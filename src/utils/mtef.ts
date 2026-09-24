/**
 * Đọc công thức MathType (Equation.DSMT4…DSMT7, MTEF phiên bản 5) → LaTeX.
 *
 * Trong file Word, mỗi công thức MathType là một đối tượng OLE (word/embeddings/oleObjectN.bin).
 * Bên trong có luồng "Equation Native" = 28 byte đầu + dữ liệu MTEF. Tài liệu định dạng MTEF do
 * Design Science (WIRIS) công bố. Tệp này chỉ đọc – không cần MathType trên máy.
 */

// ---------------------------------------------------------------------------
// Cây công thức
// ---------------------------------------------------------------------------
type Node =
  | { t: 'char'; code: number; face: number; embell: number[]; funcStart: boolean }
  | { t: 'line'; items: Node[]; isNull: boolean }
  | { t: 'tmpl'; sel: number; vari: number; slots: Node[] }
  | { t: 'pile'; halign: number; lines: Node[] }
  | { t: 'matrix'; rows: number; cols: number; cells: Node[] };

// Kiểu chữ (typeface) của MathType
const FN_TEXT = 1;
const FN_FUNCTION = 2;
const FN_VECTOR = 7;
const FN_SPACE = 24;
const FN_MARKER = 23;
const FN_EXPAND = 22;

class Reader {
  pos = 0;
  constructor(private b: Uint8Array) {}
  get eof() {
    return this.pos >= this.b.length;
  }
  u8() {
    if (this.pos >= this.b.length) throw new Error('MTEF: hết dữ liệu');
    return this.b[this.pos++];
  }
  u16() {
    const v = this.b[this.pos] | (this.b[this.pos + 1] << 8);
    this.pos += 2;
    return v;
  }
  cstr() {
    let s = '';
    for (;;) {
      const c = this.u8();
      if (c === 0) return s;
      s += String.fromCharCode(c);
    }
  }
  skip(n: number) {
    this.pos += n;
  }
}

const OPT_NUDGE = 0x08;
const OPT_CHAR_EMBELL = 0x01;
const OPT_CHAR_FUNC_START = 0x02;
const OPT_CHAR_ENC_CHAR_8 = 0x04;
const OPT_CHAR_ENC_CHAR_16 = 0x10;
const OPT_CHAR_ENC_NO_MTCODE = 0x20;
const OPT_LINE_NULL = 0x01;
const OPT_LP_RULER = 0x02;
const OPT_LINE_LSPACE = 0x04;

function readNudge(r: Reader, opts: number) {
  if (!(opts & OPT_NUDGE)) return;
  const dx = r.u8();
  const dy = r.u8();
  if (dx === 128 && dy === 128) r.skip(4);
}

function readRuler(r: Reader) {
  // [7][số điểm dừng][mỗi điểm: kiểu 1 byte + vị trí 2 byte]
  const tag = r.u8();
  if (tag !== 7) throw new Error('MTEF: thiếu RULER');
  const n = r.u8();
  r.skip(n * 3);
}

/** Mảng "kích thước" dạng nibble của EQN_PREFS */
function skipDimArray(r: Reader, count: number) {
  let done = 0;
  let hi = true;
  let byte = 0;
  while (done < count) {
    let nib: number;
    if (hi) {
      byte = r.u8();
      nib = byte >> 4;
    } else nib = byte & 0x0f;
    hi = !hi;
    if (nib === 0x0f) done++;
  }
}

