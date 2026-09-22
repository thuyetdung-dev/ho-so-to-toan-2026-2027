import React, { useMemo } from 'react';
import katex from 'katex';

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
  return raw
    .replace(/\\\$/g, '$')
    .replace(/\$\$\$/g, '$$');
}

/**
 * KaTeX renderer safely parses LaTeX math enclosed in $...$, $$...$$, \(...\), or \[...\]
 * Handles nested dollar signs, special characters, and never double-renders.
 */
export const MathText: React.FC<MathRendererProps> = ({ content, className = '', block = false }) => {
  const renderedElements = useMemo(() => {
    if (!content || typeof content !== 'string') return null;

    const cleaned = cleanLatexString(content);

    // Regex capturing:
    // 1. $$...$$
    // 2. \[...\]
    // 3. $...$
    // 4. \(...\)
    const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n\r]+?\$|\\\([\s\S]+?\\\))/g;
    const parts = cleaned.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      const isDoubleDollar = part.startsWith('$$') && part.endsWith('$$') && part.length >= 4;
      const isBracketBlock = part.startsWith('\\[') && part.endsWith('\\]') && part.length >= 4;
      const isBlock = isDoubleDollar || isBracketBlock || block;

      const isSingleDollar = part.startsWith('$') && part.endsWith('$') && !isDoubleDollar && part.length >= 2;
      const isParenInline = part.startsWith('\\(') && part.endsWith('\\)') && part.length >= 4;
      const isInline = isSingleDollar || isParenInline;

      if (isDoubleDollar || isBracketBlock || isSingleDollar || isParenInline) {
        let formula = '';
        if (isDoubleDollar) formula = part.slice(2, -2).trim();
        else if (isBracketBlock) formula = part.slice(2, -2).trim();
        else if (isSingleDollar) formula = part.slice(1, -1).trim();
        else if (isParenInline) formula = part.slice(2, -2).trim();

        // Strip any residual redundant outer dollar signs inside the formula
        formula = formula.replace(/^\$+/, '').replace(/\$+$/, '').trim();

        if (!formula) return null;

        try {
          const html = katex.renderToString(formula, {
            displayMode: isBlock && !isSingleDollar && !isParenInline,
            throwOnError: false,
            strict: false,
          });
          return (
            <span
              key={`math-${index}`}
              className={`katex-rendered inline-block ${isBlock && !isSingleDollar && !isParenInline ? 'my-2 block text-center' : 'mx-0.5 align-middle'}`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          // If katex fails completely, render clean formula
          return (
            <span key={`err-${index}`} className="font-mono text-slate-700 mx-0.5 text-xs bg-slate-100 px-1 rounded">
              {formula}
            </span>
          );
        }
      }

      // Plain text block
      return (
        <span key={`text-${index}`} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  }, [content, block]);

  return <div className={`math-content leading-relaxed ${className}`}>{renderedElements}</div>;
};

interface GeoGebraEmbedProps {
  url?: string;
}

export const GeoGebraViewer: React.FC<GeoGebraEmbedProps> = ({ url }) => {
  if (!url) return null;
  let embedUrl = url;
  const match = url.match(/geogebra\.org\/m\/([a-zA-Z0-9]+)/);
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
          allowFullScreen
        />
      </div>
    </div>
  );
};
