import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPartGrade,
  detectPlanKind,
  detectTableRole,
  headingOf,
    splitIntoParts,
} from '../src/utils/teacherPlanSplit.ts';
import { partSize, partToSection } from '../src/utils/teacherPlanSections.ts';
import { readPersonalInfo } from '../src/utils/teacherPlanImport.ts';
import type { Grid } from '../src/utils/planImport.ts';

test('tiêu đề gần bảng nhất quyết định loại và khối dù phần căn cứ nhắc loại khác', () => {
  const ctx = 'Khối 10\nChuyên đề học tập: 35 tiết\nHoạt động trải nghiệm theo kế hoạch trường\nII. Phân phối phần Toán cốt lõi';
  assert.equal(detectPlanKind(ctx), 'teaching');
  assert.equal(detectPartGrade('Lớp 10C7 được phân công\nKhối 11\nII. Phân phối phần Toán cốt lõi', 10), 11);
  assert.equal(detectTableRole('IV. Phân phối chi tiết nội dung cốt lõi (Hòa nhập)', 'inclusive',
    ['Tuần', 'Tiết PPCT', 'Nội dung dạy học', 'Yêu cầu cần đạt']), 'core');
});

test('bảng trải nghiệm có ô tuần trống kế thừa tuần trước, không nhận dòng chủ đề làm tiết', () => {
  const grids: Grid[] = [{ context: 'Hoạt động trải nghiệm và hướng nghiệp lớp 11', rows: [
    ['Tuần', 'TT tiết', 'Chủ đề/ Bài học', 'Yêu cầu cần đạt'],
    ['20', '59', 'Sinh hoạt lớp', 'Hợp tác'],
    ['CHỦ ĐỀ 6', '', '', ''],
    ['', '60', 'Bảo tồn cảnh quan', 'Trách nhiệm'],
    ['21', '61', 'Tổng kết', 'Tự đánh giá'],
  ] }];
  const [part] = splitIntoParts(grids, 10);
  assert.equal(part.experienceLines.length, 3);
  assert.equal(part.experienceLines[1].week, '20');
  assert.equal(part.grade, 11);
});

test('nhận ra loại kế hoạch từ chữ đứng trước bảng', () => {
  assert.equal(detectPlanKind('3. Kế hoạch giáo dục học sinh hòa nhập'), 'inclusive');
  assert.equal(detectPlanKind('IV. PHÂN PHỐI CHI TIẾT 105 TIẾT NỘI DUNG CỐT LÕI MÔN TOÁN 10 (HÒA NHẬP)'), 'inclusive');
  assert.equal(detectPlanKind('Hoạt động trải nghiệm và hướng nghiệp lớp 11'), 'experience');
  assert.equal(detectPlanKind('II. Phân phối phần Toán cốt lõi'), 'teaching');
  assert.equal(detectPlanKind('III. Phân phối chuyên đề học tập lựa chọn'), 'teaching');
});

test('hòa nhập được ưu tiên hơn trải nghiệm khi cả hai chữ cùng xuất hiện', () => {
  assert.equal(detectPlanKind('Hoạt động trải nghiệm cho học sinh hòa nhập'), 'inclusive');
});

test('chữ không gợi ý gì thì giữ loại mặc định', () => {
  assert.equal(detectPlanKind('Bảng số liệu'), 'teaching');
  assert.equal(detectPlanKind('Bảng số liệu', 'experience'), 'experience');
});

test('nhận ra khối lớp từ chữ đứng trước bảng', () => {
  assert.equal(detectPartGrade('Khối 10', 12), 10);
  assert.equal(detectPartGrade('Hoạt động trải nghiệm và hướng nghiệp lớp 11', 12), 11);
  assert.equal(detectPartGrade('MÔN TOÁN 10 (HÒA NHẬP)', 12), 10);
  assert.equal(detectPartGrade('Không nói gì', 11), 11, 'không đoán được thì dùng khối mặc định');
});

test('nhận ra bảng nào là bảng gì', () => {
  assert.equal(detectTableRole('III. Phân phối chuyên đề học tập lựa chọn', 'teaching'), 'topic');
  assert.equal(detectTableRole('II. Phân phối phần Toán cốt lõi', 'teaching'), 'core');
  assert.equal(detectTableRole('2. Kiểm tra, đánh giá', 'teaching'), 'assessment');
  assert.equal(detectTableRole('Phân phối chương trình', 'experience'), 'experience');
  assert.equal(detectTableRole('3. Kiểm tra, đánh giá định kỳ', 'experience'), 'assessment', 'bảng kiểm tra vẫn là bảng kiểm tra');
});

