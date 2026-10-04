import { describe, expect, it } from "./helpers/vitest-shim.ts";
import fs from "fs";
import { extractTasks } from "../src/report/tasks";

const text = fs.readFileSync("tests/fixtures/report/ke-hoach-day-du.txt", "utf8");

describe('mục "4. Đối với Tổ trưởng chuyên môn, tổ Văn phòng" (kế hoạch đầy đủ)', () => {
  const staff = extractTasks(text, "kh.pdf", { staffOnly: true });
  const all = extractTasks(text, "kh.pdf");
  const works = staff.map((t) => t.work);
  const TT = "(Tổ trưởng chuyên môn, tổ Văn phòng)";

  it("lấy đủ mọi việc của tổ trưởng chuyên môn, tổ Văn phòng, ghi rõ người thực hiện", () => {
    const tt = works.filter((w) => w.endsWith(TT + "."));
    expect(tt).toHaveLength(6);
    expect(
      tt.some((w) => w.startsWith("Căn cứ vị trí việc làm") && w.includes("để hướng dẫn giáo viên")),
    ).toBe(true);
    expect(tt.some((w) => w.includes("xác định rõ: Người chủ trì; Người phối hợp; Sản phẩm đầu ra"))).toBe(
      true,
    );
    expect(tt[0]).toBe(
      `Tổ chức triển khai Kế hoạch đánh giá, xếp loại Quý III/2026 đến toàn thể giáo viên, nhân viên trong tổ ${TT}.`,
    );
    expect(staff.find((t) => t.work.startsWith("Gửi biên bản"))?.time).toMatch(/25\/9\/2026/);
  });

  it("tiêu đề mục không bị dính vào đầu việc", () => {
    expect(works.join("\n")).not.toContain("Đối với Tổ trưởng chuyên môn, tổ Văn phòng Tổ chức");
  });

  it("vẫn có việc của viên chức, người lao động và phân công cá nhân", () => {
    expect(works.filter((w) => w.endsWith("(viên chức, người lao động).")).length).toBe(3);
    expect(
      works.some((w) =>
        w.includes(
          "Thường xuyên cập nhật: Tiến độ thực hiện; Kết quả; Sản phẩm; Minh chứng; Nhiệm vụ phát sinh",
        ),
      ),
    ).toBe(true);
    expect(works.some((w) => w.includes("TTCM hỗ trợ xây dựng danh mục"))).toBe(true);
  });

  it("giữ việc của lãnh đạo trường vì vẫn thuộc phạm vi cấp trường", () => {
    const s = works.join("\n");
    for (const x of [
      "Chỉ đạo rà soát",
      "Chủ động xây dựng và cập nhật danh mục",
      "Hiệu trưởng phân công viên chức",
    ])
      expect(s).toContain(x);
    expect(all.some((t) => t.work.startsWith("Chỉ đạo rà soát") && t.work.endsWith("(Hiệu trưởng)."))).toBe(
      true,
    );
  });

  it("bỏ phần mục đích, yêu cầu, tiêu chí (không phải việc cần làm)", () => {
    const s = all.map((t) => t.work).join("\n");
    for (const x of [
      "Triển khai, đồng bộ",
      "Kết quả đánh giá quý",
      "tránh phát sinh",
      "Về tiêu chuẩn chung",
      "Nơi nhận",
    ])
      expect(s).not.toContain(x);
  });

  it("không giới hạn 80 đầu việc", () => {
    const many = Array.from(
      { length: 120 },
      (_, i) => `- Tham gia tiết dạy chuyên đề số ${i + 1} của tổ Toán theo phân công.`,
    ).join("\n");
    expect(extractTasks(many, "x").length).toBe(120);
  });
});
