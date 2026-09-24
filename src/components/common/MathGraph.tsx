import React, { useMemo } from 'react';
import { niceStep, parseGraphSpec, sampleFunction } from '../../utils/mathviz';

const COLORS = ['#2563eb', '#dc2626', '#059669', '#9333ea', '#d97706', '#0891b2'];

const fmt = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return String(r).replace('.', ',');
};

/** Vẽ đồ thị hàm số dạng SVG từ mô tả [[do-thi: ...]] (xem src/utils/mathviz.ts). */
export const MathGraph: React.FC<{ spec: string; width?: number; height?: number }> = ({ spec, width = 520, height = 340 }) => {
  const data = useMemo(() => {
    const s = parseGraphSpec(spec);
    const curves = s.functions.map(f => sampleFunction(f.expr, s.xMin, s.xMax));
    let yMin = s.yMin;
    let yMax = s.yMax;
    if (yMin === undefined || yMax === undefined) {
      // Tự chọn khung y theo phân vị để tiệm cận không làm dẹt đồ thị
      const ys: number[] = curves.flatMap(segs => segs.flatMap(seg => seg.map(pt => pt[1])));
      s.points.forEach(p => ys.push(p.y));
      const sorted = ys.filter(Number.isFinite).sort((a, b) => a - b);
      if (sorted.length) {
        const lo = sorted[Math.floor(sorted.length * 0.03)];
        const hi = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.97))];
        const pad = Math.max(1, (hi - lo) * 0.12);
        yMin ??= Math.min(lo - pad, -1);
        yMax ??= Math.max(hi + pad, 1);
      } else {
        yMin ??= -5;
        yMax ??= 5;
      }
    }
    return { s, curves, yMin: yMin!, yMax: yMax! };
  }, [spec]);

  const { s, curves, yMin, yMax } = data;
  const pad = { l: 34, r: 14, t: 12, b: 26 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const sx = (x: number) => pad.l + ((x - s.xMin) / (s.xMax - s.xMin)) * W;
  const sy = (y: number) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * H;
  const clampY = (y: number) => Math.max(yMin - (yMax - yMin), Math.min(yMax + (yMax - yMin), y));

  const xStep = niceStep(s.xMax - s.xMin, 10);
  const yStep = niceStep(yMax - yMin, 8);
  const xTicks: number[] = [];
  for (let v = Math.ceil(s.xMin / xStep) * xStep; v <= s.xMax + 1e-9; v += xStep) xTicks.push(Math.round(v / xStep) * xStep);
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax + 1e-9; v += yStep) yTicks.push(Math.round(v / yStep) * yStep);

  const x0 = s.xMin <= 0 && s.xMax >= 0 ? sx(0) : sx(s.xMin);
  const y0 = yMin <= 0 && yMax >= 0 ? sy(0) : sy(yMin);
  const clipId = useMemo(() => `clip-${Math.random().toString(36).slice(2)}`, []);

  return (
    <figure className="my-3 inline-block max-w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="max-w-full h-auto bg-white border border-slate-200 rounded-lg"
        role="img"
        aria-label={`Đồ thị ${s.functions.map(f => f.label).join(', ')}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={pad.l} y={pad.t} width={W} height={H} />
          </clipPath>
          <marker id={`${clipId}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#334155" />
          </marker>
        </defs>
        {/* lưới */}
        {xTicks.map(v => (
          <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={pad.t} y2={pad.t + H} stroke="#e2e8f0" strokeWidth={1} />
        ))}
        {yTicks.map(v => (
          <line key={`gy${v}`} y1={sy(v)} y2={sy(v)} x1={pad.l} x2={pad.l + W} stroke="#e2e8f0" strokeWidth={1} />
        ))}
        {/* trục */}
        <line x1={pad.l} x2={pad.l + W + 6} y1={y0} y2={y0} stroke="#334155" strokeWidth={1.2} markerEnd={`url(#${clipId}-arrow)`} />
        <line x1={x0} x2={x0} y1={pad.t + H} y2={pad.t - 6} stroke="#334155" strokeWidth={1.2} markerEnd={`url(#${clipId}-arrow)`} />
        <text x={pad.l + W + 2} y={y0 - 6} fontSize="12" fontStyle="italic" fill="#334155">x</text>
        <text x={x0 + 6} y={pad.t + 4} fontSize="12" fontStyle="italic" fill="#334155">y</text>
        <text x={x0 - 10} y={y0 + 13} fontSize="10" fill="#475569">O</text>
        {xTicks.filter(v => Math.abs(v) > 1e-9).map(v => (
          <text key={`tx${v}`} x={sx(v)} y={Math.min(y0 + 13, pad.t + H + 14)} fontSize="9" textAnchor="middle" fill="#64748b">{fmt(v)}</text>
        ))}
        {yTicks.filter(v => Math.abs(v) > 1e-9).map(v => (
          <text key={`ty${v}`} x={Math.max(x0 - 4, pad.l - 2)} y={sy(v) + 3} fontSize="9" textAnchor="end" fill="#64748b">{fmt(v)}</text>
        ))}
        <g clipPath={`url(#${clipId})`}>
          {s.verticals.map((v, i) => (
            <line key={`v${i}`} x1={sx(v)} x2={sx(v)} y1={pad.t} y2={pad.t + H} stroke="#64748b" strokeDasharray="4 3" strokeWidth={1.2} />
          ))}
          {curves.map((segs, i) =>
            segs.map((seg, j) => (
              <path
                key={`c${i}-${j}`}
                d={seg.map(([x, y], k) => `${k ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(clampY(y)).toFixed(1)}`).join('')}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            )),
          )}
          {s.points.map(p => (
            <g key={p.name}>
              <line x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y)} y2={y0} stroke="#94a3b8" strokeDasharray="3 3" />
              <line x1={sx(p.x)} x2={x0} y1={sy(p.y)} y2={sy(p.y)} stroke="#94a3b8" strokeDasharray="3 3" />
              <circle cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill="#0f172a" />
              <text x={sx(p.x) + 6} y={sy(p.y) - 6} fontSize="11" fontWeight="bold" fill="#0f172a">{p.name}</text>
            </g>
          ))}
        </g>
      </svg>
      <figcaption className="text-[11px] text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {s.functions.map((f, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="font-mono">{f.label}</span>
          </span>
        ))}
        {s.errors.map((e, i) => (
          <span key={`e${i}`} className="text-rose-600">⚠ {e}</span>
        ))}
      </figcaption>
    </figure>
  );
};
