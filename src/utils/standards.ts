/**
 * Định mức minh chứng tối thiểu theo học kỳ (thay cho điểm KPI phần trăm).
 * Mỗi nhóm chỉ ghi: Đạt / Chưa đạt / Chưa đến hạn / Không yêu cầu — không quy ra điểm.
 * Hàm thuần, kiểm thử được.
 */
import type {
  DepartmentConfig, KpiMinimums, LessonPlan, Meeting, Member, ObservationRecord, TeacherPlan, TrainingRecord, WorkTask,
} from '../types';
import { recordInScope, resolveAssigneeId } from './management';

export type StandardTerm = 'HK1' | 'HK2' | 'CaNam';
export type StandardStatus = 'dat' | 'chua_dat' | 'chua_den_han' | 'khong_yeu_cau';
export type StandardKey = 'teacherPlans' | 'lessonPlans' | 'observations' | 'professionalTasks' | 'trainings';

export const STATUS_TEXT: Record<StandardStatus, string> = {
  dat: 'Đạt',
  chua_dat: 'Chưa đạt',
  chua_den_han: 'Chưa đến hạn',
  khong_yeu_cau: 'Không yêu cầu',
};

export const TERM_TEXT: Record<StandardTerm, string> = { HK1: 'Học kỳ I', HK2: 'Học kỳ II', CaNam: 'Cả năm học' };

/** Định mức mặc định cho một giáo viên Toán THPT (tổ có thể sửa trong Cài đặt). */
export const DEFAULT_MINIMUMS: KpiMinimums = {
  teacherPlans: { hk1: 1, hk2: 0 },
  lessonPlans: { hk1: 8, hk2: 8 },
  observations: { hk1: 4, hk2: 4 },
  trainings: { hk1: 0, hk2: 0 },
};

export interface StandardGroup {
  key: StandardKey;
  label: string;
  /** Số minh chứng đã có (đã duyệt / đã rà soát / đã hoàn thành) */
  actual: number;
  /** Định mức tối thiểu; với nhiệm vụ là số việc đã đến hạn */
  required: number;
  status: StandardStatus;
  detail: string;
  refs: string[];
}

export interface TeacherStandards {
  term: StandardTerm;
  start: string;
  end: string;
  groups: StandardGroup[];
  met: number;
  /** Số nhóm có yêu cầu (bỏ qua "Không yêu cầu") */
  counted: number;
  failed: number;
  pending: number;
  overall: StandardStatus;
  unassignedTasks: number;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nextDay = (day: string) => { const d = new Date(`${day}T00:00:00`); d.setDate(d.getDate() + 1); return iso(d); };

/** Mốc thời gian của học kỳ trong năm học. */
export function termBounds(config: Pick<DepartmentConfig, 'academicYear' | 'startDate' | 'endDate' | 'kpiConfig'>, term: StandardTerm) {
  const y = /^(\d{4})-(\d{4})$/.exec(config.academicYear || '');
  const y1 = y ? y[1] : String(new Date().getFullYear());
  const y2 = y ? y[2] : String(Number(y1) + 1);
  const yearStart = config.startDate || `${y1}-08-01`;
  const yearEnd = config.endDate || `${y2}-05-31`;
  const hk1End = config.kpiConfig?.hk1EndDate || `${y2}-01-17`;
  if (term === 'HK1') return { start: yearStart, end: hk1End };
  if (term === 'HK2') return { start: nextDay(hk1End), end: yearEnd };
  return { start: yearStart, end: yearEnd };
}

function minimumOf(m: KpiMinimums, key: keyof KpiMinimums, term: StandardTerm) {
  const v = m[key] || { hk1: 0, hk2: 0 };
  const n = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));
  return term === 'HK1' ? n(v.hk1) : term === 'HK2' ? n(v.hk2) : n(v.hk1) + n(v.hk2);
}

function quotaStatus(actual: number, required: number, today: string, end: string): StandardStatus {
  if (required <= 0) return actual > 0 ? 'dat' : 'khong_yeu_cau';
  if (actual >= required) return 'dat';
  return today <= end ? 'chua_den_han' : 'chua_dat';
}

