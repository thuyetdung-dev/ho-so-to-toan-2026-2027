import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teacherStandards, termBounds } from '../src/utils/standards.ts';

const member: any = { id: 'm1', displayName: 'Hồ Thuyết Dũng', role: 'head' };
const config: any = { academicYear: '2026-2027', startDate: '2026-09-05', endDate: '2027-05-28', kpiConfig: { enabled: true, label: '', weights: {}, hk1EndDate: '2027-01-16',
  minimums: { teacherPlans: { hk1: 1, hk2: 0 }, lessonPlans: { hk1: 2, hk2: 2 }, observations: { hk1: 1, hk2: 1 }, trainings: { hk1: 0, hk2: 0 } } } };
const empty: any = { teacherPlans: [], lessonPlans: [], observations: [], meetings: [], trainings: [], workTasks: [], members: [member] };
const lp = (id: string, createdAt: string, status = 'approved') => ({ id, teacherId: 'm1', status, title: id, createdAt, updatedAt: createdAt, academicYear: '2026-2027' });
const wt = (id: string, deadline: string, status: string) => ({ id, title: id, assigneeId: 'm1', deadline, status, academicYear: '2026-2027', createdAt: 'x' });

test('mốc học kỳ', () => {
  assert.deepEqual(termBounds(config, 'HK1'), { start: '2026-09-05', end: '2027-01-16' });
  assert.deepEqual(termBounds(config, 'HK2'), { start: '2027-01-17', end: '2027-05-28' });
  assert.deepEqual(termBounds({ academicYear: '2026-2027' } as any, 'HK1'), { start: '2026-08-01', end: '2027-01-17' });
});

test('chưa đủ định mức giữa kỳ = Chưa đến hạn; hết kỳ = Chưa đạt; đủ = Đạt', () => {
  const data = { ...empty, lessonPlans: [lp('a', '2026-10-01'), lp('b', '2026-10-02', 'submitted')] };
  const mid = teacherStandards(member, data, config, 'HK1', '2026-10-05');
  const g = mid.groups.find(x => x.key === 'lessonPlans')!;
  assert.equal(g.status, 'chua_den_han'); assert.equal(g.detail, '1/2 giáo án được duyệt');
  const after = teacherStandards(member, data, config, 'HK1', '2027-01-20');
  assert.equal(after.groups.find(x => x.key === 'lessonPlans')!.status, 'chua_dat');
  const ok = teacherStandards(member, { ...empty, lessonPlans: [lp('a', '2026-10-01'), lp('b', '2026-11-01')] }, config, 'HK1', '2026-12-01');
  assert.equal(ok.groups.find(x => x.key === 'lessonPlans')!.status, 'dat');
});

test('nhóm không có định mức và chưa có minh chứng = Không yêu cầu, không bị tính', () => {
  const r = teacherStandards(member, empty, config, 'HK1', '2026-10-05');
  assert.equal(r.groups.find(x => x.key === 'trainings')!.status, 'khong_yeu_cau');
  assert.equal(r.groups.find(x => x.key === 'professionalTasks')!.status, 'khong_yeu_cau');
  assert.equal(r.counted, 3); assert.equal(r.failed, 0); assert.equal(r.overall, 'chua_den_han');
});

test('nhiệm vụ: chỉ xét việc đến hạn; có việc quá hạn = Chưa đạt', () => {
  const r = teacherStandards(member, { ...empty, workTasks: [wt('a', '2026-10-03', 'completed'), wt('b', '2026-10-20', 'pending')] }, config, 'HK1', '2026-10-05');
  const g = r.groups.find(x => x.key === 'professionalTasks')!;
  assert.equal(g.status, 'dat'); assert.match(g.detail, /1\/1 .* 1 việc chưa đến hạn/);
  const late = teacherStandards(member, { ...empty, workTasks: [wt('a', '2026-10-03', 'pending')] }, config, 'HK1', '2026-10-05');
  assert.equal(late.groups.find(x => x.key === 'professionalTasks')!.status, 'chua_dat');
  assert.equal(late.overall, 'chua_dat');
  const onlyFuture = teacherStandards(member, { ...empty, workTasks: [wt('a', '2026-10-30', 'pending')] }, config, 'HK1', '2026-10-05');
  assert.equal(onlyFuture.groups.find(x => x.key === 'professionalTasks')!.status, 'chua_den_han');
});

test('cả năm cộng định mức hai học kỳ; việc kỳ khác không tính', () => {
  const r = teacherStandards(member, { ...empty, lessonPlans: [lp('a', '2026-10-01'), lp('b', '2027-02-01')] }, config, 'CaNam', '2026-10-05');
  assert.equal(r.groups.find(x => x.key === 'lessonPlans')!.detail, '2/4 giáo án được duyệt');
  const hk1 = teacherStandards(member, { ...empty, lessonPlans: [lp('b', '2027-02-01')] }, config, 'HK1', '2026-10-05');
  assert.equal(hk1.groups.find(x => x.key === 'lessonPlans')!.actual, 0);
});
