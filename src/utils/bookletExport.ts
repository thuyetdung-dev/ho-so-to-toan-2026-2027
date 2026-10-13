/**
 * Xuất cuốn "Sổ sinh hoạt chuyên môn" (Báo cáo & In → Đóng cuốn Sổ chuyên môn):
 *  - Word (.docx): đọc bản xem trước đang hiển thị, giữ tiêu đề, bảng, hình, đồ thị;
 *    công thức KaTeX được chuyển thành công thức Word gốc (Equation) để sửa tiếp được.
 *  - Excel (.xlsx): mỗi phần hồ sơ một trang tính, mỗi hồ sơ một dòng, kèm trang "Tổng hợp".
 *  - PDF: dùng hộp thoại in của trình duyệt (chọn "Lưu dưới dạng PDF") – xem Booklet.tsx.
 */
import * as XLSX from '@e965/xlsx';
import { sanitizeCellValue } from './excel';
import { downloadBlob } from '../report/download';

export interface BookletGroup {
  key: string;
  title: string;
  records: unknown[];
}

export interface BookletDictionaries {
  labels: Record<string, string>;
  statuses: Record<string, string>;
  hidden: Set<string>;
  names: Map<string, string>;
}

export interface BookletInfo {
  schoolName: string;
  departmentName: string;
  academicYear: string;
  start: string;
  end: string;
  head: string;
}

export const bookletFileName = (info: BookletInfo, ext: string) =>
  `So_Sinh_Hoat_Chuyen_Mon_${info.academicYear}_${info.start}_den_${info.end}`.replace(/[^\w.-]+/g, '_') + `.${ext}`;

/* ------------------------------------------------------------------ */
/* WORD                                                                */
/* ------------------------------------------------------------------ */

const FONT = 'Times New Roman';
/** Bề rộng vùng chữ A4 dọc, lề trái 2,5 cm – phải 1,5 cm (đơn vị DXA) */
const CONTENT_DXA = 9638;
/** Bề rộng tối đa của hình (px, ~16 cm) */
const MAX_IMAGE_PX = 600;

type Inline =
  | { kind: 'text'; text: string; bold?: boolean; italics?: boolean }
  | { kind: 'break' }
  | { kind: 'math'; latex: string; fallback: string }
  | { kind: 'image'; data: Uint8Array; width: number; height: number }
  | { kind: 'missing'; text: string };

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'TABLE', 'DL', 'ARTICLE', 'SECTION', 'UL', 'OL', 'LI']);

function hasBlockChild(el: Element): boolean {
  for (const c of Array.from(el.children)) {
    if (BLOCK_TAGS.has(c.tagName)) return true;
    if (c.tagName === 'DIV' && !c.classList.contains('math-content')) return true;
    if (c.tagName === 'DIV' && c.classList.contains('math-content') && hasBlockChild(c)) return true;
  }
  return false;
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('canvas');
  return new Uint8Array(await blob.arrayBuffer());
}

