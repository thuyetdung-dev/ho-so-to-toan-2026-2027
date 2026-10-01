import {
  uploadLessonImageToCloudinary,
} from './cloudinaryImageStorage';
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  getMetadata,
  ref,
  uploadString,
  type FirebaseStorage,
} from 'firebase/storage';
import {
  collection,
  deleteField,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

export const LESSON_IMAGE_STORAGE_VERSION = 2;
export const lessonImagePath = (planId: string, imageId: string) => `lessonPlanImages/${planId}/${imageId}`;

export interface LessonImageMeta {
  planId: string;
  imageId: string;

  provider?: 'firebase' | 'cloudinary';

  // Firebase Storage cũ
  storagePath?: string;

  // Cloudinary mới
  publicId?: string;
  secureUrl?: string;

  contentType?: string;
  format?: string;
  width?: number;
  height?: number;

  bytes: number;
  createdAt: string;
  storageVersion?: number;

  migratedAt?: unknown;
  migratedBy?: string;

  /** Chỉ tồn tại ở dữ liệu Firestore kiểu cũ */
  data?: string;
}

export function dataUrlContentType(dataUrl: string): string {
  const match = /^data:([^;,]+)[;,]/i.exec(dataUrl);
  return match?.[1] || 'image/jpeg';
}

export function approximateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return new TextEncoder().encode(dataUrl).length;
  const body = dataUrl.slice(comma + 1);
  if (/;base64,/i.test(dataUrl.slice(0, comma + 1))) {
    const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor(body.length * 3 / 4) - padding);
  }
  try { return new TextEncoder().encode(decodeURIComponent(body)).length; }
  catch { return new TextEncoder().encode(body).length; }
}

export async function uploadLessonImage(
  storage: FirebaseStorage,
  planId: string,
  imageId: string,
  dataUrl: string,
  uploaderUid?: string,
): Promise<LessonImageMeta> {
  // Trên trình duyệt thật: dùng Cloudinary.
  if (typeof window !== 'undefined') {
    const uploaded = await uploadLessonImageToCloudinary(
      planId,
      imageId,
      dataUrl,
    );

    return {
      planId,
      imageId,

      provider: 'cloudinary',

      publicId: uploaded.publicId,
      secureUrl: uploaded.secureUrl,

      contentType: uploaded.contentType,
      format: uploaded.format,
      width: uploaded.width,
      height: uploaded.height,

      bytes: uploaded.bytes,
      createdAt: uploaded.createdAt,

      storageVersion: LESSON_IMAGE_STORAGE_VERSION,
    };
  }

  // Node/test: giữ luồng Firebase cũ để bộ test hiện tại tiếp tục hoạt động.
  const path = lessonImagePath(planId, imageId);
  const contentType = dataUrlContentType(dataUrl);
  const objectRef = ref(storage, path);

  await uploadString(objectRef, dataUrl, 'data_url', {
    contentType,
    cacheControl: 'private,max-age=31536000,immutable',
    customMetadata: {
      planId,
      imageId,
      app: 'so-sinh-hoat-chuyen-mon-to-toan',
      ...(uploaderUid ? { uploaderUid } : {}),
    },
  });

  const metadata = await getMetadata(objectRef);

  return {
    planId,
    imageId,

    provider: 'firebase',
    storagePath: path,

    contentType: metadata.contentType || contentType,
    bytes: metadata.size || approximateDataUrlBytes(dataUrl),
    createdAt: metadata.timeCreated || new Date().toISOString(),

    storageVersion: 1,
  };
}

export async function deleteLessonImage(storage: FirebaseStorage, storagePath: string): Promise<void> {
  await deleteObject(ref(storage, storagePath)).catch(err => {
    if ((err as {code?: string})?.code !== 'storage/object-not-found') throw err;
  });
}


/**
 * Xóa ảnh theo đúng nhà cung cấp.
 * - Cloudinary mới: gọi API server-side để API Secret không lộ ra trình duyệt.
 * - Firebase Storage cũ: tiếp tục xóa theo storagePath.
 */
