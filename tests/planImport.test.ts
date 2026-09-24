import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import * as XLSX from '@e965/xlsx';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readDocx } from '../src/utils/docxReader.ts';
import { parsePlanGrids, workbookToGrids, pdfPagesToGrids, classifyHeader, parseWeek, parseTietRange } from '../src/utils/planImport.ts';
import type { PdfTextItem } from '../src/utils/lessonImport.ts';

const F = (n: string) => new URL(`./fixtures/${n}`, import.meta.url);
const opts12 = { grade: 12, weeksCount: 35 };

async function fromDocx(name: string, grade: number) {
  const buf = fs.readFileSync(F(name));
  const d = await readDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, { DOMParserImpl: DOMParser as never });
  const lines = d.text.split('\n');
  const grids = d.tables.map((t, i) => ({ rows: t.rows, context: lines.slice(Math.max(i ? d.tables[i - 1].lineIndex : 0, t.lineIndex - 12), t.lineIndex).join('\n') }));
  return parsePlanGrids(grids, d.text, { grade, weeksCount: 35 });
}
async function fromPdf(name: string, grade: number) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(F(name))) }).promise;
  const pages: PdfTextItem[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) pages.push((await (await pdf.getPage(p)).getTextContent()).items as PdfTextItem[]);
  const g = pdfPagesToGrids(pages);
  return parsePlanGrids(g.grids, g.text, { grade, weeksCount: 35 });
}

const EXPECT_K12 = [
  ['Bài 1. Tính đơn điệu và cực trị của hàm số', 3],
  ['Bài 2. Giá trị lớn nhất và giá trị nhỏ nhất của hàm số', 2],
  ['Bài 3. Đường tiệm cận của đồ thị hàm số', 2],
  ['Bài tập cuối chương I', 1],
  ['Bài 6. Vectơ trong không gian', 3],
];

test('planImport: nhận hàng tiêu đề, bỏ qua hàng dữ liệu', () => {
  assert.equal(classifyHeader(['STT', 'Bài học (1)', 'Số tiết (2)', 'Yêu cầu cần đạt (3)'])?.kind, 'dist');
  assert.equal(classifyHeader(['Tuần', 'Tiết', 'Tên bài', 'Ghi chú'])?.kind, 'dist');
  assert.equal(classifyHeader(['Bài kiểm tra, đánh giá', 'Thời gian', 'Thời điểm', 'Hình thức'])?.kind, 'eval');
  assert.equal(classifyHeader(['Kiểm tra giữa kỳ I', '90 phút', 'Tuần 9', 'TN + TL']), null);
  assert.equal(classifyHeader(['1', 'Bài 1. Hàm số', '3', 'Nhận biết']), null);
  // Bảng chuyên đề có cột "Kiểm tra, đánh giá" → vẫn là bảng phân phối, cột đó vào ghi chú (lỗi thực tế: 6 "bài kiểm tra" ảo)
  const cd = classifyHeader(['STT', 'Nội dung chuyên đề', 'Tuần', 'Kiểm tra, đánh giá']);
  assert.equal(cd?.kind, 'dist');
  assert.equal((cd!.map as Record<string, number>).notes, 3);
  assert.equal(classifyHeader(['Tuần', 'Nội dung', 'Kiểm tra, đánh giá', 'Hình thức'])?.kind, 'dist');
  assert.equal(parseWeek('Tuần 12'), 12);
  assert.equal(parseWeek('Tháng 10'), 6);
  assert.deepEqual(parseTietRange('Tiết 4, 5'), { count: 2, first: 4 });
  assert.deepEqual(parseTietRange('1-3'), { count: 3, first: 1 });
});