function fitSize(w: number, h: number) {
  if (!w || !h) return { width: 400, height: 300 };
  const k = Math.min(1, MAX_IMAGE_PX / w);
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

/** Ảnh (kể cả webp/ảnh mạng) → PNG để Word đọc được */
async function imageToPng(img: HTMLImageElement): Promise<Inline> {
  const alt = img.getAttribute('alt') || 'hình';
  try {
    const res = await fetch(img.currentSrc || img.src, { mode: 'cors', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error(String(res.status));
    const bitmap = await createImageBitmap(await res.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return { kind: 'image', data: await canvasToPng(canvas), ...fitSize(canvas.width, canvas.height) };
  } catch {
    return { kind: 'missing', text: `[${alt} – không tải được ảnh, xem bản PDF]` };
  }
}

/** Đồ thị vẽ bằng SVG → PNG */
async function svgToPng(svg: SVGSVGElement): Promise<Inline> {
  try {
    const rect = svg.getBoundingClientRect();
    const w = Math.round(rect.width || Number(svg.getAttribute('width')) || 480);
    const h = Math.round(rect.height || Number(svg.getAttribute('height')) || 320);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('svg'));
        image.src = url;
      });
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return { kind: 'image', data: await canvasToPng(canvas), ...fitSize(w, h) };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return { kind: 'missing', text: '[đồ thị – xem bản PDF]' };
  }
}

/** Nội dung dòng (chữ, công thức, hình) của một phần tử */
async function collectInlines(node: Node, style: { bold?: boolean; italics?: boolean } = {}): Promise<Inline[]> {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (!text) return [];
    const parent = node.parentElement;
    const keepLines = !!parent && (parent.classList.contains('whitespace-pre-wrap') || getComputedStyle(parent).whiteSpace.startsWith('pre'));
    if (!keepLines) {
      const t = text.replace(/\s+/g, ' ');
      return t.trim() || t === ' ' ? [{ kind: 'text', text: t, ...style }] : [];
    }
    const out: Inline[] = [];
    text.split(/\r?\n/).forEach((line, i) => {
      if (i) out.push({ kind: 'break' });
      if (line) out.push({ kind: 'text', text: line, ...style });
    });
    return out;
  }
  if (!(node instanceof Element)) return [];
  const el = node;
  if (el.classList.contains('katex-rendered') || el.classList.contains('katex')) {
    const latex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent || '';
    const fallback = (el.querySelector('.katex-mathml')?.textContent || el.textContent || '').trim();
    const display = el.classList.contains('block') || !!el.querySelector('.katex-display');
    const math: Inline = latex ? { kind: 'math', latex, fallback } : { kind: 'text', text: fallback };
    return display ? [{ kind: 'break' }, math, { kind: 'break' }] : [math];
  }
  if (el.tagName === 'IMG') return [{ kind: 'break' }, await imageToPng(el as HTMLImageElement), { kind: 'break' }];
  if (el.tagName === 'svg' || el.tagName === 'SVG') return [{ kind: 'break' }, await svgToPng(el as unknown as SVGSVGElement), { kind: 'break' }];
  if (el.tagName === 'IFRAME') {
    const src = el.getAttribute('src') || '';
    return [{ kind: 'missing', text: `[Hình GeoGebra: ${src}]` }];
  }
  if (el.tagName === 'BR') return [{ kind: 'break' }];
  const next = {
    bold: style.bold || ['B', 'STRONG', 'DT', 'TH'].includes(el.tagName),
    italics: style.italics || ['I', 'EM'].includes(el.tagName) || el.classList.contains('italic'),
  };
  const out: Inline[] = [];
  for (const c of Array.from(el.childNodes)) out.push(...(await collectInlines(c, next)));
  // các khối con kiểu block trong dòng (span.block) thì xuống dòng
  if (el.tagName === 'SPAN' && el.classList.contains('block') && out.length) return [{ kind: 'break' }, ...out, { kind: 'break' }];
  return out;
}

type Docx = typeof import('docx');
type LatexToMath = (latex: string) => readonly unknown[];

function buildRuns(d: Docx, latexToMath: LatexToMath, items: Inline[], size: number) {
  // gộp xuống dòng thừa ở đầu/cuối và liên tiếp
  const cleaned: Inline[] = [];
  for (const it of items) {
    if (it.kind === 'break' && (!cleaned.length || cleaned[cleaned.length - 1].kind === 'break')) continue;
    cleaned.push(it);
  }
  while (cleaned.length && cleaned[cleaned.length - 1].kind === 'break') cleaned.pop();
  const runs: any[] = [];
  let pendingBreak = false;
  for (const it of cleaned) {
    if (it.kind === 'break') { pendingBreak = true; continue; }
    const brk = pendingBreak ? 1 : 0;
    pendingBreak = false;
    if (it.kind === 'text' || it.kind === 'missing') {
      runs.push(new d.TextRun({ text: it.text, bold: it.kind === 'text' ? it.bold : false, italics: it.kind === 'missing' || (it.kind === 'text' && it.italics), font: FONT, size, break: brk }));
    } else if (it.kind === 'math') {
      if (brk) runs.push(new d.TextRun({ text: '', break: 1 }));
      try {
        runs.push(new d.Math({ children: latexToMath(it.latex) as any }));
      } catch {
        runs.push(new d.TextRun({ text: it.fallback || it.latex, font: 'Cambria Math', size }));
      }
    } else if (it.kind === 'image') {
      if (brk) runs.push(new d.TextRun({ text: '', break: 1 }));
      runs.push(new d.ImageRun({ type: 'png', data: it.data, transformation: { width: it.width, height: it.height } }));
    }
  }
  return runs;
}