/** Đọc một bản ghi định nghĩa / trạng thái (không tạo nút). Trả về true nếu đã xử lý. */
function skipNonObject(r: Reader, tag: number): boolean {
  switch (tag) {
    case 7: // RULER (đã đọc tag)
      r.skip(r.u8() * 3);
      return true;
    case 8: // FONT_STYLE_DEF
      r.u8();
      r.u8();
      return true;
    case 9: {
      // SIZE
      const lsize = r.u8();
      if (lsize === 101) r.u16();
      else if (lsize === 100) {
        r.u8();
        r.u16();
      } else r.u8();
      return true;
    }
    case 10:
    case 11:
    case 12:
    case 13:
    case 14: // FULL, SUB, SUB2, SYM, SUBSYM
      return true;
    case 15: // COLOR
      r.u8();
      return true;
    case 16: {
      // COLOR_DEF
      const o = r.u8();
      r.skip(o & 0x01 ? 8 : 6);
      if (o & 0x04) r.cstr();
      return true;
    }
    case 17: // FONT_DEF
      r.u8();
      r.cstr();
      return true;
    case 18: {
      // EQN_PREFS
      r.u8(); // options
      skipDimArray(r, r.u8()); // sizes
      skipDimArray(r, r.u8()); // spacing
      const nStyles = r.u8();
      for (let i = 0; i < nStyles; i++) {
        const fontDef = r.u8();
        if (fontDef) r.u8();
      }
      return true;
    }
    case 19: // ENCODING_DEF
      r.cstr();
      return true;
  }
  if (tag >= 100) {
    r.skip(r.u16());
    return true;
  }
  return false;
}

/** Đọc danh sách đối tượng cho tới END (0) */
function readList(r: Reader): Node[] {
  const out: Node[] = [];
  while (!r.eof) {
    const tag = r.u8();
    if (tag === 0) break;
    const n = readRecord(r, tag);
    if (n) out.push(n);
  }
  return out;
}

function readRecord(r: Reader, tag: number): Node | null {
  switch (tag) {
    case 1: {
      // LINE
      const o = r.u8();
      readNudge(r, o);
      if (o & OPT_LINE_LSPACE) r.u16();
      if (o & OPT_LP_RULER) readRuler(r);
      if (o & OPT_LINE_NULL) return { t: 'line', items: [], isNull: true };
      return { t: 'line', items: readList(r), isNull: false };
    }
    case 2: {
      // CHAR
      const o = r.u8();
      readNudge(r, o);
      const face = r.u8() - 128;
      let code = 0;
      if (!(o & OPT_CHAR_ENC_NO_MTCODE)) code = r.u16();
      if (o & OPT_CHAR_ENC_CHAR_8) {
        const c8 = r.u8();
        if (o & OPT_CHAR_ENC_NO_MTCODE) code = c8;
      }
      if (o & OPT_CHAR_ENC_CHAR_16) {
        const c16 = r.u16();
        if (o & OPT_CHAR_ENC_NO_MTCODE) code = c16;
      }
      const embell: number[] = [];
      if (o & OPT_CHAR_EMBELL) {
        for (const e of readList(r)) if ((e as { t: string }).t === 'embell') embell.push((e as unknown as { type: number }).type);
      }
      return { t: 'char', code, face, embell, funcStart: !!(o & OPT_CHAR_FUNC_START) };
    }
    case 3: {
      // TMPL
      const o = r.u8();
      readNudge(r, o);
      const sel = r.u8();
      let vari = r.u8();
      if (vari & 0x80) vari = (vari & 0x7f) | (r.u8() << 7);
      r.u8(); // tùy chọn riêng của khuôn
      return { t: 'tmpl', sel, vari, slots: readList(r) };
    }
    case 4: {
      // PILE
      const o = r.u8();
      readNudge(r, o);
      const halign = r.u8();
      r.u8(); // valign
      if (o & OPT_LP_RULER) readRuler(r);
      return { t: 'pile', halign, lines: readList(r) };
    }
    case 5: {
      // MATRIX
      const o = r.u8();
      readNudge(r, o);
      r.u8(); // valign
      r.u8(); // h_just
      r.u8(); // v_just
      const rows = r.u8();
      const cols = r.u8();
      r.skip(Math.floor((2 * (rows + 1) + 7) / 8));
      r.skip(Math.floor((2 * (cols + 1) + 7) / 8));
      return { t: 'matrix', rows, cols, cells: readList(r) };
    }
    case 6: {
      // EMBELL
      const o = r.u8();
      readNudge(r, o);
      return { t: 'embell', type: r.u8() } as unknown as Node;
    }
  }
  if (skipNonObject(r, tag)) return null;
  throw new Error(`MTEF: bản ghi lạ ${tag} tại ${r.pos - 1}`);
}

