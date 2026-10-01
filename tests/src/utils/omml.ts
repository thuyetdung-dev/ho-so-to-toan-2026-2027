/**
 * Chuyển công thức Word (Equation – OMML, thẻ <m:oMath>) sang LaTeX để KaTeX hiển thị.
 * Hỗ trợ các cấu trúc thường gặp trong giáo án Toán THPT: phân số, lũy thừa, chỉ số, căn,
 * ngoặc, tích phân/tổng/tích, giới hạn, hàm số, dấu mũ/vectơ/gạch trên, ma trận, hệ phương trình.
 *
 * Lưu ý: công thức MathType (đối tượng OLE, thường là ảnh WMF) KHÔNG phải OMML – không chuyển được.
 */

const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

const SYMBOLS: Record<string, string> = {
  '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '≈': '\\approx ', '≡': '\\equiv ', '∞': '\\infty ',
  '±': '\\pm ', '∓': '\\mp ', '×': '\\times ', '÷': '\\div ', '·': '\\cdot ', '⋅': '\\cdot ', '∙': '\\cdot ',
  '→': '\\to ', '⇒': '\\Rightarrow ', '⇔': '\\Leftrightarrow ', '←': '\\leftarrow ', '↔': '\\leftrightarrow ',
  '∈': '\\in ', '∉': '\\notin ', '⊂': '\\subset ', '⊃': '\\supset ', '⊆': '\\subseteq ', '⊇': '\\supseteq ',
  '∪': '\\cup ', '∩': '\\cap ', '∅': '\\emptyset ', '∀': '\\forall ', '∃': '\\exists ', '¬': '\\neg ',
  '∧': '\\wedge ', '∨': '\\vee ', '⊥': '\\perp ', '∥': '\\parallel ', '∠': '\\angle ', '△': '\\triangle ', '∆': '\\Delta ',
  '°': '^{\\circ}', '′': "'", '″': "''", '…': '\\ldots ', '⋯': '\\cdots ', '∂': '\\partial ', '∇': '\\nabla ',
  'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}',
  'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'ε': '\\varepsilon ', 'ϵ': '\\epsilon ',
  'ζ': '\\zeta ', 'η': '\\eta ', 'θ': '\\theta ', 'ι': '\\iota ', 'κ': '\\kappa ', 'λ': '\\lambda ', 'μ': '\\mu ',
  'ν': '\\nu ', 'ξ': '\\xi ', 'π': '\\pi ', 'ρ': '\\rho ', 'σ': '\\sigma ', 'τ': '\\tau ', 'φ': '\\varphi ', 'ϕ': '\\phi ',
  'χ': '\\chi ', 'ψ': '\\psi ', 'ω': '\\omega ', 'Γ': '\\Gamma ', 'Δ': '\\Delta ', 'Θ': '\\Theta ', 'Λ': '\\Lambda ',
  'Π': '\\Pi ', 'Σ': '\\Sigma ', 'Φ': '\\Phi ', 'Ψ': '\\Psi ', 'Ω': '\\Omega ',
  '−': '-', '∗': '*', '⁡': '', '​': '', ' ': ' ',
  '{': '\\{', '}': '\\}', '%': '\\%', '#': '\\#', '_': '\\_', '~': '\\sim ', '∼': '\\sim ',
};

/** Ký tự "toán học" kiểu chữ nghiêng Unicode (𝑥, 𝑦...) → chữ thường */
function normalizeMathAlnum(ch: string): string {
  const cp = ch.codePointAt(0) || 0;
  if (cp >= 0x1d400 && cp <= 0x1d7ff) {
    // Khối Mathematical Alphanumeric Symbols: chuẩn hóa NFKC trả về chữ gốc
    return ch.normalize('NFKC');
  }
  if (ch === 'ℎ') return 'h';
  return ch;
}

function escapeText(text: string): string {
  let out = '';
  for (const raw of Array.from(text)) {
    const ch = normalizeMathAlnum(raw);
    out += SYMBOLS[ch] ?? (ch === '\\' ? '\\backslash ' : ch);
  }
  return out;
}

const NARY: Record<string, string> = {
  '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '∑': '\\sum', '∏': '\\prod',
  '∐': '\\coprod', '⋃': '\\bigcup', '⋂': '\\bigcap',
};
const ACCENTS: Record<string, string> = {
  '̂': '\\hat', '̃': '\\tilde', '̄': '\\bar', '̅': '\\overline', '⃗': '\\vec', '→': '\\overrightarrow', '⃡': '\\overleftrightarrow',
  '̇': '\\dot', '̈': '\\ddot', '̌': '\\check', '́': '\\acute', '̀': '\\grave', '̆': '\\breve',
};
const FUNC_NAMES = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'det', 'gcd', 'deg']);

/** Các phần tử con (dùng childNodes để chạy được cả trên trình duyệt lẫn xmldom khi kiểm thử) */
export const elementChildren = (el: Element | undefined): Element[] =>
  el ? (Array.from(el.childNodes).filter(n => n.nodeType === 1) as Element[]) : [];
