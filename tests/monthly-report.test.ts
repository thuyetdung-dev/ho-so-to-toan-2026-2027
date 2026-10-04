import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  academicYearOf, emptyMonthlyReport, monthBounds, payloadOf, pickedToWorkTasks, reportIdOf, reportStatusOf,
  snapshotOf, tasksOfMonth,
} from '../src/report/kpi-bridge.ts';
import { buildReportModel } from '../src/report/report-model.ts';
import type { MonthlyReport, WorkTask } from '../src/types/index.ts';

const period = { month: '10', year: '2026' };
const member = { id: 'gv-01', displayName: 'Hồ Thuyết Dũng' };
const task = (id: string, deadline: string, status: WorkTask['status'], extra: Partial<WorkTask> = {}): WorkTask => ({
  id, title: `Việc ${id}`, category: 'other', assigneeId: 'gv-01', assigneeName: 'Hồ Thuyết Dũng', deadline, priority: 'normal',
  status, academicYear: '2026-2027', createdById: 'gv-01', createdByName: 'x', createdAt: 'x', updatedAt: 'x', ...extra,
});

test('mốc tháng, mã báo cáo và năm học', () => {
  assert.deepEqual(monthBounds(period), { start: '2026-10-01', end: '2026-10-31' });
  assert.deepEqual(monthBounds({ month: '02', year: '2028' }), { start: '2028-02-01', end: '2028-02-29' });
  assert.equal(reportIdOf('gv-01', period), 'gv-01__2026-10');
  assert.equal(academicYearOf(period), '2026-2027');
  assert.equal(academicYearOf({ month: '03', year: '2027' }), '2026-2027');
});

test('trạng thái công việc → trạng thái in trên báo cáo', () => {
  assert.equal(reportStatusOf('completed'), 'Hoàn thành');
  assert.equal(reportStatusOf('submitted'), 'Đang thực hiện');
  assert.equal(reportStatusOf('in_progress'), 'Đang thực hiện');
  assert.equal(reportStatusOf('pending'), 'Chưa làm');
  assert.equal(reportStatusOf('returned'), 'Chưa làm');
});

test('lấy đúng công việc của tháng, xếp theo ngày', () => {
  const list = [
    task('b', '2026-10-20', 'pending'),
    task('a', '2026-10-05', 'completed'),
    task('old', '2026-09-28', 'completed', { completedAt: '2026-10-02T03:00:00.000Z' }),
    task('sep', '2026-09-28', 'pending'),
    task('other', '2026-10-05', 'pending', { assigneeId: 'gv-02' }),
  ];
  assert.deepEqual(tasksOfMonth(list, 'gv-01', period).map(t => t.id), ['old', 'a', 'b']);
});

test('đầu việc chọn từ công văn thành công việc của chính giáo viên', () => {
  const [w] = pickedToWorkTasks(
    [{ id: 't1', time: 'Tuần 2', work: '  Dự giờ đồng nghiệp ', source: 'cv-10293.pdf', status: 'Chưa làm', date: '2026-10-09', clock: '08g00', auto: true, target: 'Giáo viên' }],
    { member, academicYear: '2026-2027', period, now: 'now' },
  );
  assert.equal(w.title, 'Dự giờ đồng nghiệp');
  assert.equal(w.assigneeId, 'gv-01');
  assert.equal(w.createdById, 'gv-01');
  assert.equal(w.status, 'pending');
  assert.equal(w.sourceType, 'document');
  assert.equal(w.sourceName, 'cv-10293.pdf');
  assert.equal(w.deadline, '2026-10-09');
  assert.equal(w.autoDate, true);
  assert.ok(!Object.values(w).includes(undefined), 'không có trường undefined');
  const [noDate] = pickedToWorkTasks([{ id: 't2', time: '', work: 'Việc', source: 's', status: 'Chưa làm' }], { member, academicYear: '2026-2027', period });
  assert.equal(noDate.deadline, '2026-10-31');
});

test('bản nháp dùng dữ liệu hiện tại; bản đã nộp dùng danh sách chốt', () => {
  const report: MonthlyReport = emptyMonthlyReport({ member, period, now: 'now' });
  const live = [task('a', '2026-10-05', 'completed', { sourceType: 'document', sourceName: 'cv.pdf' }), task('b', '2026-10-06', 'pending')];
  const draft = payloadOf(report, live, 'Tổ trưởng A');
  assert.deepEqual(draft.tasks.map(t => [t.status, t.source]), [['Hoàn thành', 'cv.pdf'], ['Chưa làm', 'Tổ giao']]);
  const submitted = { ...report, status: 'submitted' as const, tasksSnapshot: [snapshotOf(live[0])] };
  assert.equal(payloadOf(submitted, live).tasks.length, 1);
  const model = buildReportModel(draft, period, new Date(2026, 9, 31));
  assert.equal(model.signature.left?.name, 'Tổ trưởng A');
  assert.equal(model.fileName, 'Bao_cao_thang_10_2026_Ho_Thuyet_Dung');
  const notebook = buildReportModel({ ...draft, template: 'notebook' }, period);
  assert.equal(notebook.template, 'notebook');
  assert.match(notebook.cover[0], /SỔ TAY/);
});

test('báo cáo tháng sau giữ mẫu và thông tin đơn vị của tháng trước', () => {
  const prev = { ...emptyMonthlyReport({ member, period }), template: 'notebook' as const, agency: 'Sở GDĐT TP.HCM', place: 'TP. Hồ Chí Minh', selfAssessment: 'Cũ' };
  const next = emptyMonthlyReport({ member, period: { month: '11', year: '2026' }, previous: prev });
  assert.equal(next.template, 'notebook');
  assert.equal(next.agency, 'Sở GDĐT TP.HCM');
  assert.equal(next.selfAssessment, '');
  assert.equal(next.id, 'gv-01__2026-11');
});
