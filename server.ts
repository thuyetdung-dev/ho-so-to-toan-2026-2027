/**
 * Máy chủ ứng dụng: phục vụ giao diện + API Trợ lý AI (Gemini).
 *
 * - Chế độ phát triển (npm run dev): dùng Vite middleware (hot reload) trên cùng cổng 3000,
 *   để /api/ai hoạt động cả khi phát triển (bản cũ chạy `vite` thuần nên không có API).
 * - Chế độ chạy thật (npm run build && npm start): phục vụ thư mục dist/.
 *
 * Khóa GEMINI_API_KEY chỉ nằm ở máy chủ, không bao giờ gửi xuống trình duyệt.
 * Mọi yêu cầu AI phải kèm Firebase ID token hợp lệ (người dùng đã đăng nhập Google).
 */
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8')) as {
  projectId: string;
};

const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const AI_LIMIT_PER_WINDOW = Number(process.env.AI_RATE_LIMIT || 30);
const AI_WINDOW_MS = 10 * 60 * 1000;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

// Tiêu đề bảo mật cơ bản
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), ai: Boolean(process.env.GEMINI_API_KEY) });
});

// ---------- Xác thực Firebase ID token (không cần firebase-admin) ----------
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

interface AuthedRequest extends Request {
  user?: { uid: string; email?: string };
}

async function requireFirebaseUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Cần đăng nhập Google để dùng Trợ lý AI.' });
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${firebaseConfig.projectId}`,
      audience: firebaseConfig.projectId,
    });
    if (!payload.sub) throw new Error('missing sub');
    req.user = { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
    next();
  } catch {
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hãy tải lại trang.' });
  }
}

// ---------- Giới hạn tần suất đơn giản theo người dùng ----------
const usage = new Map<string, number[]>();
function rateLimit(req: AuthedRequest, res: Response, next: NextFunction) {
  const key = req.user?.uid || req.ip || 'anon';
  const now = Date.now();
  const recent = (usage.get(key) || []).filter(t => now - t < AI_WINDOW_MS);
  if (recent.length >= AI_LIMIT_PER_WINDOW) {
    return res.status(429).json({ error: `Bạn đã dùng quá ${AI_LIMIT_PER_WINDOW} lượt trong 10 phút. Vui lòng thử lại sau.` });
  }
  recent.push(now);
  usage.set(key, recent);
  next();
}

// ---------- Trợ lý AI ----------
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

let genai: GoogleGenAI | null = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!genai) genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return genai;
}

app.post('/api/ai', requireFirebaseUser, rateLimit, async (req: AuthedRequest, res: Response) => {
  const client = getClient();
  if (!client) {
    return res.status(503).json({ error: 'Máy chủ chưa cấu hình GEMINI_API_KEY. Quản trị viên cần thêm khóa vào tệp .env.local.' });
  }
  const { task = 'chat', prompt, history } = (req.body || {}) as {
    task?: string;
    prompt?: unknown;
    history?: Array<{ role: 'user' | 'model'; text: string }>;
  };
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Nội dung yêu cầu trống.' });
  if (prompt.length > 12000) return res.status(400).json({ error: 'Yêu cầu quá dài (tối đa 12.000 ký tự).' });

  const safeHistory = Array.isArray(history)
    ? history
        .filter(h => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
        .slice(-8)
        .map(h => ({ role: h.role, parts: [{ text: h.text.slice(0, 6000) }] }))
    : [];

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [...safeHistory, { role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: `${SYSTEM_BASE}\n\nNhiệm vụ: ${TASKS[task] || TASKS.chat}`,
        temperature: task === 'solve' ? 0.2 : 0.6,
        maxOutputTokens: 4096,
      },
    });
    const text = response.text || '';
    if (!text) return res.status(502).json({ error: 'AI không trả về nội dung (có thể do bộ lọc an toàn). Hãy diễn đạt lại yêu cầu.' });
    res.json({ text, model: GEMINI_MODEL });
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(502).json({ error: 'Không gọi được dịch vụ AI. Vui lòng thử lại sau.' });
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Không tìm thấy API' }));

async function start() {
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(__dirname, 'dist');
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

start();
