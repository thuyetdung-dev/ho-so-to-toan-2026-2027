import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v2 as cloudinary } from 'cloudinary';
import { ImageApiError, readImageDocument, authorizeImageRequest, authorizeImagePlan, validateIds, cloudinaryEnvironment, uniqueImageObject, imageCleanupTicket, imageApiFailure } from '../server/lessonImageAccess.ts';
export default async function handler(req: VercelRequest,res: VercelResponse) {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'POST') return res.status(405).json({error:'Chỉ chấp nhận POST.'});
  try {
    const actor = await authorizeImageRequest(req);
    const {planId,imageId,teacherId,restoreSession} = req.body || {};
    validateIds(planId,imageId);
    await authorizeImagePlan(actor,planId,{teacherId,restoreSession});
    const existing = await readImageDocument(actor,'lessonPlanImages',`${planId}__${imageId}`);
    if (existing && !restoreSession && typeof existing.data !== 'string')
      throw new ImageApiError(409,'Mã ảnh đã được sử dụng. Hãy tạo mã ảnh mới để giữ nguyên các phiên bản cũ.');
    const {cloudName,apiKey,apiSecret} = cloudinaryEnvironment();
    const timestamp = Math.floor(Date.now()/1000);
    const folder = `ho-so-to-toan/lesson-plans/${planId}`;
    // Every object is immutable; an old signature cannot overwrite an approved image.
    const publicId = uniqueImageObject(imageId);
    const params = {timestamp,folder,public_id:publicId,overwrite:false};
    const signature = cloudinary.utils.api_sign_request(params,apiSecret);
    const cleanupToken = await imageCleanupTicket(actor,planId,imageId,`${folder}/${publicId}`);
    return res.status(200).json({timestamp,signature,cloudName,apiKey,folder,publicId,overwrite:false,cleanupToken});
  } catch (error) { return imageApiFailure(res,error); }
}
