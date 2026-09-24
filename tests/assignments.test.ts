import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from '@e965/xlsx';
import { subjectKey, findDuplicateAssignments, sortAssignments, groupByTeacher, isDutyRow, summaryRows, dutyName, exportOrder } from '../src/utils/assignments.ts';
import { pickAssignmentSheet } from '../src/utils/excel.ts';
import type { Assignment, Member } from '../src/types/index.ts';

const read = (f: string) => {
  const wb = XLSX.read(fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url)), { type: 'buffer' });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
};
const toAsg = (rows: Record<string, unknown>[]): Assignment[] =>
  rows.map((r, i) => ({
    id: `a${i}`, teacherId: String(r['Họ và tên giáo viên']), teacherName: String(r['Họ và tên giáo viên']),
    classId: String(r['Lớp']), className: String(r['Lớp']), grade: Number(r['Khối']) as 10 | 11 | 12,
    subject: String(r['Môn/Chuyên đề']), periodsPerWeek: Number(r['Số tiết/tuần']), duties: String(r['Nhiệm vụ kiêm nhiệm'] || ''),
    term: 'HK1', academicYear: '2026-2027', sortOrder: i + 2,
  }));

test('phân công: nhận ra các tên khác nhau của cùng một môn', () => {
  assert.equal(subjectKey('Toán buổi 2'), subjectKey('Toán (T2)'));
  assert.equal(subjectKey('Chuyên đề học tập Toán'), subjectKey('Chuyên đề Toán (Tc)'));
  assert.notEqual(subjectKey('Toán'), subjectKey('Toán buổi 2'));
  assert.notEqual(subjectKey('Toán'), subjectKey('Chuyên đề học tập Toán'));
});

test('phân công: dữ liệu thật của tổ – 131 dòng có 45 dòng trùng, dọn xong khớp file nhập (86 dòng)', () => {
  const app = toAsg(read('phan_cong_phan_mem.xlsx'));
  const file = toAsg(read('phan_cong_import.xlsx'));
  assert.equal(app.length, 131);
  const { keep, remove } = findDuplicateAssignments(app);
  assert.equal(remove.length, 45);
  assert.ok(remove.every(r => /\((T2|Tc)\)/.test(r.subject)), 'bỏ bản viết tắt, giữ tên đầy đủ');
  const k = (a: Assignment) => `${a.teacherName}|${a.className}|${a.subject}|${a.periodsPerWeek}`;
  assert.deepEqual(keep.map(k).sort(), file.map(k).sort());
  const load = (list: Assignment[], t: string) => list.filter(a => a.teacherName === t).reduce((s, a) => s + a.periodsPerWeek, 0);
  assert.equal(load(app, 'Huỳnh Văn Hiếu'), 22);
  assert.equal(load(keep, 'Huỳnh Văn Hiếu'), 17);
});

test('phân công: sắp xếp giống file nhập – theo thứ tự giáo viên trong file, rồi lớp, rồi môn', () => {
  const file = toAsg(read('phan_cong_import.xlsx'));
  const order: string[] = [];
  file.forEach(a => !order.includes(a.teacherName) && order.push(a.teacherName));
  const members = order.map((n, i) => ({ id: n, displayName: n, role: 'teacher', sortOrder: i }) as Member);
  const shuffled = [...file].sort(() => Math.random() - 0.5);
  const sorted = sortAssignments(shuffled, members);
  const k = (a: Assignment) => `${a.teacherName}|${a.className}|${a.subject}`;
  assert.deepEqual(sorted.map(k), file.map(k));
  const groups = groupByTeacher(sorted);
  assert.equal(groups.length, 13);
  assert.equal(groups[0].teacherName, 'Hồ Thuyết Dũng');
  assert.equal(groups[0].total, 14);
  assert.deepEqual(groups[0].classGroups.map(c => [c.className, c.total]), [['11B12', 4], ['12A05', 5], ['12A11', 5]]);
  assert.equal(groups[0].dutyText, 'Tổ trưởng chuyên môn');
});

