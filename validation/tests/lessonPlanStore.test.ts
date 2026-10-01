import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitLessonPlan, mergeLessonPlan, hydrateLessonPlan, checkLimits, trimHistoryToFit, bytesOf, asFullForRewrite } from '../src/services/lessonPlanStore.ts';
import type { LessonPlan } from '../src/types/index.ts';

const img = (kb: number) => 'data:image/jpeg;base64,' + 'A'.repeat(kb * 1024);
const base: LessonPlan = {
  id: 'lp-1', teacherId: 'gv-1', teacherName: 'Cô A', grade: 12, topicTitle: 'Chương I', week: 1, periodCount: 3,
  classNames: ['12A1'], title: 'Bài 1', status: 'draft', version: 2,
  objectivesKnowledge: 'Nhận biết $y\'>0$', objectivesCompetence: 'NL', objectivesQualities: 'PC', equipment: 'Máy chiếu',
  activities: [{ id: 'a1', name: 'Hoạt động 1: Mở đầu', objectives: 'o', content: 'Xem ![H](img:h1)', product: 'p', implementation: 'i' }],
  comments: [], updatedAt: '2026-09-01',
  images: { h1: img(300), h2: img(200) },
  versionHistory: [
    { version: 1, updatedAt: '2026-08-01', updatedBy: 'Cô A', changeSummary: 'Tạo', status: 'draft', dataSnapshot: { title: 'Bài 1', activities: [] } },
    { version: 2, updatedAt: '2026-08-02', updatedBy: 'Cô A', changeSummary: 'Nộp', status: 'submitted' },
  ],
};

test('lessonPlanStore: tách giáo án – phần tóm tắt nhỏ, không chứa nội dung/hình/ảnh chụp phiên bản', () => {
  const parts = splitLessonPlan(base, '2026-09-02');
  const light = parts.light as unknown as Record<string, unknown>;
  for (const k of ['objectivesKnowledge', 'equipment', 'activities', 'images', 'contentState']) assert.equal(k in light, false, k);
  assert.equal(light.storage, 'split');
  assert.deepEqual(light.activityNames, ['Hoạt động 1: Mở đầu']);
  assert.deepEqual(light.imageIds, ['h1', 'h2']);
  assert.ok(bytesOf(parts.light) < 2000, `tóm tắt ${bytesOf(parts.light)} byte`);
  assert.ok((light.imageBytes as number) > 500 * 1024);
  const hist = parts.light.versionHistory!;
  assert.equal(hist[0].dataSnapshot, undefined);
  assert.equal(hist[0].hasSnapshot, true);
  assert.equal(hist[1].hasSnapshot, false);
  assert.equal(parts.versions.length, 1);
  assert.equal(parts.versions[0].index, 0);
  assert.equal(parts.content!.activities[0].content, 'Xem ![H](img:h1)');
  assert.equal(checkLimits(parts), null);
});

test('lessonPlanStore: ghép lại đúng như ban đầu', () => {
  const parts = splitLessonPlan(base);
  const full = mergeLessonPlan({ ...parts.light, contentState: 'light' }, parts.content, parts.images);
  assert.equal(full.contentState, 'full');
  assert.equal(full.objectivesKnowledge, base.objectivesKnowledge);
  assert.deepEqual(full.activities, base.activities);
  assert.deepEqual(full.images, base.images);
});

test('lessonPlanStore: giáo án chỉ có tóm tắt thì KHÔNG ghi đè nội dung (tránh mất dữ liệu)', () => {
  const parts = splitLessonPlan(base);
  const light = hydrateLessonPlan(parts.light as unknown as Record<string, unknown>, 'lp-1');
  assert.equal(light.contentState, 'light');
  assert.equal(light.objectivesKnowledge, '');
  const again = splitLessonPlan({ ...light, status: 'submitted' });
  assert.equal(again.content, null);
  assert.deepEqual(again.images, {});
  assert.deepEqual(again.light.imageIds, ['h1', 'h2']); // giữ nguyên danh sách hình
  assert.equal(again.light.contentBytes, parts.light.contentBytes);
});

test('lessonPlanStore: bản ghi kiểu cũ được coi là đầy đủ; chuyển đổi giữ nguyên nội dung', () => {
  const legacy = hydrateLessonPlan({ ...base } as unknown as Record<string, unknown>, 'lp-1');
  assert.equal(legacy.contentState, 'full');
  const parts = splitLessonPlan(asFullForRewrite(legacy));
  assert.ok(parts.content);
  assert.equal(Object.keys(parts.images).length, 2);
});

test('lessonPlanStore: giới hạn – giáo án nhiều hình vẫn lưu được, hình quá lớn / chữ quá dài bị chặn', () => {
  const many: LessonPlan = { ...base, images: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`h${i}`, img(400)])) };
  assert.equal(checkLimits(splitLessonPlan(many)), null); // ~8 MB hình: trước đây không lưu được
  assert.match(checkLimits(splitLessonPlan({ ...base, images: { h: img(1000) } }))!, /hình quá lớn/);
  const longText = 'Tiếng Việt có dấu ở đây. '.repeat(40000);
  assert.match(checkLimits(splitLessonPlan({ ...base, objectivesKnowledge: longText }))!, /Phần chữ của giáo án quá lớn/);
});

test('lessonPlanStore: kế hoạch tổ tự bỏ nội dung phiên bản cũ nhất khi gần 1 MB', () => {
  const snap = { distribution: ['x'.repeat(200_000)] };
  const plan = { id: 'p', versionHistory: Array.from({ length: 8 }, (_, i) => ({ version: i + 1, updatedAt: '', updatedBy: '', changeSummary: '', status: 'draft' as const, dataSnapshot: snap })) };
  const trimmed = trimHistoryToFit(plan, 900_000);
  assert.ok(bytesOf(trimmed) <= 900_000);
  assert.equal(trimmed.versionHistory.length, 8); // mốc phiên bản vẫn giữ
  assert.equal(trimmed.versionHistory[0].dataSnapshot, undefined); // bỏ cũ nhất trước
  assert.ok(trimmed.versionHistory[7].dataSnapshot); // giữ mới nhất
  assert.ok(plan.versionHistory[0].dataSnapshot, 'không sửa đối tượng gốc');
});
