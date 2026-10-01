import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HK1_WEEKS,
  emptySection,
  linePeriods,
  migrateLegacySections,
  normalizeSection,
  weekNumber,
  withSections,
  workload,
} from '../src/utils/teacherPlanSections.ts';
import type { PlanCoreLine, PlanTopicLine, TeacherPlan, TeacherPlanSection } from '../src/types/index.ts';

const core = (week: string, periods: string, content = 'Bài học', periodCount = 0): PlanCoreLine => ({
  id: `c-${week}-${periods}`,
  order: 1,
  week,
  periods,
  periodCount,
  content,
  requirements: '',
  digitalAi: '',
});

const topic = (week: string, periods: string): PlanTopicLine => ({
  id: `t-${week}`,
  order: 1,
  week,
  periods,
  periodCount: 0,
  content: 'Chuyên đề',
  requirements: '',
});

test('đọc số tuần từ ô "Tuần" dù viết kiểu nào', () => {
  assert.equal(weekNumber('1'), 1);
  assert.equal(weekNumber('Tuần 12'), 12);
  assert.equal(weekNumber('3 (21/09 – 26/09)'), 3);
  assert.equal(weekNumber(''), 0);
});

test('suy ra số tiết từ ô "Tiết PPCT" để khỏi gõ lại cột số tiết', () => {
  assert.equal(linePeriods({ periods: '1-3' }), 3);
  assert.equal(linePeriods({ periods: '4–6' }), 3, 'phải nhận cả gạch ngang dài');
  assert.equal(linePeriods({ periods: '7' }), 1);
  assert.equal(linePeriods({ periods: '' }), 0);
  // periodCount đã nhập thì ưu tiên, không suy ra nữa
  assert.equal(linePeriods({ periods: '1-3', periodCount: 2 }), 2);
});

test('khoảng tiết ghi ngược thì tính 0 chứ không ra số âm', () => {
  assert.equal(linePeriods({ periods: '9-3' }), 0);
});

test('tổng hợp thời lượng tách đúng học kỳ theo số tuần', () => {
  const s: TeacherPlanSection = {
    ...emptySection(1, 'core', 10),
    hk1Weeks: 18,
    coreLines: [core('1', '1-3'), core('18', '52-54'), core('19', '55-57'), core('35', '103-105')],
    topicLines: [topic('1', '1'), topic('19', '19')],
  };
  const rows = workload(s);
  const coreRow = rows.find(r => r.label === 'Nội dung cốt lõi');
  assert.deepEqual({ hk1: coreRow?.hk1, hk2: coreRow?.hk2, year: coreRow?.year }, { hk1: 6, hk2: 6, year: 12 });

  const topicRow = rows.find(r => r.label === 'Chuyên đề học tập lựa chọn');
  assert.deepEqual({ hk1: topicRow?.hk1, hk2: topicRow?.hk2 }, { hk1: 1, hk2: 1 });

  const total = rows.find(r => r.label === 'Tổng thời lượng nếu học chuyên đề');
  assert.equal(total?.year, 14, 'dòng tổng phải bằng cốt lõi cộng chuyên đề');
});

test('không có chuyên đề thì bảng tổng hợp chỉ một dòng', () => {
  const s = { ...emptySection(1, 'core', 12), coreLines: [core('1', '1-3')] };
  const rows = workload(s);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 'Nội dung cốt lõi');
});

test('dòng chưa ghi tuần vẫn được cộng vào tổng cả năm', () => {
  const s = { ...emptySection(1, 'core', 10), coreLines: [core('', '1-3')] };
  assert.equal(workload(s)[0].year, 3, 'không được bỏ sót dòng thiếu tuần');
});

test('phần hoạt động trải nghiệm tổng hợp theo bảng riêng của nó', () => {
  const s: TeacherPlanSection = {
    ...emptySection(1, 'experience', 11),
    experienceLines: [
      { id: 'e1', order: 1, week: '1', periods: '1', periodCount: 0, content: 'Khai giảng', requirements: '', digitalAi: '', venue: 'Sân trường' },
      { id: 'e2', order: 2, week: '20', periods: '58-60', periodCount: 0, content: 'Chủ đề 6', requirements: '', digitalAi: '', venue: 'Lớp học' },
    ],
  };
  const rows = workload(s);
  assert.equal(rows.length, 1);
  assert.deepEqual({ hk1: rows[0].hk1, hk2: rows[0].hk2, year: rows[0].year }, { hk1: 1, hk2: 3, year: 4 });
});