// ---------------------------------------------------------------------------
// Ký tự → LaTeX
// ---------------------------------------------------------------------------
const SYMBOLS: Record<number, string> = {
  0x2212: '-', 0x2013: '-', 0x00d7: '\\times ', 0x00f7: '\\div ', 0x00b1: '\\pm ', 0x2213: '\\mp ', 0x22c5: '\\cdot ', 0x00b7: '\\cdot ', 0x2219: '\\cdot ',
  0x2264: '\\le ', 0x2265: '\\ge ', 0x2260: '\\ne ', 0x2248: '\\approx ', 0x2261: '\\equiv ', 0x223c: '\\sim ', 0x2245: '\\cong ', 0x221d: '\\propto ',
  0x226a: '\\ll ', 0x226b: '\\gg ', 0x2208: '\\in ', 0x2209: '\\notin ', 0x220b: '\\ni ', 0x2282: '\\subset ', 0x2283: '\\supset ', 0x2286: '\\subseteq ',
  0x2287: '\\supseteq ', 0x2284: '\\not\\subset ', 0x2229: '\\cap ', 0x222a: '\\cup ', 0x2205: '\\varnothing ', 0x2200: '\\forall ', 0x2203: '\\exists ',
  0x2204: '\\nexists ', 0x221e: '\\infty ', 0x2192: '\\to ', 0x2190: '\\leftarrow ', 0x2194: '\\leftrightarrow ', 0x21d2: '\\Rightarrow ',
  0x21d0: '\\Leftarrow ', 0x21d4: '\\Leftrightarrow ', 0x2191: '\\uparrow ', 0x2193: '\\downarrow ', 0x21a6: '\\mapsto ', 0x27f6: '\\longrightarrow ',
  0x27f9: '\\Longrightarrow ', 0x27fa: '\\Longleftrightarrow ', 0x2227: '\\wedge ', 0x2228: '\\vee ', 0x00ac: '\\neg ', 0x22a5: '\\perp ',
  0x2225: '\\parallel ', 0x2226: '\\nparallel ', 0x2220: '\\angle ', 0x2221: '\\measuredangle ', 0x25b3: '\\triangle ', 0x2206: '\\Delta ',
  0x00b0: '^{\\circ}', 0x2218: '\\circ ', 0x2032: "'", 0x2033: "''", 0x2034: "'''", 0x2026: '\\ldots ', 0x22ef: '\\cdots ', 0x22ee: '\\vdots ',
  0x22f1: '\\ddots ', 0x2202: '\\partial ', 0x2207: '\\nabla ', 0x221a: '\\surd ', 0x2211: '\\sum ', 0x220f: '\\prod ', 0x222b: '\\int ',
  0x222c: '\\iint ', 0x222d: '\\iiint ', 0x222e: '\\oint ', 0x211d: '\\mathbb{R}', 0x2115: '\\mathbb{N}', 0x2124: '\\mathbb{Z}',
  0x211a: '\\mathbb{Q}', 0x2102: '\\mathbb{C}', 0x27e8: '\\langle ', 0x27e9: '\\rangle ', 0x2329: '\\langle ', 0x232a: '\\rangle ', 0x2016: '\\| ',
 0x2217: '*', 0x2015: '-', 0x2014: '-', 0x2010: '-', 0x00a0: '~', 0x2009: '\\,', 0x200a: '\\,', 0x2003: '\\quad ', 0x2002: '\\;',
  0x2061: '', 0x2062: '', 0x2063: '', 0x2044: '/', 0x2215: '/', 0x2223: '|', 0x2224: '\\nmid ', 0x2234: '\\therefore ', 0x2235: '\\because ',
  0x22c6: '\\star ', 0x2295: '\\oplus ', 0x2297: '\\otimes ', 0x2020: '\\dagger ', 0x2135: '\\aleph ', 0x210f: '\\hbar ', 0x2113: '\\ell ',
  0x2118: '\\wp ', 0x211c: '\\Re ', 0x2111: '\\Im ', 0x25cb: '\\bigcirc ', 0x25a1: '\\square ',
  0x007b: '\\{', 0x007d: '\\}', 0x0025: '\\%', 0x0026: '\\&', 0x0023: '\\#', 0x005f: '\\_', 0x0024: '\\$', 0x005c: '\\backslash ', 0x007e: '\\sim ',
  0x005e: '\\wedge ', 0x0020: '\\ ',
  // MT Extra (vùng riêng)
  0xec00: '\\ldots ', 0xec01: '\\cdots ', 0xec02: '\\vdots ', 0xec03: '\\ddots ', 0xec04: '\\ddots ', 0xeb05: '\\,', 0xeb08: '\\,',
  0xf0e5: '\\sum ', 0xf0f2: '\\int ',
};
const GREEK = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho varsigma sigma tau upsilon phi chi psi omega'.split(' ');
const GREEK_UP: Record<number, string> = {
  0x0393: '\\Gamma ', 0x0394: '\\Delta ', 0x0398: '\\Theta ', 0x039b: '\\Lambda ', 0x039e: '\\Xi ', 0x03a0: '\\Pi ', 0x03a3: '\\Sigma ', 0x03a5: '\\Upsilon ',
  0x03a6: '\\Phi ', 0x03a8: '\\Psi ', 0x03a9: '\\Omega ',
};
const GREEK_VAR: Record<number, string> = { 0x03d5: '\\phi ', 0x03c6: '\\varphi ', 0x03d1: '\\vartheta ', 0x03f5: '\\epsilon ', 0x03b5: '\\varepsilon ', 0x03d6: '\\varpi ' };

