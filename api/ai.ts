/**
 * API Trợ lý AI – POST /api/ai
 *
 * Tệp này là một Vercel Serverless Function (Vercel tự nhận mọi tệp trong thư mục api/).
 * Máy chủ server.ts (chạy máy nhà: npm run dev / npm start) cũng dùng lại chính hàm này,
 * nên hai nơi luôn cùng một logic.
 *
 * Biến môi trường (Vercel → Project → Settings → Environment Variables):
 *   GEMINI_API_KEY   (bắt buộc)  khóa Google AI Studio
 *   GEMINI_MODEL     (tùy chọn)  mặc định gemini-2.5-flash
 *   AI_RATE_LIMIT    (tùy chọn)  số lượt / 10 phút / người, mặc định 30
 *   FIREBASE_PROJECT_ID (tùy chọn) mặc định ho-so-to-toan-2026-2027
 *
 * Tệp này cố ý KHÔNG import tệp nội bộ nào khác để Vercel đóng gói ổn định.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { GoogleGenAI } from '@google/genai';

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  on?: (event: string, cb: (chunk?: unknown) => void) => void;
}
interface Res {
  status: (code: number) => Res;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'ho-so-to-toan-2026-2027';
const WINDOW_MS = 10 * 60 * 1000;

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

const TASKS: Record<string, string> = {
  chat: 'Trả lời câu hỏi chuyên môn của giáo viên Toán THPT một cách chính xác, ngắn gọn.',
  solve: 'Giải chi tiết bài toán, trình bày từng bước theo cách giáo viên THPT Việt Nam trình bày, nêu đáp số cuối cùng rõ ràng.',
  questions:
    'Soạn câu hỏi kiểm tra theo định dạng đề thi tốt nghiệp THPT từ 2025 (trắc nghiệm 4 phương án A–D; câu Đúng/Sai 4 ý a–d; câu trả lời ngắn có đáp số tối đa 4 ký tự). Ghi rõ đáp án và lời giải ngắn cho từng câu, mức độ (Nhận biết/Thông hiểu/Vận dụng).',
  lesson:
    'Soạn gợi ý kế hoạch bài dạy theo Phụ lục IV Công văn 5512/BGDĐT-GDTrH: Mục tiêu (kiến thức, năng lực, phẩm chất), Thiết bị dạy học, Tiến trình 4 hoạt động (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng) mỗi hoạt động có a) Mục tiêu b) Nội dung c) Sản phẩm d) Tổ chức thực hiện.',
  observation:
    'Tóm tắt và hệ thống hóa ghi chép dự giờ theo hướng phân tích hoạt động học của học sinh (CV 5512): điểm mạnh, khó khăn của học sinh, đề xuất điều chỉnh. Không xếp loại giờ dạy.',
};

const SYSTEM_BASE =
  'Bạn là trợ lý chuyên môn cho Tổ Toán trường THPT tại Việt Nam, bám sát Chương trình GDPT 2018. Luôn trả lời bằng tiếng Việt. ' +
  'Viết công thức toán bằng LaTeX đặt trong $...$ (nội dòng) hoặc $$...$$ (riêng dòng). ' +
  'Nếu không chắc chắn về một dữ kiện, hãy nói rõ thay vì bịa. Không đưa thông tin cá nhân của học sinh.';

// Giới hạn tần suất theo người dùng (trên Vercel giới hạn này tính theo từng phiên bản hàm đang chạy)
const usage = new Map<string, number[]>();
function allow(uid: string): boolean {
  const limit = Number(process.env.AI_RATE_LIMIT || 30);
  const now = Date.now();
  const recent = (usage.get(uid) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= limit) return false;
  recent.push(now);
  usage.set(uid, recent);
  return true;
}

let client: GoogleGenAI | null = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

async function readBody(req: Req): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (!req.on) return {};
  const raw = await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on!('data', chunk => {
      data += String(chunk);
      if (data.length > 200_000) reject(new Error('too large'));
    });
    req.on!('end', () => resolve(data));
    req.on!('error', reject);
  });
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'GET') {
    // Kiểm tra nhanh cấu hình (không lộ khóa)
    return res.status(200).json({ ok: true, ai: Boolean(process.env.GEMINI_API_KEY) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ hỗ trợ POST' });

  // 1) Xác thực người dùng bằng Firebase ID token
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Cần đăng nhập Google để dùng Trợ lý AI.' });
  let uid: string;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    if (!payload.sub) throw new Error('missing sub');
    uid = payload.sub;
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy tải lại trang.' });
  }

  if (!allow(uid)) {
    return res.status(429).json({ error: `Bạn đã dùng quá ${process.env.AI_RATE_LIMIT || 30} lượt trong 10 phút. Vui lòng thử lại sau.` });
  }

  const ai = getClient();
  if (!ai) {
    return res.status(503).json({
      error: 'Máy chủ chưa cấu hình GEMINI_API_KEY. Quản trị viên cần thêm khóa (Vercel → Settings → Environment Variables, hoặc tệp .env.local khi chạy trên máy).',
    });
  }

  // 2) Kiểm tra dữ liệu
  const body = await readBody(req).catch(() => ({}) as Record<string, unknown>);
  const task = typeof body.task === 'string' && TASKS[body.task] ? body.task : 'chat';
  const prompt = body.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Nội dung yêu cầu trống.' });
  if (prompt.length > 12000) return res.status(400).json({ error: 'Yêu cầu quá dài (tối đa 12.000 ký tự).' });

  const history = Array.isArray(body.history)
    ? (body.history as Array<{ role?: unknown; text?: unknown }>)
        .filter(h => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
        .slice(-8)
        .map(h => ({ role: h.role as 'user' | 'model', parts: [{ text: String(h.text).slice(0, 6000) }] }))
    : [];

  // 3) Gọi Gemini
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: `${SYSTEM_BASE}\n\nNhiệm vụ: ${TASKS[task]}`,
        temperature: task === 'solve' ? 0.2 : 0.6,
        maxOutputTokens: 4096,
      },
    });
    const text = response.text || '';
    if (!text) return res.status(502).json({ error: 'AI không trả về nội dung (có thể do bộ lọc an toàn). Hãy diễn đạt lại yêu cầu.' });
    return res.status(200).json({ text, model });
  } catch (err) {
    console.error('Gemini error:', err);
    const msg = String((err as Error)?.message || '');
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
      return res.status(502).json({ error: 'Khóa GEMINI_API_KEY không hợp lệ. Hãy kiểm tra lại khóa trên Google AI Studio.' });
    }
    return res.status(502).json({ error: 'Không gọi được dịch vụ AI. Vui lòng thử lại sau.' });
  }
}
