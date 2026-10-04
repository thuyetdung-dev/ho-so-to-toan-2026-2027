import type { ReportPayload, Task, TaskStatus } from "./types";
import { TASK_STATUSES } from "./types";
import { CELL_SEP, ROW_MARK } from "./pdf-layout";

const CLOCK = String.raw`\d{1,2}\s*[gh]\s*\d{0,2}`;
// Ngày dạng 05/09, 05/09/2026 hoặc 05-09-2026 (không nhận "8-10", "tiết 3-4" là ngày)
const DAY_MONTH = String.raw`\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?!\d)|\d{1,2}[-–]\d{1,2}[-–]\d{2,4}(?!\d)`;
const LONG_DATE = String.raw`\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}`;
const DATE_VALUE = String.raw`(?:${DAY_MONTH}|${LONG_DATE})`;
const DATE_PATTERN = new RegExp(
  String.raw`((?:(?:trước|đến|từ|ngày|tuần|tháng|trong tháng|cuối tháng|chậm nhất|hạn chót|vào|là|lúc)\s*)*(?:${DATE_VALUE})(?:\s*,?\s*(?:lúc\s*)?${CLOCK})?|(?:lúc\s*)?${CLOCK}(?=\s|:|,|$)|trong tháng\s*\d{1,2}(?!\s*[/–-]))`,
  "iu",
);
/** Dòng không phải đầu việc: tiêu đề viết HOA, căn cứ, lời chào, nơi nhận… */
const NOISE_PATTERN =
  /^(căn cứ|kính gửi|trân trọng|nơi nhận|số:|số \d|v\/v|ghi chú|độc lập|cộng hòa|cộng hoà|kt\.|tm\.|hiệu trưởng|phó hiệu trưởng|trên đây là|\(.*\)$)|,\s*ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}/iu;

// ---------------------------------------------------------------- Người thực hiện
const w = (x: string) => String.raw`(?<![\p{L}])(?:${x})(?![\p{L}])`;
/** Chỉ dành cho lãnh đạo, quản lý */
const LEADER_RE = new RegExp(
  w("(?:phó\\s+)?hiệu trưởng|ban giám hiệu|bgh|cán bộ quản lý|cbql|ql|lãnh đạo"),
  "iu",
);
/** Giáo viên, nhân viên, văn phòng, tổ chuyên môn */
const STAFF_RE = new RegExp(
  w(
    "giáo viên|gv|viên chức|người lao động|nlđ|nhân viên|văn phòng|tổ trưởng|tổ phó|tổ chuyên môn|tổ viên|toàn thể|công nhân viên|cnv|ttcm|tổ vp|kế toán|thủ quỹ|văn thư|thư viện|thiết bị|y tế|giám thị|bảo vệ",
  ),
  "iu",
);
export type Audience = "leader" | "staff" | "unknown";
/** Xác định đối tượng thực hiện của một đoạn chữ (người thực hiện/nhãn/câu). */
/** Người thực hiện là chủ ngữ đứng đầu câu: vai trò được nhắc tới đầu tiên ("Hiệu trưởng phân công viên chức…" → lãnh đạo). */
export function subjectOf(text: string): Audience {
  const s = LEADER_RE.exec(text);
  const t = STAFF_RE.exec(text);
  if (!s && !t) return "unknown";
  if (s && (!t || s.index < t.index)) return "leader";
  return "staff";
}
export function audienceOf(text: string): Audience {
  if (STAFF_RE.test(text)) return "staff";
  if (LEADER_RE.test(text)) return "leader";
  return "unknown";
}
export type ExtractOptions = {
  /** Chỉ giữ đầu việc thuộc phạm vi cấp trường; tên cũ được giữ để tương thích dữ liệu/giao diện cũ. */
  staffOnly?: boolean;
  /** Chỉ giữ nhiệm vụ giáo viên/nhân viên có thể trực tiếp thực hiện. */
  teacherOnly?: boolean;
};

const SCHOOL_UNIT_RE =
  /(?:các?\s+)?(?:trường\s+(?:thpt|trung học|phổ thông)|cơ sở giáo dục|đơn vị dự thi|nhà trường|trung tâm\s+(?:gdtx|gdnn\s*[-–]\s*gdtx)|ban giám hiệu|hiệu trưởng|phó hiệu trưởng|giáo viên|nhân viên|tổ chuyên môn|tổ trưởng|tổ phó|văn phòng trường)/iu;
const UPPER_UNIT_RE =
  /(?:sở\s+gd(?:đ|d)t|sở\s+giáo dục|phòng\s+(?:gdpt|gdtx|giáo dục|tổ chức cán bộ|kế hoạch\s*[-–]\s*tài chính|kiểm tra\s*[-–]\s*pháp chế|quản lý|học sinh)|văn phòng sở|giám đốc sở|ủy ban nhân dân|hội đồng nhân dân|điểm (?:coi )?thi|điểm chấm thi|ban (?:chỉ đạo|ra đề|làm phách|coi thi|chấm thi)(?!\s+của trường))/iu;