function charLatex(code: number, face: number): string {
  if (face === FN_SPACE || (code >= 0xef00 && code <= 0xef1f)) {
    // khoảng trắng của MathType
    return code === 0xef04 || code === 0xef05 ? '\\quad ' : code === 0xef00 || code === 0xef08 ? '' : '\\,';
  }
  if (face === FN_MARKER || face === FN_EXPAND) return '';
  if (SYMBOLS[code] !== undefined) return SYMBOLS[code];
  if (GREEK_UP[code]) return GREEK_UP[code];
  if (GREEK_VAR[code]) return GREEK_VAR[code];
  if (code >= 0x03b1 && code <= 0x03c9) return `\\${GREEK[code - 0x03b1]} `;
  if (code >= 0x0391 && code <= 0x03a9) return String.fromCharCode(code - 0x0391 + 65); // chữ Hy Lạp hoa giống chữ Latin
  if (code >= 0xe000 && code <= 0xf8ff) return ''; // ký tự riêng khác của MT Extra: bỏ
  return String.fromCharCode(code);
}

const EMBELL: Record<number, (s: string) => string> = {
  2: s => `\\dot{${s}}`,
  3: s => `\\ddot{${s}}`,
  4: s => `\\dddot{${s}}`,
  5: s => `${s}'`,
  6: s => `${s}''`,
  7: s => `{}'${s}`,
  8: s => `\\tilde{${s}}`,
  9: s => `\\hat{${s}}`,
  10: s => `\\not{${s}}`,
  11: s => `\\overrightarrow{${s}}`,
  12: s => `\\overleftarrow{${s}}`,
  13: s => `\\overleftrightarrow{${s}}`,
  14: s => `\\vec{${s}}`,
  15: s => `\\overleftarrow{${s}}`,
  16: s => `\\bar{${s}}`,
  17: s => `\\overline{${s}}`,
  18: s => `\\overset{\\frown}{${s}}`,
  19: s => `\\overset{\\smile}{${s}}`,
  24: s => `\\underset{\\cdot}{${s}}`,
  25: s => `\\underset{\\cdot\\cdot}{${s}}`,
  27: s => `\\underline{${s}}`,
  28: s => `\\utilde{${s}}`,
};

const FUNCS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'arg', 'deg', 'dim', 'gcd', 'ker', 'hom', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'coth', 'Pr', 'mod']);
const funcLatex = (name: string) => {
  if (FUNCS.has(name)) return `\\${name} `;
  if (name === 'tg') return '\\tan ';
  if (name === 'cotg') return '\\cot ';
  if (name === 'arctg') return '\\arctan ';
  return `\\operatorname{${name}}`;
};

