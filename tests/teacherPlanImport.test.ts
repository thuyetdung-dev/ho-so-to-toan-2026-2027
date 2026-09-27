import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTeacherPlanText,
  classifyTeacherPlanHeading,
  detectGrade,
  workbookToText,
} from '../src/utils/teacherPlanImport.ts';

test('kế hoạch cá nhân: nhận ra tiêu đề mục dù viết hoa, có số thứ tự hay thiếu dấu', () => {
  assert.equal(classifyTeacherPlanHeading('I. NHIỆM VỤ ĐƯỢC GIAO'), 'tasks');
  assert.equal(classifyTeacherPlanHeading('1. Nhiem vu duoc giao'), 'tasks');
  assert.equal(classifyTeacherPlanHeading('2) Phân công chuyên môn:'), 'tasks');
  assert.equal(classifyTeacherPlanHeading('II. Kế hoạch tự học, tự bồi dưỡng'), 'study');
  assert.equal(classifyTeacherPlanHeading('BDTX năm học 2026-2027'), 'study');
  assert.equal(classifyTeacherPlanHeading('III. Kết quả dự kiến'), 'results');
  assert.equal(classifyTeacherPlanHeading('Chỉ tiêu phấn đấu'), 'results');
  // Không phải tiêu đề
  assert.equal(classifyTeacherPlanHeading('Dạy lớp 12A1, 12A2 và 11B3'), null);
  assert.equal(classifyTeacherPlanHeading(''), null);
});

test('kế hoạch cá nhân: đoán khối lớp', () => {
  assert.equal(detectGrade('Kế hoạch giáo dục môn Toán Khối 12 năm học 2026-2027'), 12);
  assert.equal(detectGrade('KE HOACH GIAO DUC - KHOI 10'), 10);
  assert.equal(detectGrade('Phụ lục III – lớp 11'), 11);
  assert.equal(detectGrade('Không nói gì về khối'), undefined);
});

test('kế hoạch cá nhân: tách đúng 3 mục từ văn bản Word', () => {
  const text = [
    'TRƯỜNG THPT PHAN ĐĂNG LƯU',
    'TỔ TOÁN',
    'KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN – MÔN TOÁN KHỐI 12 – NĂM HỌC 2026-2027',
    'Họ và tên: Hồ Thuyết Dũng',
    '',
    'I. NHIỆM VỤ ĐƯỢC GIAO',
    '- Dạy lớp 12A05, 12A11 và 11B11',
    '- Kiêm nhiệm: Tổ trưởng chuyên môn',
    '',
    'II. KẾ HOẠCH TỰ HỌC, TỰ BỒI DƯỠNG',
    '1. Hoàn thành 2 mô-đun BDTX',
    '2. Dự giờ 4 tiết của đồng nghiệp',
    '',
    'III. KẾT QUẢ DỰ KIẾN',
    'Hoàn thành chương trình đúng tiến độ; 85% học sinh đạt từ 5,0 trở lên.',
  ].join('\n');

  const r = parseTeacherPlanText(text);
  assert.equal(r.recognized, true);
  assert.equal(r.grade, 12);
  assert.equal(r.teacherName, 'Hồ Thuyết Dũng');
  assert.match(r.title || '', /KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN/);

  assert.match(r.teachingTasks, /12A05, 12A11 và 11B11/);
  assert.match(r.teachingTasks, /Tổ trưởng chuyên môn/);
  assert.doesNotMatch(r.teachingTasks, /BDTX/, 'mục tự học không được lẫn sang nhiệm vụ');

  assert.match(r.selfStudyPlan, /BDTX/);
  assert.match(r.selfStudyPlan, /Dự giờ 4 tiết/);

  assert.match(r.expectedResults, /85% học sinh/);
  assert.doesNotMatch(r.expectedResults, /Dự giờ/);
});

test('kế hoạch cá nhân: nội dung viết ngay sau dấu hai chấm cùng dòng', () => {
  const r = parseTeacherPlanText([
    'Nhiệm vụ được giao: Dạy Toán 10A1, 10A2',
    'Kế hoạch tự học: Nghiên cứu GeoGebra cho hình không gian',
    'Kết quả dự kiến: Không có học sinh dưới 3,5 điểm',
  ].join('\n'));
  assert.equal(r.recognized, true);
  assert.equal(r.teachingTasks, 'Dạy Toán 10A1, 10A2');
  assert.equal(r.selfStudyPlan, 'Nghiên cứu GeoGebra cho hình không gian');
  assert.equal(r.expectedResults, 'Không có học sinh dưới 3,5 điểm');
});

test('kế hoạch cá nhân: tệp không có tiêu đề mục thì báo chưa nhận ra, giữ nguyên toàn văn', () => {
  const text = 'Tôi dạy ba lớp khối 11 và phụ trách đội tuyển học sinh giỏi.';
  const r = parseTeacherPlanText(text);
  assert.equal(r.recognized, false);
  assert.equal(r.teachingTasks, '');
  assert.match(r.rawText, /đội tuyển học sinh giỏi/);
});

test('kế hoạch cá nhân: đọc bảng Excel thành dòng "nhãn: nội dung"', () => {
  const fakeXLSX = {
    read: () => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }),
    utils: {
      sheet_to_json: <T,>() =>
        [
          ['Nhiệm vụ được giao', 'Dạy Toán 12A1', 'Chủ nhiệm 12A1'],
          [],
          ['Kết quả dự kiến', 'Tỉ lệ tốt nghiệp 100%'],
        ] as unknown as T[],
    },
  };
  const text = workbookToText(fakeXLSX as never, new ArrayBuffer(0));
  assert.equal(text, 'Nhiệm vụ được giao: Dạy Toán 12A1 Chủ nhiệm 12A1\nKết quả dự kiến: Tỉ lệ tốt nghiệp 100%');

  const r = parseTeacherPlanText(text);
  assert.equal(r.teachingTasks, 'Dạy Toán 12A1 Chủ nhiệm 12A1');
  assert.equal(r.expectedResults, 'Tỉ lệ tốt nghiệp 100%');
});