interface WalkCtx {
  d: Docx;
  latexToMath: LatexToMath;
  width: number;
  indent: number;
}

function para(ctx: WalkCtx, runs: any[], opts: Record<string, unknown> = {}) {
  const { d } = ctx;
  return new d.Paragraph({
    spacing: { after: 100, line: 300 },
    indent: ctx.indent ? { left: ctx.indent } : undefined,
    children: runs.length ? runs : [new d.TextRun({ text: '', font: FONT, size: 24 })],
    ...opts,
  });
}

async function walkBlocks(el: Element, ctx: WalkCtx): Promise<any[]> {
  const { d } = ctx;
  const out: any[] = [];
  let inlineBuffer: Inline[] = [];
  const flush = () => {
    if (inlineBuffer.some(i => i.kind !== 'break')) out.push(para(ctx, buildRuns(d, ctx.latexToMath, inlineBuffer, 24)));
    inlineBuffer = [];
  };
  for (const child of Array.from(el.childNodes)) {
    if (!(child instanceof Element)) {
      inlineBuffer.push(...(await collectInlines(child)));
      continue;
    }
    const tag = child.tagName;
    if (child.classList.contains('book-cover')) {
      flush();
      out.push(...(await coverBlocks(child, ctx)));
      continue;
    }
    if (tag === 'SECTION' && child.classList.contains('book-section')) {
      flush();
      out.push(...(await walkBlocks(child, { ...ctx, indent: 0 })));
      continue;
    }
    if (/^H[1-4]$/.test(tag)) {
      flush();
      const level = Number(tag[1]);
      const isSection = level === 2 && !!child.closest('.book-section');
      const runs = buildRuns(d, ctx.latexToMath, await collectInlines(child, { bold: true }), level <= 2 ? 28 : 24);
      out.push(new d.Paragraph({
        heading: level <= 2 ? d.HeadingLevel.HEADING_1 : level === 3 ? d.HeadingLevel.HEADING_2 : d.HeadingLevel.HEADING_3,
        pageBreakBefore: isSection && child === child.parentElement?.firstElementChild,
        alignment: isSection ? d.AlignmentType.CENTER : d.AlignmentType.LEFT,
        keepNext: true,
        spacing: { before: level <= 2 ? 240 : 160, after: 120 },
        indent: ctx.indent && level > 2 ? { left: ctx.indent } : undefined,
        children: runs,
      }));
      continue;
    }
    if (tag === 'TABLE') {
      flush();
      out.push(await tableBlock(child as HTMLTableElement, ctx));
      out.push(new d.Paragraph({ spacing: { after: 80 }, children: [] }));
      continue;
    }
    if (tag === 'DL') {
      flush();
      for (const field of Array.from(child.children)) {
        const dt = field.querySelector(':scope > dt');
        const dd = field.querySelector(':scope > dd');
        if (!dt || !dd) { out.push(...(await walkBlocks(field, ctx))); continue; }
        const label = (dt.textContent || '').trim();
        const simpleList = simpleEntries(dd);
        if (simpleList) {
          const value: Inline[] = [];
          for (const [i, e] of simpleList.entries()) {
            if (i) value.push({ kind: 'text', text: ', ' });
            value.push(...(await collectInlines(e)));
          }
          out.push(para(ctx, [new d.TextRun({ text: `${label} `, bold: true, font: FONT, size: 24 }), ...buildRuns(d, ctx.latexToMath, value, 24)]));
        } else if (!hasBlockChild(dd) && !dd.querySelector('table')) {
          const value = await collectInlines(dd);
          out.push(para(ctx, [new d.TextRun({ text: `${label} `, bold: true, font: FONT, size: 24 }), ...buildRuns(d, ctx.latexToMath, value, 24)]));
        } else {
          out.push(para(ctx, [new d.TextRun({ text: label, bold: true, font: FONT, size: 24 })], { keepNext: true }));
          out.push(...(await walkBlocks(dd, { ...ctx, indent: ctx.indent + 360 })));
        }
      }
      continue;
    }
    if (tag === 'P') {
      flush();
      const small = child.classList.contains('text-xs');
      out.push(para(ctx, buildRuns(d, ctx.latexToMath, await collectInlines(child, { italics: small }), small ? 20 : 24)));
      continue;
    }
    if (child.classList.contains('book-entry') && !hasBlockChild(child)) {
      flush();
      inlineBuffer.push(...(await collectInlines(child)));
      flush();
      continue;
    }
    if (child.classList.contains('book-entry')) {
      flush();
      out.push(...(await walkBlocks(child, ctx)));
      out.push(new d.Paragraph({ spacing: { after: 60 }, border: { bottom: { style: d.BorderStyle.DOTTED, size: 4, color: 'BFBFBF', space: 1 } }, children: [] }));
      continue;
    }
    if (tag === 'ARTICLE' || tag === 'SECTION' || tag === 'UL' || tag === 'OL' || tag === 'LI' || (tag === 'DIV' && hasBlockChild(child))) {
      flush();
      out.push(...(await walkBlocks(child, ctx)));
      continue;
    }
    if (tag === 'DIV') {
      flush();
      inlineBuffer.push(...(await collectInlines(child)));
      flush();
      continue;
    }
    inlineBuffer.push(...(await collectInlines(child)));
  }
  flush();
  return out;
}