// ---------------------------------------------------------------------------
// Cây → LaTeX
// ---------------------------------------------------------------------------
const slot = (n: Node | undefined): string => (n ? render(n).trim() : '');
const isEmpty = (n: Node | undefined) => !n || (n.t === 'line' && (n.isNull || !n.items.length));
const group = (s: string) => (s.length === 1 || /^\\[a-zA-Z]+\s*$/.test(s) ? s : `{${s}}`);

function renderItems(items: Node[]): string {
  let out = '';
  let i = 0;
  while (i < items.length) {
    const n = items[i];
    if (n.t === 'char') {
      // gom chuỗi chữ thường (TEXT) và tên hàm (FUNCTION)
      if ((n.face === FN_TEXT || n.face === FN_FUNCTION) && !n.embell.length) {
        let s = '';
        let j = i;
        while (j < items.length) {
          const m = items[j];
          if (m.t !== 'char' || m.embell.length) break;
          const combining = m.code >= 0x0300 && m.code <= 0x036f; // dấu tiếng Việt tách rời (e + ̂ = ê)
          if (!combining && (m.face !== n.face || (j > i && n.face === FN_FUNCTION && m.funcStart))) break;
          if (m.code >= 0xef00 && m.code <= 0xef1f) s += ' '; // khoảng trắng MathType
          else if (!(m.code >= 0xe000 && m.code <= 0xf8ff)) s += String.fromCharCode(m.code); // bỏ ký tự riêng khác của MT Extra
          j++;
        }
        s = s.normalize('NFC');
        const trimmed = s.trim();
        if (!trimmed) out += s ? '\\ ' : '';
        else if (/^[A-Za-z]+$/.test(trimmed) && (n.face === FN_FUNCTION || FUNCS.has(trimmed) || ['tg', 'cotg', 'arctg'].includes(trimmed))) out += funcLatex(trimmed);
        else if (/^[\d.,+\-=()[\]/<>|!:;' ]+$/.test(s) || /^[A-Za-z]$/.test(s)) out += s.replace(/ /g, '\\ ');
        else out += `\\text{${s.replace(/([{}\\$&#%_^~])/g, '\\$1')}}`;
        i = j;
        continue;
      }
      // dấu tiếng Việt tách rời đứng sau một chữ thường (không phải TEXT) → gộp vào chữ trước
      if (n.code >= 0x0300 && n.code <= 0x036f) {
        const m = out.match(/([A-Za-z])$/);
        if (m) out = out.slice(0, -1) + `\\text{${(m[1] + String.fromCharCode(n.code)).normalize('NFC')}}`;
        i++;
        continue;
      }
      let c = charLatex(n.code, n.face);
      if (n.face === FN_VECTOR && /^[A-Za-z]$/.test(c)) c = `\\mathbf{${c}}`;
      for (const e of n.embell) c = (EMBELL[e] || (s => s))(c.trim());
      out += c;
      i++;
      continue;
    }
    out += render(n);
    i++;
  }
  return out;
}

function fence(sel: number, slots: Node[], vari: number): string {
  const body = slot(slots[0]);
  const chars = slots.slice(1).filter(s => s.t === 'char') as Extract<Node, { t: 'char' }>[];
  const delim = (c: Extract<Node, { t: 'char' }> | undefined, def: string) => {
    if (!c) return def;
    const d = charLatex(c.code, c.face).trim();
    return ({ '{': '\\{', '}': '\\}', '\\{': '\\{', '\\}': '\\}' } as Record<string, string>)[d] || d || def;
  };
  const DEF: Record<number, [string, string]> = {
    0: ['\\langle', '\\rangle'], 1: ['(', ')'], 2: ['\\{', '\\}'], 3: ['[', ']'], 4: ['|', '|'], 5: ['\\|', '\\|'],
    6: ['\\lfloor', '\\rfloor'], 7: ['\\lceil', '\\rceil'], 8: ['[', ']'], 9: ['[', ']'],
  };
  const hasL = sel === 9 ? true : !!(vari & 0x01) || !(vari & 0x03);
  const hasR = sel === 9 ? true : !!(vari & 0x02) || !(vari & 0x03);
  let li = 0;
  const left = hasL ? delim(chars[li++], DEF[sel][0]) : '.';
  const right = hasR ? delim(chars[li], DEF[sel][1]) : '.';
  // Hệ phương trình: { chứa nhiều dòng
  return `\\left${left}${body}\\right${right}`;
}

function bigOp(op: string, slots: Node[], opFirst = false): string {
  const [main, lower, upper] = opFirst ? [undefined, slots[1], slots[0]] : slots;
  const opChar = slots.find(s => s.t === 'char') as Extract<Node, { t: 'char' }> | undefined;
  const o = opChar ? charLatex(opChar.code, opChar.face).trim() || op : op;
  let s = o;
  if (!isEmpty(lower)) s += `_{${slot(lower)}}`;
  if (!isEmpty(upper)) s += `^{${slot(upper)}}`;
  return `${s} ${main ? slot(main) : ''}`;
}

function renderTmpl(n: Extract<Node, { t: 'tmpl' }>): string {
  const s = n.slots.filter(x => x.t !== 'char'); // các ô (không kể ký tự ngoặc / toán tử)
  switch (n.sel) {
    case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8: case 9:
      return fence(n.sel, n.slots, n.vari);
    case 10: {
      const idx = s[1];
      return isEmpty(idx) ? `\\sqrt{${slot(s[0])}}` : `\\sqrt[${slot(idx)}]{${slot(s[0])}}`;
    }
    case 11:
      if (n.vari & 0x02) return `${group(slot(s[0]))}/${group(slot(s[1]))}`; // phân số gạch chéo
      return `\\frac{${slot(s[0])}}{${slot(s[1])}}`;
    case 12:
      return `\\underline{${slot(s[0])}}`;
    case 13:
      return `\\overline{${slot(s[0])}}`;
    case 14:
      return `\\xrightarrow[${slot(s[1])}]{${slot(s[0])}}`;
    case 15: {
      const count = n.vari & 0x0003 || 1;
      const contour = n.vari & 0x0004;
      const op = contour ? '\\oint' : ['\\int', '\\int', '\\iint', '\\iiint'][count];
      const lower = s[1];
      const upper = s[2];
      let r = op;
      if (!isEmpty(lower)) r += `_{${slot(lower)}}`;
      if (!isEmpty(upper)) r += `^{${slot(upper)}}`;
      return `${r} ${slot(s[0])}`;
    }
    case 16: return bigOp('\\sum', s);
    case 17: return bigOp('\\prod', s);
    case 18: return bigOp('\\coprod', s);
    case 19: return bigOp('\\bigcup', s);
    case 20: return bigOp('\\bigcap', s);
    case 21: return bigOp('\\int', s, true);
    case 22: return bigOp('\\sum', s, true);
    case 23: {
      // giới hạn: ô chính chứa "lim", "max"...
      const main = slot(s[0]);
      const isFn = /^\\(lim|max|min|sup|inf)\s*$/.test(main);
      // MathType đặt cận dưới/trên NGAY DƯỚI/TRÊN chữ lim, max, min
      let r = isFn ? `${main.trim()}\\limits` : `\\mathop{${main}}\\limits`;
      if (!isEmpty(s[1])) r += `_{${slot(s[1])}}`;
      if (!isEmpty(s[2])) r += `^{${slot(s[2])}}`;
      return `${r} `;
    }
    case 24:
      return n.vari & 0x0001 ? `\\overbrace{${slot(s[0])}}^{${slot(s[1])}}` : `\\underbrace{${slot(s[0])}}_{${slot(s[1])}}`;
    case 25:
      return n.vari & 0x0001 ? `\\overbrace{${slot(s[0])}}^{${slot(s[1])}}` : `\\underbrace{${slot(s[0])}}_{${slot(s[1])}}`;
    case 26:
      return `${slot(s[1])}\\,\\big)\\,${slot(s[0])}`;
    case 27:
    case 28:
    case 29: {
      // chỉ số dưới / trên gắn vào ký tự đứng trước
      const sub = s[0];
      const sup = s[1];
      let r = '';
      if (!isEmpty(sub)) r += `_{${slot(sub)}}`;
      if (!isEmpty(sup)) r += `^{${slot(sup)}}`;
      return r || '{}';
    }
    case 30:
      return `\\left\\langle ${slot(s[0])}\\middle|${slot(s[1])}\\right\\rangle `;
    case 31:
      return n.vari & 0x0001 ? `\\overleftarrow{${slot(s[0])}}` : `\\overrightarrow{${slot(s[0])}}`;
    case 32:
      return `\\widetilde{${slot(s[0])}}`;
    case 33:
      return `\\widehat{${slot(s[0])}}`;
    case 34:
      return `\\overset{\\frown}{${slot(s[0])}}`;
    case 37:
      return `\\boxed{${slot(s[0])}}`;
    default:
      return s.map(slot).join(' ');
  }
}

const ALIGN: Record<number, string> = { 1: 'l', 2: 'c', 3: 'r', 4: 'l', 5: 'r' };

function render(n: Node): string {
  switch (n.t) {
    case 'line':
      return n.isNull ? '' : renderItems(n.items);
    case 'char':
      return renderItems([n]);
    case 'tmpl':
      return renderTmpl(n);
    case 'pile': {
      const lines = n.lines.filter(l => l.t === 'line');
      if (lines.length <= 1) return lines.map(render).join('');
      return `\\begin{array}{${ALIGN[n.halign] || 'l'}}${lines.map(l => render(l).trim()).join(' \\\\ ')}\\end{array}`;
    }
    case 'matrix': {
      const cells = n.cells.filter(c => c.t === 'line');
      const rows: string[] = [];
      for (let r = 0; r < n.rows; r++) rows.push(cells.slice(r * n.cols, (r + 1) * n.cols).map(c => render(c).trim()).join(' & '));
      return `\\begin{array}{${'c'.repeat(Math.max(1, n.cols))}}${rows.join(' \\\\ ')}\\end{array}`;
    }
  }
}

/** Làm gọn: bỏ khoảng trắng thừa, sửa vài mẫu thường gặp */
function tidy(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\\left\(\s*/g, '\\left(')
    .replace(/ ([_^])/g, '$1')
    .replace(/\\(le|ge|in|to|cdot|times|ne|pm) (?=[\s)}\]]|$)/g, '\\$1')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .trim();
}

