import { describe, expect, it } from "./helpers/vitest-shim.ts";
import fs from "fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { fromPdfJs, layoutPages } from "../src/report/pdf-layout";
import { extractTasks } from "../src/report/tasks";
import { filterTaskScope, isAnnualGuidance } from "../src/report/task-filter";

/** Đọc PDF giống hệt lib/file-readers.ts trên trình duyệt (dùng tọa độ chữ). */
async function layout(path: string) {
  const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(path)) }).promise;
  const pages = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 30); n++)
    pages.push(
      fromPdfJs((await (await pdf.getPage(n)).getTextContent()).items as Parameters<typeof fromPdfJs>[0]),
    );
  return layoutPages(pages);
}

async function run(path: string, name: string) {
  const text = await layout(path);
  const tasks = extractTasks(text, name, { staffOnly: true, teacherOnly: true });
  return { text, annual: isAnnualGuidance(text, name), ...filterTaskScope(tasks) };
}

describe("Công văn 10293 – Hướng dẫn chuyên môn GDPT năm học 2026-2027", async () => {
  const r = await run(
    "tests/fixtures/report/cv-10293.pdf",
    "10293-huong-dan-chuyen-mon-gdpt-nam-hoc-2026-20272992026_110202616.pdf",
  );
  const kept = r.kept.map((t) => `${t.work} ${t.target}`).join("\n");

  it("nhận ra là văn bản cả năm học", () => expect(r.annual).toBe(true));

  it("không còn số chú thích dính chữ, đuôi trích dẫn sai, mất dấu nối năm học", () => {
    expect(kept).not.toMatch(/\p{L}\d{1,2}(?=[\s.;,)])/u);
    expect(kept).not.toContain("nhiệm vụ sau");
    expect(kept).not.toMatch(/20\d{2} 20\d{2}/);
  });

  it("loại việc tiểu học, môn khác, việc của Sở, mẩu câu cụt", () => {
    expect(kept).not.toMatch(/học sinh tiểu học|Âm nhạc|Tiếng Nhật|Blockchain|thuộc thẩm quyền quản lý/u);
    expect(r.kept.every((t) => !/^\p{Ll}|^\d{4},/u.test(t.work))).toBe(true);
    expect(r.removed.length).toBeGreaterThanOrEqual(15);
  });

  it("ghép lại câu bị cắt khi sang trang", () => {
    expect(kept).toContain("ngoài nhà trường, trải nghiệm, giáo dục theo chủ đề, sinh hoạt câu lạc bộ");
  });

  it("giữ các việc chung của giáo viên THPT", () => {
    expect(kept).toContain("Xây dựng Kế hoạch bài dạy của giáo viên");
    expect(kept).toContain("Xây dựng ma trận, thiết kế đề kiểm tra định kỳ");
    expect(kept).toContain("ôn thi tuyển sinh vào lớp 10 và tốt nghiệp THPT");
  });
});

describe("Công văn 504 – Triển khai nhiệm vụ năm học của trường", async () => {
  const r = await run(
    "tests/fixtures/report/cv-504.pdf",
    "504cv-trien-khai-thuc-hien-nhiem-vu-nam-hoc-2026-2027_310202610.pdf",
  );

  it("nhận ra là văn bản cả năm học", () => expect(r.annual).toBe(true));

  it("gán đúng người thực hiện theo từng mục phân công", () => {
    const gv = r.kept.find((t) => t.work.startsWith("Giáo viên thực hiện nghiêm túc"));
    expect(gv?.target).toMatch(/^Giáo viên chủ nhiệm, giáo viên bộ môn/);
    const tt = r.kept.find((t) => t.work.startsWith("Tổ chức nghiên cứu công văn"));
    expect(tt?.target).toBe("Tổ trưởng chuyên môn");
  });

  it("bỏ câu kết của công văn", () => {
    expect(r.kept.some((t) => /^Đề nghị các|^Trong quá trình thực hiện/u.test(t.work))).toBe(false);
  });
});
