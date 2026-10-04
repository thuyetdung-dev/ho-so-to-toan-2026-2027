import { countStats } from "./tasks";
import { sortByDate, timeLabel } from "./schedule";
import type { Period, ReportPayload } from "./types";

/**
 * Mô hình nội dung báo cáo dùng chung cho bản xem trước (HTML/in PDF) và file Word,
 * để hai bản luôn giống nhau.
 */
export type Block =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string; italic?: boolean }
  | { kind: "table"; head: string[]; rows: string[][]; widths: number[] }
  | { kind: "bullets"; items: string[] }
  | { kind: "checklist"; items: string[] };

export type ReportModel = {
  template: ReportPayload["template"];
  /** Chỉ dùng với mẫu hành chính */
  letterhead: { left: string[]; right: string[]; dateLine: string };
  /** Chỉ dùng với mẫu sổ tay: trang bìa */
  cover: string[];
  title: string[];
  blocks: Block[];
  signature: { left?: { title: string; name: string }; right: { title: string; note: string; name: string } };
  fileName: string;
};

const PLACEHOLDER = "…".repeat(30);

/**
 * Tên nguồn ngắn cho bản in: "10293-huong-dan-chuyen-mon-….pdf" → "CV 10293";
 * tên tệp khác bỏ phần mở rộng và rút gọn để cột "Nguồn" không chiếm nhiều dòng.
 */
export function shortSource(source: string) {
  const s = (source || "").trim();
  if (!/\.(pdf|docx?|xlsx?|txt|csv|jpe?g|png|webp|heic|tiff?)$/i.test(s)) return s;
  const num = /^(\d{2,6})(?=[-_ ]|cv|kh|qd|tb)/i.exec(s);
  if (num) return `CV ${num[1]}`;
  const base = s
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return base.length > 28 ? base.slice(0, 26).trimEnd() + "…" : base;
}

