import type { WeeklyReminder, WorkTask, AcademicCalendarMilestone } from '../types';

/** Nhắc việc hằng tuần của tổ: tính lịch trong tuần, tạo file .ics và đường dẫn Google Lịch. */

export const WEEKDAYS = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const BYDAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const TZ = 'Asia/Ho_Chi_Minh';

const pad = (n: number) => String(n).padStart(2, '0');
function parseIso(d: string): Date { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)); }
function toIso(d: Date): string { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
export function addDays(iso: string, n: number): string { const d = parseIso(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); }
/** 1 = Thứ Hai … 7 = Chủ nhật */
export function weekdayOf(iso: string): number { const g = parseIso(iso).getUTCDay(); return g === 0 ? 7 : g; }
export function mondayOf(iso: string): string { return addDays(iso, 1 - weekdayOf(iso)); }
export function isoDate(v?: string): v is string { return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v); }

/** Lần xảy ra đầu tiên của nhắc việc lặp lại (ngày đầu tiên ≥ startDate đúng thứ). */
export function firstOccurrence(r: WeeklyReminder, fallbackStart: string): string | null {
  if (r.kind === 'once') return isoDate(r.date) ? r.date : null;
  const wd = r.weekday || 1; const start = isoDate(r.startDate) ? r.startDate : fallbackStart;
  if (!isoDate(start)) return null;
  return addDays(start, (wd - weekdayOf(start) + 7) % 7);
}

/** Các ngày nhắc việc rơi vào khoảng [from, to] (bao gồm hai đầu). */
export function occurrencesBetween(r: WeeklyReminder, from: string, to: string, yearStart: string, yearEnd: string): string[] {
  if (!r.active) return [];
  if (r.kind === 'once') return isoDate(r.date) && r.date >= from && r.date <= to ? [r.date] : [];
  const first = firstOccurrence(r, yearStart); if (!first) return [];
  const end = isoDate(r.endDate) ? r.endDate : yearEnd;
  const step = 7 * Math.max(1, r.intervalWeeks || 1);
  const out: string[] = [];
  let d = first;
  if (d < from) { const gap = Math.round((parseIso(from).getTime() - parseIso(d).getTime()) / 86400000); d = addDays(d, Math.floor(gap / step) * step); if (d < from) d = addDays(d, step); }
  for (; d <= to && (!isoDate(end) || d <= end); d = addDays(d, step)) out.push(d);
  return out;
}

export function appliesTo(r: WeeklyReminder, memberId: string, isLeader: boolean): boolean {
  if (r.audience === 'all') return true;
  if (r.audience === 'leaders') return isLeader;
  return (r.memberIds || []).includes(memberId);
}

export function describeSchedule(r: WeeklyReminder): string {
  const t = r.time ? ` lúc ${r.time}` : ' (cả ngày)';
  if (r.kind === 'once') return isoDate(r.date) ? `${r.date.split('-').reverse().join('/')}${t}` : 'Chưa có ngày';
  return `${(r.intervalWeeks || 1) > 1 ? `${r.intervalWeeks} tuần/lần, ` : 'Hằng tuần, '}${WEEKDAYS[r.weekday || 1]}${t}`;
}

