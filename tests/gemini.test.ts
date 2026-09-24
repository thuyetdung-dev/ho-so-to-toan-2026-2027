import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Bộ nhớ trình duyệt giả lập
class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}
Object.assign(globalThis, { localStorage: new MemStore(), sessionStorage: new MemStore() });
const g = await import('../src/services/gemini.ts');

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
const reply = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body }) as Response;
const mockFetch = (fn: (url: string, init?: RequestInit) => Response) => {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return fn(url, init);
  }) as typeof fetch;
};
beforeEach(() => {
  calls = [];
  g.clearStoredKey();
  g.setStoredModel('auto');
});

const MODELS = {
  models: [
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
    { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash-Lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.1-flash-image', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.8-live', supportedGenerationMethods: ['bidiGenerateContent'] },
    { name: 'models/gemini-embedding-2-preview', supportedGenerationMethods: ['embedContent'] },
  ],
};

test('gemini: xếp hạng "Tự động" – Flash ổn định mới nhất trước, bản preview sau cùng', () => {
  assert.deepEqual(g.rankModels(['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash']), [
    'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview',
  ]);
});

test('gemini: "Dò" chỉ lấy mô hình tạo văn bản, khóa gửi qua header (không nằm trong URL)', async () => {
  mockFetch(() => reply(200, MODELS));
  const list = await g.probeModels('AIzaTEST');
  assert.deepEqual(list.map(m => m.id), ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview']);
  assert.ok(!calls[0].url.includes('AIzaTEST'));
  assert.equal((calls[0].init!.headers as Record<string, string>)['x-goog-api-key'], 'AIzaTEST');
});

test('gemini: mô hình hết lượt (429) → tự chuyển mô hình kế tiếp', async () => {
  g.setStoredKey('AIzaTEST', true);
  mockFetch(() => reply(200, MODELS));
  await g.probeModels('AIzaTEST');
  calls = [];
  mockFetch(url =>
    url.includes('gemini-3.8-flash')
      ? reply(429, { error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } })
      : reply(200, { candidates: [{ content: { parts: [{ text: 'Đáp số: $x=2$' }] } }] }),
  );
  const r = await g.askAI({ task: 'solve', prompt: 'Giải $2x=4$' });
  assert.equal(r.text, 'Đáp số: $x=2$');
  assert.equal(r.model, 'gemini-3.5-flash');
  assert.equal(r.via, 'browser');
  assert.equal(calls.length, 2);
  const body = JSON.parse(String(calls[1].init!.body));
  assert.match(body.systemInstruction.parts[0].text, /Giải chi tiết bài toán/);
  assert.equal(body.generationConfig.temperature, 0.1);
});

test('gemini: khóa sai → báo tiếng Việt, không thử tiếp', async () => {
  g.setStoredKey('sai', true);
  mockFetch(() => reply(400, { error: { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }));
  await assert.rejects(g.askAI({ task: 'chat', prompt: 'x' }), /Khóa API không hợp lệ/);
  assert.equal(calls.length, 1);
});

test('gemini: người dùng chọn mô hình cụ thể → thử mô hình đó trước', async () => {
  g.setStoredKey('AIzaTEST', true);
  g.setStoredModel('gemini-2.5-flash');
  mockFetch(() => reply(200, { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
  const r = await g.askAI({ task: 'chat', prompt: 'x' });
  assert.equal(r.model, 'gemini-2.5-flash');
});

test('gemini: không có khóa riêng → dùng máy chủ của tổ (cần đăng nhập); xóa khóa khi bấm Xóa', async () => {
  mockFetch(() => reply(200, { text: 'từ máy chủ', model: 'gemini-3.5-flash' }));
  const r = await g.askAI({ task: 'chat', prompt: 'x' }, async () => 'token');
  assert.equal(r.via, 'server');
  assert.equal(calls[0].url, '/api/ai');
  await assert.rejects(g.askAI({ task: 'chat', prompt: 'x' }), /dán khóa API/);
  g.setStoredKey('AIzaTEST', false);
  assert.equal(g.getStoredKey(), 'AIzaTEST');
  assert.equal(g.isKeyRemembered(), false); // chỉ trong phiên (sessionStorage)
  g.clearStoredKey();
  assert.equal(g.getStoredKey(), '');
});
