/**
 * Kiểm thử luồng lưu giáo án kiểu tách trên một Firestore GIẢ LẬP (trong bộ nhớ) có mô phỏng
 * các quy tắc bảo mật của firestore.rules cho lessonPlans / lessonPlanContent / lessonPlanImages / lessonPlanVersions.
 * Mục đích: bảo đảm thứ tự ghi hợp lệ với quy tắc, không mất dữ liệu, hình không tải lại.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { LessonPlan } from '../src/types/index.ts';

type Data = Record<string, any>;
interface Ref { db: FakeDb; col: string; id: string; path: string }
class FakeDb {
  docs = new Map<string, Data>();
  cache = new Map<string, Data>();
  role: 'teacher' | 'leader' = 'teacher';
  serverReads = 0;
  serverBytes = 0;
  imageWrites = 0;
}
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

function checkRules(db: FakeDb, ref: Ref, op: 'write' | 'delete', data?: Data) {
  const leader = db.role === 'leader';
  const plan = (id: string) => db.docs.get(`lessonPlans/${id}`);
  const canEdit = (id: string) => leader || (!!plan(id) && ['draft', 'returned'].includes(plan(id)!.status));
  const canClean = (id: string) => leader || !plan(id) || ['draft', 'returned'].includes(plan(id)!.status);
  const existing = db.docs.get(ref.path);
  switch (ref.col) {
    case 'lessonPlans':
      if (op === 'delete') return leader || existing?.status === 'draft';
      if (!existing) return leader || data!.status === 'draft';
      return leader || ['draft', 'submitted'].includes(data!.status) || data!.status === existing.status;
    case 'lessonPlanContent':
      if (op === 'delete') return canClean(ref.id);
      return data!.planId === ref.id && canEdit(ref.id);
    case 'lessonPlanImages':
      if (op === 'delete') return canClean(existing?.planId);
      return ref.id === `${data!.planId}__${data!.imageId}` && data!.data.length < 1_000_000 && canEdit(data!.planId);
    case 'lessonPlanVersions':
      if (op === 'delete') return canClean(existing?.planId);
      if (ref.id !== `${data!.planId}__v${data!.index}`) return false;
      return existing ? canEdit(data!.planId) : !!plan(data!.planId);
  }
  return false;
}

const snapOf = (db: FakeDb, ref: Ref, data: Data | undefined) => ({
  id: ref.id,
  ref,
  exists: () => data !== undefined,
  data: () => (data === undefined ? undefined : clone(data)),
});
const fake = {
  doc: (db: FakeDb, col: string, id: string): Ref => ({ db, col, id, path: `${col}/${id}` }),
  collection: (db: FakeDb, col: string) => ({ db, col }),
  where: (field: string, _op: string, value: unknown) => ({ field, value }),
  query: (c: { db: FakeDb; col: string }, w: { field: string; value: unknown }) => ({ ...c, w }),
  async setDoc(ref: Ref, data: Data) {
    if (!checkRules(ref.db, ref, 'write', data)) throw denied();
    if (ref.col === 'lessonPlanImages') ref.db.imageWrites++;
    ref.db.docs.set(ref.path, clone(data));
  },
  async deleteDoc(ref: Ref) {
    if (!ref.db.docs.has(ref.path)) return;
    if (!checkRules(ref.db, ref, 'delete')) throw denied();
    ref.db.docs.delete(ref.path);
  },
  async getDoc(ref: Ref) {
    const d = ref.db.docs.get(ref.path);
    ref.db.serverReads++;
    if (d) {
      ref.db.serverBytes += JSON.stringify(d).length;
      ref.db.cache.set(ref.path, clone(d));
    }
    return snapOf(ref.db, ref, d);
  },
  async getDocFromCache(ref: Ref) {
    const d = ref.db.cache.get(ref.path);
    if (!d) throw Object.assign(new Error('not in cache'), { code: 'unavailable' });
    return snapOf(ref.db, ref, d);
  },
  async getDocs(q: { db: FakeDb; col: string; w?: { field: string; value: unknown } }) {
    const docs = [...q.db.docs.entries()]
      .filter(([p, d]) => p.startsWith(q.col + '/') && (!q.w || d[q.w.field] === q.w.value))
      .map(([p, d]) => snapOf(q.db, fake.doc(q.db, q.col, p.slice(q.col.length + 1)), d));
    return { docs, forEach: (fn: (s: unknown) => void) => docs.forEach(fn) };
  },
  onSnapshot(ref: Ref, next: (s: unknown) => void) {
    fake.getDoc(ref).then(next);
    return () => undefined;
  },
};
mock.module('firebase/firestore', { namedExports: fake });
const store = await import('../src/services/lessonPlanStore.ts');

const img = (kb: number, c = 'A') => 'data:image/jpeg;base64,' + c.repeat(kb * 1024);
const newPlan = (): LessonPlan => ({
  id: 'lp-1', teacherId: 'gv-1', teacherName: 'Cô A', grade: 12, topicTitle: 'Chương I', week: 1, periodCount: 3,
  classNames: ['12A1'], title: 'Bài 1. Tính đơn điệu', status: 'draft', version: 1,
  objectivesKnowledge: 'Nhận biết tính đơn điệu. '.repeat(500), objectivesCompetence: 'NL', objectivesQualities: 'PC', equipment: 'Máy chiếu',
  activities: [{ id: 'a1', name: 'Hoạt động 1', objectives: 'o', content: '![H1](img:h1) ![H2](img:h2)', product: 'p', implementation: 'i' }],
  comments: [], updatedAt: '2026-09-01', images: { h1: img(150, 'A'), h2: img(150, 'B') }, contentState: 'full',
  versionHistory: [{ version: 1, updatedAt: '2026-09-01', updatedBy: 'Cô A', changeSummary: 'Khởi tạo', status: 'draft' }],
});
const lightOf = (db: FakeDb, id: string) => store.hydrateLessonPlan(db.docs.get(`lessonPlans/${id}`)!, id);

test('luồng thật: tạo → sửa → nộp → (chặn sửa khi chờ duyệt) → duyệt → so sánh phiên bản → xóa', async () => {
  const db = new FakeDb() as never as import('firebase/firestore').Firestore;
  const fdb = db as unknown as FakeDb;

  // 1. Giáo viên tạo giáo án mới có 2 hình
  await store.writeLessonPlan(db, newPlan(), { isNew: true });
  assert.ok(fdb.docs.has('lessonPlans/lp-1'));
  assert.ok(fdb.docs.has('lessonPlanContent/lp-1'));
  assert.ok(fdb.docs.has('lessonPlanImages/lp-1__h1') && fdb.docs.has('lessonPlanImages/lp-1__h2'));
  const lightDoc = fdb.docs.get('lessonPlans/lp-1')!;
  assert.equal(lightDoc.objectivesKnowledge, undefined);
  assert.ok(JSON.stringify(lightDoc).length < 2000);

  // 2. Mở giáo án (nội dung + hình), sửa: bỏ h2, thêm h3 → chỉ ghi hình mới, xóa hình bỏ
  let light = lightOf(fdb, 'lp-1');
  const content = await store.getLessonPlanContent(db, 'lp-1');
  const images = await store.loadLessonPlanImages(db, 'lp-1', content!.imageIds);
  const full = store.mergeLessonPlan(light, content, images);
  assert.equal(full.objectivesKnowledge, newPlan().objectivesKnowledge);
  assert.deepEqual(Object.keys(full.images!).sort(), ['h1', 'h2']);
  fdb.imageWrites = 0;
  const edited = { ...full, images: { h1: full.images!.h1, h3: img(100, 'C') }, activities: [{ ...full.activities[0], content: '![H1](img:h1) ![H3](img:h3)' }] };
  await store.writeLessonPlan(db, edited, { isNew: false, prevImageIds: light.imageIds });
  assert.equal(fdb.imageWrites, 1, 'chỉ ghi hình mới');
  assert.ok(!fdb.docs.has('lessonPlanImages/lp-1__h2'));
  assert.ok(fdb.docs.has('lessonPlanImages/lp-1__h3'));

  // 3. Mở lại giáo án: h1 lấy từ bộ nhớ máy, không tải lại
  const readsBefore = fdb.serverReads;
  await store.loadLessonPlanImages(db, 'lp-1', ['h1']);
  assert.equal(fdb.serverReads, readsBefore, 'hình đã có trên máy không tải lại');

  // 4. Nộp duyệt (chỉ phần tóm tắt + ảnh chụp phiên bản)
  light = lightOf(fdb, 'lp-1');
  const snap = { title: light.title, activities: edited.activities };
  await store.writeLessonPlan(db, {
    ...light, status: 'submitted', version: 2,
    versionHistory: [...light.versionHistory!, { version: 2, updatedAt: '2026-09-02', updatedBy: 'Cô A', changeSummary: 'Nộp', status: 'submitted', dataSnapshot: snap }],
  }, { isNew: false });
  assert.equal(fdb.docs.get('lessonPlans/lp-1')!.status, 'submitted');
  assert.ok(fdb.docs.has('lessonPlanVersions/lp-1__v1'));
  assert.equal(fdb.docs.get('lessonPlanContent/lp-1')!.activities[0].content, '![H1](img:h1) ![H3](img:h3)', 'nộp không làm mất nội dung');

  // 5. Giáo viên KHÔNG sửa được nội dung khi đang chờ duyệt
  light = lightOf(fdb, 'lp-1');
  await assert.rejects(
    store.writeLessonPlan(db, { ...store.mergeLessonPlan(light, content, {}), objectivesKnowledge: 'sửa lén' }, { isNew: false, prevImageIds: light.imageIds }),
    /permission/i,
  );
  assert.notEqual(fdb.docs.get('lessonPlanContent/lp-1')!.objectivesKnowledge, 'sửa lén');

  // 6. Tổ trưởng duyệt
  fdb.role = 'leader';
  light = lightOf(fdb, 'lp-1');
  await store.writeLessonPlan(db, {
    ...light, status: 'approved',
    versionHistory: [...light.versionHistory!, { version: 2, updatedAt: '2026-09-03', updatedBy: 'Tổ trưởng', changeSummary: 'Duyệt', status: 'approved', dataSnapshot: snap }],
  }, { isNew: false });
  light = lightOf(fdb, 'lp-1');
  assert.equal(light.status, 'approved');
  assert.deepEqual(light.versionHistory!.map(h => !!h.hasSnapshot), [false, true, true]);

  // 7. So sánh phiên bản: tải nội dung các phiên bản
  const hist = await store.loadVersionHistory(db, light);
  assert.deepEqual(hist[1].dataSnapshot, snap);
  assert.equal(hist[0].dataSnapshot, undefined);

  // 8. Sao lưu: ghép đủ nội dung + hình + phiên bản
  const [backup] = await store.loadAllLessonPlansFull(db, [light]);
  assert.deepEqual(Object.keys(backup.images!).sort(), ['h1', 'h3']);
  assert.deepEqual(backup.versionHistory![2].dataSnapshot, snap);

  // 9. Xóa: xóa sạch nội dung, hình, phiên bản
  await store.deleteLessonPlanDeep(db, light);
  assert.equal([...fdb.docs.keys()].filter(k => k.includes('lp-1')).length, 0);
});

test('luồng thật: giáo viên xóa bản nháp của mình; không xóa được giáo án đã duyệt', async () => {
  const db = new FakeDb() as never as import('firebase/firestore').Firestore;
  const fdb = db as unknown as FakeDb;
  await store.writeLessonPlan(db, newPlan(), { isNew: true });
  await store.deleteLessonPlanDeep(db, lightOf(fdb, 'lp-1'));
  assert.equal(fdb.docs.size, 0);

  await store.writeLessonPlan(db, newPlan(), { isNew: true });
  fdb.role = 'leader';
  await store.writeLessonPlan(db, { ...lightOf(fdb, 'lp-1'), status: 'approved' }, { isNew: false });
  fdb.role = 'teacher';
  await assert.rejects(store.deleteLessonPlanDeep(db, lightOf(fdb, 'lp-1')), /permission/i);
  assert.ok(fdb.docs.has('lessonPlans/lp-1'));
});

test('chuyển giáo án kiểu cũ (một bản ghi chứa tất cả) sang cách lưu mới', async () => {
  const db = new FakeDb() as never as import('firebase/firestore').Firestore;
  const fdb = db as unknown as FakeDb;
  const { contentState: _c, ...legacyData } = newPlan();
  legacyData.status = 'approved';
  legacyData.versionHistory = [
    { version: 1, updatedAt: 'x', updatedBy: 'Cô A', changeSummary: 'Nộp', status: 'submitted', dataSnapshot: { title: 'cũ', activities: [] } },
  ];
  fdb.docs.set('lessonPlans/lp-1', clone(legacyData));
  const legacy = store.hydrateLessonPlan(fdb.docs.get('lessonPlans/lp-1')!, 'lp-1');
  assert.equal(legacy.contentState, 'full');
  const before = JSON.stringify(fdb.docs.get('lessonPlans/lp-1')).length;

  fdb.role = 'leader';
  await store.writeLessonPlan(db, store.asFullForRewrite(legacy), { isNew: false });
  const after = fdb.docs.get('lessonPlans/lp-1')!;
  assert.equal(after.storage, 'split');
  assert.equal(after.images, undefined);
  assert.ok(JSON.stringify(after).length * 100 < before, `tóm tắt nhỏ hơn >100 lần (${before} → ${JSON.stringify(after).length})`);
  const full = store.mergeLessonPlan(
    lightOf(fdb, 'lp-1'),
    await store.getLessonPlanContent(db, 'lp-1'),
    await store.loadLessonPlanImages(db, 'lp-1', after.imageIds),
  );
  assert.equal(full.objectivesKnowledge, legacyData.objectivesKnowledge);
  assert.deepEqual(full.images, legacyData.images);
  assert.deepEqual((await store.loadVersionHistory(db, lightOf(fdb, 'lp-1')))[0].dataSnapshot, { title: 'cũ', activities: [] });
});

test('dung lượng tải khi mở phần mềm: 400 giáo án (chữ ~60 KB + 4 hình ~150 KB)', () => {
  const plan = { ...newPlan(), objectivesKnowledge: 'Nội dung giáo án tiếng Việt. '.repeat(1600) };
  plan.images = { h1: img(150, 'A'), h2: img(150, 'B'), h3: img(150, 'C'), h4: img(150, 'D') };
  const legacyBytes = store.bytesOf(plan);
  const lightBytes = store.bytesOf(store.splitLessonPlan(plan).light);
  const oldMB = (legacyBytes * 400) / 1024 / 1024;
  const newKB = (lightBytes * 400) / 1024;
  console.log(`    Mỗi lần mở phần mềm: trước ≈ ${oldMB.toFixed(0)} MB, bây giờ ≈ ${newKB.toFixed(0)} KB`);
  assert.ok(oldMB > 200 && newKB < 1000);
});

test('mạng chập chờn: hình chưa tải được KHÔNG bị xóa khi lưu; nội dung chưa tải được KHÔNG bị ghi đè rỗng', async () => {
  const db = new FakeDb() as never as import('firebase/firestore').Firestore;
  const fdb = db as unknown as FakeDb;
  await store.writeLessonPlan(db, newPlan(), { isNew: true });
  const light = lightOf(fdb, 'lp-1');
  const content = await store.getLessonPlanContent(db, 'lp-1');

  // h2 không tải được → giáo viên sửa chữ rồi lưu
  const partial = store.mergeLessonPlan(light, content, { h1: (await store.loadLessonPlanImages(db, 'lp-1', ['h1'])).h1 });
  await store.writeLessonPlan(db, { ...partial, objectivesCompetence: 'NL mới' }, { isNew: false, prevImageIds: light.imageIds });
  assert.ok(fdb.docs.has('lessonPlanImages/lp-1__h2'), 'hình h2 vẫn còn');
  assert.deepEqual(fdb.docs.get('lessonPlanContent/lp-1')!.imageIds.sort(), ['h1', 'h2']);

  // Xóa thật tham chiếu h2 khỏi nội dung → lúc đó mới xóa hình
  const now = store.mergeLessonPlan(lightOf(fdb, 'lp-1'), await store.getLessonPlanContent(db, 'lp-1'), { h1: 'x' });
  await store.writeLessonPlan(db, { ...now, activities: [{ ...now.activities[0], content: '![H1](img:h1)' }] }, { isNew: false, prevImageIds: ['h1', 'h2'] });
  assert.ok(!fdb.docs.has('lessonPlanImages/lp-1__h2'));

  // Không tải được nội dung → ghép ra vẫn là "tóm tắt" → lưu không đụng tới nội dung
  const noContent = store.mergeLessonPlan(lightOf(fdb, 'lp-1'), null, {});
  assert.equal(noContent.contentState, 'light');
  const before = JSON.stringify(fdb.docs.get('lessonPlanContent/lp-1'));
  await store.writeLessonPlan(db, { ...noContent, comments: [{ id: 'c', authorId: 'x', authorName: 'x', sectionId: 's', content: 'góp ý', isResolved: false, createdAt: '' }] }, { isNew: false });
  assert.equal(JSON.stringify(fdb.docs.get('lessonPlanContent/lp-1')), before);
});

test('nộp lại sau khi mất mạng giữa chừng: ghi đè phiên bản khi còn nháp được, sau khi duyệt thì không', async () => {
  const db = new FakeDb() as never as import('firebase/firestore').Firestore;
  const fdb = db as unknown as FakeDb;
  await store.writeLessonPlan(db, newPlan(), { isNew: true });
  const light = lightOf(fdb, 'lp-1');
  const entry = { version: 2, updatedAt: 'x', updatedBy: 'Cô A', changeSummary: 'Nộp', status: 'submitted' as const, dataSnapshot: { title: 'a', activities: [] } };
  // lần 1: ghi được phiên bản rồi mất mạng (giả lập bằng cách chỉ ghi phiên bản)
  fdb.docs.set('lessonPlanVersions/lp-1__v1', { planId: 'lp-1', index: 1, version: 2, snapshot: {}, createdAt: 'x' });
  // lần 2: nộp lại thành công (ghi đè phiên bản vì giáo án còn nháp)
  await store.writeLessonPlan(db, { ...light, status: 'submitted', versionHistory: [...light.versionHistory!, entry] }, { isNew: false });
  assert.equal(fdb.docs.get('lessonPlans/lp-1')!.status, 'submitted');
  // sau khi đã nộp, giáo viên không ghi đè được phiên bản cũ
  await assert.rejects(
    store.writeLessonPlan(db, { ...lightOf(fdb, 'lp-1'), versionHistory: [light.versionHistory![0], { ...entry, dataSnapshot: { title: 'sửa lịch sử', activities: [] } }] }, { isNew: false }),
    /permission/i,
  );
});
