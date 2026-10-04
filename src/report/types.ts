export type TaskStatus = "Chưa làm" | "Đang thực hiện" | "Hoàn thành";
export const TASK_STATUSES: TaskStatus[] = ["Chưa làm", "Đang thực hiện", "Hoàn thành"];

export type Task = {
  id: string;
  time: string;
  work: string;
  source: string;
  status: TaskStatus;
  /** Người/nhóm được văn bản giao thực hiện. */
  target?: string;
  /** Độ tin cậy khi nhận diện tự động (0–100). Không có = nhập tay. */
  confidence?: number;
  /** Ngày thực hiện cụ thể (yyyy-mm-dd) */
  date?: string;
  /** Giờ, vd. "08g00" */
  clock?: string;
  /** true = ngày do phần mềm tự xếp vì văn bản không ghi ngày (cần kiểm tra lại) */
  auto?: boolean;
  /** Integration 1.0: liên kết ngược về công việc trong App KPI. */
  integration?: {
    source: "kpi";
    kpiTaskId: string;
    kpiMemberId?: string;
    kpiMemberName?: string;
    kpiMemberEmail?: string;
    deadline?: string;
    linkedAt: string;
  };
};

export type Source = { name: string; size: string; lines: number };

export type Role = "Giáo viên" | "Tổ trưởng";

export type UserInfo = { id: string; name: string; email: string; role: Role };

export type ReportTemplate = "admin" | "notebook";

/** Nội dung báo cáo được lưu trong cột reports.payload */
export type ReportPayload = {
  sources: Source[];
  tasks: Task[];
  name: string;
  school: string;
  department: string;
  agency: string;
  place: string;
  template: ReportTemplate;
  selfAssessment: string;
  proposals: string;
  /** Có làm việc thứ Bảy (dùng khi tự xếp ngày) */
  workSaturday: boolean;
  /** Tên tổ trưởng ký ô xác nhận (mẫu hành chính) */
  headName?: string;
};

export type ReportStatus = "none" | "draft" | "submitted" | "approved" | "returned";

export type ReportMeta = {
  id: number | null;
  status: ReportStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string | null;
  /** V2.2: phiên bản server dùng phát hiện xung đột đa thiết bị */
  revision: number;
};

export const STATUS_LABEL: Record<ReportStatus, string> = {
  none: "Chưa có báo cáo",
  draft: "Đang soạn",
  submitted: "Đã nộp – chờ duyệt",
  approved: "Đã duyệt",
  returned: "Bị trả lại – cần sửa",
};

export function isEditable(status: ReportStatus) {
  return status === "none" || status === "draft" || status === "returned";
}

export type Period = { month: string; year: string };
