/**
 * Nhập Kế hoạch giáo dục của giáo viên (Phụ lục III CV 5512) từ tệp Word / Excel / PDF.
 *
 * Khung Phụ lục III gồm:
 *   I.1. Phân phối chương trình  – bảng: Bài học | Số tiết | Thời điểm | Thiết bị dạy học | Địa điểm dạy học
 *   I.2. Chuyên đề lựa chọn      – bảng cùng 6 cột (cấp THPT)
 *   II.  Nhiệm vụ khác (nếu có)  – văn xuôi
 *
 * Phần dò bảng dùng lại bộ đọc của Phụ lục I (planImport.ts) vì sáu cột trùng nhau;
 * ở đây chỉ thêm việc tách bảng nào thuộc "Phân phối chương trình", bảng nào thuộc
 * "Chuyên đề lựa chọn", và cắt lấy phần "Nhiệm vụ khác".
 */
import type { TeacherPlanLine } from '../types';
import { extractTextFromFile } from './lessonImport';
import type { DetectedPart } from './teacherPlanSections';
import type { ImportedDistItem } from './planImport';

export interface ImportedTeacherPlan {
  title?: string;
  grade?: 10 | 11 | 12;
  teacherName?: string;
  subject?: string;
  className?: string;
  distribution: Omit<TeacherPlanLine, 'id' | 'order'>[];
  specialTopics: Omit<TeacherPlanLine, 'id' | 'order'>[];
  otherTasks: string;
  /** Có đọc được bảng hoặc nhận ra mục nào không */
  recognized: boolean;
  rawText: string;
}

export interface TeacherPlanImportResult extends ImportedTeacherPlan {
  source: string;
  notes: string[];
}

/** Bỏ dấu để so khớp không phụ thuộc dấu và chữ hoa/thường */
export const fold = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Bỏ số thứ tự đầu dòng: "I.", "1.", "1)", "a)", "-", "•" */
const stripOrdinal = (s: string) =>
  s.replace(/^\s*(?:[IVX]+|[0-9]{1,2}|[a-hA-H])\s*[.)\-–]\s*/, '').replace(/^\s*[-–•*]\s*/, '').trim();

/**
 * Tiêu đề mục phải nằm ở ĐẦU dòng (cho phép vài từ dẫn như "Kế hoạch", "Các").
 * Không neo đầu dòng thì một dòng nội dung như "Bồi dưỡng học sinh giỏi khối 12"
 * sẽ bị nhận nhầm là tiêu đề mục II.
 */
const LEAD = '(?:(?:ke hoach|cac|noi dung|muc)\\s+)?';
const head = (body: string) => new RegExp(`^${LEAD}(?:${body})`);

const RE_DIST_HEAD = head('phan phoi chuong trinh|ke hoach day hoc');
const RE_TOPIC_HEAD = head('chuyen de lua chon|chuyen de hoc tap|chuyen de');
const RE_OTHER_HEAD = head('nhiem vu khac|nhiem vu duoc giao|cac noi dung khac');

export type Section = 'dist' | 'topics' | 'other' | null;

/** Dòng này mở đầu mục nào của Phụ lục III? */
export function classifyTeacherPlanHeading(line: string): Section {
  const bare = stripOrdinal(line).replace(/[:：].*$/, '');
  const f = fold(bare);
  if (!f || f.length > 90) return null;
  if (RE_OTHER_HEAD.test(f)) return 'other';
  if (RE_TOPIC_HEAD.test(f)) return 'topics';
  if (RE_DIST_HEAD.test(f)) return 'dist';
  return null;
}

/** Đoán khối lớp từ toàn văn */
export function detectGrade(text: string): 10 | 11 | 12 | undefined {
  const m = fold(text).match(/(?:khoi|lop)\s*(10|11|12)\b/);
  return m ? (Number(m[1]) as 10 | 11 | 12) : undefined;
}