const LEGAL_REFERENCE_RE =
  /^(?:theo\s+)?(?:căn cứ|nghị quyết|quyết định|thông tư|chỉ thị|công văn|luật|nghị định|hướng dẫn)\s+(?:số\s*)?[\d/.-]+/iu;

function isLegalReference(text: string) {
  const s = clean(text).replace(/^\d+\s+/, "");
  return (
    LEGAL_REFERENCE_RE.test(s) ||
    /(?:nghị quyết|quyết định|thông tư|chỉ thị|công văn)\s+số\s+[\d/.-]+[^.!?]*(?:quy định|ban hành|hướng dẫn)/iu.test(
      s,
    )
  );
}

function schoolScopedWork(work: string, performer = ""): string | null {
  // Tiêu đề đơn vị dài trong PDF đôi khi dính vào câu đầu tiên của mục phân công.
  const actual = /các đơn vị (?:có thí sinh|có giáo viên)\b/iu.exec(work);
  if (actual && actual.index > 0) work = capitalize(work.slice(actual.index));
  const who = clean(performer);
  if (who && UPPER_UNIT_RE.test(who) && !SCHOOL_UNIT_RE.test(who)) return null;
  if (who && SCHOOL_UNIT_RE.test(who) && !UPPER_UNIT_RE.test(who)) return work;
  if (!UPPER_UNIT_RE.test(work)) return work;
  const parts = work
    .replace(/\s+[-–]\s+[^.]+\.?$/, "")
    .split(/;\s+|(?<=[.!?])\s+/u)
    .map(clean)
    .filter(Boolean);
  const school = parts.filter((p) => SCHOOL_UNIT_RE.test(p) && !isLegalReference(p));
  if (school.length) return school.map((p) => capitalize(trimEnd(p))).join("; ") + ".";
  return SCHOOL_UNIT_RE.test(work) ? work : null;
}
/** Dấu đầu mục: -, +, •, 1., 1), a), I. … */
const LIST_MARKER = /^([-–+•*●○▪➢➤►]|\d{1,2}(\.\d{1,2})*[.)]|[a-zđ][.)]|[IVX]{1,4}[.)])\s/iu;
const MAX_BLOCK = 700;
function isHeading(line: string) {
  const letters = line.replace(/[^\p{L}]/gu, "");
  return letters.length >= 6 && letters === letters.toUpperCase();
}
const ACTION_WORDS =
  "hoàn thành|thực hiện|tham gia|tham khảo|cụ thể hóa|thống nhất|chuẩn bị|rà soát|nộp|cập nhật|tổ chức|chốt|báo cáo|đánh giá|xây dựng|triển khai|dạy|kiểm tra|họp|bồi dưỡng|ôn tập|soạn|chấm|dự giờ|sinh hoạt|xác định|xác nhận|phân công|hướng dẫn|theo dõi|đôn đốc|tổng hợp|nhận xét|đề xuất|phối hợp|lập biên bản|lập danh sách|lập danh mục|lập kế hoạch|gửi|lưu trữ|thông báo|công khai|nghiên cứu|chỉ đạo|chịu trách nhiệm|hỗ trợ|tự đánh giá|ra đề|in sao|duyệt|phê duyệt|quán triệt|phổ biến|giám sát|đăng ký|cung cấp|trả bài|coi thi|coi kiểm tra|phụ trách|đầu mối|trả lại";
const ACTION_PATTERN = new RegExp(ACTION_WORDS, "iu");
/** Ý bắt đầu bằng động từ công việc (để phân biệt việc cần làm với câu mô tả tiêu chí) */
const STARTS_WITH_ACTION = new RegExp(
  `^(?:chủ động\\s+|kịp thời\\s+|trực tiếp\\s+|thường xuyên\\s+|định kỳ\\s+)?(?:${ACTION_WORDS})`,
  "iu",
);
/** Tách câu: sau dấu . ! ? ; và trước chữ HOA hoặc chữ số (hỗ trợ chữ có dấu tiếng Việt). */
const SENTENCE_SPLIT = /\n+|(?<=[.!?])\s+(?=[\p{Lu}0-9])/u;
const MAX_TASKS = 300;

// ---------------------------------------------------------------- Mục, tiểu mục của văn bản
const H1_MARK = "§H1§ ";
const ROLE_MARK = "§ROLE§ ";
const TOPIC_MARK = "§TOPIC§ ";
const ORG_MARK = "§ORG§ ";

type Organization = "school" | "external" | "mixed" | "unknown";

function organizationOf(text: string): Organization {
  const school = SCHOOL_UNIT_RE.test(text);
  const external = UPPER_UNIT_RE.test(text);
  return school && external ? "mixed" : school ? "school" : external ? "external" : "unknown";
}

