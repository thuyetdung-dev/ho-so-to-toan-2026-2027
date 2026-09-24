/**
 * Phân công chuyên môn – theo mẫu file của tổ (sheet PhanCong + TongHop):
 *  - Tiết theo TKB: Toán, Toán 2 (buổi 2), Chuyên đề Toán, Hoạt động, CTH (tiết chủ nhiệm trong TKB)
 *  - Tiết quy đổi: "Quy đổi nhiệm vụ" (TTCM, TPCM, CT-CĐCS, UVBCH-CĐ, TTCĐ...) và "Quy đổi chủ nhiệm" (GVCN)
 *  - Tổng tiết/tuần = tiết theo TKB + tiết quy đổi, so với định mức (17)
 * Nhận ra phân công trùng khi cùng một môn được gọi bằng nhiều tên ("Toán 2" = "Toán buổi 2" = "Toán (T2)").
 */
import type { Assignment, Member } from '../types';

export const fold = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Dòng tiết quy đổi (nhiệm vụ / chủ nhiệm) – không phải tiết dạy theo TKB */
export const isDutyRow = (subject: string, className?: string) => /quy doi/.test(fold(subject)) || !String(className || '').trim();
export const isDuty = (a: Pick<Assignment, 'kind' | 'subject' | 'className'>) => a.kind === 'duty' || (a.kind !== 'teaching' && isDutyRow(a.subject, a.className));

/** Khóa môn học: các cách gọi khác nhau của cùng một môn cho cùng khóa */
export function subjectKey(subject: string): string {
  const s = fold(subject);
  if (/quy doi/.test(s)) return /chu nhiem|gvcn/.test(s) ? 'qd-chu-nhiem' : 'qd-nhiem-vu';
  if (/^cth\b|tiet chu nhiem|sinh hoat (lop|chu nhiem)|^shcn/.test(s)) return 'cth';
  if (/^hoat dong|^hdtn|trai nghiem/.test(s)) return 'hoat-dong';
  if (/chuyen de|\(tc\)|\btc\b|tu chon/.test(s)) return 'chuyen-de';
  if (/buoi ?2|\(t2\)|\bt2\b|^toan 2$|tang cuong|on tap|phu dao/.test(s)) return 'toan-buoi-2';
  if (/^toan( co ban| chinh khoa|\s*\(t1\)|\s*t1)?$/.test(s)) return 'toan';
  return s;
}

/** Mã nhiệm vụ gọn: bỏ phần ghi chú trong ngoặc – "GVCN 12A06 (CTH trong TKB)" → "GVCN 12A06" */
export const dutyCode = (duties: string) => (duties || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

/** Khóa một phân công: cùng giáo viên, lớp, học kỳ, năm học và cùng môn (theo khóa môn); dòng quy đổi kèm mã nhiệm vụ */
export const assignmentKey = (a: Pick<Assignment, 'teacherId' | 'className' | 'term' | 'academicYear' | 'subject'> & { duties?: string; kind?: Assignment['kind'] }) => {
  const sk = subjectKey(a.subject);
  const dutyPart = sk === 'qd-nhiem-vu' ? `|${fold(dutyCode(a.duties || ''))}` : '';
  return `${a.teacherId}|${(a.className || '').toUpperCase()}|${a.term}|${a.academicYear || ''}|${sk}${dutyPart}`;
};

/** Tên môn "đẹp" hơn: không viết tắt trong ngoặc, dài hơn */
const nameScore = (subject: string) => (/\(|\)/.test(subject) ? 0 : 100) + subject.length;

/**
 * Tìm phân công trùng. Trong mỗi nhóm trùng giữ một bản: tên môn đầy đủ (không viết tắt), nếu như nhau thì bản sau cùng.
 */
export function findDuplicateAssignments(list: Assignment[]): { keep: Assignment[]; remove: Assignment[] } {
  const groups = new Map<string, Assignment[]>();
  list.forEach(a => {
    const k = assignmentKey(a);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  });
  const removeIds = new Set<string>();
  groups.forEach(g => {
    if (g.length < 2) return;
    let best = g[g.length - 1];
    g.forEach(a => {
      if (nameScore(a.subject) > nameScore(best.subject)) best = a;
    });
    g.forEach(a => a.id !== best.id && removeIds.add(a.id));
  });
  return { keep: list.filter(a => !removeIds.has(a.id)), remove: list.filter(a => removeIds.has(a.id)) };
}

const ROLE_RANK: Record<string, number> = { head: 0, deputy: 1, admin: 2, teacher: 3, principal: 4 };

/** Tên riêng (chữ cuối) – người Việt sắp theo tên rồi mới đến họ */
const givenName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return `${parts[parts.length - 1] || ''} ${parts.slice(0, -1).join(' ')}`;
};

/**
 * Thứ tự giáo viên: theo thứ tự trong file Excel đã nhập (sortOrder); giáo viên chưa có thứ tự xếp sau,
 * theo vai trò (Tổ trưởng, Tổ phó trước) rồi theo tên.
 */
