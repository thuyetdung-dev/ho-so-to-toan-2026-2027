/**
 * Lưu trữ giáo án kiểu tách (bản 2.4).
 *
 * Trước đây mỗi giáo án là MỘT bản ghi chứa cả nội dung, hình và mọi phiên bản cũ, và mỗi lần mở phần mềm
 * máy tải về toàn bộ giáo án của cả tổ. Bây giờ:
 *
 *   lessonPlans/{id}                  – phần tóm tắt (tên bài, khối, tuần, trạng thái, góp ý...) → tải khi mở phần mềm
 *   lessonPlanContent/{id}            – nội dung chữ + công thức của giáo án                     → tải khi mở giáo án đó
 *   lessonPlanImages/{id}__{mãHình}   – mỗi hình một bản ghi (≤ ~950 KB/hình)                   → tải khi mở, giữ lại trên máy
 *   lessonPlanVersions/{id}__v{n}     – nội dung các phiên bản đã nộp/duyệt                     → chỉ tải khi so sánh phiên bản
 *
 * Nhờ vậy: không còn giới hạn 1 MB cho cả giáo án, lịch sử phiên bản không làm phình giáo án,
 * và lượng dữ liệu tải khi mở phần mềm giảm hàng trăm lần.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { LessonPlan, LessonPlanActivity, PlanVersionRecord } from '../types';

/** Firestore cho tối đa 1 MiB (1.048.576 byte) mỗi bản ghi – chừa phần cho tên trường */
export const MAX_DOC_BYTES = 1_000_000;
export const MAX_IMAGE_BYTES = 950_000;
export const MAX_IMAGES_PER_PLAN = 60;

const encoder = new TextEncoder();
/** Số byte khi lưu (UTF-8) – chữ tiếng Việt có dấu chiếm 2–3 byte */
export const bytesOf = (v: unknown): number => encoder.encode(typeof v === 'string' ? v : JSON.stringify(v ?? null)).length;
export const formatBytes = (n: number) =>
  n >= 1024 * 1024 * 1024 ? `${(n / 1024 / 1024 / 1024).toFixed(2)} GB` : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n <= 0 ? "0 KB" : `${Math.max(1, Math.round(n / 1024))} KB`;

export interface LessonPlanContentDoc {
  planId: string;
  objectivesKnowledge: string;
  objectivesCompetence: string;
  objectivesQualities: string;
  equipment: string;
  activities: LessonPlanActivity[];
  imageIds: string[];
  updatedAt: string;
}
export interface LessonPlanImageDoc {
  planId: string;
  imageId: string;
  data: string;
  bytes: number;
  createdAt: string;
}
export interface LessonPlanVersionDoc {
  planId: string;
  index: number;
  version: number;
  snapshot: unknown;
  createdAt: string;
}

export const imageDocId = (planId: string, imageId: string) => `${planId}__${imageId}`;
export const versionDocId = (planId: string, index: number) => `${planId}__v${index}`;

const HEAVY_KEYS = ['objectivesKnowledge', 'objectivesCompetence', 'objectivesQualities', 'equipment', 'activities', 'images', 'contentState'] as const;

// ---------------------------------------------------------------------------
// Phần thuần (không đụng Firestore) – có kiểm thử
// ---------------------------------------------------------------------------

/** Bản ghi lessonPlans đọc về → đối tượng dùng trên màn hình */
export function hydrateLessonPlan(raw: Record<string, unknown>, id: string): LessonPlan {
  const data = raw as Partial<LessonPlan>;
  if (data.storage === 'split') {
    return {
      objectivesKnowledge: '',
      objectivesCompetence: '',
      objectivesQualities: '',
      equipment: '',
      activities: [],
      comments: [],
      ...data,
      id,
      contentState: 'light',
    } as LessonPlan;
  }
  // Giáo án lưu kiểu cũ: đã có đủ nội dung trong bản ghi
  return { comments: [], activities: [], ...data, id, contentState: 'full' } as LessonPlan;
}

export interface SplitResult {
  light: LessonPlan;
  /** null = giáo án mới có phần tóm tắt trên máy → không ghi đè nội dung */
  content: LessonPlanContentDoc | null;
  images: Record<string, string>;
  versions: LessonPlanVersionDoc[];
}

/** Tách giáo án đầy đủ thành các phần để lưu */
/** Mã các hình được nhắc trong nội dung: ![...](img:mã) */
export function referencedImageIds(texts: string[]): Set<string> {
  const out = new Set<string>();
  const re = /\(img:([A-Za-z0-9_\-]+)\)/g;
  for (const t of texts) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(t || ''))) out.add(m[1]);
  }
  return out;
}

