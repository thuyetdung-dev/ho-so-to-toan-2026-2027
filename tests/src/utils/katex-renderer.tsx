import React, { useMemo } from 'react';
import katex from 'katex';
import { MathGraph } from '../components/common/MathGraph';
import { autoFixLatex, explainError } from './latexDoctor';

interface MathRendererProps {
  content: string;
  className?: string;
  block?: boolean;
}

/**
 * Clean string and safely extract LaTeX formulas
 */
function cleanLatexString(raw: string): string {
  if (!raw) return '';
  // Normalize escaped dollar signs or odd artifacts
  // Lưu ý: trong chuỗi thay thế của String.replace, '$$' nghĩa là MỘT dấu '$'.
  // Bản cũ viết '$$' nên '$$$' bị rút thành '$' thay vì '$$' → công thức hiển thị sai.
  return raw.replace(/\$\$\$/g, () => '$$');
}

/** Ảnh nhúng dạng Markdown: chỉ nhận ảnh data:image/... (base64) hoặc https */
const IMAGE_RE = /!\[([^\]\n]{0,200})\]\((data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s)]+|img:[A-Za-z0-9_-]+)\)/;
const GRAPH_RE = /\[\[\s*(?:do-thi|đồ-thị|đồ thị|do thi|graph)\s*:\s*([\s\S]+?)\]\]/u;
const GEOGEBRA_RE = /\[\[\s*geogebra\s*:\s*(\S+?)\s*\]\]/i;
const RICH_RE = new RegExp(`(${IMAGE_RE.source}|${GRAPH_RE.source}|${GEOGEBRA_RE.source})`, 'gu');
/** Môi trường LaTeX viết trần (không có $...$), ví dụ \begin{cases}...\end{cases} */
const ENV_RE = /(\\begin\{(align\*?|aligned|cases|array|matrix|pmatrix|bmatrix|vmatrix|gather\*?|equation\*?|split)\}[\s\S]+?\\end\{\2\})/g;

