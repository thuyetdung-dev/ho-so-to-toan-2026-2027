/**
 * Gọi Google Gemini TRỰC TIẾP từ trình duyệt bằng khóa API của chính giáo viên.
 *  - Khóa chỉ lưu trong trình duyệt (localStorage nếu "Ghi nhớ trên máy này", ngược lại sessionStorage),
 *    không lưu vào dữ liệu phần mềm, không gửi về máy chủ phần mềm.
 *  - "Dò": đọc danh sách mô hình mà khóa được dùng → chọn tự động mô hình tốt nhất còn hoạt động.
 *  - Nếu mô hình hết lượt / không có quyền / ngừng hoạt động → tự thử mô hình kế tiếp.
 *  - Không có khóa riêng → dùng máy chủ /api/ai (nếu quản trị viên đã cài GEMINI_API_KEY trên Vercel).
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const KEY_STORE = 'gemini_api_key';
const MODEL_STORE = 'gemini_model';
const LIST_STORE = 'gemini_models';

export type AiTask = 'chat' | 'solve' | 'questions' | 'lesson' | 'latex' | 'observation';

export const AI_TASK_PROMPTS: Record<AiTask, string> = {
  chat: 'Trả lời câu hỏi chuyên môn của giáo viên Toán THPT một cách chính xác, ngắn gọn.',
  solve: 'Giải chi tiết bài toán, trình bày từng bước theo cách giáo viên THPT Việt Nam trình bày, nêu đáp số cuối cùng rõ ràng.',
  questions:
    'Soạn câu hỏi kiểm tra theo định dạng đề thi tốt nghiệp THPT từ 2025 (trắc nghiệm 4 phương án A–D; câu Đúng/Sai 4 ý a–d; câu trả lời ngắn có đáp số tối đa 4 ký tự). Ghi rõ đáp án và lời giải ngắn cho từng câu, mức độ (Nhận biết/Thông hiểu/Vận dụng).',
  lesson:
    'Soạn gợi ý kế hoạch bài dạy theo Phụ lục IV Công văn 5512/BGDĐT-GDTrH: Mục tiêu (kiến thức, năng lực, phẩm chất), Thiết bị dạy học, Tiến trình 4 hoạt động (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng) mỗi hoạt động có a) Mục tiêu b) Nội dung c) Sản phẩm d) Tổ chức thực hiện.',
  latex:
    'Bạn là công cụ sửa công thức LaTeX cho KaTeX. Nhận một công thức bị lỗi cú pháp (thường do chép từ Word) cùng câu văn xung quanh. Hãy trả về DUY NHẤT công thức LaTeX đã sửa, đúng cú pháp KaTeX, giữ nguyên ý nghĩa toán học, không thêm dấu $, không giải thích, không dùng khối mã.',
  observation:
    'Tóm tắt và hệ thống hóa ghi chép dự giờ theo hướng phân tích hoạt động học của học sinh (CV 5512): điểm mạnh, khó khăn của học sinh, đề xuất điều chỉnh. Không xếp loại giờ dạy.',
};

const SYSTEM_BASE =
  'Bạn là trợ lý chuyên môn cho Tổ Toán trường THPT tại Việt Nam, bám sát Chương trình GDPT 2018. Luôn trả lời bằng tiếng Việt. ' +
  'Viết công thức toán bằng LaTeX đặt trong $...$ (nội dòng) hoặc $$...$$ (riêng dòng). ' +
  'Nếu không chắc chắn về một dữ kiện, hãy nói rõ thay vì bịa. Không đưa thông tin cá nhân của học sinh.';

/** Dùng khi chưa bấm "Dò": các mô hình ổn định hiện hành (Gemini 2.0 đã ngừng, 2.5 bị giới hạn truy cập) */
export const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