test('tiêu đề hiển thị lấy hai dòng cuối, không lấy cả đoạn văn', () => {
  const h = headingOf('Khối 10\nI. Căn cứ và nguyên tắc xây dựng\nII. Phân phối phần Toán cốt lõi');
  assert.equal(h, 'I. Căn cứ và nguyên tắc xây dựng — II. Phân phối phần Toán cốt lõi');
});

// --- Dựng lại đúng cấu trúc tệp Word của tổ: khối 10, khối 11, trải nghiệm lớp 11, hòa nhập ---

const coreGrid = (grade: number): Grid => ({
  context: `Khối ${grade}\nII. Phân phối phần Toán cốt lõi`,
  rows: [
    ['Tuần', 'Tiết PPCT', 'Nội dung dạy học', 'Yêu cầu cần đạt trọng tâm', 'Thiết bị và định hướng năng lực số AI'],
    ['1', '1-3', `Bài 1. Mệnh đề (khối ${grade})`, 'Nhận biết mệnh đề', 'Tra cứu dữ liệu có kiểm chứng'],
    ['2', '4-6', 'Bài 2. Tập hợp', 'Thực hiện giao, hợp', 'GeoGebra'],
  ],
});

const topicGrid: Grid = {
  context: 'III. Phân phối chuyên đề học tập lựa chọn',
  rows: [
    ['Tuần', 'Tiết', 'Nội dung chuyên đề', 'Yêu cầu cần đạt và sản phẩm gợi ý'],
    ['1', '1', 'Bài 1. Hệ phương trình bậc nhất ba ẩn', 'Giải hệ ba ẩn'],
  ],
};

const experienceGrid: Grid = {
  context: 'Hoạt động trải nghiệm và hướng nghiệp lớp 11\nPhân phối chương trình',
  rows: [
    ['Tuần', 'TT tiết', 'Chủ đề/ Bài học', 'Yêu cầu cần đạt', 'Tích hợp NLS, giáo dục AI', 'Qui mô/ Địa điểm'],
    ['1', '1', 'Khai giảng năm học mới', 'Biết cách phát triển mối quan hệ', 'Bình luận có trách nhiệm', 'Sân trường'],
  ],
};

const inclusiveGrid: Grid = {
  context: '3. Kế hoạch giáo dục học sinh hòa nhập\nIV. PHÂN PHỐI CHI TIẾT 105 TIẾT NỘI DUNG CỐT LÕI MÔN TOÁN 10 (HÒA NHẬP)',
  rows: [
    ['Tuần', 'Thời gian', 'Tiết PPCT', 'Nội dung dạy học (Điều chỉnh HSHN)', 'Yêu cầu cần đạt trọng tâm', 'Đồ dùng trực quan & Phương pháp hỗ trợ', 'Ghi chú'],
    ['1', '07/09 – 12/09', '1–3', 'Bài 1. Mệnh đề (2T)', 'Nhận biết câu là mệnh đề', 'Sơ đồ Venn trực quan', 'Kèm riêng'],
  ],
};

const assessmentGrid: Grid = {
  context: 'Khối 10\n2. Kiểm tra, đánh giá',
  rows: [
    ['Bài kiểm tra, đánh giá', 'Thời gian (1)', 'Thời điểm (2)', 'Yêu cầu cần đạt (3)', 'Hình thức (4)'],
    ['Giữa học kỳ 1', '45 phút', 'Tuần thứ 8', 'Đáp ứng yêu cầu chủ đề 1', 'Trắc nghiệm'],
  ],
};

test('tệp gộp nhiều phần được tách thành từng loại kế hoạch riêng', () => {
  const parts = splitIntoParts(
    [coreGrid(10), topicGrid, assessmentGrid, coreGrid(11), experienceGrid, inclusiveGrid],
    12,
  );
  const key = (k: string, g: number) => parts.find(p => p.planKind === k && p.grade === g);

  assert.ok(key('teaching', 10), 'phải có kế hoạch giảng dạy khối 10');
  assert.ok(key('teaching', 11), 'phải có kế hoạch giảng dạy khối 11');
  assert.ok(key('experience', 11), 'phải có hoạt động trải nghiệm lớp 11');
  assert.ok(key('inclusive', 10), 'phải có kế hoạch giáo dục hòa nhập khối 10');

  // Bảng chuyên đề không ghi khối → theo khối của bảng liền trước (khối 10)
  assert.equal(key('teaching', 10)?.topicLines.length, 1);
  assert.equal(key('teaching', 10)?.coreLines.length, 2);
  assert.equal(key('teaching', 10)?.assessments.length, 1);
  assert.equal(key('teaching', 11)?.coreLines.length, 2);
  assert.equal(key('teaching', 11)?.topicLines.length, 0, 'chuyên đề của khối 10 không được lẫn sang khối 11');
});