export async function deleteLessonImageMeta(
  storage: FirebaseStorage,
  meta: Pick<LessonImageMeta, 'provider' | 'publicId' | 'storagePath'>,
): Promise<void> {
  if (meta.provider === 'cloudinary' || (!!meta.publicId && !meta.storagePath)) {
    if (!meta.publicId) return;

    // Node/test không gọi API tương đối của trình duyệt.
    if (typeof window === 'undefined') return;

    const { auth } = await import('../firebase');
    const user = auth.currentUser;
    if (!user) throw new Error('Bạn cần đăng nhập trước khi xóa ảnh.');
    const token = await user.getIdToken();

    const res = await fetch('/api/cloudinary-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ publicId: meta.publicId }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Xóa ảnh Cloudinary thất bại (${res.status}). ${text}`);
    }
    return;
  }

  if (meta.storagePath) {
    await deleteLessonImage(storage, meta.storagePath);
  }
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0, b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += BASE64_ALPHABET[(n >> 18) & 63] + BASE64_ALPHABET[(n >> 12) & 63]
      + (i + 1 < bytes.length ? BASE64_ALPHABET[(n >> 6) & 63] : '=')
      + (i + 2 < bytes.length ? BASE64_ALPHABET[n & 63] : '=');
  }
  return out;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || 'application/octet-stream'};base64,${bytesToBase64(bytes)}`;
}

export async function getLessonImageUrl(storage: FirebaseStorage, storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}

export async function loadLessonImageAsDataUrl(storage: FirebaseStorage, storagePath: string): Promise<string> {
  const blob = await getBlob(ref(storage, storagePath));
  return blobToDataUrl(blob);
}

/**
 * Chuyển dữ liệu ảnh kiểu cũ (base64 trong lessonPlanImages) sang Firebase Storage.
 * Idempotent: upload cùng path sẽ ghi đè cùng đối tượng, sau đó metadata Firestore được chuẩn hóa.
 */
export async function migrateLegacyLessonImages(
  db: Firestore,
  storage: FirebaseStorage,
  actorEmail: string,
  onProgress?: (done: number, total: number, message: string) => void,
): Promise<{ total: number; migrated: number; skipped: number; failed: Array<{id: string; error: string}> }> {
  const snap = await getDocs(collection(db, 'lessonPlanImages'));
  const legacy = snap.docs.filter(d => typeof d.data().data === 'string' && d.data().data.startsWith('data:image/'));
  let migrated = 0, skipped = snap.size - legacy.length;
  const failed: Array<{id: string; error: string}> = [];
  let done = 0;
  onProgress?.(0, legacy.length, legacy.length ? 'Bắt đầu chuyển ảnh...' : 'Không còn ảnh base64 trong Firestore.');
  for (const row of legacy) {
    const raw = row.data() as LessonImageMeta;
    try {
      if (!raw.planId || !raw.imageId || !raw.data) throw new Error('Metadata ảnh cũ không hợp lệ.');
      const meta = await uploadLessonImage(storage, raw.planId, raw.imageId, raw.data);
      const common = {
        provider: meta.provider,
        contentType: meta.contentType,
        bytes: meta.bytes,
        storageVersion: meta.storageVersion ?? LESSON_IMAGE_STORAGE_VERSION,
        migratedAt: serverTimestamp(),
        migratedBy: actorEmail,
        data: deleteField(),
      };

      if (meta.provider === 'cloudinary') {
        await updateDoc(doc(db, 'lessonPlanImages', row.id), {
          ...common,
          publicId: meta.publicId,
          secureUrl: meta.secureUrl,
          format: meta.format,
          width: meta.width,
          height: meta.height,
          storagePath: deleteField(),
        });
      } else {
        await updateDoc(doc(db, 'lessonPlanImages', row.id), {
          ...common,
          storagePath: meta.storagePath,
          publicId: deleteField(),
          secureUrl: deleteField(),
        });
      }
      migrated++;
    } catch (err) {
      failed.push({id: row.id, error: err instanceof Error ? err.message : String(err)});
    }
    done++;
    onProgress?.(done, legacy.length, `Đã xử lý ${done}/${legacy.length} ảnh`);
  }
  return { total: snap.size, migrated, skipped, failed };
}