export function splitLessonPlan(plan: LessonPlan, now = new Date().toISOString()): SplitResult {
  const isLight = plan.contentState === 'light';
  const history = plan.versionHistory || [];
  const versions: LessonPlanVersionDoc[] = [];
  history.forEach((h, index) => {
    if (h.dataSnapshot !== undefined && h.dataSnapshot !== null) {
      versions.push({ planId: plan.id, index, version: h.version, snapshot: h.dataSnapshot, createdAt: h.updatedAt || now });
    }
  });
  const lightHistory: PlanVersionRecord[] = history.map(h => {
    const { dataSnapshot, ...rest } = h;
    return { ...rest, hasSnapshot: !!(h.hasSnapshot || (dataSnapshot !== undefined && dataSnapshot !== null)) };
  });

  const light = { ...plan } as Record<string, unknown>;
  HEAVY_KEYS.forEach(k => delete light[k]);
  light.storage = 'split';
  light.versionHistory = lightHistory;
  light.versionBytes = (plan.versionBytes || 0) + versions.reduce((a, v) => a + bytesOf(v.snapshot), 0);

  if (isLight) {
    return { light: light as unknown as LessonPlan, content: null, images: {}, versions };
  }

  const images = { ...(plan.images || {}) };
  const texts = [plan.objectivesKnowledge, plan.objectivesCompetence, plan.objectivesQualities, plan.equipment,
    ...(plan.activities || []).flatMap(a => [a.objectives, a.content, a.product, a.implementation])];
  const referenced = referencedImageIds(texts);
  // Hình đã lưu nhưng lần này không tải được (mạng chập chờn) mà nội dung vẫn dùng → giữ lại, KHÔNG coi là đã xóa
  const kept = (plan.imageIds || []).filter(id => !(id in images) && referenced.has(id));
  const imageIds = [...Object.keys(images), ...kept];
  const content: LessonPlanContentDoc = {
    planId: plan.id,
    objectivesKnowledge: plan.objectivesKnowledge || '',
    objectivesCompetence: plan.objectivesCompetence || '',
    objectivesQualities: plan.objectivesQualities || '',
    equipment: plan.equipment || '',
    activities: (plan.activities || []).map(a => ({ ...a })),
    imageIds,
    updatedAt: now,
  };
  light.activityNames = content.activities.map(a => a.name);
  light.imageIds = imageIds;
  light.contentBytes = bytesOf(content);
  const avgOld = plan.imageIds?.length ? (plan.imageBytes || 0) / plan.imageIds.length : 0;
  light.imageBytes = Object.keys(images).reduce((a, id) => a + bytesOf(images[id]), 0) + Math.round(kept.length * avgOld);
  return { light: light as unknown as LessonPlan, content, images, versions };
}

/** Ghép phần tóm tắt + nội dung + hình → giáo án đầy đủ */
export function mergeLessonPlan(light: LessonPlan, content: LessonPlanContentDoc | null, images: Record<string, string>): LessonPlan {
  // Không có nội dung (chưa tải được / không tồn tại) → vẫn là "tóm tắt", để không bao giờ lưu đè nội dung rỗng
  if (!content) return { ...light, contentState: light.storage === 'split' ? 'light' : light.contentState, images };
  return {
    ...light,
    objectivesKnowledge: content.objectivesKnowledge || '',
    objectivesCompetence: content.objectivesCompetence || '',
    objectivesQualities: content.objectivesQualities || '',
    equipment: content.equipment || '',
    activities: content.activities || [],
    images,
    contentState: 'full',
  };
}

/** Kiểm tra giới hạn trước khi ghi; trả về thông báo lỗi tiếng Việt hoặc null */
export function checkLimits(parts: SplitResult): string | null {
  if (bytesOf(parts.light) > MAX_DOC_BYTES) return 'Phần thông tin chung của giáo án quá lớn (quá nhiều góp ý/phiên bản).';
  if (parts.content && bytesOf(parts.content) > MAX_DOC_BYTES) {
    return `Phần chữ của giáo án quá lớn (${formatBytes(bytesOf(parts.content))}, tối đa ${formatBytes(MAX_DOC_BYTES)}). Hãy tách thành 2 giáo án (ví dụ tiết 1–2 và tiết 3–4).`;
  }
  const ids = Object.keys(parts.images);
  if (ids.length > MAX_IMAGES_PER_PLAN) return `Giáo án có ${ids.length} hình, tối đa ${MAX_IMAGES_PER_PLAN} hình.`;
  const big = ids.find(id => bytesOf(parts.images[id]) > MAX_IMAGE_BYTES);
  if (big) return `Có hình quá lớn (${formatBytes(bytesOf(parts.images[big]))}). Hãy chèn lại hình này (phần mềm sẽ tự nén).`;
  for (const v of parts.versions) if (bytesOf(v) > MAX_DOC_BYTES) return 'Nội dung phiên bản quá lớn để lưu.';
  return null;
}

