/**
 * Bộ đọc Word (.docx) cho giáo án Toán: giữ lại công thức và hình vẽ.
 *  - Công thức Equation của Word (OMML) → LaTeX trong $...$ / $$...$$ (xem omml.ts)
 *  - Hình ảnh PNG/JPEG/GIF → nén lại và nhúng dạng ![Hình n](data:image/...)
 *  - Công thức MathType / hình WMF-EMF → ghi chú [công thức MathType – cần gõ lại]
 *  - Bảng → mỗi ô một dòng (giữ thứ tự đọc)
 */
import JSZip from 'jszip';
import { elementChildren, ommlToLatex } from './omml';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Chuyển dữ liệu ảnh gốc → data URL đã nén (null = bỏ qua). Trên trình duyệt dùng compressImageInBrowser. */
export type ImageProcessor = (bytes: Uint8Array, mime: string) => Promise<string | null>;

export interface DocxReadResult {
  text: string;
  /** Ảnh đã nén: mã → data URL. Trong văn bản ảnh được tham chiếu bằng ![Hình n](img:mã) */
  images: Record<string, string>;
  equations: number;
  imageCount: number;
  skippedImages: number;
  mathTypeObjects: number;
  /** Bảng giữ nguyên cấu trúc hàng/cột (ô gộp dọc được chép giá trị ô trên xuống). lineIndex = vị trí trong text */
  tables: DocxTable[];
}

export interface DocxTable {
  rows: string[][];
  lineIndex: number;
}

export interface DocxReadOptions {
  DOMParserImpl?: { new (): DOMParser };
  processImage?: ImageProcessor;
  /** Tổng dung lượng ảnh tối đa (ký tự data URL) – Firestore giới hạn 1 MB mỗi tài liệu */
  imageBudget?: number;
  /** Số hình tối đa */
  maxImages?: number;
  /** Giới hạn mỗi hình (ký tự data URL) */
  maxImageChars?: number;
}

// Một số ký tự của phông Symbol (w:sym) hay gặp trong giáo án
const SYMBOL_FONT: Record<string, string> = {
  F0A3: '≤', F0B3: '≥', F0B9: '≠', F0B1: '±', F0B4: '×', F0B8: '÷', F0A5: '∞', F0CE: '∈', F0CF: '∉',
  F0C7: '∩', F0C8: '∪', F0C6: '∅', F0DE: '⇒', F0DB: '⇔', F0AE: '→', F070: 'π', F061: 'α', F062: 'β',
  F067: 'γ', F064: 'δ', F044: 'Δ', F06A: 'φ', F077: 'ω', F0B0: '°', F0D0: '∠', F05E: '⊥', F0BB: '≈',
  F0A7: '•', F0B7: '•', F0D8: '¬',
};

const attrW = (el: Element, name: string) => el.getAttributeNS(W, name) || el.getAttribute(`w:${name}`) || '';

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };

export async function readDocx(buffer: ArrayBuffer, opts: DocxReadOptions = {}): Promise<DocxReadResult> {
  const Parser = opts.DOMParserImpl || (globalThis as unknown as { DOMParser: { new (): DOMParser } }).DOMParser;
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('Tệp .docx không hợp lệ (thiếu word/document.xml)');
  const relsXml = (await zip.file('word/_rels/document.xml.rels')?.async('string')) || '<Relationships/>';

  const parser = new Parser();
  const doc = parser.parseFromString(docXml, 'application/xml');
  const rels = parser.parseFromString(relsXml, 'application/xml');
  const relTarget = new Map<string, string>();
  Array.from(rels.getElementsByTagName('Relationship')).forEach(r => {
    relTarget.set(r.getAttribute('Id') || '', r.getAttribute('Target') || '');
  });

  const stats = { equations: 0, imageCount: 0, skippedImages: 0, mathTypeObjects: 0 };
  const imageMap: Record<string, string> = {};
  const byRel = new Map<string, string>(); // cùng một ảnh dùng nhiều lần → một bản
  let budget = opts.imageBudget ?? 700_000;

  const imageFor = async (rId: string): Promise<string> => {
    const target = relTarget.get(rId);
    if (byRel.has(rId)) return `\n![Hình](img:${byRel.get(rId)})\n`;
    if (!target) return '';
    const path = target.startsWith('/') ? target.slice(1) : `word/${target.replace(/^\.\//, '')}`;
    const ext = (path.split('.').pop() || '').toLowerCase();
    const mime = MIME[ext];
    if (!mime) {
      stats.skippedImages++;
      return ' [hình vẽ định dạng ' + ext.toUpperCase() + ' – không hiển thị được trên web, cần chèn lại ảnh PNG/JPG] ';
    }
    if (stats.imageCount >= (opts.maxImages ?? Infinity)) {
      stats.skippedImages++;
      return ' [hình vẽ – vượt số hình tối đa của một giáo án] ';
    }
    const bytes = await zip.file(path)?.async('uint8array');
    if (!bytes) return '';
    const url = opts.processImage ? await opts.processImage(bytes, mime) : null;
    if (!url) {
      stats.skippedImages++;
      return ' [hình vẽ – chưa nhập được] ';
    }
    if (url.length > (opts.maxImageChars ?? 950_000)) {
      stats.skippedImages++;
      return ' [hình vẽ – quá lớn, cần chèn lại] ';
    }
    if (url.length > budget) {
      stats.skippedImages++;
      return ' [hình vẽ – bỏ qua vì giáo án đã quá dung lượng cho phép] ';
    }
    budget -= url.length;
    stats.imageCount++;
    const id = `h${stats.imageCount}${Math.random().toString(36).slice(2, 6)}`;
    imageMap[id] = url;
    byRel.set(rId, id);
    return `\n![Hình ${stats.imageCount}](img:${id})\n`;
  };

  /** Đọc nội dung một đoạn/nút theo đúng thứ tự */
  const inline = async (node: Element): Promise<string> => {
    let out = '';
    for (const c of elementChildren(node)) {
      const ns = c.namespaceURI;
      const name = c.localName;
      if (ns === M && (name === 'oMath' || name === 'oMathPara')) {
        const latex = ommlToLatex(c);
        stats.equations++;
        out += name === 'oMathPara' ? `\n$$${latex}$$\n` : `$${latex}$`;
        continue;
      }
      if (ns === W) {
        if (name === 't') out += c.textContent || '';
        else if (name === 'tab') out += ' ';
        else if (name === 'br' || name === 'cr') out += '\n';
        else if (name === 'sym') {
          const code = (c.getAttributeNS(W, 'char') || c.getAttribute('w:char') || '').toUpperCase();
          out += SYMBOL_FONT[code] || '';
        } else if (name === 'del' || name === 'rPr' || name === 'pPr' || name === 'instrText' || name === 'delText') {
          continue;
        } else if (name === 'drawing') {
          const blip = Array.from(c.getElementsByTagNameNS('*', 'blip'))[0];
          const rId = blip ? blip.getAttributeNS(R, 'embed') || blip.getAttribute('r:embed') || '' : '';
          if (rId) out += await imageFor(rId);
        } else if (name === 'object' || name === 'pict') {
          const ole = Array.from(c.getElementsByTagNameNS('*', 'OLEObject'))[0];
          const progId = ole?.getAttribute('ProgID') || '';
          if (/Equation|MathType|DSMT/i.test(progId)) {
            stats.mathTypeObjects++;
            out += ' [công thức MathType – cần gõ lại bằng $...$] ';
          } else {
            const img = Array.from(c.getElementsByTagNameNS('*', 'imagedata'))[0];
            const rId = img ? img.getAttributeNS(R, 'id') || img.getAttribute('r:id') || '' : '';
            if (rId) out += await imageFor(rId);
          }
        } else if (name === 'r') {
          // Chỉ số trên/dưới định dạng bằng Word (x², S₀) ngoài ô công thức → giữ lại bằng LaTeX
          const va = Array.from(c.getElementsByTagNameNS(W, 'vertAlign'))[0];
          const mode = va ? va.getAttributeNS(W, 'val') || va.getAttribute('w:val') : '';
          const inner = await inline(c);
          if ((mode === 'superscript' || mode === 'subscript') && inner.trim() && !inner.includes('$') && inner.length < 30) {
            const esc = inner.trim().replace(/([{}%#&_^\\])/g, '\\$1');
            out += `\\(${mode === 'superscript' ? '^' : '_'}{${esc}}\\)`; // dùng \( \) để không dính với $ bên cạnh
          } else out += inner;
        } else {
          // hyperlink, ins, smartTag, sdt, sdtContent, fldSimple...
          out += await inline(c);
        }
        continue;
      }
      // mc:AlternateContent → chỉ lấy nhánh Fallback hoặc Choice đầu tiên
      if (name === 'AlternateContent') {
        const choice = elementChildren(c).find(x => x.localName === 'Choice') || elementChildren(c).find(x => x.localName === 'Fallback');
        if (choice) out += await inline(choice);
        continue;
      }
      out += await inline(c);
    }
    return out;
  };

  const lines: string[] = [];
  const tables: DocxTable[] = [];
  const block = async (node: Element) => {
    for (const c of elementChildren(node)) {
      if (c.namespaceURI !== W) {
        if (c.localName === 'AlternateContent') await block(c);
        continue;
      }
      if (c.localName === 'p') {
        const isList = Array.from(c.getElementsByTagNameNS(W, 'numPr')).length > 0;
        const text = (await inline(c)).replace(/[ \t ]+/g, ' ');
        text.split('\n').forEach((l, i) => {
          const t = l.trim();
          if (t) lines.push(i === 0 && isList && !/^[-+•]|^[a-zđ]\)|^\d+[.)]|^[IVX]+\./i.test(t) ? `- ${t}` : t);
        });
      } else if (c.localName === 'tbl') {
        const table: DocxTable = { rows: [], lineIndex: lines.length };
        const above: string[] = []; // giá trị theo cột lưới của hàng trên (cho ô gộp dọc)
        for (const tr of elementChildren(c).filter(x => x.localName === 'tr')) {
          const row: string[] = [];
          const trPr = elementChildren(tr).find(x => x.localName === 'trPr');
          const before = trPr && elementChildren(trPr).find(x => x.localName === 'gridBefore');
          let col = before ? Number(attrW(before, 'val')) || 0 : 0;
          for (let k = 0; k < col; k++) row.push('');
          for (const tc of elementChildren(tr).filter(x => x.localName === 'tc')) {
            const tcPr = elementChildren(tc).find(x => x.localName === 'tcPr');
            const spanEl = tcPr && elementChildren(tcPr).find(x => x.localName === 'gridSpan');
            const span = Math.max(1, spanEl ? Number(attrW(spanEl, 'val')) || 1 : 1);
            const vMerge = tcPr && elementChildren(tcPr).find(x => x.localName === 'vMerge');
            const start = lines.length;
            await block(tc);
            let text = lines.slice(start).join('\n');
            if (vMerge && attrW(vMerge, 'val') !== 'restart') text = above[col] ?? '';
            row[col] = text;
            above[col] = text;
            for (let k = 1; k < span; k++) {
              row[col + k] = '';
              above[col + k] = '';
            }
            col += span;
          }
          table.rows.push(row.map(v => v ?? ''));
        }
        tables.push(table);
      } else if (c.localName === 'sdt' || c.localName === 'sdtContent' || c.localName === 'body' || c.localName === 'customXml') {
        await block(c);
      }
    }
  };
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (body) await block(body);

  return { text: lines.join('\n'), images: imageMap, tables, ...stats };
}

/** Nén ảnh trên trình duyệt: tối đa 900px chiều rộng, JPEG chất lượng 0,8 (nền trắng). */
export const compressImageInBrowser: ImageProcessor = async (bytes, mime) => {
  try {
    const blob = new Blob([bytes as BlobPart], { type: mime });
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 900 / bmp.width);
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const jpeg = canvas.toDataURL('image/jpeg', 0.8);
    // Hình vẽ nét (ít màu) thường nhỏ hơn khi để PNG
    const png = w * h < 400_000 ? canvas.toDataURL('image/png') : '';
    return png && png.length < jpeg.length ? png : jpeg;
  } catch {
    return null;
  }
};