// ---------------- iCalendar ----------------
function esc(s: string): string { return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
/** Gấp dòng tối đa 75 byte UTF-8 theo RFC 5545. */
export function foldLine(line: string): string {
  const enc = new TextEncoder(); const parts: string[] = []; let cur = ''; let bytes = 0; let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { parts.push(cur); cur = ''; bytes = 0; limit = 74; }
    cur += ch; bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}
const compact = (iso: string) => iso.replace(/-/g, '');
function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [h, m] = time.split(':').map(Number); let total = h * 60 + m + minutes; let d = date;
  while (total >= 1440) { total -= 1440; d = addDays(d, 1); }
  return { date: d, time: `${pad(Math.floor(total / 60))}:${pad(total % 60)}` };
}
const dt = (date: string, time: string) => `${compact(date)}T${time.replace(':', '')}00`;
function stamp(now: Date): string { return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function alarm(minutes: number | undefined, text: string, allDay: boolean): string[] {
  if (minutes === undefined || minutes < 0) return [];
  // Cả ngày: nhắc 9 giờ sáng hôm trước (mốc tính từ 0 giờ của ngày)
  const trigger = allDay ? '-PT15H' : minutes === 0 ? 'PT0M' : `-PT${minutes}M`;
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER:${trigger}`, 'END:VALARM'];
}

export interface IcsOptions { calendarName: string; yearStart: string; yearEnd: string; now?: Date; }

function reminderEvent(r: WeeklyReminder, o: IcsOptions, now: Date): string[] {
  const first = firstOccurrence(r, o.yearStart); if (!first || !r.active) return [];
  const lines = ['BEGIN:VEVENT', `UID:${r.id}@ho-so-to-toan`, `DTSTAMP:${stamp(now)}`, `SUMMARY:${esc(r.title)}`];
  if (r.note) lines.push(`DESCRIPTION:${esc(r.note)}`);
  const allDay = !r.time;
  if (allDay) { lines.push(`DTSTART;VALUE=DATE:${compact(first)}`, `DTEND;VALUE=DATE:${compact(addDays(first, 1))}`); }
  else {
    const end = addMinutes(first, r.time!, Math.max(5, r.durationMinutes || 30));
    lines.push(`DTSTART;TZID=${TZ}:${dt(first, r.time!)}`, `DTEND;TZID=${TZ}:${dt(end.date, end.time)}`);
  }
  if (r.kind === 'weekly') {
    const until = isoDate(r.endDate) ? r.endDate : o.yearEnd;
    const iv = Math.max(1, r.intervalWeeks || 1);
    lines.push(`RRULE:FREQ=WEEKLY${iv > 1 ? `;INTERVAL=${iv}` : ''};BYDAY=${BYDAY[r.weekday || 1]}${isoDate(until) ? `;UNTIL=${compact(until)}T165959Z` : ''}`);
  }
  lines.push(...alarm(r.alarmMinutes ?? 15, r.title, allDay), 'END:VEVENT');
  return lines;
}

function allDayEvent(uid: string, date: string, endExclusive: string, title: string, note: string | undefined, now: Date): string[] {
  return ['BEGIN:VEVENT', `UID:${uid}@ho-so-to-toan`, `DTSTAMP:${stamp(now)}`, `SUMMARY:${esc(title)}`, ...(note ? [`DESCRIPTION:${esc(note)}`] : []),
    `DTSTART;VALUE=DATE:${compact(date)}`, `DTEND;VALUE=DATE:${compact(endExclusive)}`, ...alarm(0, title, true), 'END:VEVENT'];
}

/** Tạo nội dung file .ics: nhắc việc + hạn công việc được giao + mốc lịch năm học. */
export function buildIcs(o: IcsOptions & { reminders: WeeklyReminder[]; tasks?: WorkTask[]; milestones?: AcademicCalendarMilestone[] }): string {
  const now = o.now || new Date();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//To Toan THPT Phan Dang Luu//Nhac viec//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(o.calendarName)}`, `X-WR-TIMEZONE:${TZ}`,
    'BEGIN:VTIMEZONE', `TZID:${TZ}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0700', 'TZOFFSETTO:+0700', 'TZNAME:+07', 'END:STANDARD', 'END:VTIMEZONE'];
  for (const r of o.reminders) lines.push(...reminderEvent(r, o, now));
  for (const t of o.tasks || []) {
    if (t.status === 'completed' || !isoDate(t.deadline)) continue;
    lines.push(...allDayEvent(`task-${t.id}`, t.deadline, addDays(t.deadline, 1), `Hạn: ${t.title}`, t.description, now));
  }
  for (const m of o.milestones || []) {
    const s = m.dateStart || m.startDate; const e = m.dateEnd || m.endDate || s; const title = m.title || m.name;
    if (!isoDate(s) || !title) continue;
    lines.push(...allDayEvent(`ms-${m.id}`, s, addDays(isoDate(e) && e >= s ? e : s, 1), title, m.description || m.notes, now));
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Đường dẫn "Thêm vào Google Lịch" cho một nhắc việc. */
export function googleCalendarUrl(r: WeeklyReminder, yearStart: string, yearEnd: string): string | null {
  const first = firstOccurrence(r, yearStart); if (!first) return null;
  let dates: string;
  if (!r.time) dates = `${compact(first)}/${compact(addDays(first, 1))}`;
  else { const end = addMinutes(first, r.time, Math.max(5, r.durationMinutes || 30)); dates = `${dt(first, r.time)}/${dt(end.date, end.time)}`; }
  const p = new URLSearchParams({ action: 'TEMPLATE', text: r.title, dates, ctz: TZ });
  if (r.note) p.set('details', r.note);
  if (r.kind === 'weekly') {
    const until = isoDate(r.endDate) ? r.endDate : yearEnd; const iv = Math.max(1, r.intervalWeeks || 1);
    p.set('recur', `RRULE:FREQ=WEEKLY${iv > 1 ? `;INTERVAL=${iv}` : ''};BYDAY=${BYDAY[r.weekday || 1]}${isoDate(until) ? `;UNTIL=${compact(until)}` : ''}`);
  }
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Mốc mẫu năm học 2026–2027 theo kế hoạch tổ Toán (tổ trưởng chỉnh lại trước khi dùng). */
export function sampleReminders2026(): WeeklyReminder[] {
  const once = (id: string, date: string, title: string, audience: WeeklyReminder['audience'] = 'all', note?: string): WeeklyReminder =>
    ({ id: `rem-2627-${id}`, kind: 'once', date, title, note, audience, alarmMinutes: 0, active: true });
  return [
    { id: 'rem-2627-dau-tuan', kind: 'weekly', weekday: 1, time: '07:00', durationMinutes: 15, alarmMinutes: 0, title: 'Xem việc trong tuần trên app Hồ sơ tổ Toán', note: 'Mở mục "Việc của tôi": việc sắp đến hạn, việc cần nộp minh chứng.', audience: 'all', active: true },
    { id: 'rem-2627-cuoi-tuan', kind: 'weekly', weekday: 5, time: '16:00', durationMinutes: 30, alarmMinutes: 15, title: 'Hoàn thiện kế hoạch bài dạy tuần sau, nộp minh chứng việc đã xong', audience: 'all', active: true },
    { id: 'rem-2627-shcm', kind: 'weekly', weekday: 4, time: '14:00', durationMinutes: 90, intervalWeeks: 2, alarmMinutes: 60, title: 'Sinh hoạt tổ chuyên môn', note: 'Chỉnh thứ, giờ theo lịch của nhà trường rồi bật lên.', audience: 'all', active: false },
    { id: 'rem-2627-kiem-tra-tien-do', kind: 'weekly', weekday: 6, time: '08:00', durationMinutes: 30, intervalWeeks: 2, alarmMinutes: 0, title: 'Kiểm tra tiến độ PPCT và việc của tổ (2 tuần/lần)', audience: 'leaders', active: true },
    once('ke-hoach-to', '2026-10-28', 'Trình ký Kế hoạch tổ + phụ lục (trước hạn 31/10)', 'leaders'),
    once('ghk1', '2026-10-26', 'Tuần kiểm tra giữa kỳ I (26 – 31/10)'),
    once('hoc-lieu', '2026-11-23', 'Hoàn thiện kho học liệu số của tổ (hạn 30/11)'),
    once('ho-so-gv', '2026-12-08', 'Hoàn thành kiểm tra hồ sơ giáo viên', 'leaders'),
    once('dk-hsg', '2026-12-15', 'Mở đăng ký HSG 12 + máy tính cầm tay cấp TP (đến 03/01/2027)'),
    once('kpi-q4', '2026-12-15', 'Kết thúc kỳ đánh giá KPI Quý IV trên iCPV: cập nhật minh chứng, tự đánh giá'),
    once('hk1', '2026-12-21', 'Tuần kiểm tra cuối kỳ I (21 – 26/12, nghỉ 25/12)'),
    once('thi-hsg', '2027-01-26', 'Thi HSG lớp 12 và giải toán trên máy tính cầm tay cấp TP'),
    once('dk-olympic', '2027-02-01', 'Mở đăng ký Olympic lớp 11 (01 – 28/02)'),
    once('ghk2', '2027-03-15', 'Tuần kiểm tra giữa kỳ II (15 – 20/03)'),
    once('olympic', '2027-03-19', 'Thi Olympic lớp 11 cấp TP'),
    once('hk2', '2027-04-19', 'Kiểm tra cuối kỳ II (19 – 29/04)'),
  ];
}
