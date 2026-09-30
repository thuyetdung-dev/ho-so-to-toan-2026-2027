export type UserRole = 'admin' | 'head' | 'deputy' | 'teacher' | 'principal';

export interface Member {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  role: UserRole;
  qualifications?: string; // Cử nhân, Thạc sĩ, Tiến sĩ
  subject: string; // Toán, Toán - Tin
  phone?: string;
  status: 'active' | 'transferred' | 'retired';
  joinedAt: string;
  assignedClasses?: string[];
  periodsPerWeek?: number;
  /** Thứ tự hiển thị trong bảng phân công (theo thứ tự trong file Excel đã nhập) */
  sortOrder?: number;
}

export interface AcademicCalendarMilestone {
  id: string;
  name?: string;
  title?: string;
  term: 'HK1' | 'HK2' | 'CaNam';
  week?: number;
  dateStart?: string;
  dateEnd?: string;
  startDate?: string;
  endDate?: string;
  type?: 'exam' | 'holiday' | 'meeting' | 'review' | 'buffer';
  description?: string;
  notes?: string;
  status?: string;
}

export interface MathCompetencyTag {
  id: string;
  code: string; // NL1..NL5
  name: string; // Tư duy và lập luận toán học, Mô hình hóa toán học, Giải quyết vấn đề toán học, Giao tiếp toán học, Sử dụng công cụ và phương tiện học toán
  description: string;
  components?: string[];
  indicators?: string[];
  color?: string;
}

export interface CurriculumTopic {
  id: string;
  code?: string;
  name?: string;
  grade: 10 | 11 | 12;
  title?: string;
  strand: 'Đại số & Giải tích' | 'Hình học & Đo lường' | 'Thống kê & Xác suất' | 'Chuyên đề học tập' | 'Hoạt động trải nghiệm';
  estimatedPeriods?: number;
  standardPeriods?: number;
  term?: 'HK1' | 'HK2' | 'Cả năm';
  objectives?: string;
}

export interface ObservationCriterionItem {
  id: string;
  code?: string;
  group?: 'KeHoach' | 'HocSinh' | 'GiaoVien' | string;
  groupName?: string;
  category?: string;
  name: string;
  indicators?: string[];
  maxScore?: number;
}

export interface ExternalLinksConfig {
  examAndQuestionBankUrl: string; // Mặc định https://dinhcaotritue.com
  sharedDocumentsDriveUrl: string; // Mặc định Google Drive
}

export interface ExamTemplateStructure {
  id: string;
  name: string;
  durationMinutes: number;
  totalQuestions: number;
  totalScore: number;
  totalPoints?: number;
  mcqCount: number;
  mcqPoints: number;
  trueFalseCount: number;
  trueFalsePoints: number;
  shortAnswerCount: number;
  shortAnswerPoints: number;
  description?: string;
}

export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'essay';
export type QuestionDifficulty = 'NB' | 'TH' | 'VD' | 'VDC';

