import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLessonText } from '../src/utils/lessonImport.ts';

const SAMPLE = `Trường THPT Phan Đăng Lưu
Tổ: Toán
CHƯƠNG I. ỨNG DỤNG ĐẠO HÀM ĐỂ KHẢO SÁT VÀ VẼ ĐỒ THỊ HÀM SỐ
BÀI 1. TÍNH ĐƠN ĐIỆU VÀ CỰC TRỊ CỦA HÀM SỐ
Môn học: Toán; lớp: 12
Thời gian thực hiện: 6 tiết
I. MỤC TIÊU
1. Về kiến thức:
- Nhận biết tính đồng biến, nghịch biến của hàm số dựa vào dấu của đạo hàm.
- Nhận biết điểm cực trị, giá trị cực trị của hàm số.
2. Về năng lực:
- Năng lực chung: tự chủ và tự học, giao tiếp và hợp tác.
- Năng lực đặc thù: tư duy và lập luận toán học; mô hình hóa toán học.
3. Về phẩm chất: Chăm chỉ, trách nhiệm.
II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU
- Máy chiếu, phần mềm GeoGebra.
- Phiếu học tập.
III. TIẾN TRÌNH DẠY HỌC
1. HOẠT ĐỘNG 1: MỞ ĐẦU
a) Mục tiêu: Tạo hứng thú, gợi vấn đề về sự biến thiên.
b) Nội dung: HS quan sát đồ thị $y = x^3 - 3x$.
c) Sản phẩm: Câu trả lời của HS.
d) Tổ chức thực hiện:
Bước 1: GV chuyển giao nhiệm vụ.
Bước 2: HS thực hiện nhiệm vụ.
2. HOẠT ĐỘNG 2: HÌNH THÀNH KIẾN THỨC MỚI
a) Mục tiêu: Hình thành định lí về tính đơn điệu.
b) Nội dung: HĐ1, HĐ2 trong SGK.
c) Sản phẩm: Định lí.
d) Tổ chức thực hiện: GV hướng dẫn HS thảo luận nhóm.
IV. ĐIỀU CHỈNH SAU BÀI DẠY
Không có.`;

test('tách đúng các mục CV 5512', () => {
  const r = parseLessonText(SAMPLE);
  assert.equal(r.recognized, true);
  assert.equal(r.topicTitle, 'CHƯƠNG I. ỨNG DỤNG ĐẠO HÀM ĐỂ KHẢO SÁT VÀ VẼ ĐỒ THỊ HÀM SỐ');
  assert.equal(r.title, 'BÀI 1. TÍNH ĐƠN ĐIỆU VÀ CỰC TRỊ CỦA HÀM SỐ');
  assert.equal(r.periodCount, 6);
  assert.match(r.objectivesKnowledge, /đồng biến, nghịch biến/);
  assert.match(r.objectivesKnowledge, /cực trị/);
  assert.match(r.objectivesCompetence, /Năng lực chung: tự chủ/);
  assert.match(r.objectivesCompetence, /Năng lực đặc thù/);
  assert.equal(r.objectivesQualities, 'Chăm chỉ, trách nhiệm.');
  assert.match(r.equipment, /GeoGebra/);
  assert.match(r.equipment, /Phiếu học tập/);
  assert.equal(r.activities.length, 2);
  assert.equal(r.activities[0].name, 'HOẠT ĐỘNG 1: MỞ ĐẦU');
  assert.equal(r.activities[0].objectives, 'Tạo hứng thú, gợi vấn đề về sự biến thiên.');
  assert.match(r.activities[0].content, /\$y = x\^3 - 3x\$/);
  assert.match(r.activities[0].implementation, /Bước 1[\s\S]*Bước 2/);
  assert.equal(r.activities[1].implementation, 'GV hướng dẫn HS thảo luận nhóm.');
  assert.doesNotMatch(r.activities[1].implementation, /Không có/); // dừng ở mục IV
});

test('văn bản không có cấu trúc → recognized=false', () => {
  const r = parseLessonText('Giáo án tự do\nNội dung bất kỳ');
  assert.equal(r.recognized, false);
  assert.match(r.rawText, /Nội dung bất kỳ/);
});
