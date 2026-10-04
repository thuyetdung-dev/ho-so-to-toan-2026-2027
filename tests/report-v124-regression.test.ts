import { describe, expect, it } from "./helpers/vitest-shim.ts";
import { extractTasks, normalizeTime } from "../src/report/tasks";
import { scheduleTasks } from "../src/report/schedule";

const source = `
TỔ CHỨC THỰC HIỆN
Hiệu trưởng, thủ trưởng các đơn vị:
- Rà soát và triển khai đánh giá quý III theo KPI; lập danh mục sản phẩm, cập nhật tiến độ, minh chứng và lưu trữ hồ sơ.
- Tự đánh giá kết quả thực hiện các chỉ tiêu, nhiệm vụ chính trị.
- Tham khảo Phụ lục 4 để cụ thể hóa danh mục sản phẩm cho Hiệu trưởng và các chức danh lãnh đạo, quản lý; thống nhất độ khó, tỷ lệ tiến độ và chất lượng đối với nhiệm vụ tương đồng.
- Cử một viên chức làm đầu mối quản trị hệ thống và cung cấp thông tin trước ngày 12 tháng 9 năm 2026.
- Các đơn vị lập danh mục sản phẩm công việc chuẩn của đơn vị và cá nhân trên phần mềm; đánh giá, xếp loại viên chức quản lý; gửi hồ sơ về Sở GDĐT qua Phòng Tổ chức cán bộ trước ngày 20 tháng 9 năm 2026.
- Cấp ủy, đơn vị hoàn thành đánh giá viên chức không giữ chức vụ quản lý và lưu hồ sơ tại đơn vị trước ngày 25 tháng 9 năm 2026.
`;

describe("hồi quy Công văn 9421 – V1.2.4", () => {
  it("đọc ngày bằng chữ và không lùi hạn chính thức", () => {
    expect(normalizeTime("trước ngày 12 tháng 9 năm 2026")).toBe("trước ngày 12/9/2026");
    const tasks = scheduleTasks(extractTasks(source, "9421.pdf", { staffOnly: true }), {
      month: "09",
      year: "2026",
    });
    expect(tasks.find((t) => t.work.includes("đầu mối"))?.date).toBe("2026-09-12");
    expect(tasks.find((t) => t.work.includes("hồ sơ về Sở"))?.date).toBe("2026-09-20");
    expect(tasks.find((t) => t.work.includes("không giữ chức vụ"))?.date).toBe("2026-09-25");
  });

  it("giữ đối tượng và chế độ giáo viên loại nhiệm vụ chỉ dành cho lãnh đạo", () => {
    const all = extractTasks(source, "9421.pdf", { staffOnly: true });
    expect(all.some((t) => /Hiệu trưởng|thủ trưởng/i.test(t.target || ""))).toBe(true);
    const teacher = extractTasks(source, "9421.pdf", { staffOnly: true, teacherOnly: true });
    expect(teacher.every((t) => !/Hiệu trưởng|thủ trưởng|cấp ủy/i.test(t.target || ""))).toBe(true);
  });

  it("không cắt một chỉ đạo nhiều yêu cầu thành các đầu việc vụn", () => {
    const all = extractTasks(source, "9421.pdf", { staffOnly: true });
    const first = all.find((t) => t.work.includes("Rà soát và triển khai"));
    expect(first?.work).toContain("; lập danh mục sản phẩm");
    expect(first?.work).toContain("cập nhật tiến độ");
  });
});
