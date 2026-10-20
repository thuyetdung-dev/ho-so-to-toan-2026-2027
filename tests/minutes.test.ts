import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateParts, departmentShortName, minutesHeading, parseNameRoleLines, timeText, voteText, attendanceTotal } from '../src/utils/minutes.ts';

test('tiêu đề biên bản theo tên cuộc họp', () => {
  assert.equal(minutesHeading({ title: 'Hội nghị Viên chức và người lao động', type: 'regular' }), 'BIÊN BẢN HỘI NGHỊ VIÊN CHỨC VÀ NGƯỜI LAO ĐỘNG');
  assert.equal(minutesHeading({ title: 'Biên bản họp tổ tháng 10', type: 'regular' }), 'BIÊN BẢN HỌP TỔ THÁNG 10');
  assert.equal(minutesHeading({ title: '06/10/2026', type: 'regular' }), 'BIÊN BẢN SINH HOẠT CHUYÊN MÔN');
});

test('ngày giờ và tên tổ', () => {
  assert.deepEqual(dateParts('2026-10-20'), { d: '20', m: '10', y: '2026' });
  assert.equal(timeText('07:30'), '7 giờ 30');
  assert.equal(timeText(''), '…… giờ ……');
  assert.equal(departmentShortName('Tổ Toán'), 'Toán');
});

test('đại biểu, sĩ số và biểu quyết', () => {
  assert.deepEqual(parseNameRoleLines('Mai Thị Ngọc Nhung - Phó Hiệu trưởng\n\nKhách'), [
    { name: 'Mai Thị Ngọc Nhung', role: 'Phó Hiệu trưởng' },
    { name: 'Khách', role: '' },
  ]);
  const m = { attendees: Array(12).fill('x'), absentees: [{ name: 'A', reason: 'ốm' }] };
  assert.equal(attendanceTotal(m), 13);
  assert.equal(voteText({ ...m, voteAgree: 12 }), '12/12 người tán thành, đạt 100%');
  assert.equal(voteText({ attendees: Array(13).fill('x'), voteAgree: 12 }), '12/13 người tán thành, đạt 92,3%');
  assert.match(voteText({ attendees: ['x'], voteAgree: null }), /………/);
});
