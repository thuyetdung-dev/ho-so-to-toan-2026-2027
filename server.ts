/**
 * Máy chủ ứng dụng khi chạy trên máy/VPS: phục vụ giao diện + API Trợ lý AI (Gemini).
 * (Trên Vercel không dùng tệp này: Vercel phục vụ dist/ và chạy api/ai.ts như một hàm serverless.)
 *
 * - Chế độ phát triển (npm run dev): dùng Vite middleware (hot reload) trên cùng cổng 3000,
 *   để /api/ai hoạt động cả khi phát triển (bản cũ chạy `vite` thuần nên không có API).
 * - Chế độ chạy thật (npm run build && npm start): phục vụ thư mục dist/.
 *
 * Khóa GEMINI_API_KEY chỉ nằm ở máy chủ, không bao giờ gửi xuống trình duyệt.
 * Mọi yêu cầu AI phải kèm Firebase ID token hợp lệ (người dùng đã đăng nhập Google).
 */
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import aiHandler from './api/ai.ts';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8')) as {
  projectId: string;
};
process.env.FIREBASE_PROJECT_ID ||= firebaseConfig.projectId;

const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const PORT = Number(process.env.PORT) || 3000;

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

// ---------- Trợ lý AI: dùng chung hàm với Vercel (api/ai.ts) ----------
app.all('/api/ai', (req, res) => aiHandler(req, res));

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
