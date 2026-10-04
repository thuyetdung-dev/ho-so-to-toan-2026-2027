/**
 * Cầu nối giữa phần đọc công văn / báo cáo tháng (chuyển từ app Báo cáo tự động)
 * và dữ liệu công việc của app Hồ sơ tổ. Hàm thuần, kiểm thử được.
 */
import type { MonthlyReport, MonthlyReportTaskSnapshot, WorkTask, WorkTaskStatus } from '../types';
import type { Period, ReportPayload, Task, TaskStatus } from './types';
import { newId } from '../utils/ids';

export const DOCUMENT_SOURCE = 'document';

/** Trạng thái công việc (có minh chứng, có duyệt) → trạng thái in trên báo cáo. */
export function reportStatusOf(status: WorkTaskStatus): TaskStatus {
  if (status === 'completed') return 'Hoàn thành';
  if (status === 'in_progress' || status === 'submitted') return 'Đang thực hiện';
  return 'Chưa làm';
}

export const WORK_STATUS_LABEL: Record<WorkTaskStatus, string> = {
  pending: 'Chưa làm',
  in_progress: 'Đang làm',
  submitted: 'Chờ duyệt minh chứng',
  completed: 'Hoàn thành',
  returned: 'Cần bổ sung',
};

export function monthBounds(p: Period) {
  const last = new Date(Number(p.year), Number(p.month), 0).getDate();
  return { start: `${p.year}-${p.month}-01`, end: `${p.year}-${p.month}-${String(last).padStart(2, '0')}` };
}

export function reportIdOf(memberId: string, p: Period) {
  return `${memberId}__${p.year}-${p.month}`;
}