/** Danh sách giá trị đơn giản (ví dụ các lớp 12A1, 12A2) – trả về các mục để ghi trên một dòng */
function simpleEntries(dd: Element): Element[] | null {
  const wrapper = dd.children.length === 1 && dd.firstElementChild?.tagName === 'DIV' ? dd.firstElementChild : null;
  if (!wrapper || !wrapper.children.length) return null;
  const entries = Array.from(wrapper.children);
  if (!entries.every(e => e.classList.contains('book-entry') && !hasBlockChild(e) && !e.querySelector('img,svg,table'))) return null;
  const total = entries.reduce((n, e) => n + (e.textContent || '').length, 0);
  return total <= 300 ? entries : null;
}

async function coverBlocks(el: Element, ctx: WalkCtx) {
  const { d } = ctx;
  const out: any[] = [];
  for (const c of Array.from(el.children)) {
    const text = (c.textContent || '').trim();
    if (!text) continue;
    const size = c.tagName === 'H1' ? 40 : c.tagName === 'H2' ? 32 : 26;
    out.push(new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      spacing: { before: c.tagName === 'H1' ? 2400 : 160, after: 200 },
      children: [new d.TextRun({ text, bold: c.tagName !== 'P' || out.length === 0, font: FONT, size })],
    }));
  }
  return out;
}