/** MTEF (bắt đầu bằng byte phiên bản) → LaTeX */
export function mtefToLatex(mtef: Uint8Array): string {
  const r = new Reader(mtef);
  const version = r.u8();
  if (version !== 5) throw new Error(`MTEF phiên bản ${version} chưa hỗ trợ`);
  r.u8(); // platform
  r.u8(); // product
  r.u8(); // product version
  r.u8(); // product subversion
  r.cstr(); // application key "DSMT7"
  r.u8(); // equation options
  const top = readList(r);
  return tidy(top.map(render).join(''));
}

/** Luồng "Equation Native" (28 byte đầu + MTEF) → LaTeX */
export function equationNativeToLatex(stream: Uint8Array): string {
  const headerLen = stream[0] | (stream[1] << 8);
  return mtefToLatex(stream.subarray(headerLen));
}

export interface CfbLike {
  read: (data: Uint8Array, opts: { type: 'array' | 'buffer' }) => unknown;
  find: (cfb: unknown, path: string) => { content?: ArrayLike<number> } | null;
}

/** Tệp OLE (oleObjectN.bin) của MathType → LaTeX; trả về null nếu không phải MathType / không đọc được */
export function oleToLatex(bin: Uint8Array, CFB: CfbLike): string | null {
  try {
    const cfb = CFB.read(bin, { type: 'array' });
    const e = CFB.find(cfb, 'Equation Native');
    if (!e?.content) return null;
    const bytes = e.content instanceof Uint8Array ? e.content : Uint8Array.from(e.content as ArrayLike<number>);
    return equationNativeToLatex(bytes);
  } catch {
    return null;
  }
}