test('đọc đúng từng cột của bảng phân phối', () => {
  const [p] = splitIntoParts([coreGrid(10)], 10);
  assert.deepEqual(
    { week: p.coreLines[0].week, periods: p.coreLines[0].periods, content: p.coreLines[0].content },
    { week: '1', periods: '1-3', content: 'Bài 1. Mệnh đề (khối 10)' },
  );
  assert.equal(p.coreLines[0].requirements, 'Nhận biết mệnh đề');
  assert.equal(p.coreLines[0].digitalAi, 'Tra cứu dữ liệu có kiểm chứng');
});

test('bảng trải nghiệm đọc được cột quy mô và địa điểm', () => {
  const [p] = splitIntoParts([experienceGrid], 11);
  assert.equal(p.experienceLines.length, 1);
  assert.equal(p.experienceLines[0].venue, 'Sân trường');
  assert.equal(p.experienceLines[0].digitalAi, 'Bình luận có trách nhiệm');
});

test('bảng hòa nhập đọc được cột ghi chú', () => {
  const [p] = splitIntoParts([inclusiveGrid], 10);
  assert.equal(p.planKind, 'inclusive');
  assert.equal(p.coreLines[0].note, 'Kèm riêng');
  assert.equal(p.coreLines[0].digitalAi, 'Sơ đồ Venn trực quan');
});

test('bảng kiểm tra đánh giá đọc đúng bốn cột', () => {
  const [p] = splitIntoParts([assessmentGrid], 10);
  assert.equal(p.assessments.length, 1);
  assert.deepEqual(
    { name: p.assessments[0].name, duration: p.assessments[0].duration, form: p.assessments[0].form },
    { name: 'Giữa học kỳ 1', duration: '45 phút', form: 'Trắc nghiệm' },
  );
});

test('dòng tiêu đề chủ đề gộp ô và dòng rỗng bị bỏ qua', () => {
  const g: Grid = {
    context: 'Khối 10\nII. Phân phối phần Toán cốt lõi',
    rows: [
      ['Tuần', 'Tiết PPCT', 'Nội dung dạy học', 'Yêu cầu cần đạt trọng tâm', 'Thiết bị'],
      ['HỌC KÌ I', 'HỌC KÌ I', 'HỌC KÌ I', 'HỌC KÌ I', 'HỌC KÌ I'],
      ['', '', '', '', ''],
      ['1', '1-3', 'Bài 1. Mệnh đề', 'Nhận biết mệnh đề', 'Máy chiếu'],
    ],
  };
  const [p] = splitIntoParts([g], 10);
  assert.equal(p.coreLines.length, 1);
  assert.equal(p.coreLines[0].content, 'Bài 1. Mệnh đề');
});

test('phần không đọc được dòng nào thì không tạo kế hoạch rỗng', () => {
  const g: Grid = { context: 'Khối 10', rows: [['Tuần', 'Tiết PPCT', 'Nội dung dạy học', 'Yêu cầu cần đạt trọng tâm', 'Thiết bị']] };
  assert.equal(splitIntoParts([g], 10).length, 0);
});

test('phần được dựng thành nội dung kế hoạch với tên đúng loại', () => {
  const [p] = splitIntoParts([inclusiveGrid], 10);
  const s = partToSection(p);
  assert.equal(s.title, 'Giáo dục hòa nhập khối 10');
  assert.equal(s.kind, 'core', 'hòa nhập dùng bảng phân phối, chỉ khác nhãn cột');
  assert.equal(partSize(p), 1);

  const [e] = splitIntoParts([experienceGrid], 11);
  assert.equal(partToSection(e).kind, 'experience');
  assert.equal(partToSection(e).title, 'Hoạt động trải nghiệm, hướng nghiệp lớp 11');
});

test('đọc mục Thông tin cá nhân ở đầu tệp', () => {
  const info = readPersonalInfo(
    [
      '1. Thông tin cá nhân.',
      '- Họ và tên giáo viên: Đặng Quang Vinh',
      '- Lớp được phân công giảng dạy: 10C7, 10C11, 11B14',
      '- Nhiệm vụ khác được phân công kiêm nhiệm: GVCN lớp 11B14',
    ].join('\n'),
  );
  assert.equal(info.teacherName, 'Đặng Quang Vinh');
  assert.equal(info.className, '10C7, 10C11, 11B14');
  assert.equal(info.assignedTasks, 'GVCN lớp 11B14');
});
