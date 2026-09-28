/**
 * Dò và tách một tệp kế hoạch gộp nhiều phần thành từng phần riêng.
 *
 * Bản Word của tổ thường gộp trong một tệp: kế hoạch giảng dạy khối 10, khối 11,
 * hoạt động trải nghiệm - hướng nghiệp và kế hoạch giáo dục học sinh hòa nhập.
 * Mỗi bảng trong tệp đều có phần chữ đứng ngay phía trên nó ("Khối 10",
 * "III. Phân phối chuyên đề học tập lựa chọn", "Hoạt động trải nghiệm..."),
 * nên dựa vào đó để biết bảng thuộc phần nào.
 *
 * Phần mềm chỉ ĐỀ XUẤT; người dùng xác nhận hoặc sửa loại và khối trước khi lưu.
 */
import { newId } from './ids';
import { splitGrid, type Grid } from './planImport';
import { fold } from './teacherPlanImport';
import { partSize, type DetectedPart, type TableRole } from './teacherPlanSections';
import type { TeacherPlanKind } from '../types';


/**
 * Dấu hiệu rõ ràng về loại kế hoạch, xét hẹp trước rộng sau.
 * Trả về null khi chữ phía trên bảng không nói gì chắc chắn – khi đó phải dùng
 * loại của bảng liền trước chứ không được mặc định về "giảng dạy".
 */
export function detectPlanKindStrict(context: string): TeacherPlanKind | null {
  // Dùng tiêu đề gần bảng nhất. Phần căn cứ có thể nhắc cả chuyên đề lẫn trải nghiệm.
  for (const line of context.split('\n').reverse()) {
    const f = fold(line);
    if (/hoa nhap|khuyet tat|hshn|hoc sinh hn\b/.test(f)) return 'inclusive';
    if (/trai nghiem|huong nghiep|hdtn/.test(f)) return 'experience';
    if (/^khoi\s*(10|11|12)\b|^ii\.\s*phan phoi phan toan cot loi|^iii\.\s*phan phoi chuyen de|^ke hoach giang day/.test(f)) return 'teaching';
  }
  return null;
}

export function detectPlanKind(context: string, fallback: TeacherPlanKind = 'teaching'): TeacherPlanKind {
  return detectPlanKindStrict(context) ?? fallback;
}

/** Đoán khối lớp từ chữ đứng trước bảng */
export function detectPartGrade(context: string, fallback: 10 | 11 | 12): 10 | 11 | 12 {
  for (const line of context.split('\n').reverse()) {
    const m = fold(line).match(/(?:khoi|lop|toan)\s*(10|11|12)\b/);
    if (m) return Number(m[1]) as 10 | 11 | 12;
  }
  return fallback;
}

/** Bảng này là bảng gì: phân phối, chuyên đề, trải nghiệm hay kiểm tra đánh giá */
export function detectTableRole(context: string, planKind: TeacherPlanKind, header: string[] = []): TableRole {
  const h = header.map(fold);
  if (h.some(c => /bai kiem tra|danh gia/.test(c)) && h.some(c => /thoi diem|thoi gian/.test(c))) return 'assessment';
  if (h.some(c => /noi dung chuyen de/.test(c))) return 'topic';
  if (h.some(c => /noi dung day hoc/.test(c))) return 'core';
  if (planKind === 'experience' && h.some(c => /chu de|bai hoc/.test(c))) return 'experience';
  const f = fold(context);
  if (/kiem tra|danh gia dinh ky|bai kiem tra/.test(f.split('\n').slice(-2).join(' '))) return 'assessment';
  if (planKind === 'experience') return 'experience';
  if (/chuyen de/.test(f)) return 'topic';
  return 'core';
}