/** Tiêu đề phân công theo đơn vị, ví dụ "2. Văn phòng Sở", "8. Các trường THPT…". */
function organizationHeading(line: string): Organization | null {
  if (line.length > 190 || /[.;:]$/.test(line) || DATE_PATTERN.test(line)) return null;
  if (!/^(?:\d{1,2}(?:\.\d{1,2})*[.)]\s*)/u.test(line)) return null;
  const body = line.replace(NUMBER_PREFIX, "");
  // "Đối với Hiệu trưởng/Tổ trưởng…" là phạm vi vai trò, không phải tiêu đề đơn vị.
  if (!UPPER_UNIT_RE.test(body) && !/(?:trường\s+(?:thpt|trung học|phổ thông)|cơ sở giáo dục|đơn vị dự thi|trung tâm\s+(?:gdtx|gdnn))/iu.test(body))
    return null;
  const organization = organizationOf(body);
  return organization === "unknown" ? null : organization;
}
/** Mục chỉ mang tính thông tin (mục đích, căn cứ, tiêu chí…): bỏ các câu không có mốc thời gian */
const INFO_SECTION =
  /mục đích|yêu cầu|căn cứ|nguyên tắc|tiêu chí|đối tượng|phạm vi|thang điểm|khung điểm|tỷ lệ|thành phần hồ sơ|giải thích/iu;
const TASK_SECTION =
  /tổ chức thực hiện|phân công|lộ trình|tiến độ|thời gian thực hiện|thời hạn|trách nhiệm của|nhiệm vụ cụ thể|các bước thực hiện|kế hoạch thực hiện|triển khai thực hiện/iu;
const NUMBER_PREFIX = /^(?:(?:\d{1,2}(?:\.\d{1,2})*|[a-zđ]|[IVX]{1,4})[.)]\s*)/iu;

/**
 * Dòng tiêu đề chỉ người thực hiện, vd. "4. Đối với Tổ trưởng chuyên môn, tổ Văn phòng",
 * "Trách nhiệm của giáo viên:", "b) Nhân viên văn phòng". Trả về nhãn người thực hiện.
 */
function roleHeading(line: string): string | null {
  if (line.length > 110 || /[.;]$/.test(line) || DATE_PATTERN.test(line)) return null;
  // Câu trích dẫn văn bản khác ("“Tổ chuyên môn có những nhiệm vụ sau: …") không phải tiêu đề phân công
  if (/^[“"'‘«(]/u.test(line)) return null;
  const body = line.replace(NUMBER_PREFIX, "");  const m = /^(đối với|trách nhiệm của|nhiệm vụ của|về phía)?\s*(.+?)\s*(:)?$/iu.exec(body);
  if (!m) return null;
  const label = m[2].trim();
  // Nhãn phải BẮT ĐẦU bằng người thực hiện ("Tổ trưởng chuyên môn…"), không phải "nhiệm vụ do tổ… giao"
  if (subjectOf(label.split(/\s+/).slice(0, 4).join(" ")) === "unknown") return null;
  // Tiêu đề có đánh số ("3. Giáo viên chủ nhiệm, giáo viên bộ môn và các bộ phận") được phép dài hơn
  const maxWords = NUMBER_PREFIX.test(line) ? 14 : 9;
  const shortRole = !ACTION_PATTERN.test(label) && label.split(/\s+/).length <= maxWords;
  return m[1] || (m[3] && label.split(/\s+/).length <= 12) || shortRole ? label : null;
}

/** Tiểu mục đánh số mang tính chủ đề, vd. "3. Về phân công nhiệm vụ…", "5.2.Thành phần hồ sơ…" */
function topicHeading(line: string): boolean {
  if (line.length > 140 || /[.;:]$/.test(line) || DATE_PATTERN.test(line)) return false;
  if (!/^(?:\d{1,2}(?:\.\d{1,2})*[.)]|[a-zđ][.)])\s*/iu.test(line)) return false;
  return /^(về|công tác|quy trình|hồ sơ|thời gian|thời hạn|nội dung|phương pháp|thành phần|tiêu chí|mục đích|yêu cầu|tổ chức thực hiện|trách nhiệm|một số nội dung|đối tượng|thẩm quyền)/iu.test(
    line.replace(NUMBER_PREFIX, ""),
  );
}

/**
 * Bỏ ký tự điều khiển ẩn (vd. \u0000 thường lẫn trong chữ lấy từ PDF).
 * PostgreSQL không lưu được \u0000 trong JSON nên phải lọc trước khi lưu.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]/g;
export function stripControl(s: string) {
  return s.replace(CONTROL_CHARS, "");
}

/** Lọc ký tự điều khiển trong mọi chuỗi của một đối tượng (dùng trước khi lưu lên máy chủ). */
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") return stripControl(value) as T;
  if (Array.isArray(value)) return value.map(sanitizeDeep) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[stripControl(k)] = sanitizeDeep(v);
    return out as T;
  }
  return value;
}

