import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

export class ImageApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export interface ImageActor { uid: string; email: string; role: string; token: string }
const projectId = () => process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const databaseId = () => process.env.FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const ID = /^[A-Za-z0-9_@.+-]{1,150}$/;
const IMAGE_ID = /^[A-Za-z0-9_-]{1,150}$/;
export function validateIds(planId: unknown, imageId: unknown): asserts planId is string {
  if (typeof planId !== 'string' || !ID.test(planId) || typeof imageId !== 'string' || !IMAGE_ID.test(imageId))
    throw new ImageApiError(400, 'Mã giáo án hoặc mã ảnh không hợp lệ.');
}
function decode(value: any): any {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v]) => [k,decode(v)]));
  return undefined;
}
/** Reads run with the caller's Firebase token: no privileged database bypass. */
export async function readImageDocument(actor: Pick<ImageActor,'token'>, collection: string, id: string): Promise<Record<string,any> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/${encodeURIComponent(databaseId())}/documents/${collection}/${encodeURIComponent(id)}`;
  let response: Response;
  try { response = await fetch(url, {headers:{Authorization:`Bearer ${actor.token}`},signal:AbortSignal.timeout(5000)}); }
  catch { throw new ImageApiError(503,'Chưa kiểm tra được quyền hồ sơ. Hãy thử lại.'); }
  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) throw new ImageApiError(403,'Không có quyền truy cập hồ sơ.');
  if (!response.ok) throw new ImageApiError(503,'Máy chủ hồ sơ chưa sẵn sàng.');
  const data = await response.json();
  return Object.fromEntries(Object.entries(data.fields || {}).map(([k,v]) => [k,decode(v)]));
}
export async function authorizeImageRequest(req: {headers: Record<string, unknown>}): Promise<ImageActor> {
  const header = req.headers.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new ImageApiError(401,'Cần đăng nhập để quản lý ảnh.');
  let payload;
  try { ({payload} = await jwtVerify(token,JWKS,{issuer:`https://securetoken.google.com/${projectId()}`,audience:projectId(),algorithms:['RS256']})); }
  catch { throw new ImageApiError(401,'Phiên đăng nhập không hợp lệ hoặc hết hạn.'); }
  if (!payload.sub || typeof payload.email !== 'string' || payload.email_verified !== true)
    throw new ImageApiError(403,'Tài khoản chưa được xác minh.');
  const email = payload.email.toLowerCase();
  const actor: ImageActor = {uid:payload.sub,email,role:'none',token};
  if (email === 'thuyetdung@gmail.com') actor.role = 'admin';
  else {
    const index = await readImageDocument(actor,'accessIndex',email);
    actor.role = index?.role || 'none';
  }
  if (!['admin','head','deputy','teacher','principal'].includes(actor.role)) throw new ImageApiError(403,'Tài khoản chưa được cấp quyền.');
  return actor;
}
export async function ownsImageTeacher(actor: ImageActor, teacherId: unknown): Promise<boolean> {
  if (typeof teacherId !== 'string' || !ID.test(teacherId)) return false;
  const member = await readImageDocument(actor,'members',teacherId);
  return typeof member?.email === 'string' && member.email.toLowerCase() === actor.email;
}
export async function authorizeImagePlan(actor: ImageActor, planId: string, options: {teacherId?:unknown;restoreSession?:unknown;deletePlan?:boolean} = {}) {
  const plan = await readImageDocument(actor,'lessonPlans',planId);
  if (options.restoreSession) {
    if (actor.role !== 'admin' || typeof options.restoreSession !== 'string') throw new ImageApiError(403,'Chỉ quản trị được phục hồi ảnh.');
    const session = await readImageDocument(actor,'restoreSessions',actor.uid);
    if (!session || session.status !== 'active' || session.sessionId !== options.restoreSession || Date.parse(session.expiresAt) <= Date.now())
      throw new ImageApiError(403,'Phiên phục hồi đã hết hạn hoặc không hợp lệ.');
    return plan;
  }
  const leader = ['admin','head','deputy'].includes(actor.role);
  if (plan) {
    if (options.deletePlan) {
      if (plan.status === 'approved' || !(['admin','head'].includes(actor.role) || actor.role === 'teacher' && plan.status === 'draft' && await ownsImageTeacher(actor,plan.teacherId)))
        throw new ImageApiError(403,'Không có quyền xóa giáo án này.');
    } else if (!['draft','returned'].includes(plan.status) || !(leader || actor.role === 'teacher' && await ownsImageTeacher(actor,plan.teacherId))) {
      throw new ImageApiError(403,'Chỉ được sửa ảnh giáo án nháp/trả lại thuộc quyền của bạn.');
    }
  } else {
    if (options.deletePlan || !(leader || actor.role === 'teacher' && await ownsImageTeacher(actor,options.teacherId)))
      throw new ImageApiError(403,'Không có quyền tạo ảnh cho giáo án này.');
  }
  return plan;
}
export function cloudinaryEnvironment() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !/^[A-Za-z0-9_-]+$/.test(cloudName) || !apiKey || !apiSecret)
    throw new ImageApiError(503,'Chưa cấu hình đầy đủ Cloudinary trên máy chủ.');
  return {cloudName,apiKey,apiSecret};
}
export const uniqueImageObject = (imageId: string) => `${imageId}--${randomUUID()}`;
export async function imageCleanupTicket(actor: ImageActor, planId: string, imageId: string, publicId: string) {
  const key = new TextEncoder().encode(cloudinaryEnvironment().apiSecret);
  return new SignJWT({planId,imageId,publicId,purpose:'lesson-image-cleanup'}).setProtectedHeader({alg:'HS256'})
    .setSubject(actor.uid).setIssuer(projectId()).setAudience('lesson-image-cleanup').setIssuedAt().setExpirationTime('30m').sign(key);
}
export async function verifyImageCleanupTicket(actor: ImageActor, ticket: unknown, publicId: unknown) {
  if (typeof ticket !== 'string' || typeof publicId !== 'string') throw new ImageApiError(403,'Thiếu xác nhận dọn ảnh.');
  try {
    const {payload} = await jwtVerify(ticket,new TextEncoder().encode(cloudinaryEnvironment().apiSecret),{algorithms:['HS256'],issuer:projectId(),audience:'lesson-image-cleanup',subject:actor.uid});
    validateIds(payload.planId,payload.imageId);
    if (payload.purpose !== 'lesson-image-cleanup' || payload.publicId !== publicId) throw Error('mismatch');
    return {planId:payload.planId as string,imageId:payload.imageId as string,publicId};
  } catch (error) {
    if (error instanceof ImageApiError && error.status === 503) throw error;
    throw new ImageApiError(403,'Xác nhận dọn ảnh sai hoặc đã hết hạn.');
  }
}
export function imageApiFailure(res: {status:(code:number)=>any}, error: unknown) {
  if (error instanceof ImageApiError) return res.status(error.status).json({error:error.message});
  console.error('Lesson image API failed:',error instanceof Error ? error.message : 'unknown');
  return res.status(500).json({error:'Không xử lý được ảnh. Hãy thử lại.'});
}
