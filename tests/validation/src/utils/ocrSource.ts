import { pdfItemsToText, type PdfTextItem } from './lessonImport';
import type { ReadGridsResult } from "./planImport";
import { textGrids } from "./professionalSource";
export async function ocrSource(
  file: File,
  options: { progress?: (s: string) => void; signal?: AbortSignal },
): Promise<ReadGridsResult> {
  if (options.signal?.aborted) throw new Error("Đã hủy OCR.");
  const { createWorker } = await import("tesseract.js");
  const base = `${import.meta.env.BASE_URL}ocr/`;
  const worker = await createWorker("vie+eng", 1, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}tesseract-core-lstm.wasm.js`,
    langPath: `${base}lang`,
    logger: (m) =>
      options.progress?.(
        `${m.status}: ${Math.round((m.progress || 0) * 100)}%`,
      ),
  });
  const stop = () => {
    void worker.terminate();
  };
  options.signal?.addEventListener("abort", stop, { once: true });
  const aborted = () => {
    if (options.signal?.aborted) throw new Error("Đã hủy OCR.");
  };
  try {
    aborted();
    let text = "";
    if (file.name.toLowerCase().endsWith(".pdf")) {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = (
        await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")
      ).default;
      const loading = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
      });
      const pdf = await loading.promise;
      try {
        if (pdf.numPages > 12)
          throw new Error(
            "OCR tối đa 12 trang mỗi tệp. Hãy tách PDF để tránh treo trình duyệt.",
          );
        for (let i = 1; i <= pdf.numPages; i++) {
          aborted();
          const page = await pdf.getPage(i);
          const extracted = await page.getTextContent();
          const plain = pdfItemsToText(extracted.items as PdfTextItem[]);
          if (plain.trim().length > 30) {
            text += `\n\nTrang ${i}\n${plain}`;
            continue;
          }
          options.progress?.(`Đang OCR trang ${i}/${pdf.numPages}`);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          if (viewport.width * viewport.height > 16_000_000)
            throw new Error(
              "Trang PDF quá lớn để OCR; hãy giảm kích thước trang.",
            );
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({
            canvasContext: canvas.getContext("2d")!,
            canvas,
            viewport,
          }).promise;
          const result = await worker.recognize(canvas);
          text += `\n\nTrang ${i}\n${result.data.text}`;
          canvas.width = canvas.height = 0;
        }
      } finally {
        await loading.destroy();
      }
    } else {
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > 25_000_000)
          throw new Error(
            "Ảnh quá lớn để OCR. Hãy giảm xuống dưới 25 megapixel.",
          );
        const result = await worker.recognize(file);
        text = result.data.text;
      } finally {
        bitmap.close();
      }
    }
    aborted();
    if (!text.trim())
      throw new Error("OCR chưa nhận được chữ. Hãy dùng ảnh rõ hơn.");
    return {
      text,
      grids: textGrids(text),
      source: "OCR tiếng Việt/Anh",
      notes: [
        "OCR chạy trên thiết bị. Phải đối chiếu chữ, số, công thức và bảng với tệp gốc; OCR không bảo đảm giữ cấu trúc bảng/công thức.",
      ],
    };
  } finally {
    options.signal?.removeEventListener("abort", stop);
    await worker.terminate().catch(() => undefined);
  }
}
