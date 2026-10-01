import type { DepartmentPlan, ReportSnapshot } from "../types";
export interface DocumentModel {
  title: string;
  school: string;
  department: string;
  subtitle: string;
  status: string;
  author: string;
  sections: {
    title: string;
    text?: string;
    headers?: string[];
    rows?: string[][];
  }[];
}
const states = {
  draft: "Bản nháp",
  submitted: "Chờ duyệt",
  approved: "Đã duyệt",
  returned: "Trả lại để điều chỉnh",
};
export function planDocument(
  p: DepartmentPlan,
  c: { schoolName: string; departmentName: string },
): DocumentModel {
  return {
    title: p.title,
    school: c.schoolName,
    department: c.departmentName,
    subtitle: `Năm học ${p.academicYear}`,
    status: `${states[p.status]} · Phiên bản ${p.version}${p.approvedBy && p.status === "approved" ? ` · Người duyệt: ${p.approvedBy}` : ""}`,
    author: p.createdBy,
    sections: [
      { title: "Nội dung kế hoạch", text: p.generalSituation },
      {
        title: "Công việc và phân công",
        headers: [
          "STT",
          "Nội dung / nhóm",
          "Người phụ trách",
          "Thời hạn",
          "Sản phẩm",
          "Minh chứng",
          "Trạng thái",
        ],
        rows: (p.tasks || []).map((t, i) => [
          String(i + 1),
          [t.title, t.category].filter(Boolean).join("\n"),
          t.assignee,
          t.deadline || t.deadlineText || "",
          t.product,
          t.evidence,
          {
            pending: "Chưa làm",
            in_progress: "Đang làm",
            completed: "Hoàn thành",
          }[t.status],
        ]),
      },
      {
        title: "Chỉ tiêu và kết quả",
        headers: ["Nội dung", "Chỉ tiêu", "Thực hiện", "Đơn vị", "Minh chứng"],
        rows: (p.indicators || []).map((t) => [
          t.title,
          t.target,
          t.actual,
          t.unit,
          t.evidence,
        ]),
      },
    ],
  };
}
export function reportDocument(
  p: Pick<
    ReportSnapshot,
    | "title"
    | "academicYear"
    | "startDate"
    | "endDate"
    | "isLocked"
    | "metrics"
    | "executiveSummary"
    | "advantages"
    | "limitations"
    | "futureDirections"
    | "finalizedBy"
    | "evidence"
  >,
  c: { schoolName: string; departmentName: string },
): DocumentModel {
  const labels: Record<string, string> = {
    membersCount: "Thành viên",
    meetingsCount: "Cuộc họp đã chốt",
    lessonStudyCount: "Nghiên cứu bài học",
    observationsCount: "Lượt dự giờ",
    plansCount: "Giáo án",
    approvedPlansCount: "Giáo án đã duyệt",
    specialTopicsCount: "Chuyên đề",
  };
  return {
    title: p.title,
    school: c.schoolName,
    department: c.departmentName,
    subtitle: `Năm học ${p.academicYear} · Từ ${p.startDate || "chưa khai báo"} đến ${p.endDate || "chưa khai báo"}`,
    status: p.isLocked ? "Báo cáo đã chốt" : "Báo cáo nháp",
    author: p.finalizedBy,
    sections: [
      {
        title: "I. Số liệu tổng hợp",
        headers: ["Nội dung", "Số lượng"],
        rows: Object.entries(p.metrics)
          .filter(([k]) => k in labels)
          .map(([k, v]) => [labels[k], String(v)]),
      },
      ...Object.entries({
        "II. Kết quả thực hiện": p.executiveSummary,
        "III. Thuận lợi": p.advantages,
        "IV. Hạn chế": p.limitations,
        "V. Phương hướng": p.futureDirections,
      }).map(([title, text]) => ({ title, text })),
      {
        title: "Danh sách mã minh chứng đã lưu",
        text: p.evidence
          ? Object.entries(p.evidence)
              .map(
                ([k, v]) =>
                  `${({ meetings: "Biên bản", observations: "Dự giờ", lessonPlans: "Giáo án", specialTopics: "Chuyên đề" } as Record<string, string>)[k]}: ${v.join(", ") || "Không có"}`,
              )
              .join("\n")
          : "Bản báo cáo chưa lưu danh sách minh chứng.",
      },
    ],
  };
}
