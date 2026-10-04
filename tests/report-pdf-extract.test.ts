import { describe, expect, it } from "./helpers/vitest-shim.ts";
import fs from "fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractTasks } from "../src/report/tasks";

/** Đọc PDF giống hệt cách lib/file-readers.ts làm trên trình duyệt. */
async function pdfText(path: string) {
  const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(path)) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    pages.push(
      (content.items as Array<{ str?: string; hasEOL?: boolean }>)
        .map((x) => (x.str || "") + (x.hasEOL ? "\n" : " "))
        .join("")
        .replace(/[ \t]+/g, " ")
        .trim(),
    );
  }
  return pages.join("\n");
}

describe("kế hoạch dạng PDF (công văn thật)", async () => {
  const tasks = extractTasks(await pdfText("tests/fixtures/report/ke-hoach-mau.pdf"), "kh.pdf");
  const works = tasks.map((t) => t.work);

  it("bỏ quốc hiệu, số hiệu, căn cứ, nơi nhận, chữ ký", () => {
    const all = works.join(" | ");
    for (const junk of ["CỘNG HOÀ", "Độc lập", "Số: 447", "Căn cứ", "Nơi nhận", "HIỆU TRƯỞNG", "Lưu: VT"])
      expect(all).not.toContain(junk);
  });

  it("nối dòng bị ngắt và giữ đúng các đầu việc có hạn", () => {
    const find = (s: string) => tasks.find((t) => t.work.includes(s));
    expect(find("tự đánh giá, xếp loại chất lượng quý III trên phần mềm")?.time).toMatch(/25\/9\/2026/);
    expect(find("họp tổ nhận xét")?.time).toMatch(/28\/9/);
    expect(find("Hội đồng đánh giá")?.time).toMatch(/30\/9\/2026, 14g00/);
    expect(find("Văn phòng tổng hợp hồ sơ")).toBeTruthy();
    expect(find("triển khai kế hoạch này")).toBeTruthy();
  });

  it("không sinh ra quá nhiều đầu việc rác", () => {
    console.log(tasks.map((t) => `[${t.time}] ${t.work}`).join("\n"));
    expect(tasks.length).toBeLessThanOrEqual(9);
  });
});