export function clean(s: string) {
  return stripControl(s)
    // "năm học 2026 - 2027", "giai đoạn 2021 – 2030": giữ dấu nối giữa hai năm
    .replace(/(?<!\d)((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})(?!\d)/gu, "$1-$2")
    .replace(/[☐☑◐!✓•▪●○■□➢➤►-]+(?=\s)/gu, " ")
    .replace(/^[\s☐☑◐✓•▪●○■□➢➤►*+-]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chuẩn hóa ô thời gian; ngày/tháng không hợp lệ (ví dụ 45/13) được đổi thành "Trong tháng". */
export function normalizeTime(value: string) {
  const v = clean(value).replace(
    /(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/giu,
    (_, d, m, y) => `${d}/${m}/${y}`,
  );
  const dates = [...v.matchAll(/(\d{1,2})[/–-](\d{1,2})(?:[/–-](\d{2,4}))?/g)];
  const valid = (d: RegExpMatchArray) =>
    Number(d[1]) >= 1 && Number(d[1]) <= 31 && Number(d[2]) >= 1 && Number(d[2]) <= 12;
  if (dates.length && !dates.some(valid)) return "Trong tháng";
  return v || "Trong tháng";
}

/** Khóa so sánh để phát hiện đầu việc trùng (bỏ dấu, bỏ ký tự đặc biệt). */
export function signature(s: string) {
  return clean(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 180);
}

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Ghép các dòng thành đoạn: dòng bị ngắt giữa câu được nối lại, dòng có dấu đầu mục
 * bắt đầu đoạn mới; bỏ tiêu đề viết HOA, quốc hiệu, số hiệu, "Căn cứ…", địa danh – ngày tháng.
 */
function paragraphs(text: string): string[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const blocks: string[] = [];
  let current = "";
  let inNoise = false;
  let noiseOpen = false; // đoạn "Căn cứ …" chưa kết thúc bằng dấu câu → các dòng sau vẫn thuộc về nó
  const flush = () => {
    if (current) blocks.push(current);
    current = "";
  };
  let afterTitle = false; // đoạn ngay sau tiêu đề văn bản (không đánh số) là phụ đề → bỏ
  let inRole = false; // đang ở dưới "4. Đối với Tổ trưởng…": "Căn cứ …" ở đây là việc, không phải căn cứ pháp lý
  let headingOpen = false; // tiêu đề mục dài bị ngắt dòng: bỏ các dòng nối tiếp (chữ thường)
  for (const line of lines) {
    const startsLower = /^\p{Ll}/u.test(line);
    if (headingOpen && startsLower && !current && !LIST_MARKER.test(line)) continue;
    headingOpen = false;
    if (line.startsWith(ROW_MARK)) {
      // Hàng của bảng (từ PDF): giữ nguyên thành một đoạn riêng
      flush();
      blocks.push(line);
      inNoise = afterTitle = false;
      continue;
    }
    const organization = organizationHeading(line);
    if (organization) {
      flush();
      blocks.push(ORG_MARK + organization + " " + line.replace(NUMBER_PREFIX, ""));
      inNoise = afterTitle = inRole = false;
      headingOpen = true;
      continue;
    }
    const role = roleHeading(line);
    if (role && !isHeading(line)) {
      flush();
      blocks.push(ROLE_MARK + role);
      inNoise = afterTitle = false;
      inRole = headingOpen = true;
      continue;
    }
    if (topicHeading(line)) {
      flush();
      blocks.push(TOPIC_MARK + line.replace(NUMBER_PREFIX, ""));
      inNoise = afterTitle = inRole = false;
      headingOpen = true;
      continue;
    }
    if (isHeading(line)) inRole = false;
    if (isHeading(line) || (NOISE_PATTERN.test(line) && !(inRole && /^căn cứ/iu.test(line)))) {
      flush();
      if (isHeading(line)) blocks.push(role ? ROLE_MARK + role : H1_MARK + line);
      afterTitle = isHeading(line) && !LIST_MARKER.test(line);
      inNoise = true;
      noiseOpen = NOISE_PATTERN.test(line) && !/[.;:!?]$/.test(line);
      continue;
    }
    // Dòng nối tiếp của một dòng bị bỏ (vd. phần sau của "Căn cứ …")
    if (inNoise && (startsLower || noiseOpen)) {
      noiseOpen = noiseOpen && !/[.;:!?]$/.test(line);
      continue;
    }
    inNoise = false;
    if (afterTitle && !LIST_MARKER.test(line) && !DATE_PATTERN.test(line)) {
      // phụ đề nằm ngay dưới tiêu đề: bỏ dòng này và các dòng nối tiếp
      if (!/[.;:!?]$/.test(line)) inNoise = noiseOpen = true;
      afterTitle = false;
      continue;
    }
    afterTitle = false;
    const endsSentence = /[.:!?]$/.test(current); // ";" thường là giữa danh sách: "Tiến độ; Kết quả;"
    const newItem =
      !current ||
      LIST_MARKER.test(line) ||
      current.length > MAX_BLOCK ||
      (endsSentence && !startsLower) ||
      (current.length < 40 && !startsLower); // dòng ngắn đứng trước thường là tiêu đề mục
    if (newItem) {
      flush();
      current = line;
    } else current += " " + line;
  }
  flush();
  return blocks;
}

/** Các đoạn/câu ứng viên (dùng cho kiểm thử và nhận diện). */
export function toBlocks(text: string): string[] {
  return paragraphs(text)
    .filter((b) => !b.startsWith("§H1§") && !b.startsWith("§ROLE§") && !b.startsWith("§TOPIC§"))
    .flatMap((b) => (b.startsWith(ROW_MARK) ? [b] : b.split(SENTENCE_SPLIT)));
}

const capitalize = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const lowerFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
const trimEnd = (x: string) => x.replace(/[\s.;,:]+$/, "");

type Candidate = {
  time: string;
  work: string;
  audience: Audience;
  confidence: number;
  performer?: string;
  organization?: Organization;
};

type TableHeader = { time: number; content: number; performer: number };

const rowCells = (row: string) =>
  row
    .slice(ROW_MARK.length)
    .split(CELL_SEP)
    .map((c) => clean(c));

/**
 * Nhận ra hàng tiêu đề của bảng công việc, vd. "Mốc thời gian | Nội dung công việc | Người thực hiện".
 * Bảng tiêu chí/xếp loại (không có cột thời gian hoặc người thực hiện) không được coi là bảng công việc.
 */
function tableHeader(row: string): TableHeader | null {
  const cells = rowCells(row);
  if (cells.length < 2 || cells.some((c) => c.length > 60) || new RegExp(DAY_MONTH).test(row)) return null;
  const find = (re: RegExp) => cells.findIndex((c) => re.test(c));
  const content = find(/^(nội dung|công việc|nhiệm vụ|hoạt động|việc cần làm)/iu);
  const time = find(/^(thời gian|thời hạn|thời điểm|mốc|ngày|tuần|hạn)/iu);
  const performer = find(
    /^(người|đơn vị|bộ phận|cá nhân|chủ trì|phụ trách|thực hiện|đối tượng|trách nhiệm)/iu,
  );
  if (content < 0 || (time < 0 && performer < 0)) return null;
  return { time, content, performer: performer === content ? -1 : performer };
}

/** Hàng bảng: [thời gian | nội dung | người thực hiện | hình thức] (thứ tự cột theo tiêu đề nếu có). */
function fromRow(row: string, header: TableHeader | null): Candidate | null {
  const cells = rowCells(row);
  const at = (i: number) => (i >= 0 && i < cells.length ? cells[i] : "");
  let dateIdx = header && header.time >= 0 && new RegExp(DAY_MONTH).test(at(header.time)) ? header.time : -1;
  if (dateIdx < 0) dateIdx = cells.findIndex((c) => new RegExp(DAY_MONTH).test(c) && c.length < 60);
  const rest = cells
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => c && i !== dateIdx && !/^\d{1,3}\.?$/.test(c)); // bỏ cột STT
  if (!rest.length) return null;
  let content = header ? at(header.content) : "";
  if (!content || content.length < 8) content = rest.reduce((a, b) => (b.c.length > a.c.length ? b : a)).c;
  let performer = header && header.performer >= 0 ? at(header.performer) : "";
  if (!performer)
    performer =
      rest.find(({ c }) => c !== content && audienceOf(c) !== "unknown" && c.length <= 120)?.c || "";
  const form = rest
    .map(({ c }) => c)
    .filter((c) => c !== content && c !== performer && (!header || cells.indexOf(c) !== header.time))
    .join("; ");
  // Không có mốc thời gian: chỉ nhận khi đang ở trong một bảng công việc (có hàng tiêu đề)
  if (dateIdx < 0 && !(header && content.length > 12)) return null;
  const work =
    trimEnd(content) +
    (form ? ` – ${lowerFirst(trimEnd(form))}` : "") +
    (performer ? ` (${trimEnd(performer)})` : "") +
    ".";
  const time =
    dateIdx >= 0
      ? capitalize(normalizeTime(cells[dateIdx]))
      : header && at(header.time)
        ? capitalize(at(header.time))
        : "Trong tháng";
  return {
    time,
    work,
    audience: audienceOf(performer || content),
    confidence: dateIdx >= 0 ? 95 : 85,
    performer,
    organization: organizationOf(performer || content),
  };
}

const LABELED = /^(?:(?:\d{1,2}(?:\.\d{1,2})*|[a-zđ]|[IVX]{1,4})[.)]\s*)?([^:]{3,70}):\s+(.+)$/iu;
const TASK_LABEL = /nhiệm vụ|công việc|nội dung công việc|việc cần làm|thời gian/iu;

/**
 * Đoạn dạng "Nhãn: nội dung".
 * - Nhãn là người thực hiện ("Viên chức, Người lao động: A; B; C") → mỗi ý sau dấu ; là một đầu việc.
 * - Nhãn thông tin ("Mục đích:", "Căn cứ pháp lý:", "Nguyên tắc:") → bỏ, trừ khi có mốc thời gian.
 * Trả về null nếu không phải dạng này.
 */
function fromLabeled(par: string): Candidate[] | null {
  const m = par.match(LABELED);
  if (!m || DATE_PATTERN.test(m[1])) return null;
  const [, label, body] = m;
  const who = audienceOf(label);
  const doiVoi = /^đối với\s+/iu.test(label);
  if (who === "unknown") {
    // "Thường xuyên cập nhật: Tiến độ; Kết quả; …" là một việc cần làm → xử lý như câu thường
    if (TASK_LABEL.test(label) || DATE_PATTERN.test(body) || STARTS_WITH_ACTION.test(label)) return null;
    return []; // đoạn thông tin
  }
  const performer = label.replace(/^(đối với|trách nhiệm của|nhiệm vụ của)\s+/iu, "");
  return (
    body
      .split(/;\s+/)
      .map((x) => clean(x))
      .filter((x) => x.length > 8)
      // "Đối với QL: Kết quả chỉ đạo…" là mô tả tiêu chí; chỉ nhận ý bắt đầu bằng việc cần làm
      .filter((x) => !doiVoi || STARTS_WITH_ACTION.test(x))
      .map((item) => {
        const d = item.match(DATE_PATTERN);
        const text = d ? item.replace(d[0], "").replace(/\s+([.,;:])/g, "$1") : item;
        return {
          time: d ? capitalize(normalizeTime(d[0])) : "Trong tháng",
          work: `${capitalize(trimEnd(clean(text)))} (${trimEnd(performer)}).`,
          audience: who,
          confidence: d ? 95 : 85,
          performer,
        };
      })
  );
}

/** Câu thường: cần có mốc thời gian hoặc động từ công việc. */
function fromSentence(line: string, inRoleScope = false): Candidate | null {
  if (
    line.length <= 22 ||
    line.length >= 1600 ||
    isHeading(line) ||
    // dưới mục "Đối với tổ trưởng…", câu "Căn cứ vị trí việc làm… để hướng dẫn…" là việc cần làm
    (NOISE_PATTERN.test(line) && !(inRoleScope && /^căn cứ/iu.test(line))) ||
    /:$/.test(line) ||
    isLegalReference(line)
  )
    return null; // câu dẫn "… cụ thể như sau:"
  let m = line.match(DATE_PATTERN);
  // "Nghị quyết số 98/2023/QH15 ngày 24/6/2023" là ngày của văn bản được trích dẫn, không phải hạn công việc
  if (
    m &&
    /(số|nghị quyết|quyết định|công văn|hướng dẫn|thông tư|kế hoạch|tờ trình)[^.;:]{0,40}$/iu.test(
      line.slice(0, m.index),
    )
  )
    m = null;
  const hasDate = !!m;
  const hasAction = ACTION_PATTERN.test(line) || /^(cô|thầy|ông|bà)\s+\p{Lu}/u.test(line);
  if (!hasDate && !hasAction) return null;
  // Ô/dòng chỉ chứa một mốc ngày không phải là đầu việc.
  if (m && !hasAction && signature(line.replace(m[0], "")).length < 8) return null;
  // Chỉ tách cụm thời gian khỏi nội dung khi nó đứng đầu hoặc cuối câu; ở giữa câu thì giữ nguyên câu
  const edge = m && (m.index! <= 1 || m.index! + m[0].length >= line.replace(/[.;,\s]+$/, "").length - 1);
  const work =
    clean(
      line
        .replace(edge ? m![0] : "", "")
        .replace(/^[\s:;,.\-–]+/, "")
        .replace(/^[a-zđ]\)\s+/iu, "") // bỏ "a) ", "b) "
        .replace(/\s+([.,;:])/g, "$1")
        .replace(/[,;:]\s*\.$/, "."),
    ) || line;
  // Vai trò được nhắc tới đầu tiên trong câu quyết định người thực hiện ("Hiệu trưởng phân công viên chức…")
  const subject = subjectOf(work);
  return {
    time: capitalize(normalizeTime(m?.[0] || "Trong tháng")),
    work,
    audience: subject,
    confidence: hasDate && hasAction ? 95 : hasAction ? 78 : 62,
    organization: organizationOf(work),
  };
}