export function vietnameseDateLine(place: string, date: Date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${place || "………"}, ngày ${d} tháng ${m} năm ${date.getFullYear()}`;
}

function multiline(text: string): Block[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length
    ? lines.map((t) => ({ kind: "para", text: t }))
    : [
        { kind: "para", text: PLACEHOLDER },
        { kind: "para", text: PLACEHOLDER },
      ];
}

/** Tên file không dấu, không ký tự đặc biệt (một số trình duyệt bỏ qua tên file có dấu tiếng Việt). */
export function safeFilePart(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^A-Za-z0-9 _-]+/g, "")
      .trim()
      .replace(/\s+/g, "_") || "Bao_cao"
  );
}

export function buildReportModel(p: ReportPayload, period: Period, today = new Date()): ReportModel {
  const { month, year } = period;
  const stats = countStats(p.tasks);
  // Kế hoạch cá nhân: theo thứ tự ngày, mỗi việc ghi rõ thứ, ngày, giờ
  const ordered = sortByDate(p.tasks);
  const completed = ordered.filter((t) => t.status === "Hoàn thành");
  const pending = ordered.filter((t) => t.status !== "Hoàn thành");
  const dept = p.department || "Tổ chuyên môn";

  const overview: Block = {
    kind: "table",
    head: ["Tổng đầu việc", "Hoàn thành", "Đang thực hiện", "Chưa làm"],
    rows: [[stats.all, stats.done, stats.doing, stats.todo].map(String)],
    widths: [25, 25, 25, 25],
  };

  const fileName = `Bao_cao_thang_${month}_${year}_${safeFilePart(p.name)}`;

  if (p.template === "notebook") {
    return {
      template: "notebook",
      letterhead: { left: [], right: [], dateLine: "" },
      cover: ["SỔ TAY VÀ BÁO CÁO CÔNG VIỆC", `THÁNG ${month} NĂM ${year}`, `Giáo viên: ${p.name}`, p.school],
      title: [],
      blocks: [
        { kind: "heading", text: "Mục đích sử dụng" },
        {
          kind: "para",
          text: "Tài liệu tự động tổng hợp các đầu việc từ hồ sơ đã tải lên, giúp theo dõi tiến độ, lưu minh chứng và chốt báo cáo công việc theo tháng.",
        },
        { kind: "heading", text: "Tổng quan tháng" },
        overview,
        { kind: "heading", text: `Kế hoạch chi tiết tháng ${month} năm ${year}` },
        {
          kind: "table",
          head: ["Ngày thực hiện", "Đầu việc", "Đối tượng", "Nguồn", "Trạng thái"],
          rows: ordered.map((t) => [
            timeLabel(t),
            t.work,
            t.target || "Cấp trường",
            shortSource(t.source),
            t.status,
          ]),
          widths: [18, 40, 14, 14, 14],
        },
        { kind: "heading", text: "Kết quả đã hoàn thành" },
        completed.length
          ? { kind: "bullets", items: completed.map((t) => t.work) }
          : { kind: "para", text: "Chưa có đầu việc được đánh dấu hoàn thành." },
        { kind: "heading", text: "Công việc cần tiếp tục" },
        // Chưa có việc nào xong: không in lại nguyên bảng kế hoạch chi tiết ở trên
        pending.length && pending.length === p.tasks.length
          ? {
              kind: "para",
              text: `Toàn bộ ${pending.length} đầu việc trong kế hoạch chi tiết ở trên chưa hoàn thành, cần tiếp tục thực hiện.`,
            }
          : pending.length
            ? {
                kind: "table",
                head: ["Ngày thực hiện", "Công việc", "Đối tượng", "Trạng thái"],
                rows: pending.map((t) => [timeLabel(t), t.work, t.target || "Cấp trường", t.status]),
                widths: [20, 46, 16, 18],
              }
            : { kind: "para", text: "Không còn công việc tồn đọng." },
        ...(p.selfAssessment.trim()
          ? [{ kind: "heading", text: "Tự đánh giá" } as Block, ...multiline(p.selfAssessment)]
          : []),
        ...(p.proposals.trim()
          ? [{ kind: "heading", text: "Đề xuất, kiến nghị" } as Block, ...multiline(p.proposals)]
          : []),
        { kind: "heading", text: "Phiếu chốt cuối tháng" },
        {
          kind: "checklist",
          items: [
            "Các công việc đến hạn đã hoàn thành hoặc có giải trình.",
            "Sản phẩm và minh chứng đã được lưu đúng thư mục.",
            "Hồ sơ chuyên môn và báo cáo đã cập nhật.",
            "Nhiệm vụ chuyển tiếp đã được ghi nhận.",
          ],
        },
      ],
      signature: { right: { title: "NGƯỜI LẬP", note: "(Ký và ghi rõ họ tên)", name: p.name } },
      fileName: `So_tay_${fileName}`,
    };
  }

  // Mẫu hành chính (thể thức văn bản: quốc hiệu, tiêu ngữ, địa danh – ngày tháng)
  return {
    template: "admin",
    letterhead: {
      left: [p.agency.toUpperCase(), p.school.toUpperCase(), dept.toUpperCase()].filter(Boolean),
      right: ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc"],
      dateLine: vietnameseDateLine(p.place, today),
    },
    cover: [],
    title: ["BÁO CÁO", `Kết quả thực hiện nhiệm vụ tháng ${month} năm ${year}`],
    blocks: [
      { kind: "para", text: `Họ và tên: ${p.name}` },
      { kind: "para", text: `Đơn vị: ${dept} – ${p.school}` },
      { kind: "heading", text: "I. TỔNG QUAN" },
      overview,
      { kind: "heading", text: "II. KẾT QUẢ THỰC HIỆN NHIỆM VỤ" },
      p.tasks.length
        ? {
            kind: "table",
            head: ["STT", "Ngày thực hiện", "Nội dung công việc", "Đối tượng", "Kết quả"],
            rows: ordered.map((t, i) => [
              String(i + 1),
              timeLabel(t),
              t.work,
              t.target || "Cấp trường",
              t.status,
            ]),
            widths: [6, 18, 46, 14, 16],
          }
        : { kind: "para", text: "Chưa có đầu việc." },
      { kind: "heading", text: "III. CÔNG VIỆC CHUYỂN TIẾP" },
      // Chưa có việc nào xong: không in lại nguyên bảng mục II
      pending.length && pending.length === p.tasks.length
        ? {
            kind: "para",
            text: `Toàn bộ ${pending.length} đầu việc ở mục II chưa hoàn thành, được chuyển tiếp sang tháng sau.`,
          }
        : pending.length
          ? {
              kind: "table",
              head: ["STT", "Ngày thực hiện", "Công việc", "Đối tượng", "Tình trạng"],
              rows: pending.map((t, i) => [
                String(i + 1),
                timeLabel(t),
                t.work,
                t.target || "Cấp trường",
                t.status,
              ]),
              widths: [6, 18, 46, 14, 16],
            }
          : { kind: "para", text: "Đã hoàn thành toàn bộ công việc trong tháng." },
      { kind: "heading", text: "IV. TỰ ĐÁNH GIÁ" },
      ...multiline(p.selfAssessment),
      { kind: "heading", text: "V. ĐỀ XUẤT, KIẾN NGHỊ" },
      ...multiline(p.proposals),
    ],
    signature: {
      left: { title: "XÁC NHẬN CỦA TỔ TRƯỞNG", name: p.headName || "" },
      right: { title: "NGƯỜI BÁO CÁO", note: "(Ký và ghi rõ họ tên)", name: p.name },
    },
    fileName,
  };
}
