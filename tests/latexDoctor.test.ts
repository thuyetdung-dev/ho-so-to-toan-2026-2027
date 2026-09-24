import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoFixLatex, latexError, scanText, suggestFix, autoFixText, applyIssue } from '../src/utils/latexDoctor.ts';

// Các công thức lỗi lấy từ giáo án thật (ảnh chụp giáo viên gửi)
const BROKEN = [
  'S_{1}=\\int_{1}^{3} (-x^{2}+4x)dx=\\left.\\left(-\\frac{x^{3}}{3}+2{x^{2}}_{1}^{3}=\\left(-9+18\\right)-\\left(-\\frac{1}{3}+2=9-\\frac{5}{3}=\\frac{22}{3}\\right.\\right.\\right',
  'S_{2}=\\int_{1}^{3} xdx=\\left.{\\frac{x^{2}}{2}}_{1}^{3}=\\frac{9}{2}-\\frac{1}{2}=4\\right',
  'V=\\int_{0}^{h} S\\left(x\\right)dx=\\int_{0}^{h} Sdx=S\\cdot x\\text{\\Big}\\left|0h=Sh\\right|',
  'x^2^3',
  'a & b',
  '\\foo x',
  '\\frac{1}{2',
];

test('latexDoctor: mọi công thức lỗi thực tế đều được tự sửa thành công thức hợp lệ', () => {
  for (const c of BROKEN) {
    assert.ok(latexError(c), `phải phát hiện lỗi: ${c}`);
    const r = autoFixLatex(c);
    assert.ok(r, `phải sửa được: ${c}`);
    assert.equal(latexError(r.fixed), null, `kết quả vẫn lỗi: ${r.fixed}`);
    assert.ok(r.steps.length > 0);
  }
});

test('latexDoctor: công thức đúng không bị đụng tới', () => {
  for (const ok of ['\\int_0^1 x^2\\,dx', '\\left(\\frac{a}{b}\\right)', 'x_{1}+x_{2}=3']) {
    assert.equal(latexError(ok), null);
    assert.deepEqual(autoFixLatex(ok), { fixed: ok, steps: [] });
    assert.equal(scanText(`$${ok}$`, true).length, 0);
  }
});

test('latexDoctor: \\right thiếu dấu được bổ sung "\\right."', () => {
  const r = autoFixLatex(BROKEN[1])!;
  assert.match(r.fixed, /\\right\.$/);
});

test('latexDoctor: gợi ý khôi phục số mũ / chỉ số dưới bị mất', () => {
  const a = suggestFix('\\frac{S_{1}}{3b^{2}}(b3-a3)=\\frac{h}{3}(S0+\\sqrt{S_{0}S_{1}}+S1)')!;
  assert.ok(a.fixed.includes('b^{3}-a^{3}'));
  assert.ok(a.fixed.includes('S_{0}+'));
  assert.ok(a.fixed.includes('+S_{1})'));
  const b = suggestFix('\\int13(-x2+3x)dx')!;
  assert.ok(b.fixed.startsWith('\\int_{1}^{3}'));
  assert.ok(b.fixed.includes('-x^{2}'));
  assert.equal(suggestFix('x^{2}+S_{0}'), null);
});

test('latexDoctor: quét văn bản, tự sửa và áp dụng từng lỗi', () => {
  const text = 'Tính $x^2^3$ và $S0+S1$.';
  const issues = scanText(text, true);
  assert.deepEqual(issues.map(i => i.kind).sort(), ['error', 'suggestion']);
  const err = issues.find(i => i.kind === 'error')!;
  const once = applyIssue(text, err);
  assert.equal(scanText(once, false).length, 0);
  assert.ok(once.endsWith(' và $S0+S1$.'));

  const all = autoFixText('A $\\frac{1}{2$ B $x$');
  assert.equal(all.fixed, 1);
  assert.equal(all.remaining, 0);
  assert.ok(all.text.includes('\\frac{1}{2}'));
});

test('latexDoctor: phát hiện dấu $ lẻ', () => {
  const issues = scanText('Cho $x+1$ và $y lỗi', false);
  assert.ok(issues.some(i => i.kind === 'delimiter'));
});

test('latexDoctor: thế cận "|0h =" → \\Big|_{0}^{h}, bỏ thanh thừa ở cuối', () => {
  const r = autoFixText('$V=S\\cdot x\\text{\\Big}\\left|0h=Sh\\right|$');
  const issues = scanText(r.text, true);
  const s = issues.find(i => i.kind === 'suggestion')!;
  assert.ok(s, r.text);
  assert.equal(s.fixedLatex, 'V=S\\cdot x \\Big|_{0}^{h}=Sh');
});
