export interface CloudinaryLessonImageMeta {
  planId: string;
  imageId: string;

  provider: 'cloudinary';
  publicId: string;
  secureUrl: string;

  contentType?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes: number;

  createdAt: string;
  storageVersion: 2;
}

interface CloudinarySignatureResponse {
  timestamp: number;
  signature: string;
  cloudName: string;
  apiKey: string;
  folder: string;
  publicId: string;
}

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  bytes: number;
  format?: string;
  width?: number;
  height?: number;
  resource_type?: string;
  created_at?: string;
}

function dataUrlContentType(dataUrl: string): string {
  const match = /^data:([^;,]+)[;,]/i.exec(dataUrl);
  return match?.[1] || 'image/jpeg';
}

export async function uploadLessonImageToCloudinary(
  planId: string,
  imageId: string,
  dataUrl: string,
): Promise<CloudinaryLessonImageMeta> {
  const { auth } = await import('../firebase');
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Bạn cần đăng nhập trước khi tải ảnh.');
  }
  const token = await user.getIdToken();

  const signRes = await fetch('/api/cloudinary-sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      planId,
      imageId,
    }),
  });

  if (!signRes.ok) {
    const text = await signRes.text().catch(() => '');
    throw new Error(
      `Không tạo được chữ ký Cloudinary (${signRes.status}). ${text}`
    );
  }

  const signed = (await signRes.json()) as CloudinarySignatureResponse;

  const form = new FormData();
  form.append('file', dataUrl);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  form.append('folder', signed.folder);
  form.append('public_id', signed.publicId);
  form.append('overwrite', 'true');

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
    {
      method: 'POST',
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(
      `Upload Cloudinary thất bại (${uploadRes.status}). ${text}`
    );
  }

  const uploaded = (await uploadRes.json()) as CloudinaryUploadResponse;

  if (!uploaded.public_id || !uploaded.secure_url) {
    throw new Error('Cloudinary không trả về public_id hoặc secure_url.');
  }

  return {
    planId,
    imageId,

    provider: 'cloudinary',
    publicId: uploaded.public_id,
    secureUrl: uploaded.secure_url,

    contentType: dataUrlContentType(dataUrl),
    format: uploaded.format,
    width: uploaded.width,
    height: uploaded.height,
    bytes: uploaded.bytes || 0,

    createdAt: uploaded.created_at || new Date().toISOString(),
    storageVersion: 2,
  };
}

export function getCloudinaryLessonImageUrl(
  meta: CloudinaryLessonImageMeta
): string {
  return meta.secureUrl;
}