export interface Question {
  id: string;
  content: string;
  type: QuestionType | string;
  difficulty: QuestionDifficulty | string;
  grade: 10 | 11 | 12;
  topic?: string;
  /** Phương án A-D (trắc nghiệm) hoặc 4 mệnh đề a-d (đúng/sai) */
  options?: string[];
  /** mcq: 'A'..'D'; true_false: 'ĐSĐS'; short_answer/essay: đáp án */
  answer?: string;
  solution?: string;
  authorId?: string;
  authorName?: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ExamBlueprint {
  id: string;
  title: string;
  grade?: 10 | 11 | 12;
  [key: string]: unknown;
}

export interface Exam {
  id: string;
  title: string;
  status: string;
  isPublished: boolean;
  grade?: 10 | 11 | 12;
  durationMinutes?: number;
  templateName?: string;
  questionIds?: string[];
  authorId?: string;
  authorName?: string;
  academicYear?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ExamResultRecord {
  id: string;
  className: string;
  scores?: number[];
  examTitle?: string;
  grade?: 10 | 11 | 12;
  teacherName?: string;
  date?: string;
  academicYear?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export type ScoreRecord = ExamResultRecord;

// Ghi chú: loại 'de_kiem_tra' đã bỏ khi chuyển việc ra đề sang công cụ ngoài.
// Tài liệu cũ mang loại đó vẫn đọc được và hiển thị là "Khác".
export type DocumentCategory = 'van_ban' | 'mau_bieu' | 'bai_giang' | 'hoc_lieu' | 'khac';

export interface SharedDocument {
  id: string;
  title: string;
  url?: string;
  category?: DocumentCategory | string;
  description?: string;
  grade?: 10 | 11 | 12 | 0;
  uploaderId?: string;
  uploaderName?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/** Chỉ mục phân quyền (id = email viết thường) — Firestore rules dùng để kiểm tra quyền. */
export interface AccessIndexEntry {
  id: string;
  email: string;
  role: UserRole;
  memberId: string;
  updatedAt: string;
}

export interface DepartmentConfig {
  id: string;
  schoolName: string;
  departmentName: string;
  academicYear: string; // 2026-2027
  currentTerm: 'HK1' | 'HK2';
  startDate: string;
  endDate: string;
  weeksCount: number; // 35 tuần
  standardPeriods: number; // 17 tiết/tuần (chuẩn gợi ý cấp THPT theo Thông tư 28/2009/TT-BGDĐT)
  notes?: string;
  academicCalendar?: AcademicCalendarMilestone[];
  calendarMilestones?: AcademicCalendarMilestone[];
  curriculumTopics?: CurriculumTopic[];
  competencyTags?: MathCompetencyTag[];
  observationCriteria?: ObservationCriterionItem[];
  examTemplates?: ExamTemplateStructure[];
  externalLinks?: ExternalLinksConfig;
  /** Ban giám hiệu nhà trường (hiển thị ở thanh bên, ký duyệt kế hoạch) */
  schoolLeaders?: SchoolLeader[];
}

export interface SchoolLeader {
  id: string;
  /** Chức vụ: Hiệu trưởng, Phó hiệu trưởng phụ trách chuyên môn... */
  title: string;
  name: string;
  /** Người ký duyệt kế hoạch dạy học của tổ (thường là PHT phụ trách chuyên môn) */
  signsPlans?: boolean;
}

export interface SchoolClass {
  id: string;
  grade: 10 | 11 | 12;
  name: string; // 10A1, 11A2, 12A1
  studentCount: number;
  homeroomTeacher?: string;
  track?: string;
  roomNumber?: string;
}

export interface Assignment {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  grade: 10 | 11 | 12;
  subject: string; // Toán cơ bản, Chuyên đề học tập
  periodsPerWeek: number;
  duties?: string; // Chủ nhiệm, Bồi dưỡng HSG, Ôn tốt nghiệp
  term: 'HK1' | 'HK2';
  academicYear: string;
  /** 'duty' = tiết quy đổi nhiệm vụ / chủ nhiệm (không phải tiết theo TKB). Mặc định: tiết dạy theo TKB */
  kind?: 'teaching' | 'duty';
  /** Thứ tự dòng trong file Excel đã nhập (để hiển thị giống file) */
  sortOrder?: number;
}

export interface PlanDistributionItem {
  id: string;
  order: number;
  week: number;
  topicTitle: string;
  periods: number;
  objectives: string; // Yêu cầu cần đạt
  equipment?: string; // Thiết bị dạy học
  location?: string; // Lớp học, Phòng máy
  status?: 'completed' | 'in_progress' | 'planned' | 'make_up' | 'delayed'; // Đã dạy, Đang dạy, Kế hoạch, Bù tiết, Chậm
  dateTaught?: string;
  notes?: string;
}

export interface PlanVersionRecord<T = any> {
  version: number;
  updatedAt: string;
  updatedBy: string;
  changeSummary: string;
  summary?: string;
  dataSnapshot?: T;
  /** Nội dung phiên bản được lưu riêng (lessonPlanVersions) – tải khi so sánh */
  hasSnapshot?: boolean;
  status: 'draft' | 'submitted' | 'approved' | 'returned';
  comment?: string;
}

export interface PlanReviewComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  type: 'comment' | 'return_reason' | 'approval_note';
  createdAt: string;
}

export interface DepartmentPlan {
  id: string;
  /** Bỏ trống khối đối với kế hoạch chuyên môn chung của tổ. */
  grade?: 10 | 11 | 12;
  planKind?: 'teaching' | 'professional';
  academicYear: string;
  title: string;
  status: 'draft' | 'submitted' | 'approved' | 'returned';
  version: number;
  generalSituation: string; // Đặc điểm tình hình
  distribution: PlanDistributionItem[];
  periodicEvaluations: {
    name: string;
    duration: number; // 45', 90'
    week: number;
    format: string; // Trắc nghiệm + Tự luận
  }[];
  createdBy: string;
  createdById?: string;
  approvedBy?: string;
  createdAt?: string;
  updatedAt: string;
  reasonForAdjustment?: string;
  versionHistory?: PlanVersionRecord<any>[];
  comments?: PlanReviewComment[];
}

/**
 * Một dòng trong bảng của Phụ lục III (dùng chung cho mục I.1 Phân phối chương trình
 * và mục I.2 Chuyên đề lựa chọn). Tên cột theo đúng khung Công văn 5512:
 * Bài học (1) | Số tiết (2) | Thời điểm (3) | Thiết bị dạy học (4) | Địa điểm dạy học (5)
 */
export interface TeacherPlanLine {
  id: string;
  order: number;
  /** (1) Tên bài học hoặc chuyên đề */
  lesson: string;
  /** (2) Số tiết dùng để dạy bài/chuyên đề */
  periods: number;
  /** (3) Tuần thực hiện */
  timing: string;
  /** (4) Thiết bị dạy học */
  equipment: string;
  /** (5) Địa điểm dạy học: lớp học, phòng bộ môn, phòng đa năng, thực địa... */
  location: string;
}

/**
 * Dòng phân phối chương trình phần nội dung cốt lõi.
 * Năm cột đúng như bảng của tổ: Tuần | Tiết PPCT | Nội dung dạy học |
 * Yêu cầu cần đạt trọng tâm | Thiết bị và định hướng năng lực số, AI.
 */
export interface PlanCoreLine {
  id: string;
  order: number;
  /** Tuần, kèm khoảng ngày nếu có: "1 (07/09 – 12/09)" */
  week: string;
  /** Tiết theo phân phối chương trình, thường là khoảng: "1-3" */
  periods: string;
  /** Số tiết của dòng, dùng để cộng tổng thời lượng */
  periodCount: number;
  content: string;
  requirements: string;
  /** Thiết bị dạy học và định hướng tích hợp năng lực số, giáo dục AI.
   *  Với kế hoạch giáo dục hòa nhập, cột này là "Đồ dùng trực quan và phương pháp hỗ trợ". */
  digitalAi: string;
  /** Ghi chú – chỉ dùng ở kế hoạch giáo dục học sinh hòa nhập */
  note?: string;
}

/** Dòng chuyên đề học tập lựa chọn: Tuần | Tiết | Nội dung chuyên đề | Yêu cầu cần đạt và sản phẩm gợi ý */
export interface PlanTopicLine {
  id: string;
  order: number;
  week: string;
  periods: string;
  periodCount: number;
  content: string;
  requirements: string;
}

/**
 * Dòng hoạt động trải nghiệm, hướng nghiệp.
 * Sáu cột: Tuần | TT tiết | Chủ đề/Bài học | Yêu cầu cần đạt |
 * Tích hợp năng lực số, giáo dục AI | Quy mô, địa điểm.
 */
export interface PlanExperienceLine {
  id: string;
  order: number;
  week: string;
  periods: string;
  periodCount: number;
  content: string;
  requirements: string;
  digitalAi: string;
  /** Quy mô tổ chức và địa điểm: lớp học, sân trường, hội trường... */
  venue: string;
}

/** Dòng kiểm tra, đánh giá định kỳ: Bài kiểm tra | Thời gian (1) | Thời điểm (2) | Yêu cầu cần đạt (3) | Hình thức (4) */
export interface PlanAssessmentLine {
  id: string;
  order: number;
  name: string;
  duration: string;
  timing: string;
  requirements: string;
  form: string;
}

/** 'core' = môn học theo khối; 'experience' = hoạt động trải nghiệm, hướng nghiệp */
export type PlanSectionKind = 'core' | 'experience';

/**
 * Loại kế hoạch giáo dục của giáo viên. Mỗi loại là một hồ sơ riêng, lọc riêng
 * trong phân hệ 3 để dễ quản lý:
 *   teaching   – Kế hoạch giảng dạy môn học
 *   experience – Hoạt động trải nghiệm, hướng nghiệp
 *   inclusive  – Giáo dục học sinh hòa nhập
 */
export type TeacherPlanKind = 'teaching' | 'experience' | 'inclusive';

export const TEACHER_PLAN_KINDS: { value: TeacherPlanKind; label: string; short: string }[] = [
  { value: 'teaching', label: 'Kế hoạch giảng dạy', short: 'Giảng dạy' },
  { value: 'experience', label: 'Hoạt động trải nghiệm, hướng nghiệp', short: 'Trải nghiệm, hướng nghiệp' },
  { value: 'inclusive', label: 'Giáo dục học sinh hòa nhập', short: 'Hòa nhập' },
];

/**
 * Một phần của kế hoạch giảng dạy, tương ứng một khối lớp hoặc một hoạt động giáo dục.
 * Giáo viên dạy nhiều khối thì kế hoạch có nhiều phần, đúng như bản Word của tổ.
 */
export interface TeacherPlanSection {
  id: string;
  order: number;
  kind: PlanSectionKind;
  /** Tiêu đề phần: "Khối 10", "Hoạt động trải nghiệm, hướng nghiệp lớp 11" */
  title: string;
  grade?: 10 | 11 | 12;
  /** I. Căn cứ và nguyên tắc xây dựng – mỗi dòng một căn cứ */
  basis: string;
  /** II. Phân phối phần nội dung cốt lõi (phần kind='core') */
  coreLines: PlanCoreLine[];
  /** III. Phân phối chuyên đề học tập lựa chọn (phần kind='core') */
  topicLines: PlanTopicLine[];
  /** Phân phối chương trình hoạt động trải nghiệm (phần kind='experience') */
  experienceLines: PlanExperienceLine[];
  /** Kiểm tra, đánh giá định kỳ */
  assessments: PlanAssessmentLine[];
  /** V. Tổ chức thực hiện – mỗi dòng một ý */
  implementation: string;
  /** Số tuần của học kỳ I, dùng để tách IV. Tổng hợp thời lượng theo học kỳ */
  hk1Weeks: number;
}

/**
 * Kế hoạch giảng dạy của giáo viên, theo đúng cấu trúc bản Word tổ Toán đang dùng
 * (Phụ lục III Công văn 5512/BGDĐT-GDTrH, có thêm phần tích hợp năng lực số và AI):
 *
 *   1. Thông tin cá nhân
 *   2. Kế hoạch dạy học – mỗi khối lớp là một phần gồm:
 *      I. Căn cứ và nguyên tắc xây dựng
 *      II. Phân phối phần nội dung cốt lõi
 *      III. Phân phối chuyên đề học tập lựa chọn
 *      IV. Tổng hợp thời lượng (phần mềm tự cộng)
 *      Kiểm tra, đánh giá định kỳ
 *      V. Tổ chức thực hiện
 *
 * Các trường của bản 2.8 và 2.10 được giữ lại dạng tùy chọn để không mất dữ liệu cũ;
 * giao diện tự chuyển chúng sang cấu trúc mới khi mở chỉnh sửa.
 */
export interface TeacherPlan {
  id: string;
  teacherId: string;
  teacherName: string;
  grade: 10 | 11 | 12;
  academicYear: string;
  title: string;
  status: 'draft' | 'submitted' | 'approved' | 'returned';
  version: number;
  updatedAt: string;

  /** Loại kế hoạch; bản ghi cũ không có trường này thì hiểu là 'teaching' */
  planKind?: TeacherPlanKind;

  /** MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC */
  subject?: string;
  /** 1. Thông tin cá nhân – lớp được phân công giảng dạy: "10C7, 10C11, 11B14" */
  className?: string;
  /** 1. Thông tin cá nhân – nhiệm vụ khác được phân công kiêm nhiệm */
  otherTasks?: string;

  /** 2. Kế hoạch dạy học – các phần theo khối lớp và hoạt động giáo dục */
  sections?: TeacherPlanSection[];

  /** Ý kiến của tổ trưởng khi duyệt hoặc trả lại */
  comments?: PlanReviewComment[];

  // ----- Trường của các bản trước; chỉ đọc để chuyển tiếp dữ liệu cũ -----
  /** @deprecated Bản 2.10 – được chuyển thành coreLines của phần đầu tiên */
  distribution?: TeacherPlanLine[];
  /** @deprecated Bản 2.10 – được chuyển thành topicLines của phần đầu tiên */
  specialTopics?: TeacherPlanLine[];
  /** @deprecated Bản 2.8 – được gom vào ô nhiệm vụ kiêm nhiệm */
  teachingTasks?: string;
  /** @deprecated Bản 2.8 */
  selfStudyPlan?: string;
  /** @deprecated Bản 2.8 */
  expectedResults?: string;
}

export interface LessonPlanActivity {
  id: string;
  name: string; // HĐ 1: Khởi động, HĐ 2: Hình thành kiến thức...
  objectives: string;
  content: string;
  product: string;
  implementation: string; // Chuyển giao, Thực hiện, Báo cáo, Đánh giá
}

export interface LessonPlanComment {
  id: string;
  authorId: string;
  authorName: string;
  sectionId: string; // Tên hoạt động hoặc mục
  content: string;
  reply?: string;
  isResolved: boolean;
  createdAt: string;
}

export interface LessonPlan {
  id: string;
  teacherId: string;
  teacherName: string;
  grade: 10 | 11 | 12;
  topicTitle: string;
  week: number;
  periodCount: number;
  classNames: string[];
  title: string;
  status: 'draft' | 'submitted' | 'approved' | 'returned';
  version: number;
  originalAuthorId?: string;
  objectivesKnowledge: string;
  objectivesCompetence: string;
  objectivesQualities: string;
  equipment: string;
  activities: LessonPlanActivity[];
  comments: LessonPlanComment[];
  approvedBy?: string;
  createdAt?: string;
  updatedAt: string;
  versionHistory?: PlanVersionRecord<any>[];
  isTaught?: boolean;
  taughtDate?: string;
  taughtClasses?: string[];
  teachingStatus?: 'not_started' | 'teaching' | 'completed' | 'in_progress' | 'not_taught';
  /** Tên tệp Word/PDF đã nhập nội dung */
  sourceFileName?: string;
  /** Liên kết tới tệp gốc (Google Drive, OneDrive...) */
  sourceFileUrl?: string;
  /** Ảnh nhúng trong giáo án: mã → data URL (nội dung dùng ![chú thích](img:mã)) */
  images?: Record<string, string>;

  // ----- Lưu trữ tách (bản 2.4) -----
  /** 'split' = nội dung, hình, phiên bản nằm ở các bảng lessonPlanContent / lessonPlanImages / lessonPlanVersions */
  storage?: 'split';
  /** Chỉ dùng trên máy: 'light' = mới có phần tóm tắt, cần tải nội dung khi mở */
  contentState?: 'light' | 'full';
  /** Tên các hoạt động (để chọn khi dự giờ mà không phải tải cả giáo án) */
  activityNames?: string[];
  /** Mã các hình của giáo án */
  imageIds?: string[];
  /** Ước tính dung lượng (byte) để hiển thị đồng hồ dung lượng */
  contentBytes?: number;
  imageBytes?: number;
  versionBytes?: number;
}

export interface MeetingTask {
  id: string;
  title: string;
  assigneeName: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface Meeting {
  id: string;
  title: string;
  type: 'regular' | 'extraordinary' | 'lesson_study';
  date: string;
  location: string;
  isOnline: boolean;
  chairPerson: string;
  secretary: string;
  attendees: string[];
  absentees: { name: string; reason: string }[];
  content: string;
  memberOpinions: { author: string; content: string }[];
  conclusions: string;
  tasks: MeetingTask[];
  status: 'draft' | 'finalized';
  lockedAt?: string;
  updatedAt: string;
}

export interface LessonStudyCycle {
  id: string;
  title: string;
  grade: 10 | 11 | 12;
  topic: string;
  teacherName: string;
  targetClassName: string;
  date: string;
  currentStep: 1 | 2 | 3 | 4; // 1: Soạn & chuẩn bị, 2: Dạy minh họa, 3: Phân tích, 4: Ứng dụng
  stepDetails: {
    step1Notes?: string;
    step2Date?: string;
    step2Observers?: string[];
    step3Conclusions?: string;
    step4Applications?: string;
  };
  status: 'ongoing' | 'completed';
  updatedAt: string;
}

export interface ObservationRecord {
  id: string;
  observerId: string;
  observerName: string;
  teacherId: string;
  teacherName: string;
  className: string;
  period: number;
  date: string;
  lessonName: string;
  lessonPlanId?: string;
  // Ghi chép phân tích hoạt động học sinh (CV 5512)
  activitiesObservations: {
    activityName: string;
    studentActions: string; // Học sinh hoạt động, tương tác ra sao
    difficultiesNoticed: string; // Khó khăn học sinh gặp phải
    teacherSupport: string; // Biện pháp hỗ trợ của giáo viên
  }[];
  generalEvaluation: string;
  lessonsLearned: string; // Rút kinh nghiệm cho bản thân
  teacherFeedback?: string; // Người dạy phản hồi
  ratingEnabled: boolean;
  rating?: 'Chưa xếp loại' | 'Đạt' | 'Khá' | 'Tốt';
  status: 'submitted' | 'reviewed';
  updatedAt: string;
}

export interface ReportSnapshot {
  evidence?: { meetings: string[]; observations: string[]; lessonPlans: string[]; specialTopics: string[] };
  startDate?: string;
  endDate?: string;
  id: string;
  title: string;
  academicYear: string;
  term: string;
  periodLabel: string;
  createdAt: string;
  finalizedBy: string;
  isLocked: boolean;
  sectionsIncluded: string[];
  metrics: {
    membersCount: number;
    meetingsCount: number;
    lessonStudyCount: number;
    observationsCount: number;
    plansCount?: number;
    approvedPlansCount?: number;
    specialTopicsCount?: number;
  };
  executiveSummary: string;
  advantages: string;
  limitations: string;
  futureDirections: string;
}

export interface TrainingRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  moduleName: string;
  hours: number;
  status: string;
  certificateUrl?: string;
  academicYear: string;
  updatedAt?: string;
}

export interface InitiativeRecord {
  authorId?: string;
  id: string;
  teacherName: string;
  title: string;
  progress: string;
  departmentFeedback?: string;
  year: string;
}

export interface SpecialTopic {
  id: string;
  title: string;
  level?: 'To' | 'Truong' | 'Cum';
  reporterName?: string;
  date?: string;
  materialsSummary?: string;
  results?: string;
  geogebraOrSoftware?: string;
  grade?: 10 | 11 | 12;
  type?: 'hsg' | 'tot_nghiep' | 'phu_dao';
  authorId?: string;
  authorName?: string;
  targetStudents?: string;
  totalPeriods?: number;
  description?: string;
  attachmentsCount?: number;
  materialsUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SkknTopic {
  id: string;
  title: string;
  academicYear: string;
  evaluationLevel: string;
  abstract: string;
  authorId: string;
  authorName: string;
  scope: string;
  fileUrl?: string;
  createdAt: string;
}

export interface AuditLog {
  actorUid?: string;
  actorEmail?: string;
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  userName?: string;
  targetType: string;
  entityType?: string;
  targetId: string;
  details: string;
  timestamp: string;
}

export interface MemberInvitation {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  subject?: string;
  status: 'pending' | 'accepted' | 'declined';
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string;
}

export interface AccessRequest {
  id: string;
  email: string;
  displayName: string;
  reason: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}
