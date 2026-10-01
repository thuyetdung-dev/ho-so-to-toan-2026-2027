import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import * as XLSX from '@e965/xlsx';
import katex from 'katex';
import { readDocx } from '../src/utils/docxReader.ts';
import { mtefToLatex } from '../src/utils/mtef.ts';

test('MathType: giáo án thật (255 công thức DSMT) → LaTeX hợp lệ, đúng nội dung', async () => {
  const buf = fs.readFileSync(new URL('./fixtures/mathtype_gtln.docx', import.meta.url));
  const r = await readDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, {
    DOMParserImpl: DOMParser as never,
    cfb: XLSX.CFB as never,
  });
  assert.equal(r.mathTypeObjects, 255);
  assert.equal(r.mathTypeConverted, 255);
  assert.ok(!r.text.includes('MathType'), 'không còn dòng "cần gõ lại"');
  assert.ok(!/^Bài 2 – GTLN VÀ GTNN CỦA HÀM SỐ 2$/m.test(r.text), 'bỏ Mục lục tự động');
  const formulas = [...r.text.matchAll(/\$\$([^$]+)\$\$|\$([^$]+)\$/g)].map(m => m[1] || m[2]);
  for (const f of formulas) assert.doesNotThrow(() => katex.renderToString(f, { throwOnError: true }), f);
  const t = r.text;
  assert.ok(t.includes('nếu $f\\left(x\\right)\\le M$ với mọi $x\\in D$'));
  assert.ok(t.includes('$M=\\max_{x\\in D}\\,f\\left(x\\right)$'));
  assert.ok(t.includes('\\sqrt{1-x^{2}}'));
  assert.ok(t.includes('\\left[\\begin{array}{c}x=0 \\\\ x=\\frac{4}{3}\\end{array}\\right.'), 'hệ "hoặc" (ngoặc vuông)');
  assert.ok(t.includes('\\lim\\limits_{x\\to 0^{+}}'));
  assert.ok(t.includes('\\text{trên}'), 'chữ Việt có dấu tách rời được ghép lại');
  assert.ok(t.includes('y=\\sin x+\\cos x'));
});

test('MathType: bản ghi MTEF tự dựng – phân số, căn, chỉ số trên', () => {
  // header v5 + "DSMT7" + LINE[ CHAR x, TMPL SUP[ null LINE, LINE[CHAR 2] ], CHAR =, TMPL FRACT[LINE[1], LINE[TMPL ROOT[LINE[2], null]]] ]
  const b: number[] = [5, 1, 0, 7, 4, ...Buffer.from('DSMT7'), 0, 1];
  const ch = (face: number, c: string) => [2, 0, face + 128, c.charCodeAt(0), 0];
  const line = (...items: number[][]) => [1, 0, ...items.flat(), 0];
  const nul = [1, 1];
  const tmpl = (sel: number, vari: number, ...slots: number[][]) => [3, 0, sel, vari, 0, ...slots.flat(), 0];
  b.push(
    ...line(
      ch(3, 'x'),
      tmpl(28, 0, nul, line(ch(8, '2'))),
      ch(6, '='),
      tmpl(11, 0, line(ch(8, '1')), line(tmpl(10, 0, line(ch(8, '2')), nul))),
    ),
  );
  assert.equal(mtefToLatex(Uint8Array.from(b)), 'x^{2}=\\frac{1}{\\sqrt{2}}');
});