/** Đọc dòng "MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC ....., LỚP....." ở đầu Phụ lục III */
export function detectSubjectAndClass(text: string): { subject?: string; className?: string } {
  const out: { subject?: string; className?: string } = {};
  for (const raw of text.split('\n')) {
    // Khung mẫu để trống bằng dấu chấm lửng ("……" hoặc "....."): coi như khoảng trắng
    const line = raw.replace(/[.…]{2,}/g, ' ').replace(/\s+/g, ' ').trim();
    const f = fold(line);
    if (!out.subject && /^mon hoc/.test(f)) {
      const m = line.match(/gi[áa]o\s*d[uụ]c\s*([^,]*)/i) || line.match(/^[^:]*[:：]\s*([^,]*)/);
      const v = (m?.[1] || '').trim();
      if (v && fold(v) !== 'lop') out.subject = v;
    }
    if (!out.className) {
      const m = line.match(/l[ớo]p\s*[:：]?\s*([0-9][0-9A-Za-zÀ-ỹ,\s./-]*)/i);
      const v = (m?.[1] || '').trim().replace(/[.,;]+$/, '');
      if (v && /\d/.test(v) && v.length <= 60) out.className = v;
    }
  }
  return out;
}

/** Chuyển một dòng bảng đọc được từ Phụ lục I sang dòng của Phụ lục III */
function toLine(d: ImportedDistItem): Omit<TeacherPlanLine, 'id' | 'order'> {
  return {
    lesson: d.topicTitle || '',
    periods: Number(d.periods) || 0,
    timing: d.week ? `Tuần ${d.week}` : '',
    equipment: d.equipment || '',
    location: d.location || '',
  };
}

/** Cắt lấy phần "II. Nhiệm vụ khác" trong toàn văn */
export function extractOtherTasks(text: string): string {
  const lines = text
    .normalize('NFC')
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.replace(/^[\s-•▪◦●○·]+(?=\S)/u, m => (/[-•▪◦●○·]/u.test(m) ? '- ' : '')))
    .map(l => l.replace(/[ \t]+/g, ' ').trimEnd());

  const out: string[] = [];
  let inside = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const kind = classifyTeacherPlanHeading(t);
    if (kind === 'other') {
      inside = true;
      // Phần chú thích trong ngoặc của khung mẫu không phải nội dung thật
      const after = t.split(/[:：]/).slice(1).join(':').replace(/^\s*\([^)]*\)\s*/, '').trim();
      if (after) out.push(after);
      continue;
    }
    if (kind) {
      inside = false;
      continue;
    }
    // Dòng chú thích (1)...(5) và dòng chấm chấm của khung mẫu → bỏ
    if (/^\(\d\)/.test(t) || /^[.\s…]+$/.test(t)) continue;
    if (/^(to truong|giao vien|\(ky va ghi ro ho ten\))/.test(fold(t))) { inside = false; continue; }
    if (inside) out.push(stripOrdinal(t) || t);
  }
  return out.join('\n').trim();
}

