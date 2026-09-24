/**
 * Nhập Kế hoạch dạy học (Phụ lục I / III CV 5512, PPCT) từ Word, PDF hoặc Excel.
 *
 *  Tệp → các "lưới" (bảng hàng × cột) → nhận ra hàng tiêu đề → map cột → phân phối chương trình
 *  + các bài kiểm tra định kỳ + mục "Đặc điểm tình hình".
 *
 * Nhận được các kiểu bảng hay gặp:
 *  - STT | Bài học | Số tiết | Yêu cầu cần đạt                          (Phụ lục I)
 *  - STT | Bài học | Số tiết | Thời điểm | Thiết bị | Địa điểm           (Phụ lục III)
 *  - Tuần | Tiết | Tên bài | ...  (mỗi tiết một hàng → tự gộp thành bài, cộng số tiết)
 *  - Bài kiểm tra, đánh giá | Thời gian | Thời điểm | ... | Hình thức     (bảng kiểm tra định kỳ)
 */
import type { PlanDistributionItem } from '../types';
import type { PdfTextItem } from './lessonImport';

export interface PlanEvaluation {
  name: string;
  duration: number;
  week: number;
  format: string;
}

export type ImportedDistItem = Omit<PlanDistributionItem, 'id' | 'order'>;

export interface PlanImportResult {
  distribution: ImportedDistItem[];
  evaluations: PlanEvaluation[];
  generalSituation: string;
  /** Thông tin cho người dùng (đã đọc gì) */
  notes: string[];
  /** Cảnh báo (tuần ngoài khoảng, khác khối...) */
  warnings: string[];
}

export interface Grid {
  rows: string[][];
  /** Chữ đứng trước bảng (tiêu đề mục, "Khối lớp: 12"...) – dùng để biết bảng của khối nào */
  context: string;
}

export interface PlanImportOptions {
  grade: number;
  weeksCount: number;
  /** Số tiết/tuần dùng để ước tính tuần khi tệp không có cột tuần (Toán THPT: 3) */
  periodsPerWeek?: number;
}

// ---------------------------------------------------------------------------
// Tiện ích chữ
// ---------------------------------------------------------------------------
export const norm = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const clean = (s: string) => (s || '').replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const oneLine = (s: string) => clean(s).replace(/\n+/g, ' ');

type DistField = 'stt' | 'grade' | 'objectives' | 'equipment' | 'location' | 'notes' | 'periods' | 'tiet' | 'week' | 'topic' | 'chapter';
type EvalField = 'name' | 'duration' | 'week' | 'format';

const DIST_RULES: [DistField, RegExp][] = [
  ['stt', /^(stt|tt|so tt|so thu tu|thu tu)$/],
  ['grade', /^(khoi|lop|khoi lop)$/],
  ['objectives', /yeu cau|muc tieu|yccd|chuan kien thuc/],
  ['equipment', /thiet bi|hoc lieu|do dung/],
  ['location', /dia diem/],
  ['notes', /ghi chu|kiem tra|danh gia/],
  ['periods', /so tiet|thoi luong|tong so tiet/],
  ['tiet', /^tiet\b|ppct/],
  ['week', /tuan|thoi diem|thoi gian/],
  ['topic', /bai hoc|ten bai|chu de|noi dung|bai day|^bai$|ten chuong trinh/],
  ['chapter', /^chuong$|^mach/],
];
const EVAL_RULES: [EvalField, RegExp][] = [
  ['name', /kiem tra|danh gia/],
  ['duration', /thoi gian|thoi luong/],
  ['week', /thoi diem|tuan/],
  ['format', /hinh thuc/],
];

const headerText = (cell: string) => norm(cell).replace(/\(\s*\d+\s*\)/g, '').replace(/[*:]/g, '').trim();

type Header =
  | { kind: 'dist'; map: Partial<Record<DistField, number>> }
  | { kind: 'eval'; map: Partial<Record<EvalField, number>> };