/** Nhận diện đầu việc bằng quy tắc (không cần mạng). */
export function extractTasks(text: string, source: string, options: ExtractOptions = {}): Task[] {
  const candidates: Candidate[] = [];
  let header: TableHeader | null = null;
  let infoSection = false; // đang ở mục mục đích/căn cứ/tiêu chí…
  let infoTopic = false;
  let scope: { audience: Audience; label: string } | null = null; // "4. Đối với Tổ trưởng…"
  let organizationScope: Organization = "unknown";
  // Văn bản có mục "Tổ chức thực hiện/Phân công/Lộ trình…" thì việc cần làm nằm ở đó;
  // các mục khác (mục đích, nguyên tắc, nội dung, tiêu chí…) chỉ lấy câu có mốc thời gian.
  const pars = paragraphs(text);
  const hasTaskSection = pars.some((p) => p.startsWith(H1_MARK) && TASK_SECTION.test(p));
  let inTaskSection = !hasTaskSection;
  const push = (c: Candidate) => {
    if ((infoSection || infoTopic || !inTaskSection) && c.time === "Trong tháng") return;
    if (scope) {
      const own = subjectOf(c.work.split(/\s+/).slice(0, 4).join(" "));
      c.audience = own !== "unknown" ? own : scope.audience;
      if (!/\)\.?$/.test(c.work)) c.work = `${trimEnd(c.work)} (${scope.label}).`;
      if (!c.performer) c.performer = scope.label;
    }
    if (!c.organization || c.organization === "unknown") c.organization = organizationScope;
    candidates.push(c);
  };
  for (const par of pars) {
    if (par.startsWith(H1_MARK)) {
      const title = par.slice(H1_MARK.length);
      infoSection = INFO_SECTION.test(title) && !TASK_SECTION.test(title);
      if (
        hasTaskSection &&
        (TASK_SECTION.test(title) || /^[IVX]{1,4}\.|^(PHẦN|MỤC)\s/u.test(title))
      )
        inTaskSection = TASK_SECTION.test(title);
      infoTopic = false;
      scope = null;
      organizationScope = "unknown";
      header = null;
      continue;
    }
    if (par.startsWith(ORG_MARK)) {
      const m = new RegExp(`^${ORG_MARK}(school|external|mixed)\\s+`).exec(par);
      organizationScope = (m?.[1] as Organization) || "unknown";
      scope = null;
      infoTopic = false;
      header = null;
      continue;
    }
    if (par.startsWith(ROLE_MARK)) {
      const label = par.slice(ROLE_MARK.length);
      scope = { audience: audienceOf(label), label };
      infoTopic = false;
      continue;
    }
    if (par.startsWith(TOPIC_MARK)) {
      const title = par.slice(TOPIC_MARK.length);
      scope = null;
      infoTopic = INFO_SECTION.test(title) && !TASK_SECTION.test(title);
      continue;
    }
    if (par.startsWith(ROW_MARK)) {
      const h = tableHeader(par);
      if (h) {
        header = h;
        continue;
      }
      const c = fromRow(par, header);
      if (c) push(c); // hàng bảng tự mang người thực hiện của nó
      continue;
    }
    header = null;
    const labeled = fromLabeled(clean(par));
    if (labeled) {
      labeled.forEach(push);
      continue;
    }
    for (const sentence of par.split(SENTENCE_SPLIT)) {
      const c = fromSentence(clean(sentence), !!scope);
      if (c) push(c);
    }
  }

  const seen = new Set<string>();
  const semanticSeen: string[] = [];
  const result: Task[] = [];
  for (const c of candidates) {
    if (isLegalReference(c.work)) continue;
    if (
      options.teacherOnly &&
      (c.audience === "leader" ||
        /hiệu trưởng|phó hiệu trưởng|thủ trưởng|cấp ủy|ban giám hiệu|lãnh đạo/iu.test(c.performer || ""))
    )
      continue;
    if (
      options.staffOnly &&
      c.organization === "external" &&
      !SCHOOL_UNIT_RE.test(c.work) &&
      !SCHOOL_UNIT_RE.test(c.performer || "")
    )
      continue;
    const scoped = options.staffOnly ? schoolScopedWork(c.work, c.performer) : c.work;
    if (!scoped) continue;
    c.work = scoped;
    const key = signature(c.work);
    if (key.length < 12 || seen.has(key)) continue;
    const semantic = semanticSignature(c.work);
    if (semanticSeen.some((old) => semanticallySame(old, semantic))) continue;
    seen.add(key);
    semanticSeen.push(semantic);
    result.push({
      id: newId(),
      time: c.time,
      work: c.work,
      source,
      status: "Chưa làm",
      target:
        clean(c.performer || "") ||
        (c.audience === "leader"
          ? "Hiệu trưởng/Ban giám hiệu"
          : c.audience === "staff"
            ? "Giáo viên, nhân viên"
            : "Cấp trường"),
      confidence: c.confidence,
    });
    if (result.length >= MAX_TASKS) break;
  }
  return result;
}

