import React from 'react';
import type { Block, ReportModel } from '../../report/report-model';
import { PAPER_CSS } from '../../report/kpi-bridge';

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'heading':
      return <h3>{block.text}</h3>;
    case 'para':
      return <p className={block.italic ? 'italic' : undefined}>{block.text}</p>;
    case 'bullets':
      return <ul>{block.items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
    case 'checklist':
      return <div>{block.items.map((t, i) => <p key={i}>☐ {t}</p>)}</div>;
    case 'table':
      return (
        <table>
          <colgroup>{block.widths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
          <thead><tr>{block.head.map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{block.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
        </table>
      );
  }
}

/** Tờ báo cáo A4 – cũng là bản được in/lưu PDF. Nội dung giống hệt file Word. */
export const ReportPaper = React.forwardRef<HTMLElement, { model: ReportModel }>(({ model }, ref) => (
  <>
    <style>{PAPER_CSS}</style>
    <article className="paper" ref={ref}>
      {model.template === 'admin' ? (
        <>
          <div className="letterhead">
            <div>{model.letterhead.left.map((l, i) => <div key={i} className={i >= model.letterhead.left.length - 2 ? 'b' : undefined}>{l}</div>)}</div>
            <div>{model.letterhead.right.map((l, i) => <div key={i} className="b">{l}</div>)}</div>
          </div>
          <p className="dateline">{model.letterhead.dateLine}</p>
          <h1>{model.title[0]}</h1>
          <h2>{model.title[1]}</h2>
        </>
      ) : (
        <div className="cover">
          <h1>{model.cover[0]}</h1>
          <h2>{model.cover[1]}</h2>
          <p className="center"><b>{model.cover[2]}</b><br />{model.cover[3]}</p>
        </div>
      )}
      {model.blocks.map((b, i) => <BlockView key={i} block={b} />)}
      <div className="signatures">
        <div>
          {model.signature.left && (
            <><b>{model.signature.left.title}</b><div className="signspace" /><b>{model.signature.left.name}</b></>
          )}
        </div>
        <div>
          <b>{model.signature.right.title}</b><br /><i>{model.signature.right.note}</i>
          <div className="signspace" /><b>{model.signature.right.name}</b>
        </div>
      </div>
    </article>
  </>
));
ReportPaper.displayName = 'ReportPaper';
