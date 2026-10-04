import { describe, expect, it } from "./helpers/vitest-shim.ts";
import { filterTaskScope, isAnnualGuidance, scopeReason } from "../src/report/task-filter";
import { clean } from "../src/report/tasks";
import { shortSource } from "../src/report/report-model";
import type { Task } from "../src/report/types";

const t = (work: string, target = "Cấp trường"): Task => ({
  id: work.slice(0, 12),
  time: "Trong tháng",
  work,
  source: "10293.pdf",
  status: "Chưa làm",
  target,
});

// Các câu thật nhận diện từ công văn 10293 (Hướng dẫn chuyên môn GDPT năm học 2026-2027)
const SHOULD_DROP = [
  "Dạy học các nội dung về văn hóa giao thông Tiếp tục sử dụng các tài liệu giáo dục an toàn giao thông dành cho học sinh tiểu học để thực hiện việc giáo dục an toàn giao thông cho học sinh trong trường tiểu học.",
  "Đối với học sinh tiểu học, giáo dục lý tưởng cách mạng, đạo đức, lối sống đơn giản là giáo dục đạo đức, pháp luật.",
  "Tổ chức kiểm tra, đánh giá với mỗi nội dung Âm nhạc, Mĩ thuật đúng quy định; khuyến khích thực hiện kiểm tra, đánh giá định kì thông qua bài thực hành.",
  "Tiếp tục xây dựng và triển khai giảng dạy ứng dụng trí tuệ nhân tạo (AI); Coding, Blockchain lồng ghép trong môn Tin học tại các trường trung học.",
  "Đối với các cơ sở giáo dục phổ thông tổ chức dạy học Ngoại ngữ sử dụng sách giáo khoa Tiếng Nhật, Tiếng Trung, Tiếng Hàn: sách giáo khoa được sử dụng phải tuân theo sự phê duyệt của Bộ GDĐT.",
  "Kiểm tra, giám sát, chỉ đạo các cơ sở giáo dục thuộc thẩm quyền quản lý chủ động, thường xuyên rà soát kết quả đạt được.",
  "Phối hợp chặt chẽ với Sở GDĐT trong việc triển khai thực hiện công tác chuyên môn đối với các cơ sở giáo dục thuộc thẩm quyền quản lý.",
  "tra, coi kiểm tra và chấm kiểm tra; quy định công bố kết quả kiểm tra và lưu trữ bài kiểm tra.",
  "trải nghiệm, giáo dục theo chủ đề, sinh hoạt câu lạc bộ…).",
  "Sở GDĐT đề nghị Hiệu trưởng các cơ sở giáo dục phổ thông triển khai thực hiện các nội dung trên.",
  "2026, chất lượng kỳ thi tốt nghiệp trung học phổ thông (THPT) năm 2026 đối với các môn học.",
];

const SHOULD_KEEP = [
  "Xây dựng Kế hoạch bài dạy của giáo viên",
  "Xây dựng ma trận, thiết kế đề kiểm tra định kỳ phù hợp với yêu cầu cần đạt và các biểu hiện cụ thể về các thành phần năng lực của môn học.",
  "Tăng cường ứng dụng công nghệ thông tin, xây dựng học liệu dùng chung, tổ chức tập huấn, sinh hoạt chuyên môn.",
  "Giáo viên cần lồng ghép nội dung giáo dục quốc phòng và an ninh; tổ chức cho học sinh tham quan bảo tàng, nghe nhân chứng lịch sử kể chuyện.",
  "Xây dựng kế hoạch tổ chức ôn tập, bồi dưỡng cho học sinh có nhu cầu ôn thi tuyển sinh vào lớp 10 và tốt nghiệp THPT đúng quy định.",
  "Chủ động xây dựng phương án tổ chức thực hiện lớp học linh hoạt, lớp ghép đối với các môn học lựa chọn.",
  "Thực hiện việc sử dụng tài liệu tham khảo cho các môn học trong nhà trường theo quy định.",
  "Chú ý đến sự phân hóa các đối tượng học sinh, thực hiện việc bồi dưỡng học sinh giỏi, ôn tập cho học sinh lớp cuối cấp.",
];

describe("lọc phạm vi đầu việc cho giáo viên Toán THPT", () => {
  it("loại câu tiểu học, môn khác, việc của Sở và mẩu câu cụt", () => {
    for (const w of SHOULD_DROP) expect(scopeReason(t(w)), w).not.toBeNull();
  });

  it("giữ việc chung của giáo viên THPT", () => {
    for (const w of SHOULD_KEEP) expect(scopeReason(t(w)), w).toBeNull();
  });

  it("không lọc theo môn khi chọn 'Tất cả môn'", () => {
    const r = filterTaskScope([t(SHOULD_DROP[2])], { subject: "all" });
    expect(r.kept).toHaveLength(1);
  });

  it("trả về lý do cho từng câu bị loại", () => {
    const r = filterTaskScope([t(SHOULD_DROP[0]), t(SHOULD_KEEP[0])]);
    expect(r.kept.map((x) => x.work)).toEqual([SHOULD_KEEP[0]]);
    expect(r.removed[0].reason).toBe("Không thuộc cấp THPT");
  });
});

describe("nhận ra văn bản định hướng cả năm học", () => {
  it("công văn hướng dẫn chuyên môn năm học", () => {
    expect(
      isAnnualGuidance(
        "SỞ GIÁO DỤC VÀ ĐÀO TẠO\nV/v hướng dẫn thực hiện nhiệm vụ chuyên môn giáo dục phổ thông năm học 2026 - 2027",
        "10293-huong-dan-chuyen-mon-gdpt-nam-hoc-2026-20272992026_110202616.pdf",
      ),
    ).toBe(true);
    expect(
      isAnnualGuidance("V/v triển khai thực hiện nhiệm vụ năm học 2026-2027", "504cv-trien-khai.pdf"),
    ).toBe(true);
  });

  it("kế hoạch tháng của tổ không phải văn bản cả năm", () => {
    expect(
      isAnnualGuidance("TỔ TOÁN\nKẾ HOẠCH HOẠT ĐỘNG THÁNG 10 NĂM HỌC 2026-2027", "kh-thang-10.pdf"),
    ).toBe(false);
    expect(isAnnualGuidance("KẾ HOẠCH tổ chức kỳ thi Olympic tháng 4", "olympic.pdf")).toBe(false);
  });
});

describe("làm sạch chữ", () => {
  it("giữ dấu nối giữa hai năm", () => {
    expect(clean("năm học 2026 - 2027")).toBe("năm học 2026-2027");
    expect(clean("giai đoạn 2021 – 2030")).toBe("giai đoạn 2021-2030");
  });
});

describe("tên nguồn ngắn trên bản in", () => {
  it("rút gọn tên tệp công văn", () => {
    expect(shortSource("10293-huong-dan-chuyen-mon-gdpt-nam-hoc-2026-20272992026_110202616.pdf")).toBe(
      "CV 10293",
    );
    expect(shortSource("504cv-trien-khai-thuc-hien-nhiem-vu-nam-hoc-2026-2027_310202610.pdf")).toBe("CV 504");
    expect(shortSource("Nhập thủ công")).toBe("Nhập thủ công");
    expect(shortSource("ke-hoach-thang-10-to-toan.docx")).toBe("ke hoach thang 10 to toan");
  });
});