const DEDUPE_STOP_WORDS = new Set(
  "các đơn vị nhà trường thực hiện tổ chức công tác theo quy định yêu cầu có liên quan cuộc thi tham gia đảm bảo và của cho tại được đúng nghiêm túc".split(
    " ",
  ),
);

export function semanticSignature(value: string) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => (w.length > 1 || /^\d+$/.test(w)) && !DEDUPE_STOP_WORDS.has(w))
    .sort()
    .join(" ");
}

function semanticallySame(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  const aa = new Set(a.split(" "));
  const bb = new Set(b.split(" "));
  const an = [...aa].filter((x) => /^\d+$/.test(x));
  const bn = [...bb].filter((x) => /^\d+$/.test(x));
  // Số thứ tự/mã có thể phân biệt các đầu việc cùng mẫu câu; chỉ khóa trùng mờ cho câu không có số.
  if (an.length || bn.length) return false;
  const common = [...aa].filter((x) => bb.has(x)).length;
  const min = Math.min(aa.size, bb.size);
  const union = new Set([...aa, ...bb]).size;
  return min >= 4 && (common / min >= 0.82 || common / union >= 0.72);
}

/** Tách một đầu việc thành nhiều đầu việc theo dấu ; hoặc xuống dòng hoặc dấu chấm cuối câu. */
export function splitWork(work: string): string[] {
  return work
    .split(/\n+|;\s+|(?<=[.!?])\s+(?=\p{Lu})/u)
    .map(clean)
    .filter((x) => x.length > 8);
}

