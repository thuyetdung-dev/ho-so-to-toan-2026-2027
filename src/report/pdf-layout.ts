/**
 * Dựng lại bố cục trang PDF từ các mẩu chữ có tọa độ (pdf.js getTextContent):
 * - gom mẩu chữ thành dòng, tách dòng thành các đoạn cách xa nhau (cột);
 * - khối nhiều cột (bảng) được ghép lại theo cột thành một hàng: "§ROW§ ô1 ¦ ô2 ¦ ô3";
 * - bỏ tiêu đề/chân trang lặp lại ở nhiều trang.
 * Hàm thuần, không phụ thuộc trình duyệt, để kiểm thử được.
 */

export const ROW_MARK = "§ROW§";
export const CELL_SEP = " ¦ ";

export type PdfItem = { str: string; x: number; y: number; w: number; h: number };

type Segment = { x0: number; x1: number; text: string };
type Line = { y: number; h: number; segs: Segment[] };

/** Cỡ chữ phổ biến nhất của trang (chữ thân bài). */
function bodyHeight(items: PdfItem[]): number {
  const hs = items
    .filter((i) => i.str.trim().length > 1)
    .map((i) => Math.round(i.h || 10))
    .sort((a, b) => a - b);
  return hs.length ? hs[Math.floor(hs.length / 2)] : 10;
}

/**
 * Bỏ chú thích cuối trang của văn bản hành chính:
 * - số chú thích nhỏ đặt cao (superscript) dính vào chữ, vd. "tổ chức¹" → "tổ chức1";
 * - phần chú thích chữ nhỏ ở cuối trang (nằm dưới dòng thân bài cuối cùng).
 */
export function dropFootnotes(items: PdfItem[]): PdfItem[] {
  const body = bodyHeight(items);
  const small = (i: PdfItem) => (i.h || 10) < body * 0.82;
  const noSuperscript = items.filter((i) => !(small(i) && /^\s*\d{1,2}\s*$/.test(i.str)));
  // Số trang đứng riêng ở chân trang không tính là thân bài
  const bodyLines = noSuperscript.filter((i) => !small(i) && i.str.trim() && !/^\s*\d{1,3}\s*$/.test(i.str));
  if (!bodyLines.length) return noSuperscript;
  const lowestBody = Math.min(...bodyLines.map((i) => i.y));
  // Chú thích: chữ nhỏ nằm hẳn dưới dòng thân bài cuối cùng của trang, mở đầu bằng số chú thích.
  // (Bảng chữ nhỏ ở cuối trang không mở đầu bằng "1 …" nên được giữ lại.)
  const below = (i: PdfItem) => small(i) && i.y < lowestBody - body * 0.5;
  const zone = items.filter((i) => below(i) && i.str.trim());
  if (!zone.length) return noSuperscript;
  const top = Math.max(...zone.map((i) => i.y));
  const firstLine = zone
    .filter((i) => Math.abs(i.y - top) < (i.h || 10) * 0.6)
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str)
    .join(" ")
    .trim();
  if (!/^\d{1,2}(?:\s|\p{Lu})/u.test(firstLine)) return noSuperscript;
  return noSuperscript.filter((i) => !below(i));
}

function toLines(items: PdfItem[]): Line[] {
  const sorted = dropFootnotes(items)
    .filter((i) => i.str.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; h: number; items: PdfItem[] }[] = [];
  for (const it of sorted) {
    const h = it.h || 10;
    const line = lines.find((l) => Math.abs(l.y - it.y) < Math.max(h, l.h) * 0.5);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, h, items: [it] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) => {
      const its = l.items.sort((a, b) => a.x - b.x);
      const segs: Segment[] = [];
      for (const it of its) {
        const last = segs[segs.length - 1];
        const gap = last ? it.x - last.x1 : Infinity;
        if (last && gap < l.h * 0.6) {
          last.text +=
            (gap > l.h * 0.15 && !last.text.endsWith(" ") && !it.str.startsWith(" ") ? " " : "") + it.str;
          last.x1 = Math.max(last.x1, it.x + it.w);
        } else segs.push({ x0: it.x, x1: it.x + it.w, text: it.str });
      }
      segs.forEach((s) => (s.text = s.text.replace(/\s+/g, " ").trim()));
      return { y: l.y, h: l.h, segs: segs.filter((s) => s.text) };
    })
    .filter((l) => l.segs.length);
}

