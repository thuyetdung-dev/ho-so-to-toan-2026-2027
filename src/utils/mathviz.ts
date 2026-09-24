/**
 * mathviz – Bộ vẽ đồ thị hàm số cho giáo án (không dùng eval, an toàn với nội dung do người dùng nhập).
 *
 * Cú pháp chèn vào bất kỳ ô nội dung nào của giáo án:
 *
 *   [[do-thi: y = x^3 - 3x; y = 2; x = -3..3; y = -4..4; A(1;-2); B(-1;2)]]
 *
 *   - Mỗi "y = biểu thức" (hoặc "f(x) = ...") là một đồ thị; có thể nhiều đồ thị.
 *   - "y = số" là đường thẳng nằm ngang;  "x = số" (một giá trị) là đường thẳng đứng.
 *   - "x = a..b", "y = c..d" là khung nhìn (mặc định x = -5..5, y tự động).
 *   - "A(1;2)" hoặc "A(1,2)" là điểm có tên.
 *   - Biểu thức hỗ trợ: + - * / ^, dấu nhân ngầm (2x, 3(x+1), x(x-1)), hàm sin cos tan cot
 *     sqrt (căn) abs ln log exp, hằng số pi, e; |x| là trị tuyệt đối.
 */

export type Expr =
  | { t: 'num'; v: number }
  | { t: 'var' }
  | { t: 'neg'; a: Expr }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Expr; b: Expr }
  | { t: 'fn'; name: string; a: Expr };

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  tg: Math.tan,
  cot: x => 1 / Math.tan(x),
  cotg: x => 1 / Math.tan(x),
  sqrt: Math.sqrt,
  can: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
};

type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const s = src
    .replace(/[−–—]/g, '-')
    .replace(/[×·∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\pi/g, 'pi')
    .replace(/\\(sin|cos|tan|cot|ln|log|exp|sqrt)/g, '$1')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/[{]/g, '(')
    .replace(/[}]/g, ')');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const raw = s.slice(i, j).replace(',', '.');
      const v = Number(raw);
      if (!Number.isFinite(v)) throw new Error(`Số không hợp lệ: ${raw}`);
      out.push({ k: 'num', v });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      let word = s.slice(i, j).toLowerCase();
      // Tách "xsin", "2pix"... thành các định danh đã biết
      while (word) {
        const known = ['arcsin', 'arccos', 'arctan', 'sqrt', 'cotg', 'can', 'sin', 'cos', 'tan', 'cot', 'abs', 'exp', 'log', 'ln', 'tg', 'pi', 'x', 'e'].find(k =>
          word.startsWith(k),
        );
        if (!known) throw new Error(`Không hiểu "${word}" (chỉ dùng biến x)`);
        out.push({ k: 'id', v: known });
        word = word.slice(known.length);
      }
      i = j;
      continue;
    }
    if ('+-*/^()|'.includes(c)) {
      out.push({ k: 'op', v: c });
      i++;
      continue;
    }
    throw new Error(`Ký tự không hợp lệ: "${c}"`);
  }
  return out;
}

/** Phân tích biểu thức một biến x thành cây (có hỗ trợ nhân ngầm). */
export function parseExpr(src: string): Expr {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.k === 'op' && peek()!.v === v;

  const startsFactor = () => {
    const t = peek();
    if (!t) return false;
    if (t.k === 'num' || t.k === 'id') return true;
    return t.k === 'op' && (t.v === '(' || t.v === '|');
  };

  function expr(): Expr {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const op = (toks[p++] as { v: '+' | '-' }).v;
      a = { t: 'bin', op, a, b: term() };
    }
    return a;
  }
  function term(): Expr {
    let a = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (toks[p++] as { v: '*' | '/' }).v;
        a = { t: 'bin', op, a, b: unary() };
      } else if (startsFactor() && !(peek()?.k === 'op' && peek()!.v === '|' && absDepth > 0)) {
        a = { t: 'bin', op: '*', a, b: power() }; // nhân ngầm: 2x, x(x+1)
      } else break;
    }
    return a;
  }
  function unary(): Expr {
    if (isOp('-')) {
      p++;
      return { t: 'neg', a: unary() };
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    return power();
  }
  function power(): Expr {
    const base = atom();
    if (isOp('^')) {
      p++;
      return { t: 'bin', op: '^', a: base, b: unary() };
    }
    return base;
  }
  let absDepth = 0;
  function atom(): Expr {
    const t = toks[p++];
    if (!t) throw new Error('Biểu thức chưa hoàn chỉnh');
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'id') {
      if (t.v === 'x') return { t: 'var' };
      if (t.v === 'pi') return { t: 'num', v: Math.PI };
      if (t.v === 'e') return { t: 'num', v: Math.E };
      // hàm: sin x, sin(x), sin^2 x
      let exponent: Expr | null = null;
      if (isOp('^')) {
        p++;
        exponent = atom();
      }
      const arg = isOp('(') ? atom() : power();
      const f: Expr = { t: 'fn', name: t.v, a: arg };
      return exponent ? { t: 'bin', op: '^', a: f, b: exponent } : f;
    }
    if (t.v === '(') {
      const e = expr();
      if (!isOp(')')) throw new Error('Thiếu dấu ")"');
      p++;
      return e;
    }
    if (t.v === '|') {
      absDepth++;
      const e = expr();
      absDepth--;
      if (!isOp('|')) throw new Error('Thiếu dấu "|" đóng trị tuyệt đối');
      p++;
      return { t: 'fn', name: 'abs', a: e };
    }
    throw new Error(`Không mong đợi "${t.v}"`);
  }

  const tree = expr();
  if (p < toks.length) throw new Error(`Thừa ký tự "${(toks[p] as { v: unknown }).v}"`);
  return tree;
}

