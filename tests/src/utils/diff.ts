/**
 * So sánh hai ảnh chụp (snapshot) phiên bản kế hoạch/giáo án.
 * Bản cũ hiển thị bảng "so sánh" với nội dung cố định viết sẵn, không phản ánh dữ liệu thật.
 */
export interface DiffEntry {
  path: string;
  label: string;
  kind: 'added' | 'removed' | 'changed';
  before?: string;
  after?: string;
}

type Plain = Record<string, unknown>;

const FIELD_LABELS: Record<string, string> = {
  title: 'Tiêu đề',
  generalSituation: 'Đặc điểm tình hình',
  totalPeriods: 'Tổng số tiết',
  distribution: 'Phân phối chương trình',
  periodicEvaluations: 'Kiểm tra định kỳ',
  order: 'STT',
  week: 'Tuần',
  topicTitle: 'Bài học/Chủ đề',
  periods: 'Số tiết',
  objectives: 'Yêu cầu cần đạt / Mục tiêu',
  equipment: 'Thiết bị dạy học',
  name: 'Tên',
  duration: 'Thời gian (phút)',
  format: 'Hình thức',
  periodCount: 'Số tiết',
  objectivesKnowledge: 'Mục tiêu kiến thức',
  objectivesCompetence: 'Mục tiêu năng lực',
  objectivesQualities: 'Mục tiêu phẩm chất',
  activities: 'Hoạt động',
  content: 'Nội dung',
  product: 'Sản phẩm',
  implementation: 'Tổ chức thực hiện',
};

const labelOf = (key: string) => FIELD_LABELS[key] || key;

const show = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '(trống)';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const isPlainObject = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v);

function itemName(item: unknown, index: number): string {
  if (isPlainObject(item)) {
    const n = item.topicTitle || item.name || item.title;
    if (n) return String(n);
  }
  return `#${index + 1}`;
}

function diffValues(a: unknown, b: unknown, path: string, label: string, out: DiffEntry[]) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const la = Array.isArray(a) ? a : [];
    const lb = Array.isArray(b) ? b : [];
    const hasIds = [...la, ...lb].every(x => isPlainObject(x) && typeof x.id === 'string');
    if (hasIds) {
      const mapA = new Map(la.map(x => [(x as Plain).id as string, x]));
      const mapB = new Map(lb.map(x => [(x as Plain).id as string, x]));
      lb.forEach((item, i) => {
        const id = (item as Plain).id as string;
        const name = `${label} › ${itemName(item, i)}`;
        if (!mapA.has(id)) out.push({ path: `${path}.${id}`, label: name, kind: 'added', after: summarize(item) });
        else diffValues(mapA.get(id), item, `${path}.${id}`, name, out);
      });
      la.forEach((item, i) => {
        const id = (item as Plain).id as string;
        if (!mapB.has(id)) out.push({ path: `${path}.${id}`, label: `${label} › ${itemName(item, i)}`, kind: 'removed', before: summarize(item) });
      });
    } else {
      const max = Math.max(la.length, lb.length);
      for (let i = 0; i < max; i++) {
        const name = `${label} › ${itemName(lb[i] ?? la[i], i)}`;
        if (i >= la.length) out.push({ path: `${path}[${i}]`, label: name, kind: 'added', after: summarize(lb[i]) });
        else if (i >= lb.length) out.push({ path: `${path}[${i}]`, label: name, kind: 'removed', before: summarize(la[i]) });
        else diffValues(la[i], lb[i], `${path}[${i}]`, name, out);
      }
    }
    return;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach(k => {
      if (k === 'id') return;
      diffValues(a[k], b[k], path ? `${path}.${k}` : k, path ? `${label} › ${labelOf(k)}` : labelOf(k), out);
    });
    return;
  }
  const sa = a === undefined || a === null ? '' : String(a);
  const sb = b === undefined || b === null ? '' : String(b);
  if (sa !== sb) out.push({ path, label, kind: 'changed', before: show(a), after: show(b) });
}

function summarize(item: unknown): string {
  if (!isPlainObject(item)) return show(item);
  return Object.entries(item)
    .filter(([k, v]) => k !== 'id' && v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${labelOf(k)}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' • ');
}

export function diffSnapshots(a: unknown, b: unknown): DiffEntry[] {
  const out: DiffEntry[] = [];
  diffValues(a, b, '', '', out);
  return out;
}

/** Ảnh chụp có đủ nội dung chi tiết để so sánh hay chỉ là bản tóm tắt (dữ liệu cũ). */
export function isDetailedSnapshot(s: unknown): boolean {
  return isPlainObject(s) && (Array.isArray(s.distribution) || Array.isArray(s.activities));
}
