import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v2 as cloudinary } from 'cloudinary';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const projectId = () =>
  process.env.FIREBASE_PROJECT_ID || 'ho-so-to-toan-2026-2027';

const JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

async function authorize(req: VercelRequest): Promise<
  | { ok: true; uid: string; email: string }
  | { ok: false; status: number; error: string }
> {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return { ok: false, status: 401, error: 'Cần đăng nhập để tải ảnh.' };
  }

  let uid = '';
  let email = '';
  let verified = false;

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId()}`,
      audience: projectId(),
    });
    if (!payload.sub) throw new Error('missing sub');
    uid = payload.sub;
    email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    verified = payload.email_verified === true;
  } catch {
    return {
      ok: false,
      status: 401,
      error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
    };
  }

  if (!verified || !email) {
    return { ok: false, status: 403, error: 'Tài khoản chưa được xác minh.' };
  }

  if (email === 'thuyetdung@gmail.com') {
    return { ok: true, uid, email };
  }

  try {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/${encodeURIComponent(process.env.FIREBASE_DATABASE_ID || '(default)')}/documents/accessIndex/${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      },
    );

    if ([401, 403, 404].includes(response.status)) {
      return { ok: false, status: 403, error: 'Tài khoản chưa được cấp quyền.' };
    }
    if (!response.ok) {
      return { ok: false, status: 503, error: 'Chưa kiểm tra được quyền truy cập.' };
    }

    const data = await response.json();
    const role = data?.fields?.role?.stringValue;
    const allowed = ['admin', 'head', 'deputy', 'teacher', 'principal'].includes(role);
    if (!allowed) {
      return { ok: false, status: 403, error: 'Tài khoản chưa được cấp quyền.' };
    }

    return { ok: true, uid, email };
  } catch {
    return { ok: false, status: 503, error: 'Chưa kiểm tra được quyền truy cập.' };
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await authorize(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { planId, imageId } = req.body ?? {};

    if (
      typeof planId !== 'string' ||
      typeof imageId !== 'string' ||
      !/^[a-zA-Z0-9_@.+\-]{1,150}$/.test(planId) ||
      !/^[a-zA-Z0-9_\-]{1,150}$/.test(imageId)
    ) {
      return res.status(400).json({ error: 'planId hoặc imageId không hợp lệ' });
    }

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return res.status(500).json({
        error: 'Cloudinary environment variables are missing',
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `ho-so-to-toan/lesson-plans/${planId}`;
    const publicId = imageId;

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
        public_id: publicId,
        overwrite: true,
      },
      process.env.CLOUDINARY_API_SECRET,
    );

    return res.status(200).json({
      timestamp,
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
      publicId,
    });
  } catch (error) {
    console.error('Cloudinary sign error:', error);
    return res.status(500).json({
      error: 'Unable to create Cloudinary signature',
    });
  }
}
