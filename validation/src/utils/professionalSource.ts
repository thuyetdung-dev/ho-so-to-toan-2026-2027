import type { Grid, ReadGridsResult } from "./planImport";
import { readPlanGrids } from "./planImport";
export function textGrids(text: string): Grid[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[][][] = [];
  let block: string[][] = [];
  const flush = () => {
    if (block.length > 1) blocks.push(block);
    block = [];
  };
  for (const line of lines) {
    if (/\||\t/.test(line)) {
      const cells = line.includes("\t")
        ? line.split("\t")
        : line.replace(/^\s*\||\|\s*$/g, "").split("|");
      if (cells.every((c) => /^\s*:?-+:?\s*$/.test(c))) continue;
      block.push(cells.map((c) => c.trim()));
    } else flush();
  }
  flush();
  return blocks.map((rows) => ({ rows, context: "Bảng trong văn bản" }));
}
function jsonGrids(raw: any): Grid[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("JSON cần là đối tượng có tasks và/hoặc indicators.");
  const grids: Grid[] = [];
  for (const [key, headers, fields] of [
    [
      "tasks",
      [
        "Nội dung",
        "Nhóm",
        "Người thực hiện",
        "Thời hạn",
        "Sản phẩm",
        "Minh chứng",
      ],
      ["title", "category", "assignee", "deadline", "product", "evidence"],
    ],
    [
      "indicators",
      ["Nội dung", "Chỉ tiêu", "Thực hiện", "Đơn vị", "Minh chứng"],
      ["title", "target", "actual", "unit", "evidence"],
    ],
  ] as const) {
    if (raw[key] === undefined) continue;
    if (!Array.isArray(raw[key]) || raw[key].length > 2000)
      throw new Error(`Mục ${key} cần là danh sách tối đa 2.000 dòng.`);
    grids.push({
      context: key,
      rows: [
        [...headers],
        ...raw[key].map((r: any) => {
          if (!r || typeof r !== "object")
            throw new Error("Dòng JSON không hợp lệ.");
          return fields.map((f) =>
            typeof r[f] === "string" || typeof r[f] === "number"
              ? String(r[f])
              : "",
          );
        }),
      ],
    });
  }
  if (!grids.length)
    throw new Error("JSON chưa có tasks/indicators. Hãy dùng tệp mẫu của app.");
  return grids;
}
export async function readProfessionalSource(
  file: File,
  options: {
    ocr: boolean;
    progress?: (s: string) => void;
    signal?: AbortSignal;
  },
): Promise<ReadGridsResult> {
  if (file.size > 15 * 1024 * 1024) throw new Error("Tệp vượt giới hạn 15 MB.");
  if (options.signal?.aborted) throw new Error("Đã hủy đọc tệp.");
  const ext = file.name.toLowerCase();
  if (/\.(txt|md|json)$/.test(ext)) {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true })
        .decode(await file.arrayBuffer())
        .replace(/^\uFEFF/, "");
    } catch {
      throw new Error(
        "Tệp văn bản chưa ở UTF-8. Hãy lưu lại bằng UTF-8 rồi nhập.",
      );
    }
    if (!text.trim()) throw new Error("Tệp không có nội dung.");
    const grids = ext.endsWith(".json")
      ? jsonGrids(JSON.parse(text))
      : textGrids(text);
    return {
      text,
      grids,
      source: ext.endsWith(".json") ? "JSON" : "Văn bản UTF-8",
      notes: ["Đã đọc UTF-8; loại bỏ BOM nếu có."],
    };
  }
  if (/\.(png|jpe?g|webp)$/.test(ext)) {
    if (!options.ocr) throw new Error("Ảnh cần bật OCR trước khi đọc.");
    const { ocrSource } = await import("./ocrSource");
    return ocrSource(file, options);
  }
  const result = await readPlanGrids(file);
  if (ext.endsWith(".pdf") && options.ocr && result.text.trim().length < 30) {
    const { ocrSource } = await import("./ocrSource");
    return ocrSource(file, options);
  }
  if (!result.text.trim() && !result.grids.some((g) => g.rows.length))
    throw new Error("Không đọc được chữ/bảng. PDF scan hoặc ảnh cần bật OCR.");
  return result;
}