/** Lấy vài dòng cuối của phần chữ đứng trước bảng để hiển thị cho người dùng */
export function headingOf(context: string): string {
  const lines = (context || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  return lines.slice(-2).join(' — ').slice(0, 120);
}

/** Tên cột của bảng → chỉ số cột, theo nhãn tiếng Việt thường gặp */
interface ColMap {
  week?: number;
  periods?: number;
  content?: number;
  requirements?: number;
  digitalAi?: number;
  venue?: number;
  note?: number;
  name?: number;
  duration?: number;
  timing?: number;
  form?: number;
}

function mapColumns(headerRow: string[], role: TableRole): ColMap {
  const m: ColMap = {};
  headerRow.forEach((raw, i) => {
    const f = fold(raw);
    if (!f) return;
    if (role === 'assessment') {
      if (/bai kiem tra|danh gia/.test(f) && m.name === undefined) m.name = i;
      else if (/thoi gian/.test(f)) m.duration = i;
      else if (/thoi diem/.test(f)) m.timing = i;
      else if (/yeu cau/.test(f)) m.requirements = i;
      else if (/hinh thuc/.test(f)) m.form = i;
      return;
    }
    if (/^tuan/.test(f) || /^thoi gian/.test(f)) {
      if (m.week === undefined) m.week = i;
      return;
    }
    if (/tiet/.test(f)) {
      if (m.periods === undefined) m.periods = i;
      return;
    }
    if (/noi dung|chu de|bai hoc|chuyen de/.test(f)) {
      if (m.content === undefined) m.content = i;
      return;
    }
    if (/yeu cau/.test(f)) {
      if (m.requirements === undefined) m.requirements = i;
      return;
    }
    if (/qui mo|quy mo|dia diem/.test(f)) {
      m.venue = i;
      return;
    }
    if (/ghi chu/.test(f)) {
      m.note = i;
      return;
    }
    if (/thiet bi|nang luc so|do dung|phuong phap|tich hop|ai\b/.test(f)) {
      if (m.digitalAi === undefined) m.digitalAi = i;
    }
  });
  return m;
}

const at = (row: string[], i?: number) => (i === undefined ? '' : (row[i] || '').replace(/\s+/g, ' ').trim());

/** Dòng rỗng hoặc dòng tiêu đề chủ đề gộp ô (mọi ô giống nhau) thì bỏ */
function isNoise(row: string[]): boolean {
  const cells = row.map(c => (c || '').trim());
  if (!cells.some(Boolean)) return true;
  const filled = cells.filter(Boolean);
  return filled.length > 2 && new Set(filled).size === 1;
}

/**
 * Đọc các lưới bảng thành các phần kế hoạch.
 * `fallbackGrade` dùng khi tệp không ghi khối ở bất cứ đâu.
 */
export function splitIntoParts(grids: Grid[], fallbackGrade: 10 | 11 | 12): DetectedPart[] {
  const parts = new Map<string, DetectedPart>();

  // Một phần của tệp thường có nhiều bảng liên tiếp, nhưng chỉ bảng đầu mới có
  // dòng "Khối 10" phía trên. Các bảng sau ("III. Chuyên đề...", "2. Kiểm tra,
  // đánh giá") không ghi lại khối, nên phải nhớ khối và loại của bảng liền trước.
  let lastKind: TeacherPlanKind = 'teaching';
  let lastGrade: 10 | 11 | 12 = fallbackGrade;

  for (const grid of grids) {
    for (const table of splitGrid(grid)) {
      const ctx = table.context || grid.context || '';
      const planKind: TeacherPlanKind = detectPlanKindStrict(ctx) ?? lastKind;
      const grade = detectPartGrade(ctx, lastGrade);
      lastKind = planKind;
      lastGrade = grade;
      const headerCells = table.headerCells || [];
      const role = detectTableRole(ctx, planKind, headerCells);
      const key = `${planKind}|${grade}`;

      let part = parts.get(key);
      if (!part) {
        part = {
          id: newId('part'),
          planKind,
          grade,
          heading: headingOf(ctx),
          coreLines: [],
          topicLines: [],
          experienceLines: [],
          assessments: [],
        };
        parts.set(key, part);
      }

      // `splitGrid` đã nhận ra dòng tiêu đề; đọc lại nhãn cột từ chính dòng đó
      const cols = mapColumns(headerCells, role);
      if (cols.content === undefined && role !== 'assessment') continue;
      // Bảng tổng hợp chủ đề theo STT không phải bảng phân phối theo tuần.
      if (role !== 'assessment' && cols.week === undefined) continue;

      let previousWeek = '';
      for (const row of table.rows) {
        if (isNoise(row)) continue;
        const content = at(row, cols.content);
        if (role === 'assessment') {
          const name = at(row, cols.name);
          if (!name) continue;
          part.assessments.push({
            id: newId('al'),
            order: part.assessments.length + 1,
            name,
            duration: at(row, cols.duration),
            timing: at(row, cols.timing),
            requirements: at(row, cols.requirements),
            form: at(row, cols.form),
          });
          continue;
        }
        if (!content) continue;
        const rawWeek = at(row, cols.week);
        const periods = at(row, cols.periods);
        if (!periods || !/^\d+(?:\s*[-–—]\s*\d+)?$/.test(periods)) continue;
        const week = /^\d{1,2}(?:\b|\s|\n)/.test(rawWeek) ? rawWeek : (!rawWeek ? previousWeek : '');
        if (!week) continue;
        previousWeek = week;
        const base = {
          week,
          periods,
          periodCount: 0,
          content,
          requirements: at(row, cols.requirements),
        };
        if (role === 'experience') {
          part.experienceLines.push({
            id: newId('el'),
            order: part.experienceLines.length + 1,
            ...base,
            digitalAi: at(row, cols.digitalAi),
            venue: at(row, cols.venue),
          });
        } else if (role === 'topic') {
          part.topicLines.push({ id: newId('tl'), order: part.topicLines.length + 1, ...base });
        } else {
          part.coreLines.push({
            id: newId('cl'),
            order: part.coreLines.length + 1,
            ...base,
            digitalAi: at(row, cols.digitalAi),
            note: at(row, cols.note) || undefined,
          });
        }
      }
    }
  }

  return [...parts.values()]
    .filter(p => partSize(p) > 0)
    .sort((a, b) => a.planKind.localeCompare(b.planKind) || a.grade - b.grade);
}