test('phần mới có sẵn bốn bài kiểm tra định kỳ', () => {
  const s = emptySection(1, 'core', 10);
  assert.equal(s.assessments.length, 4);
  assert.deepEqual(
    s.assessments.map(a => a.name),
    ['Giữa học kỳ I', 'Cuối học kỳ I', 'Giữa học kỳ II', 'Cuối học kỳ II'],
  );
  assert.equal(s.hk1Weeks, DEFAULT_HK1_WEEKS);
});

test('bản ghi cũ thiếu trường nào thì được bù, không làm sập giao diện', () => {
  const s = normalizeSection({ id: 'x', kind: 'core', title: 'Khối 11' }, 2);
  assert.equal(s.order, 2);
  assert.deepEqual(s.coreLines, []);
  assert.deepEqual(s.topicLines, []);
  assert.equal(s.assessments.length, 4);
  assert.equal(s.hk1Weeks, DEFAULT_HK1_WEEKS);
});

const legacyPlan = (extra: Partial<TeacherPlan> = {}): TeacherPlan => ({
  id: 'p1',
  teacherId: 'gv1',
  teacherName: 'Đặng Quang Vinh',
  grade: 10,
  academicYear: '2026-2027',
  title: 'Kế hoạch cũ',
  status: 'draft',
  version: 1,
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...extra,
});

test('kế hoạch bản 2.10 chuyển sang cấu trúc mới, không mất dòng nào', () => {
  const p = legacyPlan({
    distribution: [
      { id: 'l1', order: 1, lesson: 'Bài 1. Mệnh đề', periods: 2, timing: 'Tuần 1', equipment: 'Máy chiếu', location: 'Lớp học' },
    ],
    specialTopics: [
      { id: 'l2', order: 1, lesson: 'Chuyên đề 1', periods: 3, timing: 'Tuần 5', equipment: '', location: '' },
    ],
  });
  const [s] = migrateLegacySections(p);
  assert.equal(s.coreLines.length, 1);
  assert.equal(s.coreLines[0].content, 'Bài 1. Mệnh đề');
  assert.equal(s.coreLines[0].periodCount, 2);
  assert.equal(s.coreLines[0].week, 'Tuần 1');
  assert.equal(s.coreLines[0].digitalAi, 'Máy chiếu · Lớp học', 'thiết bị và địa điểm cũ phải được giữ lại');
  assert.equal(s.topicLines.length, 1);
  assert.equal(s.topicLines[0].periodCount, 3);
});

test('kế hoạch bản 2.8 gom ba ô văn xuôi vào nhiệm vụ kiêm nhiệm', () => {
  const p = withSections(
    legacyPlan({ teachingTasks: 'Dạy 10C7', selfStudyPlan: 'Hai mô-đun BDTX', expectedResults: '85% đạt 5,0' }),
  );
  assert.match(p.otherTasks || '', /Dạy 10C7/);
  assert.match(p.otherTasks || '', /BDTX/);
  assert.match(p.otherTasks || '', /85%/);
});

test('kế hoạch đã có nội dung kiêm nhiệm thì không bị nội dung cũ ghi đè', () => {
  const p = withSections(legacyPlan({ otherTasks: 'GVCN lớp 11B14', teachingTasks: 'Dạy 10C7' }));
  assert.equal(p.otherTasks, 'GVCN lớp 11B14');
});

test('kế hoạch trống vẫn mở được với một phần rỗng', () => {
  const p = withSections(legacyPlan());
  assert.equal(p.sections?.length, 1);
  assert.equal(p.sections?.[0].kind, 'core');
});

test('kế hoạch đã ở cấu trúc mới thì không bị chuyển đổi lại', () => {
  const s = { ...emptySection(1, 'core', 11), title: 'Khối 11', coreLines: [core('2', '4-6')] };
  const p = withSections(legacyPlan({ sections: [s], distribution: [{ id: 'z', order: 1, lesson: 'Bỏ qua', periods: 9, timing: '', equipment: '', location: '' }] }));
  assert.equal(p.sections?.length, 1);
  assert.equal(p.sections?.[0].title, 'Khối 11');
  assert.equal(p.sections?.[0].coreLines.length, 1, 'không được trộn dòng của bản cũ vào');
});
