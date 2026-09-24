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

export type DocumentCategory = 'van_ban' | 'mau_bieu' | 'bai_giang' | 'de_kiem_tra' | 'hoc_lieu' | 'khac';

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
  grade: 10 | 11 | 12;
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
  approvedBy?: string;
  createdAt?: string;
  updatedAt: string;
  reasonForAdjustment?: string;
  versionHistory?: PlanVersionRecord<any>[];
  comments?: PlanReviewComment[];
}

export interface TeacherPlan {
  id: string;
  teacherId: string;
  teacherName: string;
  grade: 10 | 11 | 12;
  academicYear: string;
  title: string;
  status: 'draft' | 'submitted' | 'approved' | 'returned';
  version: number;
  teachingTasks: string;
  selfStudyPlan: string;
  expectedResults: string;
  updatedAt: string;
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