/** Hàng này có phải hàng tiêu đề bảng không? */
export function classifyHeader(cells: string[]): Header | null {
  const texts = cells.map(headerText);
  const shortCells = texts.map((t, i) => ({ t, i })).filter(x => x.t && x.t.length <= 60 && !/\d/.test(x.t)); // ô tiêu đề không chứa số
  if (shortCells.length < 2) return null;

  // Bảng kiểm tra định kỳ
  const ev: Partial<Record<EvalField, number>> = {};
  for (const { t, i } of shortCells) {
    const f = EVAL_RULES.find(([, re]) => re.test(t))?.[0];
    if (f && ev[f] === undefined) ev[f] = i;
  }
  const looksDist = shortCells.some(({ t }) => /so tiet|bai hoc|ten bai|noi dung|chu de|thoi luong/.test(t));
  // Bảng kiểm tra định kỳ: cột tên bài kiểm tra là cột ĐẦU (sau STT). Bảng phân phối có cột "Kiểm tra, đánh giá"
  // (cách đánh giá từng bài/chuyên đề) không phải bảng kiểm tra định kỳ.
  const firstCol = shortCells.find(({ t }) => !/^(stt|tt)$/.test(t))?.i;
  if (!looksDist && ev.name !== undefined && ev.name === firstCol && (ev.duration !== undefined || ev.format !== undefined || ev.week !== undefined)) {
    return { kind: 'eval', map: ev };
  }

  const map: Partial<Record<DistField, number>> = {};
  for (const { t, i } of shortCells) {
    const f = DIST_RULES.find(([, re]) => re.test(t))?.[0];
    if (f && map[f] === undefined) map[f] = i;
  }
  const known = Object.keys(map).length;
  if (map.topic !== undefined && known >= 2 && (map.periods !== undefined || map.tiet !== undefined || map.week !== undefined || map.objectives !== undefined)) {
    return { kind: 'dist', map };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Đọc số
// ---------------------------------------------------------------------------
const monthToWeek = (m: number) => (m >= 9 ? (m - 9) * 4 + 2 : m <= 5 ? (m + 3) * 4 + 2 : NaN);

export function parseWeek(text: string): number | undefined {
  const t = norm(text);
  if (!t) return undefined;
  const w = t.match(/tuan\s*(?:thu\s*)?(\d{1,2})/);
  if (w) return Number(w[1]);
  const m = t.match(/thang\s*(\d{1,2})/);
  if (m) {
    const v = monthToWeek(Number(m[1]));
    return Number.isNaN(v) ? undefined : v;
  }
  const n = t.match(/^(\d{1,2})\b/);
  return n ? Number(n[1]) : undefined;
}

export function parsePeriods(text: string): number | undefined {
  const m = norm(text).match(/(\d{1,2})/);
  if (!m) return undefined;
  const v = Number(m[1]);
  return v > 0 && v <= 60 ? v : undefined;
}

/** "1-3" → {count 3, first 1}; "4, 5" → {2, 4}; "Tiết 7" → {1, 7} */
export function parseTietRange(text: string): { count: number; first: number } | undefined {
  const t = norm(text).replace(/[–—→]/g, '-');
  if (!/\d/.test(t)) return undefined;
  let count = 0;
  let first = Infinity;
  const re = /(\d{1,3})\s*(?:-\s*(\d{1,3}))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (b >= a && b - a < 40) {
      count += b - a + 1;
      first = Math.min(first, a);
    }
  }
  return count ? { count, first } : undefined;
}

function gradesIn(text: string): number[] {
  const out = new Set<number>();
  const re = /(?:khoi|lop)(?:\s*lop)?\s*:?\s*(10|11|12)(?![0-9a-z])/g;
  let m: RegExpExecArray | null;
  const t = norm(text);
  while ((m = re.exec(t))) out.add(Number(m[1]));
  return [...out];
}

const isHeadingText = (t: string) => /^(chuong|phan [ivx\d]|hoc k[yi]|hk ?[i12]\b|mach)/.test(norm(t));
const topicKey = (t: string) =>
  norm(t)
    .replace(/[(\[]?\s*tiet\s*\d+(\s*[-,]\s*\d+)*\s*[)\]]?\s*$/, '')
    .replace(/[\s.,;:–-]+$/, '')
    .trim();

function evalWeekFromName(name: string, weeksCount: number): number {
  const t = norm(name);
  const scale = (w: number) => Math.min(weeksCount, Math.max(1, Math.round((w * weeksCount) / 35)));
  const hk2 = /(ky|ki|hk)\s*(ii|2)\b/.test(t);
  if (/giua/.test(t)) return scale(hk2 ? 27 : 9);
  if (/cuoi|hoc ky|hoc ki/.test(t)) return scale(hk2 ? 35 : 18);
  return scale(9);
}

// ---------------------------------------------------------------------------
// Lưới → bảng → kế hoạch
// ---------------------------------------------------------------------------
interface FoundTable {
  header: Header;
  rows: string[][];
  context: string;
}

/** Tách một lưới thành các bảng (một sheet Excel có thể chứa cả bảng PPCT và bảng kiểm tra) */
export function splitGrid(grid: Grid): FoundTable[] {
  const tables: FoundTable[] = [];
  let context = grid.context;
  let cur: FoundTable | null = null;
  for (const row of grid.rows) {
    const h = classifyHeader(row);
    if (h) {
      // Tiêu đề lặp lại (bảng sang trang mới) → bỏ qua
      if (cur && cur.header.kind === h.kind && JSON.stringify(cur.header.map) === JSON.stringify(h.map)) continue;
      cur = { header: h, rows: [], context };
      tables.push(cur);
      continue;
    }
    if (cur) cur.rows.push(row);
    else context += '\n' + row.filter(Boolean).join(' ');
  }
  return tables;
}

export function parsePlanGrids(grids: Grid[], text: string, opts: PlanImportOptions): PlanImportResult {
  const { grade, weeksCount } = opts;
  const perWeek = opts.periodsPerWeek || 3;
  const notes: string[] = [];
  const warnings: string[] = [];

  let tables = grids.flatMap(splitGrid);
  // Bảng thuộc khối nào (theo chữ phía trên bảng, hoặc tiêu đề đầu tệp)
  const docGrades = gradesIn(text.split('\n').slice(0, 25).join(' '));
  const tableGrade = (t: FoundTable) => {
    const g = gradesIn(t.context.split('\n').slice(-12).join(' '));
    if (g.length === 1) return g[0];
    return docGrades.length === 1 ? docGrades[0] : undefined;
  };
  const distTables = tables.filter(t => t.header.kind === 'dist');
  const graded = distTables.map(t => ({ t, g: tableGrade(t) }));
  if (graded.some(x => x.g === grade)) {
    const drop = graded.filter(x => x.g !== undefined && x.g !== grade).map(x => x.t);
    if (drop.length) notes.push(`bỏ qua ${drop.length} bảng của khối khác`);
    tables = tables.filter(t => !drop.includes(t));
  } else if (graded.length && graded.every(x => x.g !== undefined)) {
    warnings.push(`Tệp có vẻ là kế hoạch Khối ${[...new Set(graded.map(x => x.g))].join(', ')}, không phải Khối ${grade} – hãy kiểm tra lại.`);
  }

  // ----- Phân phối chương trình -----
  const items: (ImportedDistItem & { _key: string; _first?: number })[] = [];
  let weekOutOfRange = 0;
  for (const t of tables) {
    if (t.header.kind !== 'dist') continue;
    const map = t.header.map;
    const cell = (row: string[], f: DistField) => (map[f] !== undefined ? clean(row[map[f]!] || '') : '');
    for (const row of t.rows) {
      const nonEmpty = row.map(c => clean(c)).filter(Boolean);
      if (!nonEmpty.length) continue;
      // hàng đánh số cột (1) (2) (3)
      if (nonEmpty.every(c => /^\(\d{1,2}\)$/.test(c)) || (nonEmpty.every(c => /^\d{1,2}$/.test(c)) && !cell(row, 'topic'))) continue;
      const topicRaw = cell(row, 'topic');
      const topic = oneLine(topicRaw);
      const distinct = [...new Set(nonEmpty)];
      // Hàng tiêu đề chương / học kỳ (thường là ô gộp ngang)
      if ((distinct.length === 1 && !/^\d+$/.test(distinct[0]) && !cell(row, 'periods') && !cell(row, 'objectives')) ||
        (topic && isHeadingText(topic) && !cell(row, 'periods') && !cell(row, 'tiet'))) {
        if (distinct.length === 1 || isHeadingText(topic)) continue;
      }
      if (/^tong( cong)?\b|^cong\b/.test(norm(topic || nonEmpty[0]))) continue;
      const g = cell(row, 'grade');
      if (g && /\b(10|11|12)\b/.test(g) && !new RegExp(`\\b${grade}\\b`).test(g)) continue;

      const objectives = cell(row, 'objectives');
      if (!topic) {
        // Dòng nối tiếp của bài trước (Excel tách nhiều dòng)
        const prev = items[items.length - 1];
        if (prev && objectives) prev.objectives = prev.objectives ? `${prev.objectives}\n${objectives}` : objectives;
        continue;
      }
      const tiet = parseTietRange(cell(row, 'tiet'));
      let periods = parsePeriods(cell(row, 'periods'));
      if (periods === undefined && tiet) periods = tiet.count;
      if (periods === undefined) {
        const inTitle = norm(topic).match(/\((\d{1,2}) tiet\)/);
        periods = inTitle ? Number(inTitle[1]) : 1;
      }
      const week = parseWeek(cell(row, 'week'));
      const equipment = oneLine(cell(row, 'equipment'));
      const location = oneLine(cell(row, 'location'));
      const notesCell = oneLine(cell(row, 'notes'));
      const key = topicKey(topic);

      const prev = items[items.length - 1];
      if (prev && prev._key === key) {
        // Mỗi tiết một hàng → gộp thành một bài
        prev.periods += periods;
        if (objectives && !prev.objectives.includes(objectives)) prev.objectives = prev.objectives ? `${prev.objectives}\n${objectives}` : objectives;
        if (equipment && !(prev.equipment || '').includes(equipment)) prev.equipment = prev.equipment ? `${prev.equipment}; ${equipment}` : equipment;
        continue;
      }
      items.push({
        _key: key,
        _first: tiet?.first,
        week: week ?? 0,
        topicTitle: topic.replace(/\s*[(\[]\s*ti[eế]t\s*\d+(\s*[-,]\s*\d+)*\s*[)\]]\s*$/i, '').slice(0, 300),
        periods,
        objectives,
        equipment,
        ...(location ? { location } : {}),
        ...(notesCell ? { notes: notesCell } : {}),
        status: 'planned',
      });
    }
  }

  // Tuần: có cột tuần → dùng; thiếu → theo số thứ tự tiết, hoặc chép tuần trước, hoặc cộng dồn số tiết
  const anyWeek = items.some(i => i.week > 0);
  let cum = 0;
  let last = 1;
  for (const it of items) {
    if (!it.week) {
      if (it._first) it.week = Math.ceil(it._first / perWeek);
      else if (anyWeek) it.week = last;
      else it.week = Math.floor(cum / perWeek) + 1;
    }
    if (it.week > weeksCount || it.week < 1) {
      weekOutOfRange++;
      it.week = Math.min(weeksCount, Math.max(1, it.week));
    }
    last = it.week;
    cum += it.periods;
  }
  if (items.length && !anyWeek) notes.push(`tệp không có cột tuần – đã ước tính theo ${perWeek} tiết/tuần`);
  if (weekOutOfRange) warnings.push(`${weekOutOfRange} bài có tuần ngoài khoảng 1–${weeksCount}, đã đưa về trong khoảng.`);

  // ----- Kiểm tra định kỳ -----
  const evaluations: PlanEvaluation[] = [];
  for (const t of tables) {
    if (t.header.kind !== 'eval') continue;
    const map = t.header.map;
    const cell = (row: string[], f: EvalField) => (map[f] !== undefined ? oneLine(row[map[f]!] || '') : '');
    for (const row of t.rows) {
      const name = cell(row, 'name');
      if (!name || /^\(?\d{1,2}\)?$/.test(name)) continue;
      if (name.length > 80) {
        warnings.push(`Bỏ qua dòng kiểm tra quá dài (có thể không phải tên bài kiểm tra): "${name.slice(0, 50)}…"`);
        continue;
      }
      const dur = cell(row, 'duration').match(/(\d{2,3})/);
      const wk = parseWeek(cell(row, 'week'));
      evaluations.push({
        name: name.slice(0, 120),
        duration: dur ? Number(dur[1]) : 90,
        week: Math.min(weeksCount, Math.max(1, wk ?? evalWeekFromName(`${name} ${cell(row, 'week')}`, weeksCount))),
        format: cell(row, 'format') || 'Trắc nghiệm + Tự luận',
      });
    }
  }

  // ----- Nếu không có bảng: đọc từng dòng "Bài 1. ... (3 tiết)" -----
  if (!items.length && text) {
    const re = /^(?:[-•+]\s*)?((?:bài|chủ đề|§|chương)\s*\d+[^\n]*?)\s*[(\-–:]\s*(\d{1,2})\s*tiết\)?\s*$/i;
    let cum2 = 0;
    for (const line of text.split('\n')) {
      const m = line.trim().match(re);
      if (!m || /^chương/i.test(m[1])) continue;
      const periods = Number(m[2]);
      items.push({ _key: '', week: Math.min(weeksCount, Math.floor(cum2 / perWeek) + 1), topicTitle: m[1].trim(), periods, objectives: '', equipment: '', status: 'planned' });
      cum2 += periods;
    }
    if (items.length) notes.push('không thấy bảng – đã đọc theo dòng "Bài … (n tiết)", tuần được ước tính');
  }

  // ----- Đặc điểm tình hình -----
  let generalSituation = '';
  const lines = text.split('\n');
  const start = lines.findIndex(l => /dac diem tinh hinh/.test(norm(l)));
  if (start >= 0) {
    const out: string[] = [];
    // Dòng tiêu đề có thể kèm nội dung: "I. Đặc điểm tình hình: ..."
    const tail = lines[start].replace(/^.*?đặc điểm tình hình[^:]*:?/i, '').trim();
    if (tail) out.push(tail);
    for (const l of lines.slice(start + 1)) {
      const n = norm(l);
      if (/^(ii|2)[.)\s]\s*(ke hoach|phan phoi)|^ii[.\s]|ke hoach day hoc|phan phoi chuong trinh/.test(n)) break;
      out.push(l.trim());
      if (out.join('\n').length > 3000) break;
    }
    generalSituation = out.join('\n').trim().slice(0, 3000);
  }

  const distribution: ImportedDistItem[] = items.map(({ _key: _k, _first: _f, ...rest }) => rest);
  return { distribution, evaluations, generalSituation, notes, warnings };
}