test('phân công: file của tổ (bản sửa) – chọn đúng sheet PhanCong, tính đúng như sheet TongHop', () => {
  const wb = XLSX.read(fs.readFileSync(new URL('./fixtures/phan_cong_sua.xlsx', import.meta.url)), { type: 'buffer' });
  assert.equal(pickAssignmentSheet(wb), 'PhanCong');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.PhanCong, { defval: '' });
  const names: string[] = [];
  const list: Assignment[] = rows.map((r, i) => {
    const n = String(r['Họ và tên giáo viên']);
    if (!names.includes(n)) names.push(n);
    const cls = String(r['Lớp'] || '');
    return {
      id: `r${i}`, teacherId: n, teacherName: n, classId: cls, className: cls, grade: (Number(r['Khối']) || 0) as 10,
      subject: String(r['Môn/Chuyên đề']), periodsPerWeek: Number(r['Số tiết/tuần']), duties: String(r['Nhiệm vụ kiêm nhiệm'] || ''),
      term: 'HK1', academicYear: '2026-2027', kind: isDutyRow(String(r['Môn/Chuyên đề']), cls) ? 'duty' : 'teaching', sortOrder: i + 2,
    };
  });
  assert.equal(list.length, 118);
  assert.equal(findDuplicateAssignments(list).remove.length, 0, 'không có dòng nào bị coi là trùng');
  const members = names.map((n, i) => ({ id: n, displayName: n, role: 'teacher', sortOrder: i }) as Member);
  const mine = summaryRows(sortAssignments(list, members));
  // Sheet TongHop của file (giá trị Excel đã tính)
  const expected = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.TongHop, { defval: '' }).filter(r => names.includes(String(r['Họ và tên giáo viên'])));
  assert.equal(mine.length, 13);
  expected.forEach((e, i) => {
    const m = mine[i];
    assert.equal(m['Họ và tên giáo viên'], e['Họ và tên giáo viên']);
    assert.equal(m['Tiết theo TKB (gồm CTH)'], e['Tiết theo TKB (gồm CTH)'], `${m['Họ và tên giáo viên']} – tiết TKB`);
    assert.equal(m['Tiết quy đổi nhiệm vụ'], e['Tiết quy đổi nhiệm vụ'], `${m['Họ và tên giáo viên']} – quy đổi`);
    assert.equal(m['Tổng tiết/tuần'], e['Tổng tiết/tuần'], `${m['Họ và tên giáo viên']} – tổng`);
    assert.equal(m['Lớp chủ nhiệm'], String(e['Lớp chủ nhiệm'] || ''), `${m['Họ và tên giáo viên']} – lớp CN`);
    assert.equal(m['Chức vụ, nhiệm vụ'], String(e['Chức vụ, nhiệm vụ'] || ''), `${m['Họ và tên giáo viên']} – chức vụ`);
  });
  assert.equal(dutyName('TTCM'), 'Tổ trưởng chuyên môn');
  assert.equal(dutyName('GVCN 12A06 (CTH trong TKB)'), 'Chủ nhiệm lớp 12A06');
  assert.equal(dutyName('CT-CĐCS'), 'Chủ tịch Công đoàn cơ sở');
  // Tên môn kiểu mới và cũ là một
  assert.equal(subjectKey('Toán 2'), subjectKey('Toán buổi 2'));
  assert.equal(subjectKey('Chuyên đề Toán'), subjectKey('Chuyên đề học tập Toán'));
  const g = groupByTeacher(sortAssignments(list, members));
  assert.deepEqual(g[0].classGroups.map(c => c.className), ['12A11', '12A05', '11B12', ''], 'lớp theo thứ tự trong file, nhiệm vụ ở cuối');
  assert.deepEqual(g[0].classGroups[0].items.map(a => a.subject), ['Toán', 'Toán 2', 'Chuyên đề Toán']);
  // Xuất Excel: đúng thứ tự từng dòng như file gốc
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  assert.deepEqual(exportOrder(shuffled, members).map(a => a.id), list.map(a => a.id));
});