/** Đọc tệp kế hoạch cá nhân. Không ghi gì vào cơ sở dữ liệu. */
export async function importTeacherPlanFile(
  file: File,
  opts: { grade: 10 | 11 | 12; weeksCount: number },
): Promise<TeacherPlanImportResult> {
  const name = file.name.toLowerCase();
  const notes: string[] = [];

  // 1) Đọc bảng bằng bộ dò bảng của Phụ lục I (sáu cột trùng nhau)
  let tables: ImportedDistItem[] = [];
  let source = 'Word';
  try {
    // Nạp động để bộ đọc bảng nằm ở gói riêng, không kéo vào gói khởi động
    const { importPlanFile } = await import('./planImport');
    const r = await importPlanFile(file, { grade: opts.grade, weeksCount: opts.weeksCount });
    tables = r.distribution;
    source = r.source;
    notes.push(...r.notes, ...r.warnings);
  } catch (err) {
    // Tệp .txt hoặc tệp không có bảng: vẫn đọc chữ để lấy mục "Nhiệm vụ khác"
    if (!name.endsWith('.txt')) notes.push(err instanceof Error ? err.message : 'Không dò được bảng trong tệp.');
  }

  // 2) Đọc chữ để lấy tiêu đề, môn/lớp và mục II
  let text = '';
  if (name.endsWith('.txt')) {
    text = await file.text();
    source = 'Văn bản thuần';
  } else if (/\.(xlsx|xlsm|xls|ods|csv)$/.test(name)) {
    source = 'Excel';
    text = tables.map(d => `${d.topicTitle} ${d.equipment || ''} ${d.location || ''}`).join('\n');
  } else {
    try {
      const extracted = await extractTextFromFile(file);
      text = extracted.text;
      notes.push(...extracted.notes);
    } catch {
      /* đã có bảng thì thiếu phần chữ cũng không sao */
    }
  }

  // 3) Tách bảng chuyên đề khỏi bảng phân phối chương trình.
  //    Bộ đọc Phụ lục I trả về một danh sách chung, nên dựa vào chữ "chuyên đề"
  //    trong tên bài để tách; tệp nào ghi rõ hai bảng thì cách này khớp đúng.
  const isTopic = (d: ImportedDistItem) => /chuyen de/.test(fold(d.topicTitle || ''));
  const distribution = tables.filter(d => !isTopic(d)).map(toLine);
  const specialTopics = tables.filter(isTopic).map(toLine);

  const sc = detectSubjectAndClass(text);
  const otherTasks = extractOtherTasks(text);
  const titleLine = text.split('\n').map(l => l.trim()).find(l => /^ke hoach giao duc/.test(fold(l)));

  if (tables.length) notes.push(`Đọc được ${distribution.length} bài học${specialTopics.length ? ` và ${specialTopics.length} chuyên đề` : ''}.`);

  return {
    title: titleLine,
    grade: detectGrade(text) || opts.grade,
    subject: sc.subject,
    className: sc.className,
    distribution,
    specialTopics,
    otherTasks,
    recognized: tables.length > 0 || otherTasks.length > 0,
    rawText: text,
    source,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Nhập tệp gộp nhiều phần: dò từng bảng rồi tách theo loại kế hoạch và khối
// ---------------------------------------------------------------------------

/** Kết quả dò tệp, để người dùng xác nhận trước khi tạo kế hoạch */
export interface TeacherPlanAnalysis {
  source: string;
  notes: string[];
  parts: DetectedPart[];
  /** Lớp được phân công, nhiệm vụ kiêm nhiệm đọc được ở mục "Thông tin cá nhân" */
  className?: string;
  assignedTasks?: string;
  teacherName?: string;
}

/** Đọc dòng "- Lớp được phân công giảng dạy: ..." và "- Nhiệm vụ khác ...: ..." */
export function readPersonalInfo(text: string): { className?: string; assignedTasks?: string; teacherName?: string } {
  const out: { className?: string; assignedTasks?: string; teacherName?: string } = {};
  for (const raw of (text || '').split('\n')) {
    const line = raw.replace(/^[\s-–•*]+/, '').trim();
    const f = fold(line);
    const after = line.split(/[:：]/).slice(1).join(':').trim();
    if (!after) continue;
    if (!out.teacherName && /^ho va ten/.test(f)) out.teacherName = after;
    else if (!out.className && /^lop duoc phan cong/.test(f)) out.className = after;
    else if (!out.assignedTasks && /^nhiem vu khac/.test(f)) out.assignedTasks = after;
  }
  return out;
}

/**
 * Dò tệp kế hoạch của giáo viên. KHÔNG tạo kế hoạch nào – chỉ trả về các phần
 * đọc được để màn hình hỏi lại loại và khối của từng phần.
 */
export async function analyzeTeacherPlanFile(
  file: File,
  opts: { grade: 10 | 11 | 12 },
): Promise<TeacherPlanAnalysis> {
  const { readPlanGrids } = await import('./planImport');
  const { splitIntoParts } = await import('./teacherPlanSplit');
  const { grids, text, source, notes } = await readPlanGrids(file);
  const detected = splitIntoParts(grids, detectGrade(text) || opts.grade);
  const parts = detected.filter(p => p.coreLines.length + p.topicLines.length + p.experienceLines.length > 0);
  const skipped = detected.filter(p => !parts.includes(p));
  if (skipped.length) notes.push(`${skipped.length} nhóm chỉ có bảng kiểm tra, chưa có bảng phân phối được bỏ qua. Hãy đối chiếu phần kiểm tra trong tệp gốc.`);
  const info = readPersonalInfo(text);
  return { source, notes, parts, ...info };
}