// ---------------------------------------------------------------------------
// Excel → lưới
// ---------------------------------------------------------------------------
type XLSXLike = {
  read: (data: ArrayBuffer | Uint8Array, opts: { type: 'array' }) => { SheetNames: string[]; Sheets: Record<string, Record<string, unknown>> };
  utils: {
    sheet_to_json: (ws: unknown, opts: Record<string, unknown>) => unknown[][];
    decode_range: (r: string) => { s: { r: number; c: number }; e: { r: number; c: number } };
  };
};

export function workbookToGrids(XLSX: XLSXLike, data: ArrayBuffer | Uint8Array): Grid[] {
  const wb = XLSX.read(data, { type: 'array' });
  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const ref = ws['!ref'] as string | undefined;
    if (!ref) return { rows: [], context: name };
    const range = XLSX.utils.decode_range(ref);
    const rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: true }) as unknown[][]).map(r =>
      r.map(v => String(v ?? '')),
    );
    // Ô gộp dọc → chép giá trị xuống các hàng dưới (cột đầu của vùng gộp)
    const merges = (ws['!merges'] as { s: { r: number; c: number }; e: { r: number; c: number } }[] | undefined) || [];
    for (const m of merges) {
      if (m.e.r <= m.s.r) continue;
      const r0 = m.s.r - range.s.r;
      const c0 = m.s.c - range.s.c;
      const v = rows[r0]?.[c0] ?? '';
      for (let r = r0 + 1; r <= m.e.r - range.s.r; r++) {
        if (!rows[r]) continue;
        rows[r][c0] = v;
      }
    }
    return { rows, context: name };
  });
}

