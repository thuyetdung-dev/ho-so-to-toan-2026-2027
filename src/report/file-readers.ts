import { stripControl } from "./tasks";
import { CELL_SEP, fromPdfJs, layoutPages, ROW_MARK, type PdfItem } from "./pdf-layout";
import { htmlToLayout } from "./html-layout";
/**
 * Đọc chữ từ tệp ngay trên trình duyệt (không gửi tệp lên máy chủ).
 * PDF có lớp chữ đọc trực tiếp; PDF scan và ảnh dùng OCR tiếng Việt (tesseract.js).
 */

export const MAX_PDF_PAGES = 30;
export const ACCEPT = ".pdf,image/*,.heic,.heif,.tif,.tiff,.docx,.xlsx,.xls,.txt,.md,.csv,.json";

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "tif", "tiff", "heic", "heif"];
const TEXT_EXT = ["txt", "md", "csv", "json"];

type Progress = (message: string, percent?: number) => void;

type OcrWorker = {
  recognize: (img: File | HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};

export class FileReaderSession {
  private worker: OcrWorker | null = null;
  constructor(private onProgress: Progress) {}

  private async ocr(input: File | HTMLCanvasElement, label: string) {
    if (!this.worker) {
      this.onProgress("Đang tải bộ nhận dạng chữ tiếng Việt (lần đầu có thể mất vài chục giây)…");
      const T = await import("tesseract.js");
      const base = `${import.meta.env.BASE_URL}ocr/`;
      this.worker = (await T.createWorker("vie+eng", 1, {
        workerPath: `${base}worker.min.js`,
        corePath: `${base}tesseract-core-lstm.wasm.js`,
        langPath: `${base}lang`,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text")
            this.onProgress(`Đang nhận dạng chữ trong ${label}…`, Math.max(5, Math.round(m.progress * 90)));
        },
      })) as unknown as OcrWorker;
    }
    this.onProgress(`Đang nhận dạng chữ trong ${label}…`);
    const result = await this.worker.recognize(input);
    return result.data.text;
  }

  async close() {
    if (this.worker) await this.worker.terminate();
    this.worker = null;
  }

  /** Trả về nội dung chữ (đã bỏ ký tự điều khiển ẩn) và (nếu có) ghi chú cho người dùng. */
  async read(file: File): Promise<{ text: string; note?: string }> {
    const r = await this.readRaw(file);
    return { ...r, text: stripControl(r.text) };
  }

  private async readRaw(file: File): Promise<{ text: string; note?: string }> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    if (ext === "docx") {
      const mammoth = await import("mammoth");
      // Dùng HTML để giữ cấu trúc bảng (bảng lộ trình, phân công…)
      const html = (await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })).value;
      return { text: htmlToLayout(html) };
    }

    if (ext === "xls") {
      throw new Error(
        "Định dạng .xls (Excel 97–2003) chưa được hỗ trợ. Hãy mở tệp bằng Excel và lưu lại dưới dạng .xlsx.",
      );
    }

    if (ext === "xlsx") return { text: await readXlsx(file) };

    if (ext === "pdf") return this.readPdf(file);

    if (file.type.startsWith("image/") || IMAGE_EXT.includes(ext)) {
      try {
        return { text: await this.ocr(file, file.name) };
      } catch (e) {
        if (ext === "heic" || ext === "heif")
          throw new Error(
            "Trình duyệt này không đọc được ảnh HEIC của iPhone. Hãy chuyển ảnh sang JPG (hoặc dùng Safari) rồi thử lại.",
          );
        throw e;
      }
    }

    if (TEXT_EXT.includes(ext) || file.type.startsWith("text/")) return { text: await file.text() };

    throw new Error("Chưa hỗ trợ loại tệp này. Hãy dùng PDF, ảnh, DOCX, XLSX, TXT, CSV hoặc JSON.");
  }

  private async readPdf(file: File) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const limit = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const pages: (PdfItem[] | string)[] = [];
    for (let n = 1; n <= limit; n++) {
      this.onProgress(`Đang đọc ${file.name} – trang ${n}/${limit}…`, Math.round((n / limit) * 85));
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      // Dùng tọa độ chữ để dựng lại dòng, cột và hàng của bảng
      const items = fromPdfJs(content.items as Parameters<typeof fromPdfJs>[0]);
      if (
        items
          .map((i) => i.str)
          .join("")
          .trim().length > 40
      ) {
        pages.push(items);
        continue;
      }
      // Trang không có lớp chữ (bản scan) → vẽ ra canvas rồi OCR
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      pages.push(await this.ocr(canvas, `${file.name}, trang ${n}`));
    }
    return {
      text: layoutPages(pages),
      note:
        pdf.numPages > MAX_PDF_PAGES
          ? `${file.name} có ${pdf.numPages} trang; đã xử lý ${MAX_PDF_PAGES} trang đầu.`
          : undefined,
    };
  }
}

type CellValue = unknown;

/** Chuyển giá trị ô Excel (có thể là công thức, chữ định dạng, ngày…) thành chữ. */
export function cellText(v: CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toLocaleDateString("vi-VN");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text: string }>).map((r) => r.text).join("");
    if ("result" in o) return cellText(o.result);
    if ("text" in o) return String(o.text);
    if ("error" in o) return "";
  }
  return String(v);
}

async function readXlsx(file: File) {
  const XLSX = await import("@e965/xlsx");
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellDates: true });
  const lines: string[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: "" });
    for (const row of rows) {
      const values = (row as CellValue[]).map(cellText).map((v) => v.trim()).filter(Boolean);
      if (values.length > 1) lines.push(ROW_MARK + " " + values.join(CELL_SEP));
      else if (values.length) lines.push(values[0]);
    }
  }
  return lines.join("\n");
}

export function formatBytes(bytes: number) {
  return bytes < 1024
    ? bytes + " B"
    : bytes < 1048576
      ? (bytes / 1024).toFixed(1) + " KB"
      : (bytes / 1048576).toFixed(1) + " MB";
}
