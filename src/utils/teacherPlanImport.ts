/**
 * Nhập Kế hoạch giáo dục của giáo viên (Phụ lục III CV 5512) từ tệp Word / Excel / PDF.
 *
 * Khác với planImport.ts (Phụ lục I – đọc BẢNG phân phối chương trình), Phụ lục III chủ yếu là
 * VĂN XUÔI theo mục, nên ở đây tách theo tiêu đề mục thay vì dò bảng.
 *
 * Phần đọc chữ của Word/PDF dùng lại extractTextFromFile() trong lessonImport.ts
 * (đã chuyển được công thức Word và MathType sang LaTeX).
 */
import { extractTextFromFile } from './lessonImport';

export interface ImportedTeacherPlan {
  title?: string;
  grade?: 10 | 11 | 12;
  teacherName?: string;
  teachingTasks: string;
  selfStudyPlan: string;
  expectedResults: string;
  /** Có nhận ra ít nhất một mục theo tiêu đề hay không */
  recognized: boolean;
  rawText: string;
}

export interface TeacherPlanImportResult extends ImportedTeacherPlan {
  source: string;
  notes: string[];
}

type Bucket = 'tasks' | 'study' | 'results' | null;

/** Bỏ dấu để so khớp tiêu đề không phụ thuộc dấu và chữ hoa/thường */
const fold = (s: string) =>
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
 * Tiêu đề mục phải nằm ở ĐẦU dòng (cho phép vài từ dẫn như "Kế hoạch", "Công tác").
 * Không neo đầu dòng thì một dòng nội dung như "Hoàn thành 2 mô-đun BDTX" sẽ bị nhận
 * nhầm là tiêu đề và mất nội dung.
 */
const LEAD = '(?:(?:ke hoach|cong tac|noi dung|phan|muc)\\s+)?';
const head = (body: string) => new RegExp(`^${LEAD}(?:${body})`);

const HEAD: { bucket: Exclude<Bucket, null>; re: RegExp }[] = [
  {
    bucket: 'tasks',
    re: head('nhiem vu|phan cong (chuyen mon|giang day|nhiem vu)|day hoc|giang day'),
  },
  {
    bucket: 'study',
    re: head('tu hoc|tu boi duong|boi duong thuong xuyen|bdtx|hoc tap( nang cao)?|nang cao trinh do|tu nghien cuu'),
  },
  {
    bucket: 'results',
    re: head('ket qua|chi tieu|dang ky thi dua|muc tieu phan dau'),
  },
];

/** Dòng này có phải tiêu đề mục không? Trả về mục tương ứng. */
export function classifyTeacherPlanHeading(line: string): Bucket {
  const bare = stripOrdinal(line).replace(/[:：].*$/, '');
  const f = fold(bare);
  if (!f || f.length > 90) return null;
  for (const h of HEAD) if (h.re.test(f)) return h.bucket;
  return null;
}

/** Đoán khối lớp từ toàn văn */
export function detectGrade(text: string): 10 | 11 | 12 | undefined {
  const f = fold(text);
  const m = f.match(/(?:khoi|lop)\s*(10|11|12)\b/);
  if (m) return Number(m[1]) as 10 | 11 | 12;
  return undefined;
}

/** Tách văn bản Phụ lục III thành 3 mục nội dung */
export function parseTeacherPlanText(text: string): ImportedTeacherPlan {
  const lines = text
    .normalize('NFC')
    .replace(/\r/g, '')
    .split('\n')
    // Gạch đầu dòng của phông Symbol/Wingdings → "- "
    .map(l => l.replace(/^[\s-•▪◦●○·]+(?=\S)/u, m => (/[-•▪◦●○·]/u.test(m) ? '- ' : '')))
    .map(l => l.replace(/[ \t]+/g, ' ').trimEnd())
    .filter(l => l.trim() !== '');

  const buckets: Record<Exclude<Bucket, null>, string[]> = { tasks: [], study: [], results: [] };
  let current: Bucket = null;
  let recognized = false;
  let title: string | undefined;
  let teacherName: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!title && /ke hoach/.test(fold(trimmed)) && fold(trimmed).length > 12) {
      title = trimmed.replace(/^[-–•*\s]+/, '');
    }
    if (!teacherName) {
      const m = trimmed.match(/^(?:h[oọ]\s*(?:v[àa]\s*)?t[êe]n|gi[áa]o\s*vi[êe]n|ng[ưu][ờo]i\s*l[ậa]p)\s*[:：]\s*(.+)$/i);
      if (m && m[1].trim().length > 2) teacherName = m[1].trim();
    }

    const heading = classifyTeacherPlanHeading(trimmed);
    if (heading) {
      current = heading;
      recognized = true;
      // Nội dung viết ngay sau dấu hai chấm trên cùng dòng tiêu đề
      const after = trimmed.split(/[:：]/).slice(1).join(':').trim();
      if (after) buckets[heading].push(after);
      continue;
    }

    if (current) buckets[current].push(stripOrdinal(trimmed) || trimmed);
  }

  const join = (arr: string[]) => arr.join('\n').trim();

  return {
    title,
    teacherName,
    grade: detectGrade(text),
    teachingTasks: join(buckets.tasks),
    selfStudyPlan: join(buckets.study),
    expectedResults: join(buckets.results),
    recognized,
    rawText: lines.join('\n'),
  };
}

/** Bảng Excel → các dòng chữ "nhãn: nội dung" để bộ tách mục ở trên xử lý được */
interface XLSXLike {
  read: (data: ArrayBuffer | Uint8Array, opts: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_json: <T>(sheet: unknown, opts: { header: number; blankrows: boolean; defval: string }) => T[] };
}

export function workbookToText(XLSX: XLSXLike, data: ArrayBuffer): string {
  const wb = XLSX.read(data, { type: 'array' });
  const out: string[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: '' });
    for (const row of rows) {
      const cells = (row || []).map(c => String(c ?? '').trim()).filter(Boolean);
      if (!cells.length) continue;
      // Ô đầu là nhãn mục, các ô sau là nội dung → "Nhãn: nội dung"
      out.push(cells.length > 1 ? `${cells[0]}: ${cells.slice(1).join(' ')}` : cells[0]);
    }
  }
  return out.join('\n');
}

/** Đọc tệp kế hoạch cá nhân và tách mục. Không ghi gì vào cơ sở dữ liệu. */
export async function importTeacherPlanFile(file: File): Promise<TeacherPlanImportResult> {
  const name = file.name.toLowerCase();

  if (/\.(xlsx|xlsm|xls|ods|csv)$/.test(name)) {
    const XLSX = (await import('@e965/xlsx')) as unknown as XLSXLike;
    const text = workbookToText(XLSX, await file.arrayBuffer());
    const parsed = parseTeacherPlanText(text);
    return {
      ...parsed,
      source: 'Excel',
      notes: ['Excel chỉ đọc được chữ trong ô; công thức toán và hình vẽ cần gõ lại.'],
    };
  }

  if (name.endsWith('.txt')) {
    const text = await file.text();
    const parsed = parseTeacherPlanText(text);
    return { ...parsed, source: 'Văn bản thuần', notes: [] };
  }

  // Word (.docx) và PDF: dùng lại bộ đọc của phần nhập giáo án
  const extracted = await extractTextFromFile(file);
  const parsed = parseTeacherPlanText(extracted.text);
  return {
    ...parsed,
    source: name.endsWith('.pdf') ? 'PDF' : 'Word',
    notes: extracted.notes,
  };
}