// ---------------------------------------------------------------------------
// PDF → lưới (dựng lại bảng theo tọa độ chữ)
// ---------------------------------------------------------------------------
interface Seg {
  text: string;
  x: number;
  end: number;
  y: number;
}
type Line = { y: number; segs: Seg[] };

function pageLines(items: PdfTextItem[]): Line[] {
  const pieces = items
    .filter(it => typeof it.str === 'string' && it.str.length > 0 && Array.isArray(it.transform))
    .map(it => ({ s: it.str as string, x: it.transform![4], y: it.transform![5], w: it.width || 0 }));
  const groups: (typeof pieces)[] = [];
  for (const pc of pieces) {
    const g = groups.find(l => Math.abs(l[0].y - pc.y) <= 2);
    if (g) g.push(pc);
    else groups.push([pc]);
  }
  groups.sort((a, b) => b[0].y - a[0].y);
  return groups.map(g => {
    const sorted = [...g]
      .map(pc => ({ ...pc, s: pc.s.replace(/[\u0000-\u001f]/g, '') }))
      .filter(pc => pc.s)
      .sort((a, b) => a.x - b.x);
    // Chữ có dấu vẽ bằng phông dự phòng, đè lên chỗ trống trong mảnh chữ chính ("Luy n t p" + "ệ" + "ậ" → "Luyện tập")
    const base: typeof sorted = [];
    const overlays = new Map<(typeof sorted)[number], (typeof sorted)[number][]>();
    for (const pc of sorted) {
      const host = pc.s.trim().length >= 1 && pc.s.trim().length <= 2 ? base.find(h => pc.x > h.x + 0.5 && pc.x < h.x + h.w - 0.5 && h.s.length > 2 && h.s.includes(' ')) : undefined;
      if (host) {
        if (!overlays.has(host)) overlays.set(host, []);
        overlays.get(host)!.push(pc);
      } else base.push(pc);
    }
    overlays.forEach((ovs, host) => {
      const placed = placeOverlays(host.s, host.x, host.w, ovs.map(o => o.x));
      if (placed) {
        const chars = [...host.s];
        placed.forEach((k, j) => (chars[k] = ovs[j].s.trim()));
        host.s = chars.join('');
      } else base.push(...ovs);
    });
    base.sort((p1, p2) => p1.x - p2.x);
    const kept = base.filter(pc => !(pc.s.trim() === '' && base.some(o => o !== pc && o.s.trim() !== '' && Math.abs(o.x - pc.x) < 1)));
    const segs: Seg[] = [];
    for (const pc of kept) {
      if (!pc.s.trim()) continue; // khoảng trắng (có khi rộng cả cột) không dùng để nối
      const cur = segs[segs.length - 1];
      if (cur && pc.x - cur.end < 4) {
        if (pc.x - cur.end > 1.5 && !cur.text.endsWith(' ') && !pc.s.startsWith(' ')) cur.text += ' ';
        cur.text += pc.s;
        cur.end = Math.max(cur.end, pc.x + pc.w);
      } else if (pc.s.trim()) {
        segs.push({ text: pc.s, x: pc.x, end: pc.x + pc.w, y: pc.y });
      }
    }
    segs.forEach(s => (s.text = s.text.trim()));
    return { y: g[0].y, segs: segs.filter(s => s.text) };
  }).filter(l => l.segs.length);
}