const kids = (el: Element, name?: string) =>
  elementChildren(el).filter(c => c.namespaceURI === M_NS && (!name || c.localName === name));
const kid = (el: Element | undefined, name: string) => (el ? kids(el, name)[0] : undefined);
/** Đọc thuộc tính m:val của thẻ thuộc tính (vd <m:fPr><m:type m:val="lin"/></m:fPr>).
 *  undefined = không có thẻ; '' = có thẻ nhưng không có giá trị. */
const prop = (el: Element | undefined, prName: string, attr = 'val'): string | undefined => {
  const pr = elementChildren(el).find(c => c.localName.endsWith('Pr'));
  const node = elementChildren(pr).find(c => c.localName === prName);
  if (!node) return undefined;
  return node.hasAttributeNS(M_NS, attr) ? node.getAttributeNS(M_NS, attr) || '' : node.getAttribute(`m:${attr}`) || '';
};
/** Thuộc tính bật/tắt: có thẻ mà không ghi giá trị nghĩa là "bật" */
const isOn = (v: string | undefined) => v !== undefined && v !== '0' && v !== 'off' && v !== 'false';

const group = (s: string) => (s.length === 1 ? s : `{${s}}`);

function children(el: Element | undefined): string {
  if (!el) return '';
  return elementChildren(el)
    .map(c => node(c))
    .join('');
}