/** Thêm đầu việc mới vào danh sách, bỏ những đầu việc trùng nội dung. */
export function appendUnique(existing: Task[], incoming: Task[]): Task[] {
  const seen = new Set(existing.map((t) => signature(t.work)));
  const out = [...existing];
  for (const t of incoming) {
    const key = signature(t.work);
    if (key && seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function coerceStatus(value: unknown): TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : "Chưa làm";
}

export function countStats(tasks: Task[]) {
  const done = tasks.filter((t) => t.status === "Hoàn thành").length;
  const doing = tasks.filter((t) => t.status === "Đang thực hiện").length;
  return { all: tasks.length, done, doing, todo: tasks.length - done - doing };
}

export const DEFAULT_SCHOOL = "Trường THPT Phan Đăng Lưu";

export function emptyPayload(name: string): ReportPayload {
  return {
    sources: [],
    tasks: [],
    name,
    school: DEFAULT_SCHOOL,
    department: "Tổ Toán",
    agency: "",
    place: "",
    template: "admin",
    selfAssessment: "",
    proposals: "",
    workSaturday: false,
  };
}

/** Đọc payload đã lưu (kể cả định dạng cũ chỉ có sources/tasks/name/school). */
export function normalizePayload(input: unknown, fallbackName: string): ReportPayload {
  const base = emptyPayload(fallbackName);
  if (!input || typeof input !== "object") return base;
  const raw = sanitizeDeep(input);
  const r = raw as Record<string, unknown>;
  const str = (k: keyof ReportPayload) => (typeof r[k] === "string" ? (r[k] as string) : (base[k] as string));
  const tasks = Array.isArray(r.tasks)
    ? (r.tasks as Partial<Task>[]).map((t) => ({
        id: typeof t.id === "string" && t.id ? t.id : newId(),
        time: normalizeTime(String(t.time ?? "")),
        work: String(t.work ?? ""),
        source: String(t.source ?? "Nhập thủ công"),
        status: coerceStatus(t.status),
        ...(typeof t.target === "string" && t.target.trim() ? { target: t.target.trim() } : {}),
        ...(typeof t.confidence === "number" ? { confidence: t.confidence } : {}),
        ...(typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? { date: t.date } : {}),
        ...(typeof t.clock === "string" && t.clock ? { clock: t.clock } : {}),
        ...(t.auto ? { auto: true } : {}),
        ...(t.integration &&
        typeof t.integration === "object" &&
        t.integration.source === "kpi" &&
        typeof t.integration.kpiTaskId === "string" &&
        t.integration.kpiTaskId
          ? {
              integration: {
                source: "kpi" as const,
                kpiTaskId: t.integration.kpiTaskId,
                ...(typeof t.integration.kpiMemberId === "string" && t.integration.kpiMemberId
                  ? { kpiMemberId: t.integration.kpiMemberId }
                  : {}),
                ...(typeof t.integration.kpiMemberName === "string" && t.integration.kpiMemberName
                  ? { kpiMemberName: t.integration.kpiMemberName }
                  : {}),
                ...(typeof t.integration.kpiMemberEmail === "string" && t.integration.kpiMemberEmail
                  ? { kpiMemberEmail: t.integration.kpiMemberEmail }
                  : {}),
                ...(typeof t.integration.deadline === "string" && t.integration.deadline
                  ? { deadline: t.integration.deadline }
                  : {}),
                linkedAt:
                  typeof t.integration.linkedAt === "string" && t.integration.linkedAt
                    ? t.integration.linkedAt
                    : new Date().toISOString(),
              },
            }
          : {}),
      }))
    : [];
  return {
    sources: Array.isArray(r.sources) ? (r.sources as ReportPayload["sources"]) : [],
    tasks,
    name: str("name") || fallbackName,
    school: str("school") || DEFAULT_SCHOOL,
    department: str("department"),
    agency: str("agency"),
    place: str("place"),
    template: r.template === "notebook" ? "notebook" : "admin",
    selfAssessment: str("selfAssessment"),
    proposals: str("proposals"),
    workSaturday: r.workSaturday === true,
  };
}
