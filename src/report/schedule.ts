/**
 * Lập lịch cụ thể cho từng đầu việc: ngày (dd/mm/yyyy), thứ trong tuần và giờ.
 *
 * - Văn bản ghi rõ ngày ("Trước 20/09/2026", "Đến 19/09", "vào ngày 30/9/2026, 14g00") → đổi thành ngày cụ thể.
 *   "Trước ngày X" giữ nguyên mốc hạn chính thức X, không tự suy đoán thành X − 1.
 * - "Tuần 2", "đầu tháng", "giữa tháng", "cuối tháng" → ngày làm việc tương ứng trong tháng.
 * - Không ghi ngày ("Trong tháng") → tự xếp vào các ngày làm việc trong tháng theo đúng thứ tự trong kế hoạch,
 *   nằm giữa các mốc có ngày trước và sau nó. Việc tự xếp được đánh dấu để người dùng kiểm tra.
 * - Ngày quá xa tháng báo cáo (vd. ngày ban hành một nghị quyết năm 2023) coi là trích dẫn, không phải hạn.
 */
import type { Period, Task } from "./types";

export const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export type ScheduleOptions = {
  workSaturday?: boolean;
  /** Không tự xếp việc vào trước ngày này (vd. ngày ban hành kế hoạch), dạng yyyy-mm-dd */
  notBefore?: string;
};

// ---------------------------------------------------------------- tiện ích ngày (không dùng múi giờ)
export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function fromISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const isWorkday = (d: Date, o: ScheduleOptions = {}) =>
  d.getDay() !== 0 && (o.workSaturday || d.getDay() !== 6);
const prevWorkday = (d: Date, o: ScheduleOptions) => {
  let x = d;
  while (!isWorkday(x, o)) x = addDays(x, -1);
  return x;
};
const nextWorkday = (d: Date, o: ScheduleOptions) => {
  let x = d;
  while (!isWorkday(x, o)) x = addDays(x, 1);
  return x;
};
const monthStart = (p: Period) => new Date(Number(p.year), Number(p.month) - 1, 1);
const monthEnd = (p: Period) => new Date(Number(p.year), Number(p.month), 0);

/** Các ngày làm việc trong [a, b] (tính cả hai đầu). */
export function workdaysBetween(a: Date, b: Date, o: ScheduleOptions = {}): Date[] {
  const out: Date[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) if (isWorkday(d, o)) out.push(d);
  return out;
}

export function formatDate(iso: string) {
  const d = fromISO(iso);
  return d
    ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
    : "";
}
export function weekdayOf(iso: string) {
  const d = fromISO(iso);
  return d ? WEEKDAYS[d.getDay()] : "";
}

/** Nhãn đầy đủ: "Thứ Sáu, 18/09/2026 · 08g00" (hoặc chuỗi thời gian gốc nếu chưa có ngày). */
export function timeLabel(t: Pick<Task, "date" | "clock" | "time">) {
  if (!t.date) return t.time || "Chưa xếp ngày";
  return `${weekdayOf(t.date)}, ${formatDate(t.date)}${t.clock ? ` · ${t.clock}` : ""}`;
}

// ---------------------------------------------------------------- đọc cụm thời gian
export type ParsedTime = { date?: Date; clock?: string };

const CLOCK_RE = /(?<![\d/])(\d{1,2})\s*(?:giờ|g|h)(?:\s*(\d{1,2}))?(?:\s*phút)?(?![\p{L}\d/])/iu;

