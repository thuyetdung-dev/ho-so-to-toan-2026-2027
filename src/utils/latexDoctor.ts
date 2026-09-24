/**
 * "Bác sĩ công thức" – tự tìm và sửa lỗi công thức LaTeX trong giáo án.
 *
 * Giáo viên không cần biết LaTeX: phần mềm quét mọi công thức ($...$, $$...$$, \(...\), \[...\]),
 * dùng KaTeX để phát hiện công thức lỗi (hiện chữ đỏ), rồi thử lần lượt các cách sửa an toàn
 * cho tới khi công thức hiển thị được. Ngoài lỗi cú pháp còn đưa ra "gợi ý" cho các chỗ
 * nghi sai do chép từ Word (vd S0 → S₀, x2 → x²) để giáo viên bấm chọn.
 */
import katex from 'katex';

export interface FormulaIssue {
  /** vị trí trong chuỗi gốc (tính cả dấu $) */
  start: number;
  end: number;
  /** công thức gốc kèm dấu phân cách, vd "$x^2$" */
  raw: string;
  /** phần LaTeX bên trong */
  latex: string;
  open: string;
  close: string;
  kind: 'error' | 'suggestion' | 'delimiter';
  /** mô tả dễ hiểu cho giáo viên */
  message: string;
  /** LaTeX đề xuất (đã kiểm tra hiển thị được); null = chưa tự sửa được */
  fixedLatex: string | null;
  /** các bước đã sửa, để giáo viên biết phần mềm đã làm gì */
  steps: string[];
}

/** Trả về thông báo lỗi của KaTeX, hoặc null nếu công thức hợp lệ */
export function latexError(latex: string, display = false): string | null {
  try {
    katex.renderToString(latex, { throwOnError: true, strict: false, displayMode: display, trust: false });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message.replace(/^KaTeX parse error:\s*/, '') : String(e);
  }
}

/** Diễn giải lỗi KaTeX sang tiếng Việt */
export function explainError(msg: string): string {
  if (/'\\right'|\\left|\\right/.test(msg)) return 'Dấu ngoặc \\left … \\right không khớp (thường do chép từ Word)';
  if (/Expected '\}'|Unexpected '\}'|Extra \}|Expected group/.test(msg)) return 'Thiếu hoặc thừa dấu ngoặc nhọn { }';
  if (/Double superscript/.test(msg)) return 'Hai số mũ liền nhau (vd x^2^3)';
  if (/Double subscript/.test(msg)) return 'Hai chỉ số dưới liền nhau';
  if (/Undefined control sequence/.test(msg)) return `Lệnh không tồn tại: ${msg.match(/\\[A-Za-z]+/)?.[0] || ''}`;
  if (/text mode/.test(msg)) return 'Lệnh toán bị đặt trong \\text{...}';
  if (/got '&'/.test(msg)) return 'Dấu & dùng sai chỗ';
  if (/Expected 'EOF'/.test(msg)) return 'Thừa ký tự ở cuối công thức';
  return 'Công thức sai cú pháp';
}

const UNICODE_FIX: Array<[RegExp, string]> = [
  [/−|–/g, '-'],
  [/≤/g, '\\le '],
  [/≥/g, '\\ge '],
  [/≠/g, '\\ne '],
  [/∞/g, '\\infty '],
  [/×/g, '\\times '],
  [/·|⋅/g, '\\cdot '],
  [/→/g, '\\to '],
  [/⇒/g, '\\Rightarrow '],
  [/⇔/g, '\\Leftrightarrow '],
  [/∈/g, '\\in '],
  [/π/g, '\\pi '],
  [/√/g, '\\sqrt '],
  [/∫/g, '\\int '],
  [/Δ|∆/g, '\\Delta '],
  [/α/g, '\\alpha '],
  [/β/g, '\\beta '],
  [/°/g, '^{\\circ}'],
  [/ /g, ' '],
];

type Fixer = { name: string; when?: RegExp; apply: (s: string, err: string) => string };

/** Cân bằng \left … \right: thêm "." cho \right thiếu dấu, bỏ \right thừa, đóng \left còn mở */
function balanceLeftRight(s: string): string {
  let out = s
    .replace(/\\right\s*$/g, '\\right.')
    .replace(/\\right(?=\s*[$}]|\s*\\right|\s*\\end)/g, '\\right.')
    .replace(/\\left\s*$/g, '');
  const tokens = out.split(/(\\left(?![a-zA-Z])|\\right(?![a-zA-Z]))/);
  let depth = 0;
  out = tokens
    .map(t => {
      if (t === '\\left') {
        depth++;
        return t;
      }
      if (t === '\\right') {
        if (depth === 0) return ''; // \right không có \left → bỏ chữ \right, giữ dấu ngoặc
        depth--;
        return t;
      }
      return t;
    })
    .join('');
  return out + '\\right.'.repeat(depth);
}

