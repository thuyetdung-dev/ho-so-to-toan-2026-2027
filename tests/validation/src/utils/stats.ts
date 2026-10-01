/** Thống kê điểm kiểm tra (dùng cho phân hệ Phân tích kết quả và Báo cáo). */
export interface ScoreStats {
  n: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  passRate: number; // >= 5
  goodRate: number; // >= 8
  weakRate: number; // < 3.5
  bins: number[]; // 10 khoảng [0,1), [1,2) ... [9,10]
}

export function computeStats(scores: number[]): ScoreStats {
  const s = scores.filter(x => Number.isFinite(x)).sort((a, b) => a - b);
  const n = s.length;
  const bins = new Array(10).fill(0);
  if (!n) return { n: 0, mean: 0, median: 0, std: 0, min: 0, max: 0, passRate: 0, goodRate: 0, weakRate: 0, bins };
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  const std = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  s.forEach(x => bins[Math.min(9, Math.floor(x))]++);
  const pct = (k: number) => Math.round((k / n) * 1000) / 10;
  return {
    n,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    std: Math.round(std * 100) / 100,
    min: s[0],
    max: s[n - 1],
    passRate: pct(s.filter(x => x >= 5).length),
    goodRate: pct(s.filter(x => x >= 8).length),
    weakRate: pct(s.filter(x => x < 3.5).length),
    bins,
  };
}

/** Đọc danh sách điểm dán từ Excel/Word: phân tách bằng khoảng trắng, xuống dòng, dấu chấm phẩy; chấp nhận dấu phẩy thập phân. */
export function parseScores(text: string): { scores: number[]; invalid: string[] } {
  const tokens = text
    .replace(/,\s+/g, ' ') // "7.5, 8" → phân tách bằng dấu phẩy + khoảng trắng
    .split(/[\s;]+/)
    .map(t => t.trim())
    .filter(Boolean);
  const scores: number[] = [];
  const invalid: string[] = [];
  tokens.forEach(t => {
    const v = Number(t.replace(',', '.'));
    if (Number.isFinite(v) && v >= 0 && v <= 10) scores.push(Math.round(v * 100) / 100);
    else invalid.push(t);
  });
  return { scores, invalid };
}

