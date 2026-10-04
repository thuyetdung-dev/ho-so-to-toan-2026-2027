// Phần bảng Word cần DOMParser (trình duyệt); trên Node bỏ qua phần đó.
import { describe, expect, it } from "./helpers/vitest-shim.ts";
import fs from "fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { fromPdfJs, layoutPages, readableLayout, ROW_MARK } from "../src/report/pdf-layout";
import { htmlToLayout } from "../src/report/html-layout";
import { audienceOf, extractTasks } from "../src/report/tasks";

async function pdfLayout(path: string) {
  const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(path)) }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++)
    pages.push(
      fromPdfJs((await (await pdf.getPage(n)).getTextContent()).items as Parameters<typeof fromPdfJs>[0]),
    );
  return layoutPages(pages);
}

describe("kế hoạch có bảng lộ trình (PDF)", async () => {
  const text = await pdfLayout("tests/fixtures/report/ke-hoach-bang.pdf");
  const all = extractTasks(text, "kh.pdf");
  const staff = extractTasks(text, "kh.pdf", { staffOnly: true });
  const works = (ts: typeof all) => ts.map((t) => `[${t.time}] ${t.work}`);

  it("ghép đúng từng hàng của bảng, thời gian khớp nội dung", () => {
    const row = all.find((t) => t.work.startsWith("Nộp ma trận"));
    expect(row?.time).toBe("Đến 10/10/2026");
    expect(row?.work).toContain("(Giáo viên bộ môn)");
    expect(all.find((t) => t.work.startsWith("In sao đề"))?.time).toBe("Trước 14/10/2026");
  });

  it("bỏ tiêu đề/chân trang, phụ đề, mục đích và bảng tiêu chí", () => {
    const s = works(all).join("\n");
    for (const junk of [
      "Tài liệu lưu hành",
      "Số: 12",
      "Tổ chức kiểm tra giữa kỳ I năm học",
      "Mục đích",
      "Hoàn thành nhiệm vụ được giao",
    ])
      expect(s).not.toContain(junk);
    expect(text).toContain(ROW_MARK);
    expect(readableLayout(text)).not.toContain(ROW_MARK);
  });

  it("chỉ giữ việc thuộc cấp trường khi bật lọc", () => {
    const s = works(staff).join("\n");
    expect(s).toContain("Duyệt ma trận"); // lãnh đạo trường vẫn là cấp trường
    expect(s).toContain("Phê duyệt kế hoạch");
    expect(s).toContain("Rà soát, góp ý và tổng hợp đề kiểm tra");
    expect(s).toContain("In sao đề");
    expect(s).toContain("Ra đề đúng ma trận (Giáo viên bộ môn)");
    expect(staff.find((t) => t.work.startsWith("Trả bài"))?.time).toMatch(/30\/10\/2026/);
    expect(staff.find((t) => t.work.startsWith("Báo cáo kết quả về Sở"))?.work).toContain("(Văn phòng)");
    expect(staff.length).toBe(12);
    expect(all.length).toBe(12); // 5 hàng bảng + 2 việc Hiệu trưởng + 3 việc giáo viên + 2 việc văn phòng
  });
});

describe("bảng trong file Word và Excel", () => {
  const html = `<p>KẾ HOẠCH THÁNG 10</p>
    <table><tr><td><p>STT</p></td><td><p>Nội dung công việc</p></td><td><p>Người phụ trách</p></td><td><p>Thời gian</p></td></tr>
    <tr><td>1</td><td><p>Dự giờ, góp ý tiết dạy minh họa</p></td><td>Giáo viên trong tổ</td><td>Tuần 2</td></tr>
    <tr><td>2</td><td><p>Kiểm tra hồ sơ chuyên môn của tổ</p></td><td>Phó Hiệu trưởng</td><td>15/10/2026</td></tr></table>`;
  const hasDom = typeof DOMParser !== "undefined";
  const text = hasDom ? htmlToLayout(html) : "";
  it("hàng bảng Word thành hàng; cột lấy theo tiêu đề kể cả khi không có ngày cụ thể", () => {
    if (!hasDom) return;
    const t = extractTasks(text, "kh.docx");
    expect(t.map((x) => x.time)).toEqual(["Tuần 2", "15/10/2026"]);
    expect(t[0].work).toBe("Dự giờ, góp ý tiết dạy minh họa (Giáo viên trong tổ).");
    expect(extractTasks(text, "kh.docx", { staffOnly: true })).toHaveLength(2);
  });
  it("nhận diện người thực hiện", () => {
    expect(audienceOf("Hiệu trưởng & Bộ phận Văn phòng")).toBe("staff");
    expect(audienceOf("Hiệu trưởng, các Phó Hiệu trưởng")).toBe("leader");
    expect(audienceOf("Toàn thể Viên chức, GV, NLĐ")).toBe("staff");
    expect(audienceOf("Hội đồng trường")).toBe("unknown");
  });
});

describe("PDF Olympic 9762 có ô bảng nhiều dòng", async () => {
  const text = await pdfLayout("tests/fixtures/report/olympic-9762.pdf");
  const tasks = extractTasks(text, "olympic.pdf", { staffOnly: true });
  const works = tasks.map((t) => t.work);

  it("ghép trọn từng hàng, không cắt vụn dòng đầu hoặc dòng cuối của ô", () => {
    expect(text).toContain(
      "§ROW§ Từ 24/8/2026 đến 31/01/2027 ¦ Sở GDĐT xây dựng, triển khai Kế hoạch tổ chức Cuộc thi; các cơ sở giáo dục tổ chức thi chọn đội tuyển.",
    );
    expect(text).toContain(
      "§ROW§ Ngày 15/3/2027 ¦ Các đơn vị thực hiện in thẻ dự thi chính thức cho thí sinh (yêu cầu dán ảnh, đóng dấu giáp lai và thủ trưởng đơn vị ký xác nhận). ¦ Các đơn vị dự thi",
    );
  });

  it("đầu việc đầu ra là câu hoàn chỉnh", () => {
    expect(works).toContain("Các cơ sở giáo dục tổ chức thi chọn đội tuyển.");
    expect(works.some((w) => w.startsWith("Các đơn vị thực hiện in thẻ dự thi chính thức"))).toBe(true);
    expect(works.join("\n")).not.toMatch(/^giáo dục tổ chức|^chính thức cho thí sinh|^theo cụm chuyên môn/mu);
  });

  it("chỉ giữ đúng 5 nhiệm vụ cấp trường và bỏ nhiệm vụ của Sở, phòng, ban, điểm thi", () => {
    expect(tasks).toHaveLength(5);
    const all = works.join("\n");
    for (const expected of [
      "tổ chức thi chọn đội tuyển",
      "thực hiện đăng ký thí sinh",
      "in thẻ dự thi chính thức",
      "đảm bảo đúng đối tượng dự thi",
      "đảm bảo cử đúng thành phần",
    ])
      expect(all).toContain(expected);
    for (const excluded of [
      "Tổ chức chấm thi, xử lý kết quả",
      "Tham mưu kế hoạch tổ chức",
      "Phối hợp lực lượng an ninh",
      "Văn phòng Sở",
      "Nghị quyết số 86",
    ])
      expect(all).not.toContain(excluded);
    expect(works.some((work) => work.startsWith("THPT),"))).toBe(false);
  });
});
