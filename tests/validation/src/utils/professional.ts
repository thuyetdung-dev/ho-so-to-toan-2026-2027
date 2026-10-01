import type { ProfessionalTask, ProfessionalIndicator } from "../types";
import type { Grid } from "./planImport";
import { newId } from "./ids";
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
export function parseDeadline(value: string): string {
  const s = value.trim();
  if ((s.match(/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/g) || []).length > 1) return "";
  let match = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  let year = "",
    month = "",
    day = "";
  if (match) [, year, month, day] = match;
  else {
    match = s.match(/(?:^|\b)(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:$|\b)/);
    if (match) [, day, month, year] = match;
    else {
      match = normalize(s).match(
        /ngay\s+(\d{1,2})\s+thang\s+(\d{1,2})\s+nam\s+(\d{4})/,
      );
      if (match) [, day, month, year] = match;
    }
  }
  if (!year) return "";
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
    ? date
    : "";
}
export function taskKey(
  t: Pick<ProfessionalTask, "title" | "assignee" | "deadline"> & {
    deadlineText?: string;
  },
) {
  return [t.title, t.assignee, t.deadline || t.deadlineText || ""]
    .map(normalize)
    .join("|");
}
export function mergeTasks(
  current: ProfessionalTask[],
  incoming: ProfessionalTask[],
) {
  const keys = new Set(current.map(taskKey));
  const accepted: ProfessionalTask[] = [];
  let duplicates = 0;
  incoming.forEach((t) => {
    const key = taskKey(t);
    if (keys.has(key)) duplicates++;
    else {
      keys.add(key);
      accepted.push(t);
    }
  });
  return { tasks: [...current, ...accepted], duplicates };
}
export function taskStats(
  tasks: ProfessionalTask[],
  today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }),
) {
  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter(
      (t) => t.status !== "completed" && t.deadline && t.deadline < today,
    ).length,
    missingEvidence: tasks.filter(
      (t) => t.status === "completed" && !t.evidence.trim(),
    ).length,
  };
}
const fields: Record<string, string[]> = {
  title: ["cong viec", "noi dung", "nhiem vu", "hoat dong", "ten cong viec"],
  assignee: [
    "nguoi thuc hien",
    "nguoi phu trach",
    "phu trach",
    "giao vien",
    "phan cong",
  ],
  deadline: [
    "thoi han",
    "han",
    "han hoan thanh",
    "ngay hoan thanh",
    "thoi gian",
  ],
  product: ["san pham", "san pham can nop", "dau ra"],
  evidence: ["minh chung", "ket qua", "lien ket minh chung"],
  category: ["nhom", "loai", "linh vuc"],
  target: ["chi tieu", "muc tieu", "muc tieu can dat"],
  actual: ["thuc hien", "ket qua thuc hien"],
  unit: ["don vi"],
};
export interface StructuredImport {
  tasks: ProfessionalTask[];
  indicators: ProfessionalIndicator[];
  issues: { row: number; reason: string }[];
  recognized: boolean;
}
export function parseProfessionalGrid(
  grid: Grid,
  source: string,
  tableIndex: number,
): StructuredImport {
  const out: StructuredImport = {
    tasks: [],
    indicators: [],
    issues: [],
    recognized: false,
  };
  if (grid.rows.length > 2001) {
    out.issues.push({
      row: 1,
      reason:
        "Bảng vượt 2.000 dòng dữ liệu; hãy tách bảng trước khi tạo công việc/chỉ tiêu.",
    });
    return out;
  }
  let columns: Record<string, number> = {};
  let header = -1;
  for (let i = 0; i < Math.min(grid.rows.length, 12); i++) {
    const map: Record<string, number> = {};
    grid.rows[i].forEach((cell, c) => {
      const n = normalize(cell);
      for (const [field, names] of Object.entries(fields))
        if (names.includes(n)) map[field] = c;
    });
    if (
      map.title !== undefined &&
      (map.assignee !== undefined ||
        map.deadline !== undefined ||
        map.product !== undefined ||
        map.target !== undefined)
    ) {
      columns = map;
      header = i;
      break;
    }
  }
  if (header < 0) return out;
  out.recognized = true;
  const cell = (row: string[], field: string) =>
    row[columns[field]]?.trim() || "";
  const seen = new Set<string>();
  for (let i = header + 1; i < grid.rows.length; i++) {
    const row = grid.rows[i];
    if (!row.some((c) => c.trim())) continue;
    const title = cell(row, "title");
    if (!title) {
      out.issues.push({
        row: i + 1,
        reason: "Thiếu nội dung công việc/chỉ tiêu",
      });
      continue;
    }
    if (
      /^(cong van|thong tu|nghi dinh|quyet dinh)\s+(so\s+)?\d/.test(
        normalize(title),
      ) &&
      !cell(row, "assignee") &&
      !cell(row, "product")
    ) {
      out.issues.push({
        row: i + 1,
        reason: "Căn cứ pháp lý, không tự tách thành đầu việc",
      });
      continue;
    }
    const provenance = { fileName: source, table: tableIndex + 1, row: i + 1 };
    if (columns.target !== undefined) {
      out.indicators.push({
        id: newId("indicator"),
        title,
        target: cell(row, "target"),
        actual: cell(row, "actual"),
        unit: cell(row, "unit"),
        evidence: cell(row, "evidence"),
        source: provenance,
      });
      continue;
    }
    const deadlineText = cell(row, "deadline");
    const deadline = parseDeadline(deadlineText);
    const t: ProfessionalTask = {
      id: newId("task"),
      title,
      assignee: cell(row, "assignee"),
      deadline,
      deadlineText,
      product: cell(row, "product"),
      evidence: cell(row, "evidence"),
      category: cell(row, "category") || "Công việc chung",
      status: "pending",
      source: provenance,
    };
    if (deadlineText && !deadline)
      out.issues.push({
        row: i + 1,
        reason:
          "Chưa xác định được ngày đầy đủ; giữ nguyên thời hạn chữ để rà soát",
      });
    if (seen.has(taskKey(t))) {
      out.issues.push({
        row: i + 1,
        reason: "Dòng trùng trong bảng, đã bỏ qua",
      });
      continue;
    }
    seen.add(taskKey(t));
    out.tasks.push(t);
  }
  return out;
}
export function validateStructured(plan: {
  tasks?: ProfessionalTask[];
  indicators?: ProfessionalIndicator[];
}) {
  const errors: string[] = [];
  for (const [i, t] of (plan.tasks || []).entries()) {
    if (!t.title.trim()) errors.push(`Công việc ${i + 1} thiếu nội dung`);
    if (t.deadline && parseDeadline(t.deadline) !== t.deadline)
      errors.push(`Công việc ${i + 1} có ngày không hợp lệ`);
    if (
      t.evidence &&
      !/^https?:\/\//i.test(t.evidence) &&
      t.evidence.length > 4000
    )
      errors.push(`Minh chứng công việc ${i + 1} quá dài`);
  }
  for (const [i, t] of (plan.indicators || []).entries())
    if (!t.title.trim()) errors.push(`Chỉ tiêu ${i + 1} thiếu nội dung`);
  return errors;
}