/** Chọn các khoảng trắng trong chuỗi để đặt chữ đè (theo thứ tự), sao cho vị trí ước lượng khớp nhất */
function placeOverlays(str: string, x: number, w: number, xs: number[]): number[] | null {
  const chars = [...str];
  const spaces = chars.map((c, k) => (c === ' ' ? k : -1)).filter(k => k >= 0);
  const n = xs.length;
  if (!n || spaces.length < n) return null;
  const wOf = (ch: string) => (ch === ' ' ? 0.25 : /[.,;:'!|ilIjft()]/.test(ch) ? 0.28 : ch === 'r' ? 0.35 : /[MW]/.test(ch) ? 0.85 : /[mw]/.test(ch) ? 0.75 : /[A-ZĐ]/.test(ch) ? 0.65 : 0.5);
  const cost = (pick: number[]) => {
    const set = new Set(pick);
    const ws = chars.map((c, k) => (set.has(k) ? 0.5 : wOf(c)));
    const total = ws.reduce((a2, v) => a2 + v, 0);
    let err = 0;
    pick.forEach((k, j) => {
      const left = x + (ws.slice(0, k).reduce((a2, v) => a2 + v, 0) / total) * w;
      err += Math.abs(left - xs[j]);
    });
    return err;
  };
  let best: number[] | null = null;
  let bestCost = Infinity;
  let budget = 20000;
  const rec = (start: number, pick: number[]) => {
    if (budget-- <= 0) return;
    if (pick.length === n) {
      const c = cost(pick);
      if (c < bestCost) {
        bestCost = c;
        best = [...pick];
      }
      return;
    }
    for (let q = start; q <= spaces.length - (n - pick.length); q++) rec(q + 1, [...pick, spaces[q]]);
  };
  rec(0, []);
  return best;
}

const STOP_RE = /^(i{1,3}|iv|v)\.\s|^(\d\.\s+)?(kiem tra,? danh gia dinh ky|cac nhiem vu khac|to truong|hieu truong|giao vien|nguoi lap|duyet cua)|^\.{3,}|ngay\s*\.*\s*thang/;

/** Dựng các bảng từ các trang PDF. Trả về lưới có hàng tiêu đề ở đầu. */
export function pdfPagesToGrids(pages: PdfTextItem[][]): { grids: Grid[]; text: string } {
  const grids: Grid[] = [];
  const textLines: string[] = [];
  let active: { cols: { x: number; end: number; text: string }[]; bounds: number[]; grid: Grid } | null = null;
  let context: string[] = [];

  const flushRows = (lines: Line[], cols: number, bounds: number[], anchorCol: number, grid: Grid, anchorRe = /^\d{1,3}[.)]?$|^\d{1,2}\s*(-|,)\s*\d{1,2}$/) => {
    const colOf = (x: number) => {
      let c = 0;
      for (let i = 1; i < cols; i++) if (x >= bounds[i]) c = i;
      return c;
    };
    const isAnchor = (l: Line) =>
      l.segs.some(s => colOf(s.x) === anchorCol && anchorRe.test(s.text)) || l.segs.some(s => /^(tổng|cộng)\b/i.test(s.text));
    const isHeading = (l: Line) => !isAnchor(l) && isHeadingText(l.segs.map(s => s.text).join(' '));
    const anchors = lines.map((l, i) => (isAnchor(l) ? i : -1)).filter(i => i >= 0);
    if (!anchors.length) return;
    // Căn giữa theo chiều dọc? (có chữ ở cột nội dung phía trên số thứ tự đầu tiên)
    const centered = lines.slice(0, anchors[0]).some(l => !isHeading(l));
    const owner = lines.map((l, i) => {
      if (isHeading(l)) return -1;
      if (isAnchor(l)) return i;
      if (centered) {
        let best = anchors[0];
        for (const a of anchors) if (Math.abs(lines[a].y - l.y) < Math.abs(lines[best].y - l.y)) best = a;
        return best;
      }
      const prev = anchors.filter(a => a < i);
      return prev.length ? prev[prev.length - 1] : -1;
    });
    const cellsByAnchor = new Map<number, string[][]>(anchors.map(a => [a, Array.from({ length: cols }, () => [] as string[])]));
    const ordered: { y: number; row: string[] }[] = [];
    lines.forEach((l, i) => {
      if (isHeading(l)) {
        ordered.push({ y: l.y, row: [l.segs.map(s => s.text).join(' '), ...Array(cols - 1).fill('')] });
        return;
      }
      const cells = cellsByAnchor.get(owner[i]);
      if (cells) for (const s of l.segs) cells[colOf(s.x)].push(s.text);
    });
    for (const a of anchors) {
      const cells = cellsByAnchor.get(a)!;
      ordered.push({ y: lines[a].y, row: cells.map(parts => parts.join(' ').replace(/\s+(?=[-•+]\s)/g, '\n')) });
    }
    ordered.sort((p, q) => q.y - p.y).forEach(o => grid.rows.push(o.row));
  };

  for (const items of pages) {
    const lines = pageLines(items);
    lines.forEach(l => textLines.push(l.segs.map(s => s.text).join(' ')));
    // Bỏ số trang ở cuối trang
    const lastL = lines[lines.length - 1];
    if (lastL && lastL.segs.length === 1 && /^\d{1,3}$/.test(lastL.segs[0].text) && lines.length > 1 && lines[lines.length - 2].y - lastL.y > 15) lines.pop();

    let i = 0;
    let pending: Line[] = [];
    const endTable = () => {
      if (active && pending.length) {
        const map = classifyHeader(active.cols.map(c => c.text));
        const anchorCol = map
          ? ((map.map as Record<string, number>).stt ?? (map.map as Record<string, number>).periods ?? (map.map as Record<string, number>).tiet ?? (map.map as Record<string, number>).week ?? (map.map as Record<string, number>).duration ?? 0)
          : 0;
        if (map?.kind === 'eval') {
          // Bảng kiểm tra: mỗi hàng bắt đầu bằng chữ ở cột tên → neo theo cột thời gian
          flushRows(pending, active.cols.length, active.bounds, map.map.duration ?? map.map.week ?? 0, active.grid, /^\d{2,3}\s*(ph|'|’|$)|^tu[aầ]n/i);
        } else flushRows(pending, active.cols.length, active.bounds, anchorCol, active.grid);
      }
      pending = [];
    };
    while (i < lines.length) {
      // Thử nhận hàng tiêu đề (có thể gói trên 1–3 dòng)
      let header: { cols: { x: number; end: number; text: string }[]; used: number } | null = null;
      for (let k = 0; k < 3 && i + k < lines.length && !header; k++) {
        if (lines[i].y - lines[i + k].y > 40) break;
        if (/^(\d{1,2}|[ivx]{1,4})[.)]\s/.test(norm(lines[i].segs.map(x => x.text).join(' ')))) break;
        const segs = lines.slice(i, i + k + 1).flatMap(l => l.segs);
        const clusters: { x: number; end: number; parts: Seg[] }[] = [];
        for (const s of [...segs].sort((a, b) => a.x - b.x)) {
          const c = clusters.find(cl => s.x <= cl.end + 2 && s.end >= cl.x - 2);
          if (c) {
            c.parts.push(s);
            c.x = Math.min(c.x, s.x);
            c.end = Math.max(c.end, s.end);
          } else clusters.push({ x: s.x, end: s.end, parts: [s] });
        }
        clusters.sort((a, b) => a.x - b.x);
        const cols = clusters.map(c => ({
          x: c.x,
          end: c.end,
          text: c.parts.sort((a, b) => b.y - a.y || a.x - b.x).map(p => p.text).join(' '),
        }));
        if (cols.length >= 2 && classifyHeader(cols.map(c => c.text))) header = { cols, used: k + 1 };
      }
      if (header) {
        // Dòng tiêu đề còn tiếp ("đánh giá", "(1) (2) (3)")
        let prevY = lines[i + header.used - 1].y;
        while (i + header.used < lines.length) {
          const nl = lines[i + header.used];
          const isNum = (t: string) => /^\(\d{1,2}\)$/.test(t);
          const overlaps = (sg: Seg) => header!.cols.find(c => sg.x >= c.x - 3 && sg.x <= c.end + 3);
          const ok =
            prevY - nl.y <= 18 &&
            !isHeadingText(nl.segs.map(sg => sg.text).join(' ')) &&
            nl.segs.every(sg => isNum(sg.text) || (!/\d/.test(sg.text) && overlaps(sg)));
          if (!ok) break;
          for (const sg of nl.segs) if (!isNum(sg.text)) overlaps(sg)!.text += ' ' + sg.text;
          prevY = nl.y;
          header.used++;
        }
        endTable();
        const same = active && active.cols.length === header.cols.length && active.cols.every((c, j) => Math.abs(c.x - header!.cols[j].x) < 6);
        if (!same) {
          const grid: Grid = { rows: [header.cols.map(c => c.text)], context: context.slice(-12).join('\n') };
          grids.push(grid);
          active = { cols: header.cols, bounds: [], grid };
        }
        // Ranh giới cột: vị trí bắt đầu chữ lặp lại nhiều lần trong khoảng giữa hai tiêu đề, nếu không thì điểm giữa
        const after = lines.slice(i + header.used).flatMap(l => l.segs.map(s => s.x));
        active!.bounds = active!.cols.map((c, j) => {
          if (j === 0) return -Infinity;
          const prev = active!.cols[j - 1];
          const lo = prev.end;
          const hi = c.x + 1;
          const cands = after.filter(x => x > lo && x < hi);
          const freq = cands
            .map(x => ({ x, n: cands.filter(y => Math.abs(y - x) < 1.5).length }))
            .filter(v => v.n >= 2)
            .sort((a, b) => a.x - b.x);
          return freq.length ? freq[0].x - 1 : (lo + hi) / 2;
        });
        i += header.used;
        continue;
      }
      const l = lines[i];
      const txt = norm(l.segs.map(s => s.text).join(' '));
      // Hết bảng: dòng mục mới ("2. Chuyên đề...", "III. ...") nằm sát lề trái bảng, hoặc chữ ký/ngày tháng
      const leftEdge = active ? active.cols[0].x : 0;
      const sectionLine = l.segs.length === 1 && l.segs[0].x <= leftEdge + 3 && /^(\d{1,2}|[ivx]{1,4})[.)]\s+\S/.test(txt);
      if (active && (STOP_RE.test(txt) || sectionLine)) {
        endTable();
        active = null;
      }
      if (active) pending.push(l);
      else context.push(l.segs.map(s => s.text).join(' '));
      i++;
    }
    endTable(); // bảng có thể tiếp tục ở trang sau (giữ active)
  }
  return { grids, text: textLines.join('\n') };
}

// ---------------------------------------------------------------------------
// Tệp → kết quả (chạy trên trình duyệt)
// ---------------------------------------------------------------------------
export async function importPlanFile(file: File, opts: PlanImportOptions): Promise<PlanImportResult & { source: string }> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (/\.(xlsx|xlsm|xls|ods|csv)$/.test(name)) {
    const XLSX = (await import('@e965/xlsx')) as unknown as XLSXLike;
    const grids = workbookToGrids(XLSX, buffer);
    const r = parsePlanGrids(grids, '', opts);
    return { ...r, source: 'Excel' };
  }
  if (name.endsWith('.docx')) {
    const { readDocx } = await import('./docxReader');
    const d = await readDocx(buffer, { imageBudget: 0 });
    const lines = d.text.split('\n');
    const grids = d.tables.map((t, i) => {
      const prevEnd = i > 0 ? d.tables[i - 1].lineIndex : 0;
      return { rows: t.rows, context: lines.slice(Math.max(prevEnd, t.lineIndex - 12), t.lineIndex).join('\n') };
    });
    const r = parsePlanGrids(grids, d.text, opts);
    if (d.equations) r.notes.push(`${d.equations} công thức được giữ dạng LaTeX`);
    return { ...r, source: 'Word' };
  }
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await task.promise;
    const pages: PdfTextItem[][] = [];
    for (let p = 1; p <= pdf.numPages; p++) pages.push((await (await pdf.getPage(p)).getTextContent()).items as PdfTextItem[]);
    await task.destroy();
    const { grids, text } = pdfPagesToGrids(pages);
    const r = parsePlanGrids(grids, text, opts);
    r.notes.push('PDF được dựng lại bảng theo vị trí chữ – nên xem kỹ trước khi lưu');
    return { ...r, source: 'PDF' };
  }
  if (name.endsWith('.doc')) throw new Error('Tệp .doc (Word 97-2003) không đọc được. Hãy mở bằng Word và "Lưu thành" .docx rồi nhập lại.');
  throw new Error('Chỉ hỗ trợ Word (.docx), PDF (.pdf) hoặc Excel (.xlsx, .xls).');
}