/** Năm học chứa tháng báo cáo: tháng 8–12 thuộc năm học bắt đầu năm đó. */
export function academicYearOf(p: Period) {
  const y = Number(p.year);
  return Number(p.month) >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** Công việc của một giáo viên thuộc tháng báo cáo: hạn trong tháng, hoặc được xác nhận hoàn thành trong tháng. */
export function tasksOfMonth(tasks: WorkTask[], memberId: string, p: Period): WorkTask[] {
  const { start, end } = monthBounds(p);
  const inMonth = (iso?: string) => !!iso && iso.slice(0, 10) >= start && iso.slice(0, 10) <= end;
  return tasks
    .filter(t => t.assigneeId === memberId && (inMonth(t.deadline) || (t.status === 'completed' && inMonth(t.completedAt))))
    .sort((a, b) => (a.deadline + (a.clock || '99g99')).localeCompare(b.deadline + (b.clock || '99g99')));
}

export function snapshotOf(t: WorkTask): MonthlyReportTaskSnapshot {
  return {
    id: t.id,
    title: t.title,
    date: t.deadline,
    ...(t.clock ? { clock: t.clock } : {}),
    ...(t.timeText ? { timeText: t.timeText } : {}),
    ...(t.target ? { target: t.target } : {}),
    source: t.sourceType === DOCUMENT_SOURCE ? t.sourceName || 'Công văn' : 'Tổ giao',
    status: t.status,
  };
}

export function toReportTask(s: MonthlyReportTaskSnapshot): Task {
  return {
    id: s.id,
    time: s.timeText || '',
    work: s.title,
    source: s.source || '',
    status: reportStatusOf(s.status),
    target: s.target || 'Cá nhân',
    date: s.date,
    clock: s.clock,
  };
}

/** Đầu việc giáo viên tích chọn từ công văn → công việc của chính giáo viên đó. */
export function pickedToWorkTasks(
  picked: Task[],
  args: { member: { id: string; displayName: string }; academicYear: string; period: Period; now?: string },
): WorkTask[] {
  const now = args.now || new Date().toISOString();
  const { end } = monthBounds(args.period);
  return picked.map(t => ({
    id: newId('doc'),
    title: t.work.trim(),
    category: 'other' as const,
    assigneeId: args.member.id,
    assigneeName: args.member.displayName,
    deadline: t.date || end,
    priority: 'normal' as const,
    status: 'pending' as const,
    sourceType: DOCUMENT_SOURCE,
    sourceName: t.source,
    ...(t.time ? { timeText: t.time } : {}),
    ...(t.clock ? { clock: t.clock } : {}),
    ...(t.target ? { target: t.target } : {}),
    ...(t.auto ? { autoDate: true } : {}),
    academicYear: args.academicYear,
    createdById: args.member.id,
    createdByName: args.member.displayName,
    createdAt: now,
    updatedAt: now,
  }));
}

export function emptyMonthlyReport(args: {
  member: { id: string; displayName: string };
  period: Period;
  schoolName?: string;
  departmentName?: string;
  previous?: MonthlyReport;
  now?: string;
}): MonthlyReport {
  const now = args.now || new Date().toISOString();
  const prev = args.previous;
  return {
    id: reportIdOf(args.member.id, args.period),
    memberId: args.member.id,
    memberName: args.member.displayName,
    month: args.period.month,
    year: args.period.year,
    academicYear: academicYearOf(args.period),
    // Giữ mẫu và thông tin đơn vị của tháng trước cho đỡ nhập lại
    template: prev?.template || 'admin',
    school: prev?.school || args.schoolName || 'Trường THPT Phan Đăng Lưu',
    department: prev?.department || args.departmentName || 'Tổ Toán',
    agency: prev?.agency || '',
    place: prev?.place || '',
    selfAssessment: '',
    proposals: '',
    sources: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

/** Dữ liệu để dựng báo cáo: bản đã nộp/duyệt dùng danh sách chốt lúc nộp, bản nháp dùng dữ liệu hiện tại. */
export function payloadOf(report: MonthlyReport, live: WorkTask[], headName?: string): ReportPayload {
  const frozen = report.status === 'submitted' || report.status === 'approved';
  const rows = frozen && report.tasksSnapshot ? report.tasksSnapshot : live.map(snapshotOf);
  return {
    sources: report.sources || [],
    tasks: rows.map(toReportTask),
    name: report.memberName,
    school: report.school,
    department: report.department,
    agency: report.agency,
    place: report.place,
    template: report.template,
    selfAssessment: report.selfAssessment,
    proposals: report.proposals,
    workSaturday: false,
    headName,
  };
}

/** Trang HTML riêng để in / lưu PDF bản báo cáo (khổ A4, Times New Roman). */
export const PAPER_CSS = `
.paper{background:#fff;width:210mm;min-height:297mm;margin:auto;padding:20mm 18mm;box-shadow:0 12px 40px #24384b1f;font:14px/1.4 "Times New Roman",serif;color:#111;box-sizing:border-box}
.paper h1,.paper h2{text-align:center}
.paper>h1{font-size:20px;margin:0}
.paper>h2{font-size:16px;margin:4px 0 18px}
.paper h3{font-size:16px;margin:22px 0 9px}
.paper p{margin:6px 0}
.paper .italic{font-style:italic}
.paper .center{text-align:center}
.paper table{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
.paper th,.paper td{border:1px solid #222;padding:7px;vertical-align:top;overflow-wrap:anywhere}
.paper th{background:#d9eaf4}
.paper ul{margin:6px 0;padding-left:22px}
.paper .letterhead{display:grid;grid-template-columns:43% 57%;text-align:center;font-size:14px;line-height:1.45}
.paper .letterhead .b{font-weight:700}
.paper .letterhead>div>div:last-child{text-decoration:underline;text-underline-offset:3px}
.paper .dateline{text-align:right;font-style:italic;margin:14px 0 20px}
.paper .cover{min-height:40vh;display:flex;flex-direction:column;justify-content:center;border-bottom:1px dashed #c9d3db;margin-bottom:20px;padding-bottom:20px}
.paper .cover h1{font-size:24px;margin:0}
.paper .cover h2{font-size:19px}
.paper .signatures{display:grid;grid-template-columns:1fr 1fr;text-align:center;margin-top:30px;break-inside:avoid}
.paper .signspace{height:80px}
`;

export const PRINT_CSS = `
@page{size:A4;margin:20mm 15mm 20mm 30mm}
body{margin:0;background:#fff}
.paper{box-shadow:none;width:auto;min-height:auto;padding:0;font-size:13pt}
.paper table{page-break-inside:auto}
.paper tr{break-inside:avoid}
`;

export function printableHtml(title: string, paperHtml: string) {
  const esc = title.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] || c);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc}</title><style>${PAPER_CSS}${PRINT_CSS}</style></head><body>${paperHtml}</body></html>`;
}