async function tableBlock(table: HTMLTableElement, ctx: WalkCtx) {
  const { d } = ctx;
  const rowsEl = Array.from(table.rows);
  const count = Math.max(1, ...rowsEl.map(r => r.cells.length));
  const total = Math.max(2000, ctx.width - ctx.indent);
  // cột STT hẹp, các cột còn lại chia đều
  const first = /^stt$/i.test((rowsEl[0]?.cells[0]?.textContent || '').trim()) ? Math.min(700, Math.floor(total / count)) : Math.floor(total / count);
  const rest = count > 1 ? Math.floor((total - first) / (count - 1)) : total;
  const widths = Array.from({ length: count }, (_, i) => (i === 0 ? first : rest));
  widths[count - 1] += total - widths.reduce((a, b) => a + b, 0);
  const border = { style: d.BorderStyle.SINGLE, size: 4, color: '808080' };
  const rows = [];
  for (const [ri, tr] of rowsEl.entries()) {
    const header = tr.parentElement?.tagName === 'THEAD';
    const cells = [];
    for (const [ci, td] of Array.from(tr.cells).entries()) {
      const inner = await walkBlocks(td, { ...ctx, indent: 0, width: widths[ci] - 200 });
      cells.push(new d.TableCell({
        width: { size: widths[ci], type: d.WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        shading: header ? { fill: 'F2F2F2', type: d.ShadingType.CLEAR, color: 'auto' } : undefined,
        borders: { top: border, bottom: border, left: border, right: border },
        children: (inner.length ? inner : [new d.Paragraph({ children: [] })]).map((p: any) => p),
      }));
    }
    while (cells.length < count) cells.push(new d.TableCell({ width: { size: widths[cells.length], type: d.WidthType.DXA }, borders: { top: border, bottom: border, left: border, right: border }, children: [new d.Paragraph({ children: [] })] }));
    rows.push(new d.TableRow({ tableHeader: header, cantSplit: false, children: cells }));
    void ri;
  }
  return new d.Table({
    width: { size: total, type: d.WidthType.DXA },
    columnWidths: widths,
    indent: ctx.indent ? { size: ctx.indent, type: d.WidthType.DXA } : undefined,
    rows,
  });
}

/** Tạo file Word từ bản xem trước (phần tử .booklet đang hiển thị) */
export async function bookletToWord(root: HTMLElement, info: BookletInfo): Promise<Blob> {
  const d = await import('docx');
  const { latexToMath } = await import('docx/math');
  const ctx: WalkCtx = { d, latexToMath: latexToMath as unknown as LatexToMath, width: CONTENT_DXA, indent: 0 };
  const children = await walkBlocks(root, ctx);
  const doc = new d.Document({
    creator: info.head || info.departmentName,
    title: `Sổ sinh hoạt chuyên môn ${info.academicYear}`,
    styles: {
      default: { document: { run: { font: FONT, size: 24, color: '000000' } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: '000000' } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: '000000' } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, italics: true, color: '000000' } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, bottom: 1134, left: 1417, right: 850 },
        },
      },
      footers: {
        default: new d.Footer({
          children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ children: [d.PageNumber.CURRENT], size: 20, font: FONT })] })],
        }),
      },
      children,
    }],
  });
  return d.Packer.toBlob(doc);
}

/* ------------------------------------------------------------------ */
/* EXCEL                                                               */
/* ------------------------------------------------------------------ */

const CELL_LIMIT = 32000;

/** Rút gọn nội dung cho ô Excel: bỏ ảnh nhúng base64, giữ công thức dạng LaTeX */
function cleanText(s: string): string {
  return s
    .replace(/!\[([^\]\n]{0,200})\]\((?:data:image\/[^)]+|https:\/\/[^\s)]+|img:[A-Za-z0-9_-]+)\)/g, (_m, alt) => `[${alt || 'hình'}]`)
    .replace(/\[\[\s*(?:do-thi|đồ-thị|đồ thị|do thi|graph)\s*:\s*([\s\S]+?)\]\]/gu, '[đồ thị: $1]')
    .replace(/\[\[\s*geogebra\s*:\s*(\S+?)\s*\]\]/gi, '[GeoGebra: $1]');
}

function visibleEntries(obj: Record<string, unknown>, dict: BookletDictionaries) {
  return Object.entries(obj).filter(([k, v]) => !dict.hidden.has(k) && !k.endsWith('Id') && v !== undefined && v !== null && v !== '');
}