/** Tải tệp Excel mẫu cho kế hoạch dạy học */
export async function downloadPlanTemplate(grade: number) {
  const XLSX = await import('@e965/xlsx');
  const wb = XLSX.utils.book_new();
  const dist = [
    ['KẾ HOẠCH DẠY HỌC MÔN TOÁN – KHỐI LỚP ' + grade],
    [],
    ['STT', 'Tuần', 'Bài học / Chủ đề', 'Số tiết', 'Yêu cầu cần đạt', 'Thiết bị dạy học', 'Địa điểm dạy học'],
    [1, 1, 'Bài 1. Tính đơn điệu và cực trị của hàm số', 3, '- Nhận biết tính đồng biến, nghịch biến của hàm số\n- Tìm cực trị của hàm số', 'Máy chiếu, GeoGebra', 'Lớp học'],
    [2, 2, 'Bài 2. Giá trị lớn nhất và giá trị nhỏ nhất của hàm số', 2, '- Tìm GTLN, GTNN của hàm số trên một đoạn', 'Máy chiếu', 'Lớp học'],
  ];
  const evals = [
    ['Bài kiểm tra, đánh giá', 'Thời gian (phút)', 'Thời điểm', 'Hình thức'],
    ['Giữa học kỳ I', 90, 'Tuần 9', '12 TN + 4 Đúng/Sai + 6 Trả lời ngắn'],
    ['Cuối học kỳ I', 90, 'Tuần 18', '12 TN + 4 Đúng/Sai + 6 Trả lời ngắn'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(dist);
  ws1['!cols'] = [{ wch: 5 }, { wch: 6 }, { wch: 50 }, { wch: 8 }, { wch: 60 }, { wch: 25 }, { wch: 15 }];
  const ws2 = XLSX.utils.aoa_to_sheet(evals);
  ws2['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'PhanPhoi');
  XLSX.utils.book_append_sheet(wb, ws2, 'KiemTra');
  XLSX.writeFile(wb, `Mau_Ke_hoach_day_hoc_Khoi_${grade}.xlsx`);
}
