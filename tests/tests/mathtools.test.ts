import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import katex from 'katex';
import { parseExpr, evalExpr, parseGraphSpec, sampleFunction } from '../src/utils/mathviz.ts';
import { readDocx } from '../src/utils/docxReader.ts';
import { parseLessonText } from '../src/utils/lessonImport.ts';

const f = (src: string, x: number) => evalExpr(parseExpr(src), x);

test('mathviz: phân tích biểu thức, nhân ngầm, hàm, trị tuyệt đối', () => {
  assert.equal(f('x^3 - 3x', 2), 2);
  assert.equal(f('2x(x+1)', 3), 24);
  assert.equal(f('(2x+1)/(x-1)', 2), 5);
  assert.ok(Math.abs(f('sin(pi/2)', 0) - 1) < 1e-12);
  assert.equal(f('|x-3|', 1), 2);
  assert.equal(f('sqrt(x)+ln(e)', 4), 3);
  assert.equal(f('-x^2', 3), -9);
  assert.equal(f('x^(1/3)', -8), -2);
  assert.equal(f('3,5x', 2), 7);
  assert.throws(() => parseExpr('alert(1)'));
  assert.throws(() => parseExpr('x + y'));
});

test('mathviz: đọc mô tả đồ thị', () => {
  const s = parseGraphSpec('y = x^2 - 2x; y = 1; x = -2..4; y = -2..6; A(1;-1); x = 3');
  assert.equal(s.functions.length, 2);
  assert.deepEqual([s.xMin, s.xMax, s.yMin, s.yMax], [-2, 4, -2, 6]);
  assert.deepEqual(s.points, [{ name: 'A', x: 1, y: -1 }]);
  assert.deepEqual(s.verticals, [3]);
  assert.equal(s.errors.length, 0);
  // tiệm cận đứng x=1 → đồ thị bị ngắt thành 2 nhánh
  const segs = sampleFunction(parseExpr('1/(x-1)'), -3, 3, 601);
  assert.ok(segs.length >= 2);
});

test('docxReader: chuyển công thức Word sang LaTeX và giữ hình', async () => {
  const buf = fs.readFileSync(new URL('./fixtures/giao_an_cong_thuc.docx', import.meta.url));
  const r = await readDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), {
    DOMParserImpl: DOMParser as unknown as { new (): globalThis.DOMParser },
    processImage: async (bytes, mime) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`,
  });
  assert.equal(r.equations, 4);
  assert.equal(r.imageCount, 1);
  assert.match(r.text, /\$\\frac\{1\}\{2\}\+x\^\{2\}\$/);
  assert.match(r.text, /\$\$\\int_\{a\}\^\{b\} \\left\|f\(x\)-g\(x\)\\right\|dx\$\$/);
  assert.match(r.text, /\\sqrt\{x\+1\}\\ge \\sin x/);
  assert.match(r.text, /\\begin\{cases\}x\+y=3\\\\x-y=1\\end\{cases\}/);
  assert.match(r.text, /!\[Hình 1\]\(img:h1\w+\)/);
  // Mọi công thức phải hợp lệ với KaTeX
  for (const m of r.text.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)) {
    assert.doesNotThrow(() => katex.renderToString(m[1] || m[2], { throwOnError: true }), m[0]);
  }
  const parsed = parseLessonText(r.text);
  assert.equal(parsed.title, 'BÀI 13. ỨNG DỤNG HÌNH HỌC CỦA TÍCH PHÂN');
  assert.equal(parsed.periodCount, 3);
  assert.match(parsed.objectivesKnowledge, /\\frac\{1\}\{2\}/);
  assert.match(parsed.activities[0].content, /img:h1/);
});

test('lessonImport: tiêu đề không đánh số (Word tự đánh số) vẫn nhận ra', () => {
  const r = parseLessonText('MỤC TIÊU\nVề kiến thức: Biết đạo hàm.\nTHIẾT BỊ DẠY HỌC VÀ HỌC LIỆU\nMáy chiếu\nTIẾN TRÌNH DẠY HỌC\nHoạt động 1: Mở đầu\nMục tiêu: Gợi mở.\nNội dung: Bài toán.\nSản phẩm: Lời giải.\nTổ chức thực hiện: Nhóm.');
  assert.match(r.objectivesKnowledge, /Biết đạo hàm/);
  assert.equal(r.equipment, 'Máy chiếu');
  assert.equal(r.activities[0].objectives, 'Gợi mở.');
  assert.equal(r.activities[0].content, 'Bài toán.');
  assert.equal(r.activities[0].implementation, 'Nhóm.');
});
