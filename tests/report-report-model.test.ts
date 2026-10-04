import { describe, expect, it } from "./helpers/vitest-shim.ts";
import JSZip from "jszip";
import { buildReportModel, safeFilePart, vietnameseDateLine } from "../src/report/report-model";
import { buildDocx } from "../src/report/export-docx";
import { emptyPayload } from "../src/report/tasks";
import type { ReportPayload } from "../src/report/types";

const payload: ReportPayload = {
  ...emptyPayload("Nguyễn Văn A"),
  agency: "Sở GD&ĐT TP. Hồ Chí Minh",
  place: "TP. Hồ Chí Minh",
  selfAssessment: "Hoàn thành tốt nhiệm vụ.",
  tasks: [
    { id: "1", time: "Trước 05/09", work: "Hoàn thiện kế hoạch dạy học", source: "a", status: "Hoàn thành" },
    { id: "2", time: "Trước 30/09", work: "Chốt hồ sơ tháng", source: "a", status: "Đang thực hiện" },
  ],
};
const period = { month: "09", year: "2026" };

describe("mô hình báo cáo", () => {
  it("mẫu hành chính có quốc hiệu, dòng ngày tháng, 5 mục", () => {
    const m = buildReportModel(payload, period, new Date(2026, 8, 20));
    expect(m.letterhead.right[0]).toBe("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM");
    expect(m.letterhead.left[0]).toBe("SỞ GD&ĐT TP. HỒ CHÍ MINH");
    expect(m.letterhead.dateLine).toBe("TP. Hồ Chí Minh, ngày 20 tháng 09 năm 2026");
    expect(m.blocks.filter((b) => b.kind === "heading").map((b) => (b as { text: string }).text)).toEqual([
      "I. TỔNG QUAN",
      "II. KẾT QUẢ THỰC HIỆN NHIỆM VỤ",
      "III. CÔNG VIỆC CHUYỂN TIẾP",
      "IV. TỰ ĐÁNH GIÁ",
      "V. ĐỀ XUẤT, KIẾN NGHỊ",
    ]);
  });

  it("mẫu sổ tay có trang bìa và mục Kết quả đã hoàn thành", () => {
    const m = buildReportModel({ ...payload, template: "notebook" }, period);
    expect(m.cover[0]).toBe("SỔ TAY VÀ BÁO CÁO CÔNG VIỆC");
    expect(m.blocks.some((b) => b.kind === "bullets" && b.items[0] === "Hoàn thiện kế hoạch dạy học")).toBe(
      true,
    );
  });

  it("tên file an toàn", () => {
    expect(safeFilePart('Cô A/B: "x"')).toBe("Co_AB_x");
    expect(safeFilePart("Thuyết Dũng")).toBe("Thuyet_Dung");
    expect(vietnameseDateLine("", new Date(2026, 0, 5))).toBe("………, ngày 05 tháng 01 năm 2026");
  });

  it("xuất được file Word chứa đủ nội dung", async () => {
    for (const template of ["admin", "notebook"] as const) {
      const blob = await buildDocx(buildReportModel({ ...payload, template }, period));
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const xml = await zip.file("word/document.xml")!.async("string");
      expect(xml).toContain("Chốt hồ sơ tháng");
      expect(xml).toContain("Nguyễn Văn A");
      if (template === "admin") expect(xml).toContain("Độc lập - Tự do - Hạnh phúc");
    }
  });
});