/** Chia các dòng thành khối, ngăn cách bởi khoảng trống lớn hơn khoảng cách dòng thông thường. */
function toBlocks(lines: Line[]): Line[][] {
  const gaps = lines
    .slice(1)
    .map((l, i) => lines[i].y - l.y)
    .filter((g) => g > 0)
    .sort((a, b) => a - b);
  // Ô căn giữa theo chiều dọc tạo ra nhiều khoảng nửa dòng (8-9pt). Đặt sàn 12pt
  // để dòng 17-18pt trong cùng một hàng không bị tách, nhưng khoảng cách giữa hai hàng vẫn tách.
  const typical = gaps.length ? Math.max(12, gaps[Math.floor(gaps.length * 0.3)]) : 14;
  const blocks: Line[][] = [];
  lines.forEach((l, i) => {
    const gap = i ? lines[i - 1].y - l.y : Infinity;
    if (!blocks.length || gap > typical * 1.6) blocks.push([l]);
    else blocks[blocks.length - 1].push(l);
  });
  return blocks;
}

/** Cột = các khoảng x chồng lấn nhau của mọi đoạn trong các dòng của bảng. */
function columnsOf(lines: Line[]) {
  const spans = lines
    .flatMap((l) => l.segs.map((s) => [s.x0, s.x1] as [number, number]))
    .sort((a, b) => a[0] - b[0]);
  const cols: [number, number][] = [];
  for (const [a, b] of spans) {
    const last = cols[cols.length - 1];
    if (last && a <= last[1] + 2) last[1] = Math.max(last[1], b);
    else cols.push([a, b]);
  }
  return cols;
}

type Cell = { col: number; top: number; bottom: number; parts: string[] };

/**
 * Dựng các hàng của bảng: tách mỗi cột thành các ô (khoảng cách dòng lớn hơn bình thường = sang ô mới),
 * rồi gom các ô có dải độ cao chồng nhau thành một hàng (ô căn giữa theo chiều dọc vẫn đúng hàng).
 */
function tableRows(lines: Line[], cols: [number, number][]): string[] {
  const colOf = (s: Segment) => {
    const mid = (s.x0 + s.x1) / 2;
    const i = cols.findIndex(([a, b]) => mid >= a - 1 && mid <= b + 1);
    return i < 0 ? cols.length - 1 : i;
  };
  const perCol = cols.map((_, ci) =>
    lines
      .flatMap((l) => l.segs.filter((s) => colOf(s) === ci).map((s) => ({ y: l.y, h: l.h, text: s.text })))
      .sort((a, b) => b.y - a.y),
  );
  // Khoảng cách dòng trong một ô ≈ khoảng cách nhỏ nhất giữa hai dòng liên tiếp cùng cột.
  const gaps = perCol.flatMap((segs) =>
    segs
      .slice(1)
      .map((s, i) => ({ g: segs[i].y - s.y, h: s.h }))
      .filter(({ g, h }) => g >= h * 0.8),
  );
  const leading = gaps.length ? Math.min(...gaps.map((x) => x.g)) : 12;
  const cells: Cell[] = [];
  perCol.forEach((segs, ci) => {
    let cur: Cell | null = null;
    for (const s of segs) {
      if (cur && cur.bottom - s.y <= leading * 1.3) {
        cur.parts.push(s.text);
        cur.bottom = s.y;
      } else {
        cur = { col: ci, top: s.y + s.h, bottom: s.y, parts: [s.text] };
        cells.push(cur);
      }
    }
  });
  cells.sort((a, b) => b.top - a.top);
  const rows: { top: number; bottom: number; cells: Cell[] }[] = [];
  for (const c of cells) {
    const row = rows.find((r) => c.top > r.bottom && c.bottom < r.top);
    if (row) {
      row.cells.push(c);
      row.top = Math.max(row.top, c.top);
      row.bottom = Math.min(row.bottom, c.bottom);
    } else rows.push({ top: c.top, bottom: c.bottom, cells: [c] });
  }
  return rows
    .sort((a, b) => b.top - a.top)
    .map((r) => {
      const texts = cols.map((_, ci) =>
        r.cells
          .filter((c) => c.col === ci)
          .map((c) => c.parts.join(" "))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      );
      return texts.filter(Boolean).length > 1
        ? ROW_MARK + " " + texts.join(CELL_SEP)
        : texts.filter(Boolean).join(" ");
    });
}

