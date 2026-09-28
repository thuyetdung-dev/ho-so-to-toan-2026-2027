/**
 * Hàm dựng và tính toán cho Kế hoạch giảng dạy của giáo viên.
 *
 * Cấu trúc theo bản Word tổ Toán đang dùng: mỗi khối lớp (hoặc hoạt động giáo dục)
 * là một "phần" có phân phối chương trình riêng, bảng chuyên đề riêng và bảng
 * kiểm tra đánh giá riêng. Mục "IV. Tổng hợp thời lượng" không nhập tay mà do
 * phần mềm cộng từ hai bảng, tách học kỳ theo số tuần của học kỳ I.
 */
import { newId } from './ids';
import type {
  TeacherPlanKind,
  PlanAssessmentLine,
  PlanCoreLine,
  PlanExperienceLine,
  PlanTopicLine,
  TeacherPlan,
  TeacherPlanSection,
} from '../types';

/** Số tuần học kỳ I theo khung thời gian năm học phổ biến ở cấp THPT */
export const DEFAULT_HK1_WEEKS = 18;

/** Lấy số tuần từ ô "Tuần": "1", "Tuần 12", "3 (21/09 – 26/09)" → 1, 12, 3 */
export function weekNumber(week: string): number {
  const m = (week || '').match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/**
 * Số tiết của một dòng. Ưu tiên `periodCount`; nếu để trống thì suy ra từ ô
 * "Tiết PPCT": "1-3" → 3 tiết, "7" → 1 tiết. Suy ra như vậy để nhập từ Word
 * không phải gõ lại cột số tiết.
 */
export function linePeriods(line: { periodCount?: number; periods?: string }): number {
  if (Number(line.periodCount) > 0) return Number(line.periodCount);
  const text = (line.periods || '').replace(/[–—]/g, '-');
  const range = text.match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    const n = Number(range[2]) - Number(range[1]) + 1;
    return n > 0 ? n : 0;
  }
  const one = text.match(/\d+/);
  return one ? 1 : 0;
}

export interface WorkloadRow {
  label: string;
  hk1: number;
  hk2: number;
  year: number;
}

/** Cộng số tiết của một bảng, tách theo học kỳ dựa vào số tuần */
function sumByTerm(
  lines: { week: string; periodCount?: number; periods?: string }[],
  hk1Weeks: number,
): { hk1: number; hk2: number; year: number } {
  let hk1 = 0;
  let hk2 = 0;
  for (const l of lines) {
    const n = linePeriods(l);
    const w = weekNumber(l.week);
    // Dòng không ghi tuần thì tính vào học kỳ I để tổng cả năm luôn đúng
    if (w > hk1Weeks) hk2 += n;
    else hk1 += n;
  }
  return { hk1, hk2, year: hk1 + hk2 };
}

/** IV. Tổng hợp thời lượng – phần mềm tự cộng, không nhập tay */
export function workload(section: TeacherPlanSection): WorkloadRow[] {
  const hk1Weeks = section.hk1Weeks || DEFAULT_HK1_WEEKS;
  const rows: WorkloadRow[] = [];
  if (section.kind === 'experience') {
    const e = sumByTerm(section.experienceLines || [], hk1Weeks);
    rows.push({ label: 'Hoạt động trải nghiệm, hướng nghiệp', ...e });
    return rows;
  }
  const core = sumByTerm(section.coreLines || [], hk1Weeks);
  const topics = sumByTerm(section.topicLines || [], hk1Weeks);
  rows.push({ label: 'Nội dung cốt lõi', ...core });
  if (topics.year > 0) {
    rows.push({ label: 'Chuyên đề học tập lựa chọn', ...topics });
    rows.push({
      label: 'Tổng thời lượng nếu học chuyên đề',
      hk1: core.hk1 + topics.hk1,
      hk2: core.hk2 + topics.hk2,
      year: core.year + topics.year,
    });
  }
  return rows;
}

// ---------- Dòng trống ----------

export const emptyCoreLine = (order: number): PlanCoreLine => ({
  id: newId('cl'),
  order,
  week: '',
  periods: '',
  periodCount: 0,
  content: '',
  requirements: '',
  digitalAi: '',
});

export const emptyTopicLine = (order: number): PlanTopicLine => ({
  id: newId('tl'),
  order,
  week: '',
  periods: '',
  periodCount: 0,
  content: '',
  requirements: '',
});

export const emptyExperienceLine = (order: number): PlanExperienceLine => ({
  id: newId('el'),
  order,
  week: '',
  periods: '',
  periodCount: 0,
  content: '',
  requirements: '',
  digitalAi: '',
  venue: '',
});

export const emptyAssessmentLine = (order: number): PlanAssessmentLine => ({
  id: newId('al'),
  order,
  name: '',
  duration: '45 phút',
  timing: '',
  requirements: '',
  form: '',
});

/** Bốn bài kiểm tra định kỳ bắt buộc trong năm học, điền sẵn cho đỡ gõ */
export const defaultAssessments = (): PlanAssessmentLine[] =>
  ['Giữa học kỳ I', 'Cuối học kỳ I', 'Giữa học kỳ II', 'Cuối học kỳ II'].map((name, i) => ({
    ...emptyAssessmentLine(i + 1),
    name,
  }));