export function teacherComparator(members: Member[]) {
  const byId = new Map(members.map(m => [m.id, m]));
  return (idA: string, nameA: string, idB: string, nameB: string) => {
    const a = byId.get(idA);
    const b = byId.get(idB);
    const oa = a?.sortOrder ?? Infinity;
    const ob = b?.sortOrder ?? Infinity;
    if (oa !== ob) return oa - ob;
    const ra = ROLE_RANK[a?.role || 'teacher'] ?? 3;
    const rb = ROLE_RANK[b?.role || 'teacher'] ?? 3;
    if (ra !== rb) return ra - rb;
    return givenName(nameA).localeCompare(givenName(nameB), 'vi');
  };
}

export const compareClassName = (a: string, b: string) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });

/** Thứ tự các dòng trong một lớp */
const SUBJECT_RANK: Record<string, number> = { toan: 0, 'toan-buoi-2': 1, 'chuyen-de': 2, 'hoat-dong': 3, cth: 4, 'qd-chu-nhiem': 5, 'qd-nhiem-vu': 6 };
const subjectRank = (s: string) => SUBJECT_RANK[subjectKey(s)] ?? 3.5;

/**
 * Sắp xếp giống file Excel: học kỳ → giáo viên (thứ tự trong file) → lớp (thứ tự xuất hiện trong file,
 * nếu chưa có thì theo tên lớp) → môn (Toán, Toán 2, Chuyên đề, Hoạt động, CTH, quy đổi). Dòng quy đổi nhiệm vụ (không lớp) ở cuối.
 */
export function sortAssignments(list: Assignment[], members: Member[]): Assignment[] {
  const cmpTeacher = teacherComparator(members);
  const firstSeen = new Map<string, number>(); // giáo viên|lớp → thứ tự dòng đầu tiên trong file
  list.forEach(a => {
    if (a.sortOrder === undefined || !a.className) return;
    const k = `${a.term}|${a.teacherId}|${a.className}`;
    firstSeen.set(k, Math.min(firstSeen.get(k) ?? Infinity, a.sortOrder));
  });
  const classRank = (a: Assignment) => (a.className ? firstSeen.get(`${a.term}|${a.teacherId}|${a.className}`) ?? Infinity : Number.MAX_VALUE);
  return [...list].sort(
    (a, b) =>
      a.term.localeCompare(b.term) ||
      cmpTeacher(a.teacherId, a.teacherName, b.teacherId, b.teacherName) ||
      (!a.className ? 1 : 0) - (!b.className ? 1 : 0) ||
      (classRank(a) === classRank(b) ? 0 : classRank(a) < classRank(b) ? -1 : 1) ||
      compareClassName(a.className || '', b.className || '') ||
      // cùng lớp: nhập từ file → giữ đúng thứ tự dòng trong file; thêm tay → Toán, Toán 2, Chuyên đề, Hoạt động, CTH, quy đổi
      (a.sortOrder !== undefined && b.sortOrder !== undefined ? a.sortOrder - b.sortOrder : 0) ||
      subjectRank(a.subject) - subjectRank(b.subject) ||
      a.subject.localeCompare(b.subject, 'vi') ||
      (a.duties || '').localeCompare(b.duties || '', 'vi'),
  );
}

// ---------------------------------------------------------------------------
// Chức vụ / nhiệm vụ
// ---------------------------------------------------------------------------
const DUTY_NAMES: [RegExp, string][] = [
  [/^ttcm$|to truong (chuyen mon|cm)/, 'Tổ trưởng chuyên môn'],
  [/^tpcm$|to pho (chuyen mon|cm)/, 'Tổ phó chuyên môn'],
  [/^ct-?cdcs$|chu tich cong doan/, 'Chủ tịch Công đoàn cơ sở'],
  [/^uvbch-?cd$|uy vien bch/, 'Ủy viên BCH Công đoàn'],
  [/^ttcd$|to truong cong doan/, 'Tổ trưởng Công đoàn'],
];
/** Tên đầy đủ của một mã nhiệm vụ: TTCM → Tổ trưởng chuyên môn; GVCN 12A06 → Chủ nhiệm lớp 12A06 */
export function dutyName(code: string): string {
  const c = dutyCode(code);
  const f = fold(c);
  const gvcn = c.match(/^gvcn\s+(\S+)/i);
  if (gvcn) return `Chủ nhiệm lớp ${gvcn[1].toUpperCase()}`;
  return DUTY_NAMES.find(([re]) => re.test(f))?.[1] || c;
}

export interface TeacherSummary {
  /** Tiết theo TKB (gồm CTH, Hoạt động) */
  tkb: number;
  /** Tiết quy đổi nhiệm vụ + chủ nhiệm */
  quyDoi: number;
  total: number;
  /** Lớp chủ nhiệm */
  homeroom: string[];
  /** Mã chức vụ, nhiệm vụ như cột "Chức vụ, nhiệm vụ" của file: "UVBCH-CĐ; GVCN 12A06" */
  dutyCodes: string[];
  /** Tên đầy đủ: "Ủy viên BCH Công đoàn; Chủ nhiệm lớp 12A06" */
  dutyText: string;
  classes: string[];
}