function blockText(block: Line[]): string {
  if (!block.some((l) => l.segs.length > 1)) return block.map((l) => l.segs[0].text).join("\n");
  const base = columnsOf(block.filter((l) => l.segs.length > 1));
  if (base.length < 2) return block.map((l) => l.segs.map((s) => s.text).join(" ")).join("\n");
  // Dòng một đoạn thuộc bảng nếu không tràn qua từ 2 cột trở lên (tiêu đề mục, đoạn văn thường thì tràn)
  const inTable = block.map(
    (l) =>
      l.segs.length > 1 || base.filter(([a, b]) => l.segs[0].x0 < b - 2 && l.segs[0].x1 > a + 2).length <= 1,
  );
  const first = inTable.indexOf(true);
  const last = inTable.lastIndexOf(true);
  const plain = (ls: Line[]) => ls.map((l) => l.segs.map((s) => s.text).join(" "));
  const table = block.slice(first, last + 1);
  return [
    ...plain(block.slice(0, first)),
    ...tableRows(table, columnsOf(table)),
    ...plain(block.slice(last + 1)),
  ].join("\n");
}

/** Chuẩn hóa để so dòng lặp ở đầu/cuối trang (bỏ số trang). */
const repeatKey = (s: string) => s.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();

/** Mỗi trang là danh sách mẩu chữ có tọa độ, hoặc chữ thuần (trang scan đã OCR). */
export function layoutPages(pages: (PdfItem[] | string)[]): string {
  const pageBlocks = pages.map((p) => (typeof p === "string" ? [p] : toBlocks(toLines(p)).map(blockText)));
  // Dòng xuất hiện ở từ 2 trang trở lên (tiêu đề chạy, chân trang) → bỏ
  const counts = new Map<string, number>();
  if (pages.length > 1)
    for (const blocks of pageBlocks)
      for (const k of new Set(blocks.flatMap((b) => b.split("\n")).map(repeatKey)))
        counts.set(k, (counts.get(k) || 0) + 1);
  return pageBlocks
    .map((blocks) =>
      blocks
        .map((b) =>
          b
            .split("\n")
            .filter((line) => (counts.get(repeatKey(line)) || 0) < 2 || line.length < 12)
            // Số trang đứng riêng một dòng ("12", "Trang 3", "3/15")
            .filter((line) => !/^\s*(?:trang\s*)?\d{1,3}(?:\s*\/\s*\d{1,3})?\s*$/iu.test(line))
            .join("\n"),
        )
        .filter(Boolean)
        .join("\n\n"),
    )
    .join("\n\n");
}

/** Chuyển item của pdf.js (transform = [a,b,c,d,x,y]) sang PdfItem. */
export function fromPdfJs(
  items: Array<{ str?: string; transform?: number[]; width?: number; height?: number }>,
): PdfItem[] {
  return items
    .filter((i) => typeof i.str === "string" && i.transform)
    .map((i) => ({
      str: i.str!,
      x: i.transform![4],
      y: i.transform![5],
      w: i.width || 0,
      h: i.height || Math.abs(i.transform![3]) || 10,
    }));
}

/** Văn bản dễ đọc cho người/AI: bỏ ký hiệu hàng, ô ngăn bằng " | ". */
export function readableLayout(text: string) {
  return text
    .split(ROW_MARK + " ")
    .join("")
    .split(CELL_SEP)
    .join(" | ");
}