test('planImport: Word Phụ lục I – phân phối, kiểm tra định kỳ, đặc điểm tình hình', async () => {
  const r = await fromDocx('phu_luc_1_k12.docx', 12);
  assert.deepEqual(r.distribution.map(d => [d.topicTitle, d.periods]), EXPECT_K12);
  assert.ok(r.distribution[0].objectives.includes('đồng biến'));
  assert.deepEqual(r.distribution.map(d => d.week), [1, 2, 2, 3, 3]); // ước tính 3 tiết/tuần
  assert.deepEqual(r.evaluations.map(e => [e.name, e.duration, e.week]), [['Giữa Học kỳ 1', 90, 9], ['Cuối Học kỳ 1', 90, 18], ['Giữa Học kỳ 2', 90, 27]]);
  assert.ok(r.generalSituation.startsWith('1. Số lớp: 6'));
  assert.equal(r.warnings.length, 0);
});

test('planImport: Word PPCT mỗi tiết một hàng, cột tuần gộp ô → gộp bài, cộng tiết', async () => {
  const r = await fromDocx('ppct_k10.docx', 10);
  assert.deepEqual(r.distribution.map(d => [d.week, d.topicTitle, d.periods]), [
    [1, 'Bài 1. Mệnh đề', 2],
    [1, 'Bài 2. Tập hợp', 2],
    [2, 'Bài 3. Các phép toán trên tập hợp', 1],
    [2, 'Luyện tập', 1],
  ]);
  const wrong = await fromDocx('ppct_k10.docx', 12);
  assert.equal(wrong.warnings.length, 1); // tệp khối 10 nhập vào kế hoạch khối 12
});

test('planImport: Excel – nhiều sheet theo khối, hàng (1)(2), bảng kiểm tra cùng sheet, ô gộp', () => {
  const r = parsePlanGrids(workbookToGrids(XLSX as never, fs.readFileSync(F('kh_gv.xlsx'))), '', opts12);
  assert.deepEqual(r.distribution.map(d => [d.week, d.topicTitle, d.periods, d.equipment, d.location]), [
    [1, 'Bài 1. Tính đơn điệu và cực trị của hàm số', 3, 'Máy chiếu', 'Lớp học'],
    [2, 'Bài 2. GTLN và GTNN của hàm số', 2, 'Máy chiếu, GeoGebra', 'Phòng máy'],
    [2, 'Bài 3. Đường tiệm cận', 2, '', undefined],
  ]);
  assert.deepEqual(r.evaluations, [{ name: 'Kiểm tra giữa kỳ I', duration: 90, week: 9, format: 'TN + TL' }]);
  const m = parsePlanGrids(workbookToGrids(XLSX as never, fs.readFileSync(F('merged.xlsx'))), '', { grade: 10, weeksCount: 35 });
  assert.deepEqual(m.distribution.map(d => [d.week, d.topicTitle, d.periods]), [[1, 'Mệnh đề', 2], [1, 'Tập hợp', 1]]);
});

test('planImport: PDF – dựng lại bảng theo tọa độ chữ', async () => {
  const r = await fromPdf('phu_luc_1_k12.pdf', 12);
  assert.deepEqual(r.distribution.map(d => [d.topicTitle, d.periods]), EXPECT_K12);
  assert.ok(r.distribution[0].objectives.includes('cực trị'));
  assert.ok(!r.distribution[1].objectives.includes('biến thiên'), 'yêu cầu của bài 1 không được lẫn sang bài 2');
  assert.deepEqual(r.evaluations.map(e => [e.name, e.week, e.format]), [
    ['Giữa Học kỳ 1', 9, 'Trắc nghiệm + Tự luận'],
    ['Cuối Học kỳ 1', 18, 'Trắc nghiệm 3 dạng mới'],
    ['Giữa Học kỳ 2', 27, 'Trắc nghiệm'],
  ]);
  const p = await fromPdf('ppct_k10.pdf', 10);
  assert.deepEqual(p.distribution.map(d => [d.week, d.periods]), [[1, 2], [1, 2], [2, 1], [2, 1]]);
  assert.equal(p.distribution[1].topicTitle, 'Bài 2. Tập hợp'); // chữ có dấu vẽ đè được ghép lại
});