export function teacherStandards(
  member: Member,
  data: {
    teacherPlans: TeacherPlan[];
    lessonPlans: LessonPlan[];
    observations: ObservationRecord[];
    meetings: Meeting[];
    trainings: TrainingRecord[];
    workTasks?: WorkTask[];
    members?: Member[];
  },
  config: Pick<DepartmentConfig, 'academicYear' | 'startDate' | 'endDate' | 'kpiConfig'>,
  term: StandardTerm,
  today: string = iso(new Date()),
): TeacherStandards {
  const { start, end } = termBounds(config, term);
  const scope = { academicYear: config.academicYear, startDate: start, endDate: end };
  const minimums = { ...DEFAULT_MINIMUMS, ...(config.kpiConfig?.minimums || {}) };
  const members = data.members || [];

  const tp = data.teacherPlans.filter(p => p.teacherId === member.id && p.status === 'approved' && recordInScope(p, scope, p.updatedAt));
  const lp = data.lessonPlans.filter(p => p.teacherId === member.id && p.status === 'approved' && recordInScope(p, scope, p.createdAt || p.updatedAt));
  const obs = data.observations.filter(o => o.observerId === member.id && o.status === 'reviewed' && !!o.lessonsLearned?.trim() && recordInScope(o, scope, o.date));
  const tr = data.trainings.filter(t => t.teacherId === member.id && ['completed', 'hoàn thành', 'done'].includes(String(t.status).toLowerCase()) && recordInScope(t, scope, t.updatedAt));

  // Nhiệm vụ: chỉ xét việc có hạn trong kỳ và đã đến hạn (hạn trước hôm nay)
  const finalized = data.meetings.filter(m => m.status === 'finalized');
  const meetingTasks = finalized.flatMap(m => (m.tasks || []).map(t => ({ ...t, from: m.title })));
  const unassignedTasks = meetingTasks.filter(t => !resolveAssigneeId(t, members)).length;
  const allTasks = [
    ...meetingTasks.filter(t => resolveAssigneeId(t, members) === member.id),
    ...(data.workTasks || []).filter(t => t.assigneeId === member.id && (!t.academicYear || t.academicYear === config.academicYear))
      .map(t => ({ ...t, from: t.sourceType === 'document' ? (t.sourceName || 'Công văn') : 'Điều hành' })),
  ];
  const inTerm = allTasks.filter(t => t.deadline && t.deadline >= start && t.deadline <= end);
  const due = inTerm.filter(t => t.deadline < today);
  const dueDone = due.filter(t => t.status === 'completed');
  // Đã nộp minh chứng đúng hạn, đang chờ lãnh đạo xác nhận: không tính là quá hạn
  const waitingReview = due.filter(t => t.status === 'submitted').length;
  const overdue = due.length - dueDone.length - waitingReview;
  const notDue = inTerm.length - due.length;
  const taskStatus: StandardStatus = overdue > 0 ? 'chua_dat' : waitingReview > 0 ? 'chua_den_han' : due.length > 0 ? 'dat' : inTerm.length ? 'chua_den_han' : 'khong_yeu_cau';

  const quota = (key: keyof KpiMinimums, label: string, list: { id: string }[], unit: string, refOf: (x: never) => string): StandardGroup => {
    const required = minimumOf(minimums, key, term);
    const status = quotaStatus(list.length, required, today, end);
    return {
      key, label, actual: list.length, required, status,
      detail: required > 0 ? `${list.length}/${required} ${unit}` : list.length ? `${list.length} ${unit} (không bắt buộc)` : 'Tổ chưa đặt định mức',
      refs: list.map(x => refOf(x as never)),
    };
  };

  const groups: StandardGroup[] = [
    quota('teacherPlans', 'Kế hoạch giáo dục cá nhân', tp, 'kế hoạch được duyệt', (p: TeacherPlan) => p.title || p.id),
    quota('lessonPlans', 'Kế hoạch bài dạy', lp, 'giáo án được duyệt', (p: LessonPlan) => p.title || p.topicTitle || p.id),
    quota('observations', 'Dự giờ & rút kinh nghiệm', obs, 'tiết dự có rút kinh nghiệm', (o: ObservationRecord) => `${o.date} · ${o.lessonName || ''}`),
    {
      key: 'professionalTasks', label: 'Nhiệm vụ được giao', actual: dueDone.length, required: due.length, status: taskStatus,
      detail: (due.length ? `${dueDone.length}/${due.length} việc đến hạn đã hoàn thành${overdue ? ` · ${overdue} quá hạn` : ''}${waitingReview ? ` · ${waitingReview} chờ xác nhận` : ''}` : 'Chưa có việc đến hạn')
        + (notDue ? ` · ${notDue} việc chưa đến hạn` : ''),
      refs: inTerm.map(t => `${t.deadline} · ${t.title} (${t.from})${t.status === 'completed' ? ' ✓' : t.deadline < today ? ' – quá hạn' : ''}`),
    },
    quota('trainings', 'Bồi dưỡng chuyên môn', tr, 'nội dung hoàn thành', (t: TrainingRecord) => t.moduleName || t.id),
  ];

  const countedGroups = groups.filter(g => g.status !== 'khong_yeu_cau');
  const met = countedGroups.filter(g => g.status === 'dat').length;
  const failed = countedGroups.filter(g => g.status === 'chua_dat').length;
  const pending = countedGroups.filter(g => g.status === 'chua_den_han').length;
  const overall: StandardStatus = !countedGroups.length ? 'khong_yeu_cau' : failed ? 'chua_dat' : pending ? 'chua_den_han' : 'dat';
  return { term, start, end, groups, met, counted: countedGroups.length, failed, pending, overall, unassignedTasks };
}

export const STATUS_CLS: Record<StandardStatus, string> = {
  dat: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  chua_dat: 'bg-rose-100 text-rose-700 border-rose-200',
  chua_den_han: 'bg-amber-50 text-amber-700 border-amber-200',
  khong_yeu_cau: 'bg-slate-100 text-slate-500 border-slate-200',
};