function normClock(text: string): string | undefined {
  const m = CLOCK_RE.exec(text);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, "0")}g${String(min).padStart(2, "0")}`;
}

/** Đọc một cụm thời gian (ô "Thời gian" của đầu việc) thành ngày cụ thể trong/quanh tháng báo cáo. */
export function parseTimePhrase(raw: string, period: Period, o: ScheduleOptions = {}): ParsedTime {
  const text = (raw || "").toLowerCase().normalize("NFC");
  const clock = normClock(text);
  const pm = Number(period.month);
  const py = Number(period.year);
  const start = monthStart(period);
  const end = monthEnd(period);

  // 1) ngày cụ thể dd/mm[/yyyy], dd-mm-yyyy hoặc "12 tháng 9 năm 2026"
  const long = /(?<!\d)(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})(?!\d)/u.exec(text);
  const dm = long || /(?<!\d)(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?(?!\d)/.exec(text);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    let year = dm[3] ? Number(dm[3].length === 2 ? "20" + dm[3] : dm[3]) : py;
    if (!dm[3] && month < pm - 6) year = py + 1; // tháng 1 trong báo cáo tháng 12
    const d = new Date(year, month - 1, day);
    if (d.getMonth() !== month - 1 || d.getDate() !== day) return { clock };
    // Ngày quá xa tháng báo cáo → là ngày trích dẫn văn bản, không phải hạn công việc
    if (d < addDays(start, -10) || d > addDays(end, 60)) return { clock };
    return { date: d, clock };
  }

  // 2) tuần thứ n của tháng (tuần tính từ thứ Hai; tuần 1 chứa ngày 1) → ngày làm việc cuối của tuần đó
  const wk = /tuần\s*(?:thứ\s*)?(\d)/u.exec(text);
  if (wk) {
    const offset = (start.getDay() + 6) % 7; // số ngày từ thứ Hai đến ngày 1
    const days = workdaysBetween(start, end, o).filter(
      (d) => Math.floor((d.getDate() - 1 + offset) / 7) + 1 === Number(wk[1]),
    );
    if (days.length) return { date: days[days.length - 1], clock };
  }

  // 3) đầu / giữa / cuối tháng
  if (/đầu tháng/u.test(text)) return { date: nextWorkday(start, o), clock };
  if (/giữa tháng/u.test(text)) return { date: prevWorkday(new Date(py, pm - 1, 15), o), clock };
  if (/cuối tháng/u.test(text)) return { date: prevWorkday(end, o), clock };

  return { clock };
}

// ---------------------------------------------------------------- xếp lịch cả danh sách
/**
 * Gán ngày cho mọi đầu việc chưa có ngày. Việc đọc được ngày từ văn bản → ngày đó.
 * Việc không có ngày → rải đều trên các ngày làm việc giữa mốc trước và mốc sau nó (theo thứ tự trong danh sách).
 * Không đổi các đầu việc đã có ngày (do người dùng chọn hoặc đã xếp trước đó).
 */
export function scheduleTasks(tasks: Task[], period: Period, o: ScheduleOptions = {}): Task[] {
  let start = nextWorkday(monthStart(period), o);
  const end = prevWorkday(monthEnd(period), o);
  const issued = o.notBefore ? fromISO(o.notBefore) : null;
  if (issued && issued > start && issued <= end) start = nextWorkday(issued, o);
  const out = tasks.map((t) => {
    if (t.date && fromISO(t.date)) return t;
    const p = parseTimePhrase(t.time, period, o);
    return p.date
      ? { ...t, date: toISO(p.date), clock: t.clock || p.clock, auto: false }
      : { ...t, clock: t.clock || p.clock };
  });

  // Rải các việc chưa có ngày vào giữa hai mốc liền kề
  let i = 0;
  while (i < out.length) {
    if (out[i].date) {
      i++;
      continue;
    }
    let j = i;
    while (j < out.length && !out[j].date) j++;
    const prev = i > 0 ? fromISO(out[i - 1].date!) : null;
    const next = j < out.length ? fromISO(out[j].date!) : null;
    // Việc không ngày phải xong trước mốc hạn ngay sau nó; bắt đầu từ mốc trước nếu mốc đó sớm hơn
    const inMonth = (d: Date | null) => !!d && d >= start && d <= end;
    const b = inMonth(next) ? next! : end;
    const a = inMonth(prev) && prev! <= b ? prev! : start;
    let days = workdaysBetween(a, b, o);
    if (!days.length) days = workdaysBetween(start, end, o);
    const n = j - i;
    for (let k = 0; k < n; k++) {
      const idx =
        days.length === 1
          ? 0
          : Math.min(days.length - 1, Math.round(((k + 1) * (days.length - 1)) / (n + 1)));
      out[i + k] = { ...out[i + k], date: toISO(days[idx]), auto: true };
    }
    i = j;
  }
  return out;
}

/** Sắp xếp theo ngày rồi giờ; giữ thứ tự gốc khi trùng. */
export function sortByDate(tasks: Task[]): Task[] {
  return tasks
    .map((t, i) => ({ t, i }))
    .sort((x, y) => {
      const a = (x.t.date || "9999") + (x.t.clock || "99g99");
      const b = (y.t.date || "9999") + (y.t.clock || "99g99");
      return a < b ? -1 : a > b ? 1 : x.i - y.i;
    })
    .map(({ t }) => t);
}

/**
 * Ngày ban hành văn bản, tìm ở phần đầu văn bản:
 * "TP. Hồ Chí Minh, ngày 17 tháng 9 năm 2026" hoặc "Kế hoạch số 447/KH-PĐL ngày 17/09/2026".
 */
export function detectIssueDate(text: string): string | undefined {
  const head = text.slice(0, 3000);
  const long = /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/iu.exec(head);
  const short =
    /(?:kế hoạch|công văn|quyết định|thông báo|số)[^\n]{0,60}?ngày\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/iu.exec(
      head,
    );
  const m = long || short;
  if (!m) return undefined;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) ? toISO(d) : undefined;
}