/** Cân bằng ngoặc nhọn (không tính \{ \}) */
function balanceBraces(s: string): string {
  let depth = 0;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && (s[i + 1] === '{' || s[i + 1] === '}')) {
      out += c + s[i + 1];
      i++;
      continue;
    }
    if (c === '{') depth++;
    if (c === '}') {
      if (depth === 0) continue; // thừa → bỏ
      depth--;
    }
    out += c;
  }
  return out + '}'.repeat(depth);
}

const FIXERS: Fixer[] = [
  { name: 'Chuyển ký hiệu Unicode sang lệnh LaTeX', apply: s => UNICODE_FIX.reduce((acc, [re, rep]) => acc.replace(re, rep), s) },
  { name: 'Đưa lệnh toán ra khỏi \\text{...}', apply: s => s.replace(/\\text\{\s*(\\[A-Za-z]+)\s*\}/g, '$1 ').replace(/\\text\{\s*\}/g, '') },
  { name: 'Cân bằng dấu ngoặc nhọn { }', apply: balanceBraces },
  { name: 'Cân bằng cặp \\left … \\right', apply: balanceLeftRight },
  {
    name: 'Tách hai số mũ / chỉ số liền nhau',
    when: /Double (superscript|subscript)/,
    apply: s => s.replace(/(\^(?:\{[^{}]*\}|\\?[A-Za-z0-9]))\s*\^/g, '$1{}^').replace(/(_(?:\{[^{}]*\}|\\?[A-Za-z0-9]))\s*_/g, '$1{}_'),
  },
  {
    name: 'Thay lệnh không tồn tại bằng chữ thường',
    when: /Undefined control sequence/,
    apply: (s, err) => {
      const cmd = err.match(/Undefined control sequence: (\\[A-Za-z]+)/)?.[1];
      return cmd ? s.split(cmd).join(`\\text{${cmd.slice(1)}}`) : s;
    },
  },
  { name: 'Sửa dấu & đặt sai chỗ', when: /'&'/, apply: s => (/\\begin\{/.test(s) ? s : s.replace(/(^|[^\\])&/g, '$1\\&')) },
  { name: 'Sửa ký tự đặc biệt % #', apply: s => s.replace(/(^|[^\\])([%#])/g, '$1\\$2') },
  {
    name: 'Bỏ các lệnh \\left \\right gây lỗi (giữ nguyên dấu ngoặc)',
    apply: s =>
      s
        .replace(/\\(left|right)\s*\./g, '')
        .replace(/\\(left|right)(?![a-zA-Z])\s*/g, '')
        .replace(/\\(big|Big|bigg|Bigg)[lr]?(?![a-zA-Z])/g, ''),
  },
  { name: 'Cân bằng lại ngoặc nhọn', apply: balanceBraces },
];

/** Thử sửa tự động một công thức. Trả về null nếu không sửa được. */
export function autoFixLatex(latex: string, display = false): { fixed: string; steps: string[] } | null {
  let cur = latex;
  let err = latexError(cur, display);
  if (!err) return { fixed: cur, steps: [] };
  const steps: string[] = [];
  for (const f of FIXERS) {
    if (f.when && !f.when.test(err)) continue;
    const next = f.apply(cur, err);
    if (next === cur) continue;
    const nextErr = latexError(next, display);
    // Chỉ giữ bước sửa nếu nó làm hết lỗi hoặc đổi sang lỗi khác (tiến triển)
    if (!nextErr || nextErr !== err) {
      cur = next;
      steps.push(f.name);
      err = nextErr;
      if (!err) return { fixed: cur.replace(/\s{2,}/g, ' ').trim(), steps };
    }
  }
  return null;
}

/** Gợi ý cho công thức hợp lệ nhưng nghi chép sai từ Word (không tự áp dụng) */
export function suggestFix(latex: string): { fixed: string; steps: string[] } | null {
  let s = latex;
  const steps: string[] = [];
  // Chữ HOA + chữ số: S0, S1, V2 → chỉ số dưới (không đụng tên lệnh \frac…)
  const sub = s.replace(/(?<![\\A-Za-z_^{])([A-Z])(\d{1,2})(?![\d.,])/g, '$1_{$2}');
  if (sub !== s) {
    s = sub;
    steps.push('Chữ in hoa + số → chỉ số dưới (S0 → S₀)');
  }
  // chữ thường + 2/3 (thường là bình phương/lập phương bị mất định dạng): x2 → x², b3 → b³
  const sup = s.replace(/(?<![\\A-Za-z_^{])([a-z])([23])(?![\d.,])/g, '$1^{$2}');
  if (sup !== s) {
    s = sup;
    steps.push('Chữ thường + 2 hoặc 3 → số mũ (x2 → x²)');
  }
  // \int_a^b viết liền "13" sau \int: ∫13 → ∫_1^3
  const intRange = s.replace(/\\int\s*(\d)(\d)(?!\d)/g, '\\int_{$1}^{$2}');
  if (intRange !== s) {
    s = intRange;
    steps.push('Cận tích phân viết liền (∫13 → ∫₁³)');
  }
  // Thanh "thế cận" bị mất định dạng: "x |0h = ..." → x \Big|_{0}^{h}
  const bar = s.replace(/\|\s*([0-9a-z])([0-9a-z])(?=\s*=)/g, '\\Big|_{$1}^{$2}');
  if (bar !== s) {
    // thanh "|" đóng thừa ở cuối (từ \right| bị cắt) → bỏ: "=Sh|" → "=Sh"
    s = /\\Big\|_\{[^}]*\}\^\{[^}]*\}[^|]*\|\s*$/.test(bar) && (bar.match(/(?<!\\Big)\|/g) || []).length === 1
      ? bar.replace(/\|\s*$/, '')
      : bar;
    steps.push('Thế cận viết liền (|0h → |₀ʰ)');
  }
  if (!steps.length || latexError(s)) return null;
  return { fixed: s, steps };
}

// $$...$$ | \[...\] | $...$ | \(...\)
const FORMULA_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n\r]+?\$|\\\([\s\S]+?\\\))/g;

/** Quét một đoạn văn bản, trả về danh sách lỗi/gợi ý */
export function scanText(text: string, withSuggestions = true): FormulaIssue[] {
  if (!text) return [];
  const issues: FormulaIssue[] = [];
  let m: RegExpExecArray | null;
  FORMULA_RE.lastIndex = 0;
  const covered: Array<[number, number]> = [];
  while ((m = FORMULA_RE.exec(text))) {
    const raw = m[0];
    const open = raw.startsWith('$$') ? '$$' : raw.startsWith('$') ? '$' : raw.slice(0, 2);
    const close = open === '$$' ? '$$' : open === '$' ? '$' : open === '\\[' ? '\\]' : '\\)';
    const latex = raw.slice(open.length, raw.length - close.length);
    const display = open === '$$' || open === '\\[';
    covered.push([m.index, m.index + raw.length]);
    if (!latex.trim()) continue;
    const err = latexError(latex, display);
    if (err) {
      const fix = autoFixLatex(latex, display);
      issues.push({
        start: m.index,
        end: m.index + raw.length,
        raw,
        latex,
        open,
        close,
        kind: 'error',
        message: explainError(err),
        fixedLatex: fix ? fix.fixed : null,
        steps: fix ? fix.steps : [],
      });
    } else if (withSuggestions) {
      const sug = suggestFix(latex);
      if (sug) {
        issues.push({
          start: m.index,
          end: m.index + raw.length,
          raw,
          latex,
          open,
          close,
          kind: 'suggestion',
          message: 'Có thể bị mất số mũ/chỉ số khi chép từ Word',
          fixedLatex: sug.fixed,
          steps: sug.steps,
        });
      }
    }
  }
  // Dấu $ lẻ (mở mà không đóng) nằm ngoài các công thức đã nhận
  const outside = text
    .split('')
    .map((c, i) => (covered.some(([a, b]) => i >= a && i < b) ? ' ' : c))
    .join('');
  outside.split('\n').forEach((line, li) => {
    const count = (line.match(/(?<!\\)\$/g) || []).length;
    if (count % 2 === 1) {
      const lineStart = outside.split('\n').slice(0, li).join('\n').length + (li ? 1 : 0);
      const pos = lineStart + line.search(/(?<!\\)\$/);
      issues.push({
        start: pos,
        end: pos + 1,
        raw: '$',
        latex: '',
        open: '',
        close: '',
        kind: 'delimiter',
        message: 'Dấu $ bị lẻ (công thức mở mà không đóng) – phần mềm sẽ bỏ dấu $ thừa',
        fixedLatex: '',
        steps: ['Bỏ dấu $ thừa'],
      });
    }
  });
  return issues.sort((a, b) => a.start - b.start);
}

/** Áp dụng một sửa lỗi vào văn bản (theo vị trí; gọi từ cuối về đầu khi áp nhiều sửa) */
export function applyIssue(text: string, issue: FormulaIssue, latexOverride?: string): string {
  const latex = latexOverride ?? issue.fixedLatex;
  if (latex === null) return text;
  const replacement = issue.kind === 'delimiter' ? '' : `${issue.open}${latex}${issue.close}`;
  return text.slice(0, issue.start) + replacement + text.slice(issue.end);
}

/** Tự sửa mọi lỗi (không áp gợi ý) trong một đoạn văn bản */
export function autoFixText(text: string): { text: string; fixed: number; remaining: number } {
  const issues = scanText(text, false);
  let out = text;
  let fixed = 0;
  let remaining = 0;
  for (const is of [...issues].reverse()) {
    if (is.fixedLatex !== null) {
      out = applyIssue(out, is);
      fixed++;
    } else remaining++;
  }
  return { text: out, fixed, remaining };
}
