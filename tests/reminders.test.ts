import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekdayOf, mondayOf, firstOccurrence, occurrencesBetween, buildIcs, foldLine, googleCalendarUrl, appliesTo, describeSchedule, sampleReminders2026 } from '../src/utils/reminders.ts';
import type { WeeklyReminder } from '../src/types/index.ts';

const weekly: WeeklyReminder = { id: 'r1', title: 'Xem việc tuần', kind: 'weekly', weekday: 1, time: '07:00', durationMinutes: 15, audience: 'all', active: true };

test('thứ trong tuần và đầu tuần', () => {
  assert.equal(weekdayOf('2026-10-20'), 2); // Thứ Ba
  assert.equal(weekdayOf('2026-10-25'), 7); // Chủ nhật
  assert.equal(mondayOf('2026-10-25'), '2026-10-19');
});

test('lần đầu và các lần lặp', () => {
  assert.equal(firstOccurrence(weekly, '2026-09-05'), '2026-09-07');
  assert.deepEqual(occurrencesBetween(weekly, '2026-10-19', '2026-11-02', '2026-09-05', '2027-05-28'), ['2026-10-19', '2026-10-26', '2026-11-02']);
  const biweekly = { ...weekly, intervalWeeks: 2 };
  // 07/09 + bội số 14 ngày: 21/09, 05/10, 19/10, 02/11
  assert.deepEqual(occurrencesBetween(biweekly, '2026-10-10', '2026-11-02', '2026-09-05', '2027-05-28'), ['2026-10-19', '2026-11-02']);
  assert.deepEqual(occurrencesBetween({ ...weekly, active: false }, '2026-10-19', '2026-10-25', '2026-09-05', '2027-05-28'), []);
  assert.deepEqual(occurrencesBetween(weekly, '2027-05-30', '2027-06-10', '2026-09-05', '2027-05-28'), []);
  const once: WeeklyReminder = { ...weekly, id: 'o', kind: 'once', date: '2026-10-28' };
  assert.deepEqual(occurrencesBetween(once, '2026-10-26', '2026-11-01', '', ''), ['2026-10-28']);
});

test('đối tượng nhận nhắc', () => {
  assert.equal(appliesTo(weekly, 'm1', false), true);
  assert.equal(appliesTo({ ...weekly, audience: 'leaders' }, 'm1', false), false);
  assert.equal(appliesTo({ ...weekly, audience: 'members', memberIds: ['m1'] }, 'm1', false), true);
  assert.equal(describeSchedule({ ...weekly, intervalWeeks: 2 }), '2 tuần/lần, Thứ Hai lúc 07:00');
});

test('file .ics hợp lệ', () => {
  const ics = buildIcs({ calendarName: 'Tổ Toán', yearStart: '2026-09-05', yearEnd: '2027-05-28', now: new Date('2026-10-20T10:00:00Z'),
    reminders: [weekly, { ...weekly, id: 'r2', kind: 'once', date: '2026-10-28', time: undefined, title: 'Trình ký, kế hoạch; tổ' }],
    tasks: [{ id: 't1', title: 'Nộp đề', deadline: '2026-10-22', status: 'pending' } as never, { id: 't2', title: 'Xong', deadline: '2026-10-22', status: 'completed' } as never] });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;TZID=Asia\/Ho_Chi_Minh:20260907T070000/);
  assert.match(ics, /DTEND;TZID=Asia\/Ho_Chi_Minh:20260907T071500/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20270528T165959Z/);
  assert.match(ics, /SUMMARY:Trình ký\\, kế hoạch\; tổ/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261028/);
  assert.match(ics, /SUMMARY:Hạn: Nộp đề/);
  assert.doesNotMatch(ics, /Hạn: Xong/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});

test('gấp dòng tiếng Việt không cắt giữa ký tự', () => {
  const long = 'SUMMARY:' + 'Kiểm tra hồ sơ '.repeat(10);
  const folded = foldLine(long);
  assert.equal(folded.replace(/\r\n /g, ''), long);
});

test('liên kết Google Lịch và mốc mẫu', () => {
  const url = new URL(googleCalendarUrl(weekly, '2026-09-05', '2027-05-28')!);
  assert.equal(url.searchParams.get('dates'), '20260907T070000/20260907T071500');
  assert.equal(url.searchParams.get('recur'), 'RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20270528');
  const s = sampleReminders2026();
  assert.equal(new Set(s.map(r => r.id)).size, s.length);
  assert.ok(s.every(r => r.kind === 'weekly' || /^\d{4}-\d{2}-\d{2}$/.test(r.date!)));
});