/**
 * Bỏ bớt nội dung các phiên bản CŨ NHẤT cho tới khi bản ghi vừa giới hạn
 * (dùng cho Kế hoạch tổ – vẫn lưu một bản ghi). Các mốc phiên bản vẫn giữ, chỉ mất phần so sánh chi tiết.
 */
export function trimHistoryToFit<T extends { versionHistory?: PlanVersionRecord[] }>(item: T, maxBytes = 900_000): T {
  if (bytesOf(item) <= maxBytes || !item.versionHistory?.length) return item;
  const history = item.versionHistory.map(h => ({ ...h }));
  const out = { ...item, versionHistory: history };
  for (const h of history) {
    if (bytesOf(out) <= maxBytes) break;
    if (h.dataSnapshot !== undefined) delete h.dataSnapshot;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Đọc / ghi Firestore
// ---------------------------------------------------------------------------

/**
 * Ghi giáo án. Thứ tự ghi đảm bảo không mất dữ liệu nếu mạng đứt giữa chừng:
 *  - giáo án mới: tóm tắt trước (để quy tắc bảo mật thấy giáo án tồn tại), rồi nội dung
 *  - giáo án đã có: phiên bản, hình, nội dung trước – tóm tắt ghi SAU CÙNG (ghi đè luôn bản ghi kiểu cũ)
 */
export async function writeLessonPlan(
  db: Firestore,
  plan: LessonPlan,
  opts: { isNew: boolean; prevImageIds?: string[] },
): Promise<LessonPlan> {
  const now = new Date().toISOString();
  const parts = splitLessonPlan(plan, now);
  const limitError = checkLimits(parts);
  if (limitError) throw new Error(limitError);

  const planRef = doc(db, 'lessonPlans', plan.id);
  if (opts.isNew) await setDoc(planRef, parts.light);

  for (const v of parts.versions) await setDoc(doc(db, 'lessonPlanVersions', versionDocId(plan.id, v.index)), v);

  if (parts.content) {
    const prev = new Set(opts.prevImageIds || []);
    for (const [imageId, data] of Object.entries(parts.images)) {
      if (prev.has(imageId)) continue; // hình không đổi (mã hình không bao giờ dùng lại cho hình khác)
      const img: LessonPlanImageDoc = { planId: plan.id, imageId, data, bytes: bytesOf(data), createdAt: now };
      await setDoc(doc(db, 'lessonPlanImages', imageDocId(plan.id, imageId)), img);
    }
    await setDoc(doc(db, 'lessonPlanContent', plan.id), parts.content);
    const stillUsed = new Set(parts.content.imageIds);
    for (const imageId of prev) {
      if (!stillUsed.has(imageId)) await deleteDoc(doc(db, 'lessonPlanImages', imageDocId(plan.id, imageId))).catch(() => undefined);
    }
  }

  if (!opts.isNew) await setDoc(planRef, parts.light);
  return { ...parts.light, contentState: 'light' };
}

/** Hình không bao giờ thay đổi → lấy từ bộ nhớ trên máy nếu đã có, không tải lại */
export async function loadLessonPlanImages(db: Firestore, planId: string, ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    ids.map(async id => {
      const ref = doc(db, 'lessonPlanImages', imageDocId(planId, id));
      let snap = await getDocFromCache(ref).catch(() => null);
      if (!snap || !snap.exists()) snap = await getDoc(ref).catch(() => null);
      const data = snap?.exists() ? (snap.data() as LessonPlanImageDoc).data : undefined;
      if (data) out[id] = data;
    }),
  );
  return out;
}

export function subscribeLessonPlanContent(
  db: Firestore,
  planId: string,
  onData: (content: LessonPlanContentDoc | null) => void,
  onError: (err: unknown) => void,
) {
  return onSnapshot(
    doc(db, 'lessonPlanContent', planId),
    snap => {
      // Bộ nhớ trên máy chưa có bản ghi → chờ máy chủ trả lời, không coi là "giáo án rỗng"
      if (!snap.exists() && snap.metadata?.fromCache) return;
      onData(snap.exists() ? (snap.data() as LessonPlanContentDoc) : null);
    },
    onError,
  );
}

export async function getLessonPlanContent(db: Firestore, planId: string): Promise<LessonPlanContentDoc | null> {
  const snap = await getDoc(doc(db, 'lessonPlanContent', planId));
  return snap.exists() ? (snap.data() as LessonPlanContentDoc) : null;
}

/** Lịch sử phiên bản kèm nội dung (để so sánh) */
export async function loadVersionHistory(db: Firestore, plan: LessonPlan): Promise<PlanVersionRecord[]> {
  const history = plan.versionHistory || [];
  if (!history.some(h => h.hasSnapshot && h.dataSnapshot === undefined)) return history;
  const snap = await getDocs(query(collection(db, 'lessonPlanVersions'), where('planId', '==', plan.id)));
  const byIndex = new Map<number, unknown>();
  snap.forEach(d => {
    const v = d.data() as LessonPlanVersionDoc;
    byIndex.set(v.index, v.snapshot);
  });
  return history.map((h, i) => (h.dataSnapshot === undefined && byIndex.has(i) ? { ...h, dataSnapshot: byIndex.get(i) } : h));
}

/** Xóa giáo án cùng nội dung, hình, phiên bản (bản ghi tóm tắt xóa sau cùng) */
export async function deleteLessonPlanDeep(db: Firestore, plan: LessonPlan) {
  if (plan.storage === 'split') {
    for (const id of plan.imageIds || []) await deleteDoc(doc(db, 'lessonPlanImages', imageDocId(plan.id, id))).catch(() => undefined);
    const versions = await getDocs(query(collection(db, 'lessonPlanVersions'), where('planId', '==', plan.id))).catch(() => null);
    if (versions) for (const v of versions.docs) await deleteDoc(v.ref).catch(() => undefined);
    await deleteDoc(doc(db, 'lessonPlanContent', plan.id)).catch(() => undefined);
  }
  await deleteDoc(doc(db, 'lessonPlans', plan.id));
}

/** Đọc TOÀN BỘ nội dung, hình, phiên bản (cho sao lưu) và ghép vào danh sách giáo án */
export async function loadAllLessonPlansFull(db: Firestore, plans: LessonPlan[]): Promise<LessonPlan[]> {
  if (!plans.some(p => p.contentState === 'light')) return plans;
  const [contents, images, versions] = await Promise.all([
    getDocs(collection(db, 'lessonPlanContent')),
    getDocs(collection(db, 'lessonPlanImages')),
    getDocs(collection(db, 'lessonPlanVersions')),
  ]);
  const contentBy = new Map<string, LessonPlanContentDoc>();
  contents.forEach(d => contentBy.set(d.id, d.data() as LessonPlanContentDoc));
  const imagesBy = new Map<string, Record<string, string>>();
  images.forEach(d => {
    const v = d.data() as LessonPlanImageDoc;
    if (!imagesBy.has(v.planId)) imagesBy.set(v.planId, {});
    imagesBy.get(v.planId)![v.imageId] = v.data;
  });
  const versionsBy = new Map<string, Map<number, unknown>>();
  versions.forEach(d => {
    const v = d.data() as LessonPlanVersionDoc;
    if (!versionsBy.has(v.planId)) versionsBy.set(v.planId, new Map());
    versionsBy.get(v.planId)!.set(v.index, v.snapshot);
  });
  return plans.map(p => {
    if (p.contentState !== 'light') return p;
    const full = mergeLessonPlan(p, contentBy.get(p.id) || null, imagesBy.get(p.id) || {});
    const vmap = versionsBy.get(p.id);
    return {
      ...full,
      versionHistory: (p.versionHistory || []).map((h, i) => (vmap?.has(i) ? { ...h, dataSnapshot: vmap.get(i) } : h)),
    };
  });
}

/** Chuẩn bị giáo án (từ sao lưu hoặc kiểu cũ) để ghi lại theo cách tách: coi là đầy đủ */
export const asFullForRewrite = (p: LessonPlan): LessonPlan => {
  const { storage: _s, contentState: _c, ...rest } = p;
  return { ...rest, activities: p.activities || [], contentState: 'full' } as LessonPlan;
};
