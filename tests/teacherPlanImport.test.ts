import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTeacherPlanHeading,
  detectGrade,
  detectSubjectAndClass,
  extractOtherTasks,
  fold,
} from '../src/utils/teacherPlanImport.ts';

test('kế hoạch cá nhân: nhận ra tiêu đề các mục của Phụ lục III', () => {
  assert.equal(classifyTeacherPlanHeading('1. Phân phối chương trình'), 'dist');
  assert.equal(classifyTeacherPlanHeading('I. KẾ HOẠCH DẠY HỌC'), 'dist');
  assert.equal(classifyTeacherPlanHeading('2. Chuyên đề lựa chọn (đối với cấp trung học phổ thông)'), 'topics');
  assert.equal(classifyTeacherPlanHeading('Chuyên đề học tập:'), 'topics');
  assert.equal(classifyTeacherPlanHeading('II. Nhiệm vụ khác (nếu có)'), 'other');
  assert.equal(classifyTeacherPlanHeading('Các nội dung khác'), 'other');
});

test('kế hoạch cá nhân: dòng nội dung không bị nhận nhầm là tiêu đề', () => {
  assert.equal(classifyTeacherPlanHeading('Bồi dưỡng học sinh giỏi khối 12'), null);
  assert.equal(classifyTeacherPlanHeading('1. Hoàn thành 2 mô-đun BDTX'), null);
  assert.equal(classifyTeacherPlanHeading('Dạy lớp 12A1, 12A2 và 11B3'), null);
  assert.equal(classifyTeacherPlanHeading(''), null);
  // Quá dài thì không phải tiêu đề mục
  assert.equal(
    classifyTeacherPlanHeading(
      'Phân phối chương trình được xây dựng trên cơ sở khung thời gian năm học do Sở Giáo dục ban hành',
    ),
    null,
  );
});

test('kế hoạch cá nhân: đoán khối lớp', () => {
  assert.equal(detectGrade('Kế hoạch giáo dục của giáo viên – môn Toán, Khối 12'), 12);
  assert.equal(detectGrade('KE HOACH GIAO DUC - KHOI 10'), 10);
  assert.equal(detectGrade('Phụ lục III – lớp 11'), 11);
  assert.equal(detectGrade('Không nói gì về khối'), undefined);
});

test('kế hoạch cá nhân: đọc dòng "MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC ..., LỚP ..."', () => {
  const r = detectSubjectAndClass('MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC TOÁN, LỚP 12A1');
  assert.equal(r.subject, 'TOÁN');
  assert.equal(r.className, '12A1');
});

test('kế hoạch cá nhân: dòng môn/lớp còn để trống dấu chấm thì không đoán bừa', () => {
  const r = detectSubjectAndClass('MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC ……………….., LỚP………………..');
  assert.equal(r.subject, undefined);
  assert.equal(r.className, undefined);
});

test('kế hoạch cá nhân: cắt đúng mục II. Nhiệm vụ khác', () => {
  const text = [
    'I. Kế hoạch dạy học',
    '1. Phân phối chương trình',
    'Bài 1. Mệnh đề',
    '2. Chuyên đề lựa chọn',
    'Chuyên đề 1. Hệ phương trình bậc nhất ba ẩn',
    'II. Nhiệm vụ khác (nếu có): (Bồi dưỡng học sinh giỏi; Tổ chức hoạt động giáo dục...)',
    '- Bồi dưỡng học sinh giỏi khối 12',
    '- Phụ trách câu lạc bộ Toán học',
    '',
    '(1) Tên bài học/chuyên đề được xây dựng từ nội dung/chủ đề.',
    '(5) Địa điểm tổ chức hoạt động dạy học.',
    'TỔ TRƯỞNG',
    '(Ký và ghi rõ họ tên)',
  ].join('\n');

  const out = extractOtherTasks(text);
  assert.match(out, /Bồi dưỡng học sinh giỏi khối 12/);
  assert.match(out, /câu lạc bộ Toán học/);
  assert.doesNotMatch(out, /Mệnh đề/, 'không được lẫn nội dung bảng phân phối chương trình');
  assert.doesNotMatch(out, /Hệ phương trình/, 'không được lẫn nội dung chuyên đề');
  assert.doesNotMatch(out, /Tên bài học/, 'phải bỏ phần chú thích (1)...(5)');
  assert.doesNotMatch(out, /Ký và ghi rõ/, 'phải bỏ phần ký tên');
  assert.doesNotMatch(out, /Bồi dưỡng học sinh giỏi; Tổ chức/, 'phải bỏ phần gợi ý trong ngoặc của khung mẫu');
});

test('kế hoạch cá nhân: không có mục II thì trả về chuỗi rỗng', () => {
  assert.equal(extractOtherTasks('Tôi dạy ba lớp khối 11 và phụ trách đội tuyển học sinh giỏi.'), '');
});

test('fold: bỏ dấu và chuẩn hoá khoảng trắng', () => {
  assert.equal(fold('  Chuyên   Đề   Lựa Chọn '), 'chuyen de lua chon');
  assert.equal(fold('ĐỊA ĐIỂM'), 'dia diem');
});
