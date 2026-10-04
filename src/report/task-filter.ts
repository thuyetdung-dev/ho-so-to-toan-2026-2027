/**
 * Lọc đầu việc theo phạm vi thật của giáo viên THPT trong một tổ bộ môn,
 * và nhận ra văn bản định hướng cả năm học (không nên tách thành việc của một tháng).
 * Hàm thuần, kiểm thử được; dùng chung cho kết quả nhận diện theo quy tắc và bằng AI.
 */
import type { Task } from "./types";

export type SubjectFilter = "toan" | "all";

export type FilterOptions = {
  /** Chỉ giữ việc của cấp THPT (bỏ việc riêng của tiểu học, THCS, mầm non). Mặc định bật. */
  thptOnly?: boolean;
  /** Bỏ việc gắn riêng với môn học khác. "all" = không lọc theo môn. */
  subject?: SubjectFilter;
};

export type RemovedTask = { task: Task; reason: string };
export type FilterResult = { kept: Task[]; removed: RemovedTask[] };

const THPT_RE =
  /(?<!\p{L})(?:thpt|trung học phổ thông|lớp\s*1[0-2]|khối\s*1[0-2]|tốt nghiệp|cuối cấp|trường phổ thông có nhiều cấp học|giáo dục phổ thông)(?!\p{L})/iu;
const LOWER_LEVEL_RE = /(?<!\p{L})(?:tiểu học|mầm non|trung học cơ sở|thcs|lớp\s*[1-9](?!\d))(?!\p{L})/iu;

/**
 * Môn học khác (khi lọc cho tổ Toán). Câu nói chung "các môn học" thì vẫn giữ.
 * Tên dễ nhầm với từ thường ("lịch sử", "công nghệ thông tin") chỉ tính khi có chữ "môn" đứng trước.
 */
const OTHER_SUBJECT_RE =
  /(?<!\p{L})(?:âm nhạc|mĩ thuật|mỹ thuật|(?<!ứng dụng )(?<!năng lực )tin học|ngoại ngữ|tiếng anh|tiếng nhật|tiếng trung|tiếng hàn|tiếng pháp|ngữ văn|vật lí|vật lý|hóa học|hoá học|giáo dục thể chất|giáo dục kinh tế và pháp luật|gdktpl|coding|blockchain|môn (?:lịch sử|địa lí|địa lý|sinh học|công nghệ|thể dục))(?!\p{L})/iu;
const ALL_SUBJECTS_RE =
  /(?<!\p{L})(?:các môn học|mọi môn|tất cả (?:các )?môn|môn toán|toán học|liên môn|từng môn)(?!\p{L})/iu;

/** Việc của cấp quản lý trên trường (Sở, phòng thuộc Sở) lọt qua bộ lọc câu. */
const UPPER_MANAGEMENT_RE =
  /(?:thuộc thẩm quyền quản lý|chỉ đạo các (?:cơ sở giáo dục|trường|đơn vị)|kiểm tra, giám sát, chỉ đạo|phối hợp chặt chẽ với sở|các phòng giáo dục|ủy ban nhân dân (?:quận|huyện|xã|phường))/iu;

/** Câu kết thường gặp cuối công văn: không phải một việc cụ thể. */
const CLOSING_RE =
  /^(?:(?:sở gdđt|sở giáo dục và đào tạo|sở gd&đt|nhà trường|ban giám hiệu|hiệu trưởng)\s+)?(?:đề nghị (?:các|toàn thể|quý|hiệu trưởng|thủ trưởng)|trong quá trình (?:triển khai |tổ chức )?thực hiện,? nếu có|trên đây là|nhận được (?:công văn|văn bản) này)/iu;

/** Mẩu câu bị cắt khi PDF sang trang: mở đầu bằng chữ thường, hoặc bằng "2026, …". */
function isFragment(work: string) {
  const w = work.trim();
  return /^\p{Ll}/u.test(w) || /^\d{4}\s*,/.test(w) || /^[,;.)\]]/.test(w);
}

export function scopeReason(task: Task, o: FilterOptions = {}): string | null {
  const text = `${task.work} ${task.target || ""}`;
  if (isFragment(task.work)) return "Mẩu câu bị cắt khi sang trang";
  if (CLOSING_RE.test(task.work.trim())) return "Câu kết của văn bản";
  if (UPPER_MANAGEMENT_RE.test(text)) return "Việc của Sở/cấp quản lý";
  if ((o.thptOnly ?? true) && LOWER_LEVEL_RE.test(text) && !THPT_RE.test(text)) return "Không thuộc cấp THPT";
  if ((o.subject ?? "toan") === "toan" && OTHER_SUBJECT_RE.test(text) && !ALL_SUBJECTS_RE.test(text))
    return "Riêng cho môn học khác";
  return null;
}

/**
 * Ghép lại câu bị PDF cắt đôi: đầu việc mở đầu bằng chữ thường được nối vào đầu việc ngay trước
 * khi đầu việc trước chưa kết thúc câu (vd. "… (Trong, ngoài nhà trường," + "trải nghiệm, … câu lạc bộ…).").
 */
export function mergeFragments(tasks: Task[]): Task[] {
  const out: Task[] = [];
  for (const t of tasks) {
    const prev = out[out.length - 1];
    if (prev && /^\p{Ll}/u.test(t.work.trim()) && !/[.!?…]\)?\s*$/u.test(prev.work.trim())) {
      out[out.length - 1] = { ...prev, work: `${prev.work.trim()} ${t.work.trim()}` };
      continue;
    }
    out.push(t);
  }
  return out;
}

export function filterTaskScope(tasks: Task[], o: FilterOptions = {}): FilterResult {
  const kept: Task[] = [];
  const removed: RemovedTask[] = [];
  for (const task of mergeFragments(tasks)) {
    const reason = scopeReason(task, o);
    if (reason) removed.push({ task, reason });
    else kept.push(task);
  }
  return { kept, removed };
}

/**
 * Văn bản định hướng cả năm học: hướng dẫn chuyên môn, hướng dẫn/triển khai nhiệm vụ năm học,
 * kế hoạch năm học… Các câu trong đó là định hướng, không phải việc của một tháng cụ thể.
 */
export function isAnnualGuidance(text: string, fileName = ""): boolean {
  const head = `${fileName.replace(/[-_]+/g, " ")}\n${text.slice(0, 2500)}`.toLowerCase().normalize("NFC");
  const yearSpan = /năm học\s*20\d{2}\s*[-–]?\s*20\d{2}/u.test(head);
  const guidance =
    /(hướng dẫn (?:thực hiện )?(?:công tác |nhiệm vụ )?(?:chuyên môn|nhiệm vụ)|triển khai (?:thực hiện )?nhiệm vụ|nhiệm vụ năm học|kế hoạch (?:giáo dục |hoạt động )?năm học|kế hoạch giáo dục (?:của )?nhà trường)/u.test(
      head,
    );
  const monthPlan = /kế hoạch (?:hoạt động |công tác )?tháng\s*\d{1,2}/u.test(head);
  return yearSpan && guidance && !monthPlan;
}