export function emptySection(
  order: number,
  kind: 'core' | 'experience' = 'core',
  grade?: 10 | 11 | 12,
): TeacherPlanSection {
  return {
    id: newId('sec'),
    order,
    kind,
    grade,
    title:
      kind === 'experience'
        ? `Hoạt động trải nghiệm, hướng nghiệp${grade ? ` lớp ${grade}` : ''}`
        : grade
          ? `Khối ${grade}`
          : 'Khối lớp',
    basis: '',
    coreLines: [],
    topicLines: [],
    experienceLines: [],
    assessments: defaultAssessments(),
    hk1Weeks: DEFAULT_HK1_WEEKS,
    implementation: '',
  };
}

/** Bù các trường còn thiếu khi đọc bản ghi cũ từ cơ sở dữ liệu */
export function normalizeSection(s: Partial<TeacherPlanSection>, order: number): TeacherPlanSection {
  const base = emptySection(order, s.kind === 'experience' ? 'experience' : 'core', s.grade);
  return {
    ...base,
    ...s,
    id: s.id || base.id,
    order,
    title: s.title || base.title,
    basis: s.basis || '',
    implementation: s.implementation || '',
    hk1Weeks: s.hk1Weeks || DEFAULT_HK1_WEEKS,
    coreLines: s.coreLines || [],
    topicLines: s.topicLines || [],
    experienceLines: s.experienceLines || [],
    assessments: s.assessments?.length ? s.assessments : base.assessments,
  };
}

/**
 * Chuyển kế hoạch lập bằng bản 2.10 (hai bảng 5 cột theo Phụ lục III trần)
 * sang cấu trúc nhiều phần. Không làm mất dòng nào: thiết bị và địa điểm của
 * bản cũ được gộp vào cột "Thiết bị và định hướng năng lực số, AI".
 */
export function migrateLegacySections(plan: TeacherPlan): TeacherPlanSection[] {
  const dist = plan.distribution || [];
  const topics = plan.specialTopics || [];
  if (!dist.length && !topics.length) return [];
  const s = emptySection(1, 'core', plan.grade);
  s.coreLines = dist.map((l, i) => ({
    id: l.id || newId('cl'),
    order: i + 1,
    week: l.timing || '',
    periods: '',
    periodCount: Number(l.periods) || 0,
    content: l.lesson || '',
    requirements: '',
    digitalAi: [l.equipment, l.location].filter(Boolean).join(' · '),
  }));
  s.topicLines = topics.map((l, i) => ({
    id: l.id || newId('tl'),
    order: i + 1,
    week: l.timing || '',
    periods: '',
    periodCount: Number(l.periods) || 0,
    content: l.lesson || '',
    requirements: '',
  }));
  return [s];
}

/** Nội dung ba ô văn xuôi của bản 2.8, gom lại để không mất khi đổi cấu trúc */
export function legacyProseText(plan: TeacherPlan): string {
  return [
    plan.teachingTasks?.trim() && `Nhiệm vụ được giao: ${plan.teachingTasks.trim()}`,
    plan.selfStudyPlan?.trim() && `Kế hoạch tự học, tự bồi dưỡng: ${plan.selfStudyPlan.trim()}`,
    plan.expectedResults?.trim() && `Kết quả dự kiến: ${plan.expectedResults.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Đưa kế hoạch về cấu trúc mới trước khi mở màn hình chỉnh sửa */
export function withSections(plan: TeacherPlan): TeacherPlan {
  const existing = (plan.sections || []).map(normalizeSection);
  const sections = existing.length ? existing : migrateLegacySections(plan);
  const prose = legacyProseText(plan);
  return {
    ...plan,
    sections: sections.length ? sections : [emptySection(1, 'core', plan.grade)],
    otherTasks: plan.otherTasks?.trim() ? plan.otherTasks : prose,
  };
}

// ---------- Phần kế hoạch dò được từ tệp nhập ----------

/** Bảng nào trong một phần */
export type TableRole = 'core' | 'topic' | 'experience' | 'assessment';

export interface DetectedPart {
  id: string;
  /** Loại kế hoạch phần mềm đoán được – người dùng sửa được */
  planKind: TeacherPlanKind;
  /** Khối lớp phần mềm đoán được – người dùng sửa được */
  grade: 10 | 11 | 12;
  /** Chữ đứng trước bảng, để người dùng đối chiếu xem phần mềm tách có đúng không */
  heading: string;
  coreLines: PlanCoreLine[];
  topicLines: PlanTopicLine[];
  experienceLines: PlanExperienceLine[];
  assessments: PlanAssessmentLine[];
}

/** Tổng số dòng đọc được của một phần */
export const partSize = (p: DetectedPart) =>
  p.coreLines.length + p.topicLines.length + p.experienceLines.length + p.assessments.length;

/** Dựng phần nội dung của kế hoạch từ một phần đã dò được */
export function partToSection(part: DetectedPart) {
  const kind = part.planKind === 'experience' ? 'experience' : 'core';
  const s = emptySection(1, kind, part.grade);
  s.coreLines = part.coreLines;
  s.topicLines = part.topicLines;
  s.experienceLines = part.experienceLines;
  if (part.assessments.length) s.assessments = part.assessments;
  s.title =
    part.planKind === 'experience'
      ? `Hoạt động trải nghiệm, hướng nghiệp lớp ${part.grade}`
      : part.planKind === 'inclusive'
        ? `Giáo dục hòa nhập khối ${part.grade}`
        : `Khối ${part.grade}`;
  return s;
}