function toText(value: unknown, dict: BookletDictionaries, depth = 0): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return cleanText(dict.names.get(value) || dict.statuses[value] || value);
  const pad = '  '.repeat(depth);
  if (Array.isArray(value)) {
    return value
      .map((v, i) => {
        const t = toText(v, dict, depth + 1);
        return t ? `${pad}${i + 1}. ${t.trimStart()}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    return visibleEntries(value as Record<string, unknown>, dict)
      .map(([k, v]) => {
        const t = toText(v, dict, depth + 1);
        if (!t) return '';
        const label = dict.labels[k] || k;
        return t.includes('\n') ? `${pad}${label}:\n${t}` : `${pad}${label}: ${t.trim()}`;
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(value);
}

function sheetFromRecords(records: unknown[], dict: BookletDictionaries) {
  const objects = records.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r));
  const keys: string[] = [];
  for (const r of objects) for (const [k] of visibleEntries(r, dict)) if (!keys.includes(k)) keys.push(k);
  const header = ['STT', ...keys.map(k => dict.labels[k] || k)];
  const rows = objects.map((r, i) => [
    i + 1,
    ...keys.map(k => {
      const v = r[k];
      if (typeof v === 'number') return v;
      const t = toText(v, dict);
      return sanitizeCellValue(t.length > CELL_LIMIT ? `${t.slice(0, CELL_LIMIT)}… (đã cắt bớt, xem bản Word)` : t);
    }),
  ]);
  const ws = XLSX.utils.aoa_to_sheet(rows.length ? [header, ...rows] : [['Chưa có hồ sơ trong phạm vi đã chọn.']]);
  ws['!cols'] = header.map((h, i) => {
    if (i === 0) return { wch: 5 };
    const longest = Math.max(String(h).length, ...rows.map(r => Math.min(60, String(r[i] ?? '').split('\n').reduce((m, l) => Math.max(m, l.length), 0))));
    return { wch: Math.max(10, Math.min(60, longest + 2)) };
  });
  if (rows.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  return ws;
}

function sheetName(title: string, used: Set<string>) {
  let base = title.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Trang';
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 28)} ${i}`;
  used.add(name.toLowerCase());
  return name;
}

/** Tạo file Excel từ dữ liệu đã chuẩn bị cho cuốn sổ */
export function bookletToExcel(groups: BookletGroup[], info: BookletInfo, dict: BookletDictionaries): Blob {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const summary: (string | number)[][] = [
    [info.schoolName],
    [`SỔ SINH HOẠT CHUYÊN MÔN – ${info.departmentName.toUpperCase()}`],
    [`Năm học: ${info.academicYear}`],
    [`Phạm vi hoạt động: ${info.start} – ${info.end}`],
    [`Tổ trưởng: ${info.head || 'Chưa khai báo'}`],
    [],
    ['Phần hồ sơ', 'Số hồ sơ', 'Trang tính'],
  ];
  const sheets: Array<[string, XLSX.WorkSheet]> = [];
  used.add('tổng hợp');
  for (const g of groups) {
    if (g.key === 'members') {
      const members = g.records.filter((r: any) => r && r.displayName);
      const assignments = g.records
        .filter((r: any) => r && r.teacherName)
        .map((r: any) => ({ teacherName: r.teacherName, className: r.className, subject: r.subject, periodsPerWeek: r.periodsPerWeek, duties: r.duties, term: r.term }));
      const n1 = sheetName('I. Thành viên', used);
      const n2 = sheetName('I. Phân công', used);
      sheets.push([n1, sheetFromRecords(members, dict)], [n2, sheetFromRecords(assignments, dict)]);
      summary.push([g.title, g.records.length, `${n1}; ${n2}`]);
      continue;
    }
    const name = sheetName(g.title, used);
    sheets.push([name, sheetFromRecords(g.records, dict)]);
    summary.push([g.title, g.records.length, name]);
  }
  const ws = XLSX.utils.aoa_to_sheet(summary);
  ws['!cols'] = [{ wch: 45 }, { wch: 10 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Tổng hợp');
  for (const [name, sheet] of sheets) XLSX.utils.book_append_sheet(wb, sheet, name);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export { downloadBlob };