// ---------------------------------------------------------------------------
// Lưu khóa / mô hình trong trình duyệt
// ---------------------------------------------------------------------------
const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export function getStoredKey(): string {
  return safe(() => localStorage.getItem(KEY_STORE) || sessionStorage.getItem(KEY_STORE) || '', '');
}
export function isKeyRemembered(): boolean {
  return safe(() => !!localStorage.getItem(KEY_STORE), false);
}
export function setStoredKey(key: string, remember: boolean) {
  const k = key.trim();
  safe(() => {
    localStorage.removeItem(KEY_STORE);
    sessionStorage.removeItem(KEY_STORE);
    if (k) (remember ? localStorage : sessionStorage).setItem(KEY_STORE, k);
  }, undefined);
}
/** Xóa khóa và danh sách mô hình (nút "Xóa", và khi đăng xuất) */
export function clearStoredKey() {
  safe(() => {
    [localStorage, sessionStorage].forEach(s => {
      s.removeItem(KEY_STORE);
      s.removeItem(LIST_STORE);
    });
  }, undefined);
}
export function getStoredModel(): string {
  return safe(() => localStorage.getItem(MODEL_STORE) || 'auto', 'auto');
}
export function setStoredModel(model: string) {
  safe(() => localStorage.setItem(MODEL_STORE, model || 'auto'), undefined);
}
export function getStoredModelList(): GeminiModel[] {
  return safe(() => JSON.parse(localStorage.getItem(LIST_STORE) || sessionStorage.getItem(LIST_STORE) || '[]') as GeminiModel[], []);
}
function setStoredModelList(list: GeminiModel[], remember: boolean) {
  safe(() => (remember ? localStorage : sessionStorage).setItem(LIST_STORE, JSON.stringify(list)), undefined);
}

// ---------------------------------------------------------------------------
// Mô hình
// ---------------------------------------------------------------------------
export interface GeminiModel {
  id: string;
  label: string;
}

const NOT_TEXT = /embedding|aqa|tts|image|imagen|live|audio|transcribe|translate|omni|robotics|computer-use|deep-research|antigravity|veo|lyria|learnlm|gemma/;

/** Điểm xếp hạng để "Tự động chọn": bản ổn định trước bản thử nghiệm; Flash (nhanh, gói miễn phí rộng) → Pro → Flash-Lite; phiên bản mới trước */
export function modelScore(id: string): number {
  const v = id.match(/gemini-(\d+)(?:\.(\d+))?/);
  const version = v ? Number(v[1]) + Number(v[2] || 0) / 10 : 0;
  const preview = /preview|exp|experimental/.test(id) ? 1 : 0;
  const family = /flash-lite/.test(id) ? 2 : /flash/.test(id) ? 0 : /pro/.test(id) ? 1 : 3;
  return (1 - preview) * 1000 + (3 - family) * 100 + version;
}
export const rankModels = (ids: string[]) => [...new Set(ids)].sort((a, b) => modelScore(b) - modelScore(a));

/** Chuyển lỗi của Gemini thành câu tiếng Việt; retry = nên thử mô hình khác */
function describe(status: number, body: { error?: { message?: string; status?: string; details?: { reason?: string }[] } }): { message: string; retry: boolean } {
  const msg = body?.error?.message || '';
  const reason = body?.error?.details?.map(d => d.reason).join(' ') || body?.error?.status || '';
  if (/API_KEY_INVALID|API key not valid/i.test(reason + msg)) return { message: 'Khóa API không hợp lệ. Hãy kiểm tra lại khóa (lấy tại aistudio.google.com → Get API key).', retry: false };
  if (status === 403 && /SERVICE_DISABLED|has not been used|disabled/i.test(msg)) return { message: 'Khóa chưa được bật Gemini API. Vào aistudio.google.com tạo khóa mới rồi dán lại.', retry: false };
  if (status === 429) return { message: 'Mô hình này đã hết lượt dùng miễn phí trong hôm nay/phút này.', retry: true };
  if (status === 404) return { message: 'Mô hình không tồn tại hoặc đã ngừng hoạt động.', retry: true };
  if (status === 403) return { message: 'Khóa không có quyền dùng mô hình này.', retry: true };
  if (status >= 500) return { message: 'Máy chủ Gemini đang bận, thử lại sau ít phút.', retry: true };
  if (/location is not supported|User location/i.test(msg)) return { message: 'Gemini chưa hỗ trợ khu vực mạng hiện tại.', retry: false };
  return { message: msg || `Lỗi Gemini (${status})`, retry: false };
}