export function evalExpr(e: Expr, x: number): number {
  switch (e.t) {
    case 'num':
      return e.v;
    case 'var':
      return x;
    case 'neg':
      return -evalExpr(e.a, x);
    case 'fn':
      return (FUNCS[e.name] || (() => NaN))(evalExpr(e.a, x));
    case 'bin': {
      const a = evalExpr(e.a, x);
      const b = evalExpr(e.b, x);
      switch (e.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '^': {
          // lũy thừa phân số của số âm: x^(1/3)
          if (a < 0 && !Number.isInteger(b)) {
            const inv = 1 / b;
            if (Number.isInteger(Math.round(inv)) && Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 === 1) {
              return -Math.pow(-a, b);
            }
          }
          return Math.pow(a, b);
        }
      }
    }
  }
  return NaN;
}

export interface GraphSpec {
  functions: Array<{ label: string; expr: Expr }>;
  verticals: number[];
  points: Array<{ name: string; x: number; y: number }>;
  xMin: number;
  xMax: number;
  yMin?: number;
  yMax?: number;
  errors: string[];
}

const num = (s: string) => Number(s.trim().replace(',', '.').replace(/[−–]/g, '-'));

/** Đọc phần mô tả bên trong [[do-thi: ...]] */
export function parseGraphSpec(body: string): GraphSpec {
  const spec: GraphSpec = { functions: [], verticals: [], points: [], xMin: -5, xMax: 5, errors: [] };
  const parts = body
    .split(/;(?![^()]*\))/) // tách theo ";" nhưng không tách trong ngoặc A(1;2)
    .map(s => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    const range = part.match(/^([xy])\s*(?:=|∈|:)\s*\[?\s*(-?[\d.,]+)\s*(?:\.\.|;|:|,\s)\s*(-?[\d.,]+)\s*\]?$/i);
    if (range) {
      const a = num(range[2]);
      const b = num(range[3]);
      if (Number.isFinite(a) && Number.isFinite(b) && a < b) {
        if (range[1].toLowerCase() === 'x') {
          spec.xMin = a;
          spec.xMax = b;
        } else {
          spec.yMin = a;
          spec.yMax = b;
        }
      } else spec.errors.push(`Khoảng không hợp lệ: ${part}`);
      continue;
    }
    const pt = part.match(/^([A-Za-zÀ-ỹ][\w']*)\s*\(\s*(-?[\d.,]+)\s*[;,]\s*(-?[\d.,]+)\s*\)$/u);
    if (pt && pt[1] !== 'y' && pt[1] !== 'f') {
      spec.points.push({ name: pt[1], x: num(pt[2]), y: num(pt[3]) });
      continue;
    }
    const vert = part.match(/^x\s*=\s*(-?[\d.,]+)$/i);
    if (vert) {
      spec.verticals.push(num(vert[1]));
      continue;
    }
    const fn = part.match(/^((?:y|[a-zA-Z]\s*\(\s*x\s*\)))\s*=\s*(.+)$/);
    const exprSrc = fn ? fn[2] : part;
    try {
      spec.functions.push({ label: fn ? `${fn[1].replace(/\s/g, '')} = ${fn[2]}` : `y = ${part}`, expr: parseExpr(exprSrc) });
    } catch (err) {
      spec.errors.push(`"${part}": ${(err as Error).message}`);
    }
  }
  if (spec.xMax - spec.xMin > 1e4) spec.errors.push('Khoảng x quá rộng');
  return spec;
}

/** Lấy mẫu đồ thị thành các đoạn liền (ngắt tại điểm gián đoạn / tiệm cận đứng). */
export function sampleFunction(expr: Expr, xMin: number, xMax: number, n = 600): Array<Array<[number, number]>> {
  const segs: Array<Array<[number, number]>> = [];
  let cur: Array<[number, number]> = [];
  let prevY: number | null = null;
  const step = (xMax - xMin) / n;
  for (let i = 0; i <= n; i++) {
    const x = xMin + i * step;
    const y = evalExpr(expr, x);
    if (!Number.isFinite(y)) {
      if (cur.length) segs.push(cur);
      cur = [];
      prevY = null;
      continue;
    }
    // Gián đoạn (tiệm cận đứng, tan...): giá trị ở giữa hai điểm không nằm giữa hai giá trị → ngắt đoạn
    if (prevY !== null && Math.abs(y - prevY) > 0.5) {
      const ym = evalExpr(expr, x - step / 2);
      const lo = Math.min(y, prevY);
      const hi = Math.max(y, prevY);
      const tol = (hi - lo) * 0.05;
      if (!Number.isFinite(ym) || ym < lo - tol || ym > hi + tol) {
        if (cur.length) segs.push(cur);
        cur = [];
      }
    }
    cur.push([x, y]);
    prevY = y;
  }
  if (cur.length) segs.push(cur);
  return segs;
}

/** Bước lưới "đẹp" (1, 2, 5 × 10^k) */
export function niceStep(range: number, target = 10): number {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
}

/** Tìm token [[do-thi: ...]] / [[graph: ...]] trong văn bản */
export const GRAPH_TOKEN = /\[\[\s*(?:do-thi|đồ-thị|đồ thị|do thi|graph)\s*:\s*([\s\S]+?)\]\]/giu;
