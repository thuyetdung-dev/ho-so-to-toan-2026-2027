import { describe, expect, it } from "./helpers/vitest-shim.ts";
import {
  appendUnique,
  clean,
  extractTasks,
  normalizePayload,
  normalizeTime,
  signature,
  splitWork,
} from "../src/report/tasks";

const PLAN = `KẾ HOẠCH HOẠT ĐỘNG TỔ TOÁN THÁNG 9/2026
Căn cứ kế hoạch năm học của nhà trường.
- Trước 05/09: Hoàn thiện kế hoạch dạy học môn Toán sau góp ý của ban giám hiệu.
- 15/09, 08g00: Tham dự họp triển khai chuyên môn Toán THPT theo phân công.
- Đến 16/09: Hoàn thành tự đánh giá KPI, danh mục nhiệm vụ và minh chứng.
- Trước 30/09: Chốt tiến độ dạy học, kiểm tra thường xuyên, hồ sơ và báo cáo tháng.
Trân trọng.`;

describe("extractTasks", () => {
  const tasks = extractTasks(PLAN, "ke-hoach.docx");

  it("nhận diện đủ 4 đầu việc và bỏ tiêu đề/lời chào", () => {
    expect(tasks).toHaveLength(4);
    expect(tasks.map((t) => t.work).join(" ")).not.toMatch(/Trân trọng/);
  });

  it("tách đúng thời gian ra khỏi nội dung", () => {
    expect(tasks[0].time).toBe("Trước 05/09");
    expect(tasks[0].work.startsWith("Hoàn thiện kế hoạch")).toBe(true);
    expect(tasks[1].time).toMatch(/15\/09/);
  });

  it("gắn nguồn, trạng thái mặc định và độ tin cậy", () => {
    expect(tasks.every((t) => t.source === "ke-hoach.docx" && t.status === "Chưa làm")).toBe(true);
    expect(tasks[0].confidence).toBe(95);
  });

  it("bỏ đầu việc trùng lặp", () => {
    expect(extractTasks(PLAN + "\n" + PLAN, "x")).toHaveLength(4);
  });

  it("tách câu khi câu sau bắt đầu bằng chữ HOA có dấu", () => {
    const t = extractTasks(
      "Tổ chức sinh hoạt chuyên môn theo nghiên cứu bài học vào tuần 2. Đánh giá giữa kỳ môn Toán khối 10 trước 25/09.",
      "x",
    );
    expect(t).toHaveLength(2);
  });

  it("không tách câu tại chữ thường có dấu", () => {
    const t = extractTasks("Chuẩn bị đề kiểm tra. điều chỉnh ma trận theo góp ý của tổ trước 20/09.", "x");
    expect(t).toHaveLength(1);
  });
});

describe("normalizeTime", () => {
  it("giữ ngày hợp lệ", () => expect(normalizeTime("Trước 05/09")).toBe("Trước 05/09"));
  it("đổi ngày không hợp lệ thành Trong tháng", () => expect(normalizeTime("45/13")).toBe("Trong tháng"));
  it("ô trống thành Trong tháng", () => expect(normalizeTime("  ")).toBe("Trong tháng"));
});

describe("tiện ích", () => {
  it("signature bỏ dấu và chữ đ", () => expect(signature("Đánh giá đề")).toBe("danhgiade"));
  it("clean bỏ ký hiệu đầu dòng", () => expect(clean("☐  • Nộp hồ sơ")).toBe("Nộp hồ sơ"));
  it("splitWork tách theo dấu chấm phẩy", () =>
    expect(splitWork("Soạn đề kiểm tra; Chấm bài và nhập điểm")).toHaveLength(2));
  it("appendUnique không thêm trùng", () => {
    const a = extractTasks(PLAN, "a");
    expect(appendUnique(a, extractTasks(PLAN, "b"))).toHaveLength(4);
  });
});

describe("normalizePayload", () => {
  it("đọc được định dạng cũ (chỉ có sources/tasks/name/school)", () => {
    const p = normalizePayload(
      {
        sources: [],
        tasks: [{ id: "1", time: "45/13", work: "Việc", source: "x", status: "Hoàn thành" }],
        name: "Cô Lan",
        school: "THPT A",
      },
      "fallback",
    );
    expect(p.name).toBe("Cô Lan");
    expect(p.template).toBe("admin");
    expect(p.tasks[0].time).toBe("Trong tháng");
    expect(p.tasks[0].status).toBe("Hoàn thành");
  });
  it("sửa trạng thái lạ về Chưa làm", () => {
    const p = normalizePayload({ tasks: [{ work: "x", status: "???" }] }, "A");
    expect(p.tasks[0].status).toBe("Chưa làm");
    expect(p.tasks[0].id).toBeTruthy();
  });
  it("payload rỗng dùng tên dự phòng", () => expect(normalizePayload(null, "Thầy B").name).toBe("Thầy B"));
});