function renderKatex(formula: string, display: boolean, key: string) {
  const opts = { displayMode: display, strict: false as const, trust: false, maxExpand: 1000 };
  const cls = `katex-rendered inline-block ${display ? 'my-2 block text-center overflow-x-auto max-w-full' : 'mx-0.5 align-middle'}`;
  try {
    const html = katex.renderToString(formula, { ...opts, throwOnError: true });
    return <span key={key} className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch (err) {
    // Công thức lỗi (thường do chép từ Word): thử tự sửa để vẫn hiển thị được
    const fix = autoFixLatex(formula, display);
    if (fix) {
      const html = katex.renderToString(fix.fixed, { ...opts, throwOnError: false });
      return (
        <span
          key={key}
          className={`${cls} border-b border-dotted border-amber-500`}
          title={`Công thức có lỗi đã được tự sửa khi hiển thị (${fix.steps.join('; ')}). Mở "Sửa lỗi công thức" để lưu bản sửa.`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    const msg = err instanceof Error ? err.message.replace(/^KaTeX parse error:\s*/, '') : '';
    return (
      <span
        key={key}
        title={`Công thức lỗi: ${explainError(msg)}. Mở "Sửa lỗi công thức" để sửa.`}
        className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900 text-xs font-mono align-middle"
      >
        ⚠ {formula.length > 60 ? `${formula.slice(0, 60)}…` : formula}
      </span>
    );
  }
}

/** Phần văn bản thường: nhận thêm môi trường \begin{...}...\end{...} viết trần */
function renderPlain(text: string, key: string) {
  const pieces = text.split(ENV_RE);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (!piece) continue;
    if (/^\\begin\{/.test(piece) && pieces[i + 1] && piece.includes(`\\end{${pieces[i + 1]}}`)) {
      out.push(renderKatex(piece, true, `${key}-env${i}`));
      i++; // bỏ nhóm tên môi trường
      continue;
    }
    out.push(
      <span key={`${key}-t${i}`} className="whitespace-pre-wrap">
        {piece}
      </span>,
    );
  }
  return out;
}

function renderMath(text: string, block: boolean, keyPrefix: string) {
  const cleaned = cleanLatexString(text);
  // $$...$$ | \[...\] | $...$ | \(...\)
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n\r]+?\$|\\\([\s\S]+?\\\))/g;
  const parts = cleaned.split(regex);
  return parts.map((part, index) => {
    if (!part) return null;
    const key = `${keyPrefix}-${index}`;
    const isDoubleDollar = part.startsWith('$$') && part.endsWith('$$') && part.length >= 4;
    const isBracketBlock = part.startsWith('\\[') && part.endsWith('\\]') && part.length >= 4;
    const isSingleDollar = part.startsWith('$') && part.endsWith('$') && !isDoubleDollar && part.length >= 2;
    const isParenInline = part.startsWith('\\(') && part.endsWith('\\)') && part.length >= 4;
    if (isDoubleDollar || isBracketBlock || isSingleDollar || isParenInline) {
      let formula = isSingleDollar ? part.slice(1, -1) : part.slice(2, -2);
      formula = formula.replace(/^\$+/, '').replace(/\$+$/, '').trim();
      if (!formula) return null;
      const display = (isDoubleDollar || isBracketBlock || block) && !isSingleDollar && !isParenInline;
      return renderKatex(formula, display, key);
    }
    return <React.Fragment key={key}>{renderPlain(part, key)}</React.Fragment>;
  });
}

/**
 * Bộ hiển thị nội dung toán học:
 *  - Công thức LaTeX: $...$, $$...$$, \(...\), \[...\], và môi trường \begin{cases}... viết trần
 *  - Hình ảnh: ![chú thích](data:image/png;base64,...) hoặc ![..](https://...)
 *  - Đồ thị hàm số: [[do-thi: y = x^3 - 3x; x = -3..3]]  (xem src/utils/mathviz.ts)
 *  - GeoGebra: [[geogebra: https://www.geogebra.org/m/abcd]]
 */
export const MathText: React.FC<MathRendererProps & { as?: 'div' | 'span'; images?: Record<string, string> }> = ({
  content,
  className = '',
  block = false,
  as = 'div',
  images,
}) => {
  const renderedElements = useMemo(() => {
    if (!content || typeof content !== 'string') return null;
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    RICH_RE.lastIndex = 0;
    let i = 0;
    while ((m = RICH_RE.exec(content))) {
      if (m.index > last) out.push(...renderMath(content.slice(last, m.index), block, `m${i}`));
      const token = m[0];
      const img = token.match(IMAGE_RE);
      const graph = token.match(GRAPH_RE);
      const ggb = token.match(GEOGEBRA_RE);
      const src = img ? (img[2].startsWith('img:') ? images?.[img[2].slice(4)] : img[2]) : undefined;
      if (img && !src) {
        out.push(<span key={`img${i}`} className="text-[11px] italic text-slate-400">[{img[1] || 'hình'} – không tìm thấy dữ liệu ảnh]</span>);
      } else if (img && src) {
        out.push(
          <span key={`img${i}`} className="block my-2">
            <img src={src} alt={img[1] || 'Hình minh họa'} loading="lazy" referrerPolicy="no-referrer" className="max-w-full h-auto rounded border border-slate-200 bg-white" />
            {img[1] && !/^hình\s*\d*$/i.test(img[1]) && <span className="block text-[11px] text-slate-500 italic mt-0.5">{img[1]}</span>}
          </span>,
        );
      } else if (graph) {
        out.push(<MathGraph key={`g${i}`} spec={graph[1]} />);
      } else if (ggb) {
        out.push(<GeoGebraViewer key={`ggb${i}`} url={ggb[1]} />);
      }
      last = m.index + token.length;
      i++;
    }
    if (last < content.length) out.push(...renderMath(content.slice(last), block, `m${i}`));
    return out;
  }, [content, block, images]);

  const Tag = as;
  return <Tag className={`math-content leading-relaxed ${className}`}>{renderedElements}</Tag>;
};

interface GeoGebraEmbedProps {
  url?: string;
}

export const GeoGebraViewer: React.FC<GeoGebraEmbedProps> = ({ url }) => {
  if (!url) return null;
  // Chỉ nhúng tài nguyên của geogebra.org (bản cũ nhúng mọi URL → có thể bị chèn javascript:)
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const isGeoGebra = parsed.protocol === 'https:' && /(^|\.)geogebra\.org$/.test(parsed.hostname);
  if (!isGeoGebra) return null;
  let embedUrl = parsed.toString();
  const match = parsed.pathname.match(/\/m\/([a-zA-Z0-9]+)/);
  if (match && match[1]) {
    embedUrl = `https://www.geogebra.org/material/iframe/id/${match[1]}/width/640/height/400/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false`;
  }

  return (
    <div className="my-3 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
      <div className="bg-slate-100 px-3 py-1.5 text-xs text-slate-600 font-medium flex items-center justify-between border-b border-slate-200">
        <span>Hình vẽ tương tác GeoGebra</span>
        <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
          Mở tab mới &rarr;
        </a>
      </div>
      <div className="aspect-video w-full max-w-2xl mx-auto">
        <iframe
          src={embedUrl}
          title="GeoGebra Interactive Applet"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
          allowFullScreen
        />
      </div>
    </div>
  );
};