/** Tổng hợp một giáo viên (giống sheet TongHop) */
export function summarizeTeacher(rows: Assignment[]): TeacherSummary {
  let tkb = 0;
  let quyDoi = 0;
  const codes: string[] = [];
  const homeroom: string[] = [];
  const classes: string[] = [];
  const addCode = (c: string) => {
    const code = dutyCode(c);
    if (code && !codes.some(x => fold(x) === fold(code))) codes.push(code);
  };
  for (const a of rows) {
    const p = Number(a.periodsPerWeek) || 0;
    if (isDuty(a)) {
      quyDoi += p;
      if (a.duties) addCode(a.duties);
      else if (subjectKey(a.subject) === 'qd-chu-nhiem' && a.className) addCode(`GVCN ${a.className}`);
      if (subjectKey(a.subject) === 'qd-chu-nhiem' && a.className && !homeroom.includes(a.className)) homeroom.push(a.className);
    } else {
      tkb += p;
      if (a.className && !classes.includes(a.className)) classes.push(a.className);
      // File kiểu cũ ghi chức vụ ở mọi dòng dạy ("Tổ trưởng chuyên môn") – vẫn hiển thị chức vụ, không cộng tiết
      if (a.duties) addCode(a.duties);
    }
  }
  codes.forEach(c => {
    const m = c.match(/^gvcn\s+(\S+)/i);
    if (m && !homeroom.includes(m[1].toUpperCase())) homeroom.push(m[1].toUpperCase());
  });
  // Mã quy đổi nhiệm vụ trước, GVCN sau – như cột "Chức vụ, nhiệm vụ" của file
  const ordered = [...codes.filter(c => !/^gvcn/i.test(c)), ...codes.filter(c => /^gvcn/i.test(c))];
  return {
    tkb,
    quyDoi,
    total: tkb + quyDoi,
    homeroom,
    dutyCodes: ordered,
    dutyText: [...new Set(ordered.map(dutyName))].join('; '),
    classes,
  };
}

export interface TeacherGroup extends TeacherSummary {
  teacherId: string;
  teacherName: string;
  /** Nhóm theo lớp; dòng quy đổi nhiệm vụ không gắn lớp nằm ở nhóm className = '' (cuối) */
  classGroups: { className: string; grade: number; items: Assignment[]; total: number }[];
}

/** Gom theo giáo viên → lớp (danh sách đã sắp xếp bằng sortAssignments) */
export function groupByTeacher(sorted: Assignment[]): TeacherGroup[] {
  const groups: (Omit<TeacherGroup, keyof TeacherSummary> & { rows: Assignment[] })[] = [];
  for (const a of sorted) {
    let g = groups[groups.length - 1];
    if (!g || g.teacherId !== a.teacherId) {
      g = { teacherId: a.teacherId, teacherName: a.teacherName, classGroups: [], rows: [] };
      groups.push(g);
    }
    g.rows.push(a);
    const cn = a.className || '';
    let c = g.classGroups.find(x => x.className === cn);
    if (!c) {
      c = { className: cn, grade: a.grade, items: [], total: 0 };
      g.classGroups.push(c);
    }
    c.items.push(a);
    c.total += Number(a.periodsPerWeek) || 0;
  }
  return groups.map(({ rows, ...g }) => ({ ...g, ...summarizeTeacher(rows) }));
}

/** Dữ liệu sheet "TongHop" khi xuất Excel */
export function summaryRows(sorted: Assignment[]) {
  return groupByTeacher(sorted).map(g => ({
    'Họ và tên giáo viên': g.teacherName,
    'Tiết theo TKB (gồm CTH)': g.tkb,
    'Tiết quy đổi nhiệm vụ': g.quyDoi,
    'Tổng tiết/tuần': g.total,
    'Lớp chủ nhiệm': g.homeroom.join(', '),
    'Chức vụ, nhiệm vụ': g.dutyCodes.join('; '),
  }));
}

/** Thứ tự khi xuất Excel: như sortAssignments, nhưng trong mỗi giáo viên giữ đúng thứ tự dòng của file đã nhập */
export function exportOrder(list: Assignment[], members: Member[]): Assignment[] {
  const sorted = sortAssignments(list, members);
  const out: Assignment[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].teacherId === sorted[i].teacherId && sorted[j].term === sorted[i].term) j++;
    const block = sorted.slice(i, j).map((a, k) => ({ a, k }));
    block.sort((x, y) => (x.a.sortOrder ?? Infinity) - (y.a.sortOrder ?? Infinity) || x.k - y.k);
    out.push(...block.map(x => x.a));
    i = j;
  }
  return out;
}