/** "Dò": kiểm tra khóa và đọc danh sách mô hình tạo văn bản mà khóa được dùng */
export async function probeModels(key: string, remember = true): Promise<GeminiModel[]> {
  const out: GeminiModel[] = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const res = await fetch(`${BASE}/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, {
      headers: { 'x-goog-api-key': key.trim() },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(describe(res.status, body).message);
    for (const m of (body.models || []) as { name: string; displayName?: string; supportedGenerationMethods?: string[] }[]) {
      const id = m.name.replace(/^models\//, '');
      if (!/^gemini-/.test(id) || NOT_TEXT.test(id)) continue;
      if (!(m.supportedGenerationMethods || []).includes('generateContent')) continue;
      out.push({ id, label: m.displayName ? `${m.displayName} (${id})` : id });
    }
    pageToken = body.nextPageToken || '';
    if (!pageToken) break;
  }
  const order = rankModels(out.map(m => m.id));
  const sorted = order.map(id => out.find(m => m.id === id)!);
  setStoredModelList(sorted, remember);
  return sorted;
}

export interface AskInput {
  task: AiTask;
  prompt: string;
  history?: { role: 'user' | 'model'; text: string }[];
}
export interface AskResult {
  text: string;
  model: string;
  via: 'browser' | 'server';
}

/** Danh sách mô hình sẽ thử, theo thứ tự */
export function candidateModels(): string[] {
  const chosen = getStoredModel();
  const known = getStoredModelList().map(m => m.id);
  const auto = known.length ? rankModels(known).filter(id => !/preview|exp/.test(id)).concat(rankModels(known).filter(id => /preview|exp/.test(id))) : FALLBACK_MODELS;
  return chosen && chosen !== 'auto' ? [chosen, ...auto.filter(m => m !== chosen)] : auto;
}

async function askBrowser(key: string, input: AskInput): Promise<AskResult> {
  const contents = [
    ...(input.history || []).slice(-8).map(h => ({ role: h.role, parts: [{ text: h.text.slice(0, 6000) }] })),
    { role: 'user', parts: [{ text: input.prompt.slice(0, 12000) }] },
  ];
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: `${SYSTEM_BASE}\n\nNhiệm vụ: ${AI_TASK_PROMPTS[input.task]}` }] },
    contents,
    generationConfig: { temperature: input.task === 'solve' || input.task === 'latex' ? 0.1 : 0.6 },
  });
  const tried: string[] = [];
  let lastError = '';
  for (const model of candidateModels().slice(0, 4)) {
    const res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('').trim();
      if (!text) {
        const blocked = data.promptFeedback?.blockReason || cand?.finishReason;
        throw new Error(blocked === 'SAFETY' ? 'Gemini từ chối trả lời yêu cầu này (bộ lọc an toàn).' : 'Gemini không trả về nội dung. Hãy diễn đạt lại yêu cầu.');
      }
      return { text, model, via: 'browser' };
    }
    const err = describe(res.status, data);
    tried.push(model);
    lastError = err.message;
    if (!err.retry) throw new Error(err.message);
  }
  throw new Error(`${lastError} Đã thử: ${tried.join(', ')}. Bấm "Dò" để xem các mô hình khóa này dùng được, hoặc chờ ít phút rồi thử lại.`);
}

/** Máy chủ phần mềm (/api/ai) có khóa của tổ không? */
export async function serverAiAvailable(): Promise<boolean> {
  try {
    const r = await fetch('/api/ai');
    if (!r.ok) return false;
    const d = await r.json();
    return Boolean(d.ai);
  } catch {
    return false;
  }
}

/**
 * Hỏi AI: có khóa riêng → gọi thẳng Gemini từ trình duyệt; không có → qua máy chủ phần mềm (cần đăng nhập).
 */
export async function askAI(input: AskInput, getIdToken?: () => Promise<string>): Promise<AskResult> {
  const key = getStoredKey();
  if (key) return askBrowser(key, input);
  if (!getIdToken) throw new Error('Chưa có khóa Gemini. Hãy dán khóa API ở mục "Khóa API Google Gemini" (trang Trợ lý AI).');
  const token = await getIdToken();
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ task: input.task, prompt: input.prompt, history: input.history || [] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404 || res.status === 503) throw new Error('Chưa có khóa Gemini. Hãy dán khóa API ở mục "Khóa API Google Gemini" (trang Trợ lý AI).');
    throw new Error(data.error || `Lỗi máy chủ (${res.status})`);
  }
  return { text: String(data.text || ''), model: String(data.model || ''), via: 'server' };
}