describe("ký tự ẩn \\u0000 từ PDF (lỗi 22P05 của PostgreSQL)", () => {
  it("clean và sanitizeDeep loại bỏ \\u0000", async () => {
    const { sanitizeDeep, stripControl } = await import("../src/report/tasks");
    expect(stripControl("Nộp\u0000 hồ sơ\u0007")).toBe("Nộp hồ sơ");
    const p = sanitizeDeep({ tasks: [{ work: "a\u0000b", n: 1 }], name: "x\u0000" });
    expect(JSON.stringify(p)).not.toContain("\\u0000");
    expect(p.tasks[0].n).toBe(1);
  });
  it("bản nháp cũ trên máy có \\u0000 được làm sạch khi mở lại", () => {
    const p = normalizePayload(
      { tasks: [{ work: "Việc\u0000 một", status: "Chưa làm" }], name: "A\u0000" },
      "B",
    );
    expect(p.tasks[0].work).toBe("Việc một");
    expect(p.name).toBe("A");
  });
  it("vẫn giữ xuống dòng và tab", async () => {
    const { stripControl } = await import("../src/report/tasks");
    expect(stripControl("a\nb\tc")).toBe("a\nb\tc");
  });
});

describe("lọc đầu việc cấp trường từ kế hoạch của Sở", () => {
  const olympic = `§ROW§ Thời gian ¦ Nội dung công việc ¦ Đơn vị thực hiện
§ROW§ Từ 24/8/2026 đến 31/01/2027 ¦ Sở GDĐT xây dựng, triển khai Kế hoạch tổ chức Cuộc thi; các cơ sở giáo dục tổ chức thi chọn đội tuyển. ¦ Phòng GDPT, Phòng GDTX-NN và Đại học, các đơn vị dự thi
§ROW§ Từ 01/2/2027 đến 28/2/2027 ¦ Sở GDĐT hướng dẫn đăng ký dự thi; các cơ sở giáo dục thực hiện đăng ký thí sinh trực tuyến. ¦ Phòng GDPT, các đơn vị dự thi
§ROW§ Từ 01/3/2027 đến 14/3/2027 ¦ Tổng hợp danh sách đăng ký dự thi; tham mưu thành lập các Ban. ¦ Phòng GDPT, Phòng Tổ chức cán bộ
§ROW§ Ngày 15/3/2027 ¦ Các đơn vị thực hiện in thẻ dự thi chính thức cho thí sinh. ¦ Các đơn vị dự thi
Nghị quyết số 86/2025/NQ-HĐND ngày 10 tháng 12 năm 2025 quy định chính sách khen thưởng.
Các trường THPT đảm bảo đúng đối tượng dự thi, thông tin học sinh chính xác và đúng thời hạn đăng ký.
Các đơn vị dự thi đảm bảo thông tin học sinh chính xác, đúng đối tượng và đúng thời hạn đăng ký.`;

  const tasks = extractTasks(olympic, "olympic.pdf", { staffOnly: true });

  it("chỉ lấy phần việc giao cho cơ sở giáo dục trong hàng hỗn hợp", () => {
    expect(tasks.some((t) => t.work.includes("tổ chức thi chọn đội tuyển"))).toBe(true);
    expect(tasks.some((t) => t.work.includes("thực hiện đăng ký thí sinh trực tuyến"))).toBe(true);
    expect(tasks.map((t) => t.work).join(" ")).not.toContain("Sở GDĐT xây dựng");
  });

  it("bỏ việc của phòng thuộc Sở và căn cứ pháp lý", () => {
    const all = tasks.map((t) => t.work).join("\n");
    expect(all).not.toContain("Tổng hợp danh sách đăng ký dự thi");
    expect(all).not.toContain("Nghị quyết số 86");
  });

  it("gộp hai cách diễn đạt cùng một yêu cầu đăng ký", () => {
    expect(tasks.filter((t) => /đúng đối tượng.*thông tin học sinh|thông tin học sinh.*đúng đối tượng/iu.test(t.work))).toHaveLength(1);
  });
});