function node(el: Element): string {
  if (el.namespaceURI !== M_NS) {
    // w:r bên trong công thức (chữ thường) → \text{}
    if (el.localName === 'r') {
      const t = Array.from(el.getElementsByTagNameNS('*', 't')).map(x => x.textContent || '').join('');
      if (!t) return '';
      return /\\[A-Za-z]+/.test(t) ? t : `\\text{${t}}`;
    }
    return '';
  }
  switch (el.localName) {
    case 'oMath':
    case 'e':
    case 'num':
    case 'den':
    case 'sub':
    case 'sup':
    case 'deg':
    case 'lim':
    case 'fName':
      return children(el);
    case 'r': {
      const t = elementChildren(el)
        .filter(c => c.localName === 't')
        .map(c => c.textContent || '')
        .join('');
      const isNormal = Array.from(el.getElementsByTagNameNS(M_NS, 'nor')).length > 0 ||
        Array.from(el.getElementsByTagNameNS(M_NS, 'sty')).some(s => (s.getAttributeNS(M_NS, 'val') || s.getAttribute('m:val')) === 'p' && /[A-Za-zÀ-ỹ]{2,}/.test(t) && !FUNC_NAMES.has(t.trim()) && !/^\d/.test(t));
      // Người dùng gõ lệnh LaTeX trực tiếp trong ô công thức (vd \Big|) → giữ nguyên, không bọc \text
      if (/\\[A-Za-z]+/.test(t)) return t;
      if (isNormal && /[A-Za-zÀ-ỹ]/.test(t)) return `\\text{${t}}`;
      if (FUNC_NAMES.has(t.trim())) return `\\${t.trim()} `;
      // Chữ tiếng Việt có dấu trong công thức → \text
      if (/[À-ỹ]/.test(t)) return `\\text{${t}}`;
      return escapeText(t);
    }
    case 'f': {
      const type = prop(el, 'type');
      const num = children(kid(el, 'num'));
      const den = children(kid(el, 'den'));
      if (type === 'lin') return `${group(num)}/${group(den)}`;
      if (type === 'noBar') return `\\genfrac{}{}{0pt}{}{${num}}{${den}}`;
      return `\\frac{${num}}{${den}}`;
    }
    case 'sSup':
      return `${group(children(kid(el, 'e')))}^{${children(kid(el, 'sup'))}}`;
    case 'sSub':
      return `${group(children(kid(el, 'e')))}_{${children(kid(el, 'sub'))}}`;
    case 'sSubSup':
      return `${group(children(kid(el, 'e')))}_{${children(kid(el, 'sub'))}}^{${children(kid(el, 'sup'))}}`;
    case 'sPre':
      return `{}_{${children(kid(el, 'sub'))}}^{${children(kid(el, 'sup'))}}${group(children(kid(el, 'e')))}`;
    case 'rad': {
      const deg = children(kid(el, 'deg'));
      const hide = prop(el, 'degHide');
      const e = children(kid(el, 'e'));
      return deg && !isOn(hide) ? `\\sqrt[${deg}]{${e}}` : `\\sqrt{${e}}`;
    }
    case 'd': {
      const beg = prop(el, 'begChr');
      const end = prop(el, 'endChr');
      const sep = prop(el, 'sepChr') ?? '|';
      const open = beg === undefined ? '(' : beg;
      const close = end === undefined ? ')' : end;
      const inner = kids(el, 'e').map(children).join(sep === ',' ? ',' : sep === '|' ? '\\mid ' : escapeText(sep));
      const delim = (c: string, left: boolean) => {
        if (!c) return '.';
        if (c === '{') return '\\{';
        if (c === '}') return '\\}';
        if (c === '|') return '|';
        if (c === '‖' || c === '∥') return '\\|';
        if (c === '⟨' || c === '〈') return '\\langle';
        if (c === '⟩' || c === '〉') return '\\rangle';
        if (c === '⌊') return '\\lfloor';
        if (c === '⌋') return '\\rfloor';
        if (c === '⌈') return '\\lceil';
        if (c === '⌉') return '\\rceil';
        if ('()[]'.includes(c)) return c;
        return left ? '.' : '.';
      };
      // Hệ phương trình: dấu { bên trái, không có ngoặc phải, nội dung là eqArr
      const eqArr = kid(kid(el, 'e'), 'eqArr');
      if (open === '{' && !close && eqArr) {
        return `\\begin{cases}${kids(eqArr, 'e').map(children).join('\\\\')}\\end{cases}`;
      }
      if (open === '[' && !close && eqArr) {
        return `\\left[\\begin{aligned}${kids(eqArr, 'e').map(r => children(r).replace(/&/g, '')).join('\\\\')}\\end{aligned}\\right.`;
      }
      return `\\left${delim(open, true)}${inner}\\right${delim(close, false)}`;
    }
    case 'nary': {
      const chr = prop(el, 'chr') ?? '∫';
      const op = NARY[chr] || escapeText(chr);
      const sub = children(kid(el, 'sub'));
      const sup = children(kid(el, 'sup'));
      const subHide = prop(el, 'subHide');
      const supHide = prop(el, 'supHide');
      let out = op;
      if (sub && !isOn(subHide)) out += `_{${sub}}`;
      if (sup && !isOn(supHide)) out += `^{${sup}}`;
      return `${out} ${children(kid(el, 'e'))}`;
    }
    case 'func': {
      const name = children(kid(el, 'fName')).trim();
      const arg = children(kid(el, 'e'));
      const fn = FUNC_NAMES.has(name.replace(/^\\/, '').trim()) && !name.startsWith('\\') ? `\\${name}` : name;
      return `${fn} ${arg}`;
    }
    case 'limLow': {
      const base = children(kid(el, 'e')).trim();
      const lim = children(kid(el, 'lim'));
      const b = base === 'lim' || base === '\\lim' ? '\\lim' : base;
      return `${b}_{${lim}}`;
    }
    case 'limUpp':
      return `\\overset{${children(kid(el, 'lim'))}}{${children(kid(el, 'e'))}}`;
    case 'acc': {
      const chr = prop(el, 'chr') ?? '̂';
      const cmd = ACCENTS[chr] || '\\hat';
      const e = children(kid(el, 'e'));
      const wide = e.replace(/\\[a-z]+|[{}\s]/gi, '').length > 1;
      const c = wide && cmd === '\\hat' ? '\\widehat' : wide && cmd === '\\vec' ? '\\overrightarrow' : wide && cmd === '\\tilde' ? '\\widetilde' : cmd;
      return `${c}{${e}}`;
    }
    case 'bar': {
      const pos = prop(el, 'pos');
      const e = children(kid(el, 'e'));
      return pos === 'bot' ? `\\underline{${e}}` : `\\overline{${e}}`;
    }
    case 'groupChr': {
      const chr = prop(el, 'chr') ?? '⏟';
      const pos = prop(el, 'pos');
      const e = children(kid(el, 'e'));
      if (chr === '→' || chr === '⟶') return `\\xrightarrow{${e}}`;
      return pos === 'top' || chr === '⏞' ? `\\overbrace{${e}}` : `\\underbrace{${e}}`;
    }
    case 'borderBox':
      return `\\boxed{${children(kid(el, 'e'))}}`;
    case 'box':
    case 'phant':
      return children(kid(el, 'e'));
    case 'eqArr':
      return `\\begin{aligned}${kids(el, 'e').map(children).join('\\\\')}\\end{aligned}`;
    case 'm': {
      const rows = kids(el, 'mr').map(r => kids(r, 'e').map(children).join(' & '));
      return `\\begin{matrix}${rows.join('\\\\')}\\end{matrix}`;
    }
    case 'oMathPara':
      return kids(el, 'oMath').map(children).join('\\\\');
    default:
      // các thẻ *Pr (thuộc tính) và thẻ lạ: bỏ qua phần thuộc tính, lấy nội dung con
      if (el.localName.endsWith('Pr')) return '';
      return children(el);
  }
}

/** Chuyển một phần tử <m:oMath> hoặc <m:oMathPara> sang LaTeX */
export function ommlToLatex(el: Element): string {
  return node(el)
    .replace(/\s{2,}/g, ' ')
    .replace(/&/g, (m, off, str) => (/\\begin\{(aligned|matrix|cases)\}/.test(str) ? m : '\\&'))
    .trim();
}
