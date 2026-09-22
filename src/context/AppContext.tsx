import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Member,
  DepartmentConfig,
  SchoolClass,
  Assignment,
  DepartmentPlan,
  PlanDistributionItem,
  TeacherPlan,
  LessonPlan,
  Meeting,
  ObservationRecord,
  SkknTopic,
  SpecialTopic,
  TrainingRecord,
  InitiativeRecord,
  AuditLog,
  UserRole,
  ReportSnapshot,
  MemberInvitation,
  AccessRequest,
  Question,
  ExamBlueprint,
  Exam,
  ExamResultRecord,
  ScoreRecord,
  SharedDocument,
} from '../types';
import { ActiveModule } from '../components/Sidebar';
import {
  SAMPLE_DEPARTMENT_CONFIG,
  SAMPLE_MEMBERS,
  SAMPLE_CLASSES,
  SAMPLE_ASSIGNMENTS,
  SAMPLE_DEPARTMENT_PLAN,
  SAMPLE_LESSON_PLAN,
  SAMPLE_OBSERVATIONS,
  SAMPLE_MEETINGS,
  SAMPLE_SPECIAL_TOPICS,
  SAMPLE_TRAININGS,
  SAMPLE_INITIATIVES,
  SAMPLE_INVITATIONS,
  SAMPLE_ACCESS_REQUESTS,
} from '../services/sample-data';
import {
  auth,
  db,
  googleProvider,
  testConnection,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';

interface AppContextType {
  // Demo Mode & Navigation
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  activeTab: ActiveModule;
  setActiveTab: (tab: ActiveModule) => void;

  // Auth & Roles & Permissions
  currentUser: User | null;
  activeMember: Member;
  allMembers: Member[];
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchActiveRole: (role: UserRole) => void;
  selectActiveMember: (memberId: string) => void;
  setActiveMember: (member: Member) => void;
  isUserAuthorized: boolean;

  // Invitations & Access Requests (Lỗi 23)
  invitations: MemberInvitation[];
  inviteMemberByEmail: (inv: { email: string; displayName: string; role: UserRole; subject?: string }) => Promise<void>;
  cancelInvitation: (id: string) => Promise<void>;
  accessRequests: AccessRequest[];
  submitAccessRequest: (email: string, displayName: string, reason: string) => Promise<void>;
  respondToAccessRequest: (id: string, action: 'approved' | 'rejected', role?: UserRole) => Promise<void>;

  // Department Config & Academic Year Transition (Lỗi 20)
  config: DepartmentConfig;
  updateConfig: (newConfig: Partial<DepartmentConfig>) => Promise<void>;
  transitionToNewAcademicYear: (newYear: string, options?: { copyConfig?: boolean; copyPlans?: boolean; keepQuestions?: boolean }) => Promise<void>;

  // Classes & Assignments
  classes: SchoolClass[];
  addClass: (cls: SchoolClass) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  assignments: Assignment[];
  setAssignments: (asgs: Assignment[]) => Promise<void>;
  saveAssignment: (asg: Assignment) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;

  // Plans (CV 5512) & Workflow (Lỗi 21)
  departmentPlans: DepartmentPlan[];
  saveDepartmentPlan: (plan: DepartmentPlan) => Promise<void>;
  submitDepartmentPlan: (planId: string, comment?: string) => Promise<void>;
  reviewDepartmentPlan: (planId: string, action: 'approve' | 'returned', note: string) => Promise<void>;
  updatePlanDistributionStatus: (planId: string, itemId: string, status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'make_up', dateTaught?: string) => Promise<void>;

  teacherPlans: TeacherPlan[];
  saveTeacherPlan: (plan: TeacherPlan) => Promise<void>;
  lessonPlans: LessonPlan[];
  saveLessonPlan: (plan: LessonPlan) => Promise<void>;
  deleteLessonPlan: (id: string) => Promise<void>;
  submitLessonPlan: (planId: string, comment?: string) => Promise<void>;
  reviewLessonPlan: (planId: string, action: 'approve' | 'returned', note: string) => Promise<void>;
  updateLessonPlanTeachingStatus: (planId: string, status: 'not_taught' | 'in_progress' | 'completed', taughtDate?: string, classes?: string[]) => Promise<void>;

  // Meetings & Observations
  meetings: Meeting[];
  saveMeeting: (meeting: Meeting) => Promise<void>;
  observations: ObservationRecord[];
  saveObservation: (obs: ObservationRecord) => Promise<void>;

  questions: Question[];
  saveQuestion: (q: Question) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  examBlueprints: ExamBlueprint[];
  saveExamBlueprint: (bp: ExamBlueprint) => Promise<void>;
  exams: Exam[];
  saveExam: (exam: Exam) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  examResults: ExamResultRecord[];
  saveExamResult: (result: ExamResultRecord) => Promise<void>;
  scoreRecords: ScoreRecord[];
  saveScoreRecord: (record: ScoreRecord) => Promise<void>;
  documents: SharedDocument[];
  saveDocument: (document: SharedDocument) => Promise<void>;

  // Professional Development & SKKN
  specialTopics: SpecialTopic[];
  saveSpecialTopic: (topic: SpecialTopic) => Promise<void>;
  skknTopics: SkknTopic[];
  saveSkknTopic: (topic: SkknTopic) => Promise<void>;
  trainings: TrainingRecord[];
  saveTraining: (t: TrainingRecord) => Promise<void>;
  initiatives: InitiativeRecord[];
  saveInitiative: (init: InitiativeRecord) => Promise<void>;

  // Reports & Snapshots (Lỗi 08)
  reportSnapshots: ReportSnapshot[];
  saveReportSnapshot: (snapshot: ReportSnapshot) => Promise<void>;

  // Audit Logs & Notifications
  auditLogs: AuditLog[];
  logAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
  setNotification: (notif: { message: string; type: 'success' | 'error' | 'info' } | null) => void;

  // System Backup & Administration
  resetToSampleData: () => Promise<void>;
  clearAllRealData: () => Promise<void>;
  exportSystemBackup: () => void;
  importSystemBackup: (backupData: any) => Promise<void>;

  // System State
  isFirestoreConnected: boolean;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SAMPLE_SKKN_TOPICS: SkknTopic[] = [
  {
    id: 'skkn-01',
    title: 'Giải pháp nâng cao năng lực mô hình hóa toán học cho học sinh lớp 12 qua các bài toán tối ưu kinh tế',
    academicYear: '2026-2027',
    evaluationLevel: 'Cấp Ngành (Xuất sắc)',
    abstract: 'Đề tài xây dựng hệ thống 24 bài toán tối ưu thực tiễn gắn với đời sống, tích hợp mô phỏng đồ thị trực quan, giúp học sinh nắm vững các bước lập hàm số và biện luận cực trị.',
    authorId: 'gv-01',
    authorName: 'ThS. Lê Quốc Dũng',
    scope: 'Toàn tỉnh',
    createdAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'skkn-02',
    title: 'Ứng dụng phần mềm GeoGebra 3D Calculator trong dạy học chuyên đề Phương pháp tọa độ trong không gian',
    academicYear: '2026-2027',
    evaluationLevel: 'Cấp Trường (Loại A)',
    abstract: 'Thiết kế 18 mô hình 3D động về vectơ, mặt phẳng, mặt cầu và đường thẳng trong Oxyz, giúp học sinh phát triển năng lực tưởng tượng không gian.',
    authorId: 'gv-02',
    authorName: 'ThS. Trần Thị Mai Phương',
    scope: 'Cụm chuyên môn',
    createdAt: '2026-09-10T09:00:00Z',
  },
];

const ENRICHED_SAMPLE_SPECIAL_TOPICS: SpecialTopic[] = [
  {
    id: 'topic-01',
    title: 'Kỹ thuật giải nhanh bài toán cực trị hình học Oxyz bằng phương pháp vectơ và tọa độ',
    grade: 12,
    type: 'tot_nghiep',
    authorId: 'gv-01',
    authorName: 'ThS. Lê Quốc Dũng',
    targetStudents: 'Học sinh lớp 12 ôn thi tốt nghiệp THPT 2025 mục tiêu 8+',
    totalPeriods: 12,
    description: 'Tổng hợp các kỹ thuật sử dụng tích có hướng, khoảng cách và phương pháp hàm số để giải quyết bài toán cực trị không gian.',
    attachmentsCount: 3,
    level: 'To',
    reporterName: 'ThS. Lê Quốc Dũng',
    date: '2026-09-15',
    materialsSummary: '3 chuyên đề + 50 bài tập có lời giải chi tiết',
    results: 'Áp dụng tốt cho 3 lớp 12',
    createdAt: '2026-09-15T08:00:00Z',
    updatedAt: '2026-09-15T08:00:00Z',
  },
  {
    id: 'topic-02',
    title: 'Bồi dưỡng học sinh giỏi: Bất đẳng thức tích phân và giải phương trình vi phân sơ cấp',
    grade: 12,
    type: 'hsg',
    authorId: 'gv-02',
    authorName: 'ThS. Trần Thị Mai Phương',
    targetStudents: 'Đội tuyển HSG Quốc gia và HSG Tỉnh môn Toán',
    totalPeriods: 24,
    description: 'Chuyên đề chuyên sâu về bất đẳng thức Cauchy-Schwarz dạng tích phân, kỹ thuật tích phân từng phần nâng cao.',
    attachmentsCount: 5,
    level: 'Cum',
    reporterName: 'ThS. Trần Thị Mai Phương',
    date: '2026-09-20',
    materialsSummary: 'Tập hợp đề thi HSG các năm',
    results: 'Đạt giải Nhì cấp tỉnh',
    createdAt: '2026-09-20T08:00:00Z',
    updatedAt: '2026-09-20T08:00:00Z',
  },
  {
    id: 'topic-03',
    title: 'Phụ đạo học sinh: Củng cố kỹ năng giải phương trình, bất phương trình mũ và logarit',
    grade: 11,
    type: 'phu_dao',
    authorId: 'gv-03',
    authorName: 'Thầy Hoàng Văn Nam',
    targetStudents: 'Học sinh cần tăng cường kỹ năng tính toán và nhận diện nghiệm ngoại lai',
    totalPeriods: 8,
    description: 'Rèn luyện quy tắc đổi cơ số, tìm điều kiện xác định và tránh sai lầm thường gặp khi giải phương trình logarit.',
    attachmentsCount: 2,
    level: 'To',
    reporterName: 'Thầy Hoàng Văn Nam',
    date: '2026-09-25',
    materialsSummary: 'Phiếu bài tập theo từng mức độ nhận biết - thông hiểu',
    results: 'Học sinh tiến bộ rõ rệt',
    createdAt: '2026-09-25T08:00:00Z',
    updatedAt: '2026-09-25T08:00:00Z',
  },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Remember the selected data mode so a reload does not unexpectedly return to sample data.
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() =>
    localStorage.getItem('to-toan-data-mode') !== 'real'
  );
  const [activeTabState, setActiveTabState] = useState<ActiveModule>(() =>
    (localStorage.getItem('to-toan-active-module') as ActiveModule) || 'overview'
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Official (Real) data state
  const [realConfig, setRealConfig] = useState<DepartmentConfig>({
    id: 'dept-real-01',
    schoolName: 'Trường THPT ...',
    departmentName: 'Tổ Toán',
    academicYear: '2026-2027',
    currentTerm: 'HK1',
    startDate: '2026-09-05',
    endDate: '2027-05-28',
    weeksCount: 35,
    standardPeriods: 17,
  });
  const [realMembers, setRealMembers] = useState<Member[]>([
    {
      id: 'admin-01',
      email: 'thuyetdung@gmail.com',
      displayName: 'Quản trị viên Tổ Toán',
      role: 'admin',
      qualifications: 'Thạc sĩ Toán',
      subject: 'Toán',
      status: 'active',
      joinedAt: new Date().toISOString(),
    },
  ]);
  const [realClasses, setRealClasses] = useState<SchoolClass[]>([]);
  const [realAssignments, setRealAssignments] = useState<Assignment[]>([]);
  const [realDeptPlans, setRealDeptPlans] = useState<DepartmentPlan[]>([]);
  const [realTeacherPlans, setRealTeacherPlans] = useState<TeacherPlan[]>([]);
  const [realLessonPlans, setRealLessonPlans] = useState<LessonPlan[]>([]);
  const [realMeetings, setRealMeetings] = useState<Meeting[]>([]);
  const [realObservations, setRealObservations] = useState<ObservationRecord[]>([]);
  const [realSpecialTopics, setRealSpecialTopics] = useState<SpecialTopic[]>([]);
  const [realSkknTopics, setRealSkknTopics] = useState<SkknTopic[]>([]);
  const [realTrainings, setRealTrainings] = useState<TrainingRecord[]>([]);
  const [realInitiatives, setRealInitiatives] = useState<InitiativeRecord[]>([]);
  const [realAuditLogs, setRealAuditLogs] = useState<AuditLog[]>([]);
  const [realQuestions, setRealQuestions] = useState<Question[]>([]);
  const [realExamBlueprints, setRealExamBlueprints] = useState<ExamBlueprint[]>([]);
  const [realExams, setRealExams] = useState<Exam[]>([]);
  const [realExamResults, setRealExamResults] = useState<ExamResultRecord[]>([]);
  const [realDocuments, setRealDocuments] = useState<SharedDocument[]>([]);

  // Demo interactive states
  const [demoConfig, setDemoConfig] = useState<DepartmentConfig>(SAMPLE_DEPARTMENT_CONFIG);
  const [demoClasses, setDemoClasses] = useState<SchoolClass[]>([...SAMPLE_CLASSES]);
  const [demoAssignments, setDemoAssignments] = useState<Assignment[]>([...SAMPLE_ASSIGNMENTS]);
  const [demoDeptPlans, setDemoDeptPlans] = useState<DepartmentPlan[]>([SAMPLE_DEPARTMENT_PLAN]);
  const [demoLessonPlans, setDemoLessonPlans] = useState<LessonPlan[]>([SAMPLE_LESSON_PLAN]);
  const [demoInvitations, setDemoInvitations] = useState<MemberInvitation[]>(SAMPLE_INVITATIONS);
  const [demoAccessRequests, setDemoAccessRequests] = useState<AccessRequest[]>(SAMPLE_ACCESS_REQUESTS);
  const [reportSnapshots, setReportSnapshots] = useState<ReportSnapshot[]>([]);
  const [demoQuestions, setDemoQuestions] = useState<Question[]>([]);
  const [demoExamBlueprints, setDemoExamBlueprints] = useState<ExamBlueprint[]>([]);
  const [demoExams, setDemoExams] = useState<Exam[]>([]);
  const [demoExamResults, setDemoExamResults] = useState<ExamResultRecord[]>([]);
  const [demoDocuments, setDemoDocuments] = useState<SharedDocument[]>([]);

  // Real invitations & access requests
  const [realInvitations, setRealInvitations] = useState<MemberInvitation[]>([]);
  const [realAccessRequests, setRealAccessRequests] = useState<AccessRequest[]>([]);

  // Active Member (current simulated or logged in member)
  const [activeMemberId, setActiveMemberId] = useState<string>('gv-01');

  const setActiveTab = (tab: ActiveModule) => {
    localStorage.setItem('to-toan-active-module', tab);
    setActiveTabState(tab);
  };

  const activeTab = activeTabState;

  // Test Firebase on mount
  useEffect(() => {
    testConnection()
      .then(() => setIsFirestoreConnected(true))
      .catch(() => setIsFirestoreConnected(false));

    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      if (user) {
        // Firebase restores the signed-in session asynchronously after a reload.
        // Always return authenticated users to the official Firestore data.
        localStorage.setItem('to-toan-data-mode', 'real');
        setIsDemoMode(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync real data with Firestore if not in Demo Mode
  useEffect(() => {
    if (isDemoMode || !isFirestoreConnected || !currentUser) return;

    try {
      const subscriptions: Array<() => void> = [];
      const subscribeList = <T,>(collectionName: string, setter: React.Dispatch<React.SetStateAction<T[]>>, preserveWhenEmpty = false) => {
        subscriptions.push(onSnapshot(collection(db, collectionName), snapshot => {
          if (preserveWhenEmpty && snapshot.empty) return;
          const list: T[] = [];
          snapshot.forEach(docSnap => list.push({ ...docSnap.data(), id: docSnap.id } as T));
          setter(list);
        }, err => handleFirestoreError(err, OperationType.LIST, collectionName)));
      };

      subscriptions.push(onSnapshot(collection(db, 'departments'), snapshot => {
        const preferred = snapshot.docs.find(item => item.id === realConfig.id) || snapshot.docs[0];
        if (preferred) setRealConfig({ ...preferred.data(), id: preferred.id } as DepartmentConfig);
      }, err => handleFirestoreError(err, OperationType.LIST, 'departments')));

      subscribeList<Member>('members', setRealMembers, true);
      subscribeList<SchoolClass>('classes', setRealClasses);
      subscribeList<Assignment>('assignments', setRealAssignments);
      subscribeList<DepartmentPlan>('departmentPlans', setRealDeptPlans);
      subscribeList<TeacherPlan>('teacherPlans', setRealTeacherPlans);
      subscribeList<LessonPlan>('lessonPlans', setRealLessonPlans);
      subscribeList<Meeting>('meetings', setRealMeetings);
      subscribeList<ObservationRecord>('observations', setRealObservations);
      subscribeList<MemberInvitation>('invitations', setRealInvitations);
      subscribeList<AccessRequest>('accessRequests', setRealAccessRequests);
      subscribeList<Question>('questions', setRealQuestions);
      subscribeList<ExamBlueprint>('examBlueprints', setRealExamBlueprints);
      subscribeList<Exam>('exams', setRealExams);
      subscribeList<ExamResultRecord>('examResults', setRealExamResults);
      subscribeList<SpecialTopic>('specialTopics', setRealSpecialTopics);
      subscribeList<SkknTopic>('skknTopics', setRealSkknTopics);
      subscribeList<TrainingRecord>('trainings', setRealTrainings);
      subscribeList<InitiativeRecord>('initiatives', setRealInitiatives);
      subscribeList<SharedDocument>('documents', setRealDocuments);
      subscribeList<ReportSnapshot>('reportSnapshots', setReportSnapshots);
      subscribeList<AuditLog>('auditLogs', setRealAuditLogs);

      return () => {
        subscriptions.forEach(unsubscribe => unsubscribe());
      };
    } catch (e) {
      console.warn('Firestore subscription restricted:', e);
    }
  }, [isDemoMode, isFirestoreConnected, currentUser, realConfig.id]);

  // Current effective data depending on mode
  const currentMembers = isDemoMode ? SAMPLE_MEMBERS : realMembers;
  const currentConfig = isDemoMode ? demoConfig : realConfig;
  const currentClasses = isDemoMode ? demoClasses : realClasses;
  const currentAssignments = isDemoMode ? demoAssignments : realAssignments;
  const currentDeptPlans = isDemoMode ? demoDeptPlans : realDeptPlans;
  const currentTeacherPlans = isDemoMode ? [] : realTeacherPlans;
  const currentLessonPlans = isDemoMode ? demoLessonPlans : realLessonPlans;
  const currentInvitations = isDemoMode ? demoInvitations : realInvitations;
  const currentAccessRequests = isDemoMode ? demoAccessRequests : realAccessRequests;
  const currentMeetings = isDemoMode ? SAMPLE_MEETINGS : realMeetings;
  const currentObservations = isDemoMode ? SAMPLE_OBSERVATIONS : realObservations;
  const currentSpecialTopics = isDemoMode ? ENRICHED_SAMPLE_SPECIAL_TOPICS : realSpecialTopics;
  const currentSkknTopics = isDemoMode ? SAMPLE_SKKN_TOPICS : realSkknTopics;
  const currentTrainings = isDemoMode ? SAMPLE_TRAININGS : realTrainings;
  const currentInitiatives = isDemoMode ? SAMPLE_INITIATIVES : realInitiatives;
  const currentAuditLogs = isDemoMode
    ? [
        {
          id: 'log-01',
          action: 'Duyệt kế hoạch dạy học',
          actorId: 'gv-01',
          actorName: 'ThS. Lê Quốc Dũng',
          targetType: 'DepartmentPlan',
          targetId: 'dplan-2026-12',
          details: 'Duyệt phân phối chương trình môn Toán Khối 12 GDPT 2018',
          timestamp: '2026-09-08T15:00:00Z',
        },
      ]
    : realAuditLogs;
  const currentQuestions = isDemoMode ? demoQuestions : realQuestions;
  const currentExamBlueprints = isDemoMode ? demoExamBlueprints : realExamBlueprints;
  const currentExams = isDemoMode ? demoExams : realExams;
  const currentExamResults = isDemoMode ? demoExamResults : realExamResults;
  const currentDocuments = isDemoMode ? demoDocuments : realDocuments;

  // LỖI 23: Access Authorization: in demo mode always allowed; in real mode check member or accepted invitation
  const isUserAuthorized = useMemo(() => {
    if (isDemoMode) return true;
    if (!currentUser) return true; // Allows browsing read-only or seeing sign-in
    const email = currentUser.email?.toLowerCase().trim();
    if (!email) return false;
    const isMember = realMembers.some(m => m.email.toLowerCase().trim() === email);
    const isAcceptedInv = realInvitations.some(i => i.email.toLowerCase().trim() === email && i.status === 'accepted');
    return isMember || isAcceptedInv;
  }, [isDemoMode, currentUser, realMembers, realInvitations]);

  const activeMember =
    currentMembers.find(m => m.id === activeMemberId) ||
    currentMembers[0] || {
      id: 'default',
      email: 'guest@toan.edu.vn',
      displayName: 'Khách',
      role: 'teacher',
      qualifications: 'Cử nhân',
      subject: 'Toán',
      status: 'active',
      joinedAt: new Date().toISOString(),
    };

  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
      await signInWithPopup(auth, googleProvider);
      localStorage.setItem('to-toan-data-mode', 'real');
      setIsDemoMode(false);
      setNotification({ message: 'Đăng nhập Google thành công!', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setNotification({ message: `Đăng nhập thất bại: ${err.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.setItem('to-toan-data-mode', 'demo');
      setIsDemoMode(true);
      setNotification({ message: 'Đã đăng xuất khỏi hệ thống.', type: 'info' });
    } catch (err: any) {
      console.error(err);
    }
  };

  const toggleDemoMode = () => {
    setIsDemoMode(prev => {
      const next = !prev;
      localStorage.setItem('to-toan-data-mode', next ? 'demo' : 'real');
      setNotification({
        message: next
          ? 'Đã chuyển sang [CHẾ ĐỘ TRẢI NGHIỆM - DỮ LIỆU MẪU].'
          : 'Đã chuyển sang [DỮ LIỆU CHÍNH THỨC]. Dữ liệu mẫu không làm ảnh hưởng cơ sở dữ liệu thật.',
        type: 'info',
      });
      return next;
    });
  };

  const switchActiveRole = (newRole: UserRole) => {
    const found = currentMembers.find(m => m.role === newRole);
    if (found) {
      setActiveMemberId(found.id);
    } else {
      setActiveMemberId(currentMembers[0]?.id || 'gv-01');
    }
    setNotification({
      message: `Đã đổi vai trò kiểm thử sang: ${newRole.toUpperCase()}`,
      type: 'info',
    });
  };

  const selectActiveMember = (memberId: string) => {
    setActiveMemberId(memberId);
  };

  const logAction = async (action: string, targetType: string, targetId: string, details: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action,
      actorId: activeMember.id,
      actorName: activeMember.displayName,
      targetType,
      targetId,
      details,
      timestamp: new Date().toISOString(),
    };

    if (isDemoMode) {
      // Demo log
    } else {
      setRealAuditLogs(prev => [newLog, ...prev]);
      if (isFirestoreConnected) {
        try {
          await setDoc(doc(db, 'auditLogs', newLog.id), newLog);
        } catch (e) {
          console.warn('Audit log write error:', e);
        }
      }
    }
  };

  // CRUD Helpers
  const updateConfig = async (newConfig: Partial<DepartmentConfig>) => {
    if (isDemoMode) {
      setDemoConfig(prev => ({ ...prev, ...newConfig }));
      setNotification({ message: 'Cập nhật cấu hình trong chế độ mẫu thành công!', type: 'success' });
    } else {
      setRealConfig(prev => ({ ...prev, ...newConfig }));
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'departments', realConfig.id), { ...realConfig, ...newConfig });
      }
      setNotification({ message: 'Đã lưu cấu hình tổ vào Firestore!', type: 'success' });
    }
    await logAction('Cập nhật cấu hình tổ', 'DepartmentConfig', 'config', 'Thay đổi thông tin năm học / trường / cấu hình nâng cao');
  };

  const transitionToNewAcademicYear = async (
    newYear: string,
    options: { copyConfig?: boolean; copyPlans?: boolean; keepQuestions?: boolean } = {}
  ) => {
    if (isDemoMode) {
      setDemoConfig(prev => ({
        ...prev,
        academicYear: newYear,
        currentTerm: 'HK1',
      }));
      // Reset assignments and meetings as specified for new year
      setDemoAssignments([]);
      if (options.copyPlans) {
        setDemoDeptPlans(prev =>
          prev.map(p => ({
            ...p,
            id: `dplan-${newYear.replace(/[^0-9]/g, '')}-${p.grade}`,
            academicYear: newYear,
            status: 'draft',
            version: 1,
            versionHistory: [
              {
                version: 1,
                updatedAt: new Date().toISOString(),
                updatedBy: activeMember.displayName,
                changeSummary: `Khởi tạo kế hoạch năm học mới ${newYear} từ khung chương trình năm trước`,
                status: 'draft',
                comment: 'Bản dự thảo ban đầu cho năm học mới.',
              },
            ],
            comments: [],
            distribution: p.distribution.map(item => ({
              ...item,
              status: 'planned',
              dateTaught: undefined,
            })),
          }))
        );
      }
      setNotification({
        message: `Đã chuyển sang năm học mới ${newYear}! Ngân hàng câu hỏi được bảo lưu nguyên vẹn, phân công giảng dạy đã được làm mới.`,
        type: 'success',
      });
    } else {
      const updatedConfig: DepartmentConfig = {
        ...realConfig,
        academicYear: newYear,
        currentTerm: 'HK1',
      };
      setRealConfig(updatedConfig);
      setRealAssignments([]);
      setRealMeetings([]);
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'departments', realConfig.id), updatedConfig);
      }
      setNotification({
        message: `Đã thiết lập năm học mới ${newYear} trên hệ thống!`,
        type: 'success',
      });
    }
    await logAction('Chuyển năm học', 'AcademicYear', newYear, `Thiết lập năm học mới ${newYear}`);
  };

  const addClass = async (cls: SchoolClass) => {
    if (isDemoMode) {
      setDemoClasses(prev => [...prev, cls]);
    } else {
      setRealClasses(prev => [...prev, cls]);
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'classes', cls.id), cls);
      }
    }
    setNotification({ message: `Đã thêm lớp ${cls.name}`, type: 'success' });
    await logAction('Thêm lớp học', 'SchoolClass', cls.id, `Lớp ${cls.name} - Khối ${cls.grade}`);
  };

  const deleteClass = async (id: string) => {
    if (isDemoMode) {
      setDemoClasses(prev => prev.filter(c => c.id !== id));
    } else {
      setRealClasses(prev => prev.filter(c => c.id !== id));
      if (isFirestoreConnected) {
        await deleteDoc(doc(db, 'classes', id));
      }
    }
    setNotification({ message: 'Đã xóa lớp học', type: 'info' });
    await logAction('Xóa lớp học', 'SchoolClass', id, 'Xóa lớp khỏi danh mục');
  };

  const saveAssignment = async (asg: Assignment) => {
    if (isDemoMode) {
      setDemoAssignments(prev => {
        const idx = prev.findIndex(a => a.id === asg.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = asg;
          return cp;
        }
        return [...prev, asg];
      });
    } else {
      setRealAssignments(prev => {
        const idx = prev.findIndex(a => a.id === asg.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = asg;
          return cp;
        }
        return [...prev, asg];
      });
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'assignments', asg.id), asg);
      }
    }
    setNotification({ message: `Đã lưu phân công cho ${asg.teacherName}`, type: 'success' });
  };

  const setAssignments = async (asgs: Assignment[]) => {
    if (isDemoMode) {
      setDemoAssignments(asgs);
    } else {
      setRealAssignments(asgs);
    }
    setNotification({ message: `Đã nhập ${asgs.length} phân công giảng dạy`, type: 'success' });
  };

  const deleteAssignment = async (id: string) => {
    if (isDemoMode) {
      setDemoAssignments(prev => prev.filter(a => a.id !== id));
    } else {
      setRealAssignments(prev => prev.filter(a => a.id !== id));
      if (isFirestoreConnected) {
        await deleteDoc(doc(db, 'assignments', id));
      }
    }
    setNotification({ message: 'Đã xóa phân công giảng dạy', type: 'info' });
  };

  // LỖI 21: Workflow & Versioning for Department Plans
  const saveDepartmentPlan = async (plan: DepartmentPlan) => {
    const updatedPlan: DepartmentPlan = {
      ...plan,
      updatedAt: new Date().toISOString(),
    };
    if (isDemoMode) {
      setDemoDeptPlans(prev => {
        const idx = prev.findIndex(p => p.id === updatedPlan.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = updatedPlan;
          return cp;
        }
        return [...prev, updatedPlan];
      });
    } else {
      setRealDeptPlans(prev => {
        const idx = prev.findIndex(p => p.id === updatedPlan.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = updatedPlan;
          return cp;
        }
        return [...prev, updatedPlan];
      });
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'departmentPlans', updatedPlan.id), updatedPlan);
      }
    }
    setNotification({ message: `Kế hoạch dạy học đã được lưu (Trạng thái: ${updatedPlan.status})`, type: 'success' });
    await logAction('Lưu kế hoạch tổ', 'DepartmentPlan', updatedPlan.id, `Phiên bản v${updatedPlan.version}`);
  };

  const submitDepartmentPlan = async (planId: string, comment?: string) => {
    const plan = currentDeptPlans.find(p => p.id === planId);
    if (!plan) return;
    const nextVersion = plan.version + 1;
    const versionRecord = {
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: activeMember.displayName,
      changeSummary: 'Nộp kế hoạch dạy học lên Ban Giám Hiệu phê duyệt',
      status: 'submitted' as const,
      comment: comment || 'Kính trình Ban Giám hiệu xem xét, góp ý và phê duyệt.',
      dataSnapshot: {
        title: plan.title,
        weeksCount: plan.distribution.length,
        totalPeriods: plan.distribution.reduce((s, i) => s + i.periods, 0),
        distributionCount: plan.distribution.length,
      },
    };
    const updatedPlan: DepartmentPlan = {
      ...plan,
      status: 'submitted',
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      versionHistory: [...(plan.versionHistory || []), versionRecord],
    };
    await saveDepartmentPlan(updatedPlan);
    setNotification({ message: 'Đã nộp Kế hoạch dạy học lên BGH phê duyệt thành công!', type: 'success' });
    await logAction('Nộp kế hoạch tổ', 'DepartmentPlan', planId, `Nộp phiên bản v${nextVersion}`);
  };

  const reviewDepartmentPlan = async (planId: string, action: 'approve' | 'returned', note: string) => {
    const plan = currentDeptPlans.find(p => p.id === planId);
    if (!plan) return;
    const isApprove = action === 'approve';
    const nextStatus = isApprove ? ('approved' as const) : ('returned' as const);
    const versionRecord = {
      version: plan.version,
      updatedAt: new Date().toISOString(),
      updatedBy: activeMember.displayName,
      changeSummary: isApprove ? 'Ban Giám Hiệu phê duyệt kế hoạch' : 'Yêu cầu điều chỉnh, bổ sung kế hoạch',
      status: nextStatus,
      comment: note,
      dataSnapshot: {
        title: plan.title,
        weeksCount: plan.distribution.length,
        totalPeriods: plan.distribution.reduce((s, i) => s + i.periods, 0),
        distributionCount: plan.distribution.length,
      },
    };
    const newComment = {
      id: `pcom-${Date.now()}`,
      authorId: activeMember.id,
      authorName: activeMember.displayName,
      content: note,
      type: isApprove ? ('approval_note' as const) : ('return_reason' as const),
      createdAt: new Date().toISOString(),
    };
    const updatedPlan: DepartmentPlan = {
      ...plan,
      status: nextStatus,
      approvedBy: isApprove ? activeMember.displayName : plan.approvedBy,
      updatedAt: new Date().toISOString(),
      versionHistory: [...(plan.versionHistory || []), versionRecord],
      comments: [...(plan.comments || []), newComment],
    };
    await saveDepartmentPlan(updatedPlan);
    setNotification({
      message: isApprove ? 'Đã phê duyệt Kế hoạch dạy học thành công!' : 'Đã trả lại Kế hoạch dạy học kèm góp ý điều chỉnh.',
      type: isApprove ? 'success' : 'info',
    });
    await logAction('Duyệt kế hoạch tổ', 'DepartmentPlan', planId, `${isApprove ? 'Phê duyệt' : 'Yêu cầu điều chỉnh'}: ${note}`);
  };

  const updatePlanDistributionStatus = async (
    planId: string,
    itemId: string,
    status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'make_up',
    dateTaught?: string
  ) => {
    const plan = currentDeptPlans.find(p => p.id === planId);
    if (!plan) return;
    const updatedDist = plan.distribution.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          status,
          dateTaught: status === 'completed' ? (dateTaught || new Date().toISOString().split('T')[0]) : item.dateTaught,
        };
      }
      return item;
    });
    const updatedPlan: DepartmentPlan = {
      ...plan,
      distribution: updatedDist,
      updatedAt: new Date().toISOString(),
    };
    await saveDepartmentPlan(updatedPlan);
    setNotification({ message: 'Đã cập nhật tiến độ thực hiện tiết dạy!', type: 'success' });
  };

  const saveTeacherPlan = async (plan: TeacherPlan) => {
    if (!isDemoMode) {
      setRealTeacherPlans(prev => {
        const idx = prev.findIndex(p => p.id === plan.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = plan;
          return cp;
        }
        return [...prev, plan];
      });
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'teacherPlans', plan.id), plan);
      }
    }
    setNotification({ message: 'Đã lưu kế hoạch cá nhân của giáo viên', type: 'success' });
  };

  // LỖI 21: Workflow & Versioning for Lesson Plans (Giáo án)
  const saveLessonPlan = async (plan: LessonPlan) => {
    const updatedPlan: LessonPlan = {
      ...plan,
      updatedAt: new Date().toISOString(),
    };
    if (isDemoMode) {
      setDemoLessonPlans(prev => {
        const idx = prev.findIndex(p => p.id === updatedPlan.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = updatedPlan;
          return cp;
        }
        return [...prev, updatedPlan];
      });
    } else {
      setRealLessonPlans(prev => {
        const idx = prev.findIndex(p => p.id === updatedPlan.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = updatedPlan;
          return cp;
        }
        return [...prev, updatedPlan];
      });
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'lessonPlans', updatedPlan.id), updatedPlan);
      }
    }
    setNotification({ message: `Đã lưu kế hoạch bài dạy: ${updatedPlan.title}`, type: 'success' });
    await logAction('Lưu kế hoạch bài dạy', 'LessonPlan', updatedPlan.id, `Trạng thái: ${updatedPlan.status}`);
  };

  const deleteLessonPlan = async (id: string) => {
    if (isDemoMode) {
      setDemoLessonPlans(prev => prev.filter(p => p.id !== id));
    } else {
      setRealLessonPlans(prev => prev.filter(p => p.id !== id));
      if (isFirestoreConnected) {
        await deleteDoc(doc(db, 'lessonPlans', id));
      }
    }
    setNotification({ message: 'Đã xóa kế hoạch bài dạy', type: 'info' });
  };

  const submitLessonPlan = async (planId: string, comment?: string) => {
    const plan = currentLessonPlans.find(p => p.id === planId);
    if (!plan) return;
    const nextVersion = (plan.version || 1) + 1;
    const versionRecord = {
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: activeMember.displayName,
      changeSummary: 'Nộp kế hoạch bài dạy lên Tổ trưởng chuyên môn',
      status: 'submitted' as const,
      comment: comment || 'Kính gửi Tổ trưởng phê duyệt kế hoạch bài dạy.',
      dataSnapshot: {
        title: plan.title,
        activitiesCount: plan.activities?.length || 0,
      },
    };
    const updatedPlan: LessonPlan = {
      ...plan,
      status: 'submitted',
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      versionHistory: [...(plan.versionHistory || []), versionRecord],
    };
    await saveLessonPlan(updatedPlan);
    setNotification({ message: 'Đã nộp kế hoạch bài dạy lên Tổ chuyên môn duyệt!', type: 'success' });
  };

  const reviewLessonPlan = async (planId: string, action: 'approve' | 'returned', note: string) => {
    const plan = currentLessonPlans.find(p => p.id === planId);
    if (!plan) return;
    const isApprove = action === 'approve';
    const nextStatus = isApprove ? ('approved' as const) : ('returned' as const);
    const versionRecord = {
      version: plan.version || 1,
      updatedAt: new Date().toISOString(),
      updatedBy: activeMember.displayName,
      changeSummary: isApprove ? 'Tổ chuyên môn phê duyệt kế hoạch bài dạy' : 'Yêu cầu chỉnh sửa, bổ sung giáo án',
      status: nextStatus,
      comment: note,
      dataSnapshot: {
        title: plan.title,
        activitiesCount: plan.activities?.length || 0,
      },
    };
    const updatedPlan: LessonPlan = {
      ...plan,
      status: nextStatus,
      approvedBy: isApprove ? activeMember.displayName : plan.approvedBy,
      updatedAt: new Date().toISOString(),
      versionHistory: [...(plan.versionHistory || []), versionRecord],
    };
    await saveLessonPlan(updatedPlan);
    setNotification({
      message: isApprove ? 'Đã phê duyệt kế hoạch bài dạy!' : 'Đã trả lại kế hoạch bài dạy kèm góp ý.',
      type: isApprove ? 'success' : 'info',
    });
  };

  const updateLessonPlanTeachingStatus = async (
    planId: string,
    status: 'not_taught' | 'in_progress' | 'completed',
    taughtDate?: string,
    classes?: string[]
  ) => {
    const plan = currentLessonPlans.find(p => p.id === planId);
    if (!plan) return;
    const isCompleted = status === 'completed';
    const updatedPlan: LessonPlan = {
      ...plan,
      teachingStatus: status,
      isTaught: isCompleted,
      taughtDate: taughtDate || (isCompleted ? new Date().toISOString().split('T')[0] : plan.taughtDate),
      taughtClasses: classes || plan.taughtClasses || plan.classNames,
      updatedAt: new Date().toISOString(),
    };
    await saveLessonPlan(updatedPlan);
    setNotification({ message: 'Đã cập nhật trạng thái thực dạy của giáo án!', type: 'success' });
  };

  // LỖI 23: Member Invitations & Access Requests Handlers
  const inviteMemberByEmail = async (invData: { email: string; displayName: string; role: UserRole; subject?: string }) => {
    const newInv: MemberInvitation = {
      id: `inv-${Date.now()}`,
      email: invData.email.trim().toLowerCase(),
      displayName: invData.displayName.trim(),
      role: invData.role,
      subject: invData.subject || 'Toán',
      status: 'pending',
      invitedBy: activeMember.displayName,
      invitedAt: new Date().toISOString(),
    };

    if (isDemoMode) {
      setDemoInvitations(prev => [newInv, ...prev]);
    } else {
      setRealInvitations(prev => [newInv, ...prev]);
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'invitations', newInv.id), newInv);
      }
    }
    setNotification({
      message: `Đã gửi thư mời tham gia Tổ Toán đến email: ${newInv.email}`,
      type: 'success',
    });
    await logAction('Gửi thư mời', 'MemberInvitation', newInv.id, `Mời ${newInv.displayName} (${newInv.email}) vai trò ${newInv.role}`);
  };

  const cancelInvitation = async (id: string) => {
    if (isDemoMode) {
      setDemoInvitations(prev => prev.filter(i => i.id !== id));
    } else {
      setRealInvitations(prev => prev.filter(i => i.id !== id));
      if (isFirestoreConnected) {
        await deleteDoc(doc(db, 'invitations', id));
      }
    }
    setNotification({ message: 'Đã hủy thư mời tham gia', type: 'info' });
  };

  const submitAccessRequest = async (email: string, displayName: string, reason: string) => {
    const req: AccessRequest = {
      id: `req-${Date.now()}`,
      email: email.trim().toLowerCase(),
      displayName: displayName.trim(),
      reason: reason.trim(),
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    if (isDemoMode) {
      setDemoAccessRequests(prev => [req, ...prev]);
    } else {
      setRealAccessRequests(prev => [req, ...prev]);
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'accessRequests', req.id), req);
      }
    }
    setNotification({
      message: 'Yêu cầu cấp quyền truy cập đã được gửi đến Tổ trưởng và Quản trị viên.',
      type: 'success',
    });
  };

  const respondToAccessRequest = async (id: string, action: 'approved' | 'rejected', role: UserRole = 'teacher') => {
    const req = currentAccessRequests.find(r => r.id === id);
    if (!req) return;

    if (action === 'approved') {
      // Add user to members
      const newMember: Member = {
        id: `mem-${Date.now()}`,
        email: req.email,
        displayName: req.displayName,
        role,
        subject: 'Toán',
        status: 'active',
        joinedAt: new Date().toISOString(),
      };
      if (isDemoMode) {
        SAMPLE_MEMBERS.push(newMember);
        setDemoAccessRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
      } else {
        setRealMembers(prev => [...prev, newMember]);
        setRealAccessRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
        if (isFirestoreConnected) {
          await setDoc(doc(db, 'members', newMember.id), newMember);
          await updateDoc(doc(db, 'accessRequests', id), { status: 'approved' });
        }
      }
      setNotification({ message: `Đã phê duyệt quyền truy cập cho ${req.displayName}`, type: 'success' });
    } else {
      if (isDemoMode) {
        setDemoAccessRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
      } else {
        setRealAccessRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
        if (isFirestoreConnected) {
          await updateDoc(doc(db, 'accessRequests', id), { status: 'rejected' });
        }
      }
      setNotification({ message: `Đã từ chối yêu cầu của ${req.displayName}`, type: 'info' });
    }
    await logAction('Xử lý yêu cầu truy cập', 'AccessRequest', id, `${action === 'approved' ? 'Phê duyệt' : 'Từ chối'} quyền của ${req.displayName}`);
  };

  const saveMeeting = async (meeting: Meeting) => {
    if (isDemoMode) {
      const idx = SAMPLE_MEETINGS.findIndex(m => m.id === meeting.id);
      if (idx >= 0) SAMPLE_MEETINGS[idx] = meeting;
      else SAMPLE_MEETINGS.push(meeting);
    } else {
      setRealMeetings(prev => {
        const idx = prev.findIndex(m => m.id === meeting.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = meeting;
          return cp;
        }
        return [...prev, meeting];
      });
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'meetings', meeting.id), meeting);
      }
    }
    setNotification({ message: `Đã lưu biên bản sinh hoạt chuyên môn`, type: 'success' });
    await logAction('Lưu biên bản họp', 'Meeting', meeting.id, `Trạng thái: ${meeting.status}`);
  };

  const saveObservation = async (obs: ObservationRecord) => {
    if (isDemoMode) {
      const idx = SAMPLE_OBSERVATIONS.findIndex(o => o.id === obs.id);
      if (idx >= 0) SAMPLE_OBSERVATIONS[idx] = obs;
      else SAMPLE_OBSERVATIONS.push(obs);
    } else {
      setRealObservations(prev => {
        const idx = prev.findIndex(o => o.id === obs.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = obs;
          return cp;
        }
        return [...prev, obs];
      });
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'observations', obs.id), obs);
      }
    }
    setNotification({ message: `Đã lưu phiếu dự giờ tiết ${obs.period} - lớp ${obs.className}`, type: 'success' });
    await logAction('Lưu phiếu dự giờ', 'Observation', obs.id, `Người dạy: ${obs.teacherName}`);
  };

  const saveQuestion = async (q: Question) => {
    if (isDemoMode) {
      setDemoQuestions(prev => {
        const idx = prev.findIndex(item => item.id === q.id);
        if (idx < 0) return [q, ...prev];
        const next = [...prev]; next[idx] = q; return next;
      });
    } else {
      setRealQuestions(prev => {
        const idx = prev.findIndex(item => item.id === q.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = q;
          return cp;
        }
        return [q, ...prev];
      });
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'questions', q.id), q);
      }
    }
    setNotification({ message: `Đã lưu câu hỏi vào ngân hàng (${q.difficulty})`, type: 'success' });
    await logAction('Lưu câu hỏi', 'Question', q.id, `Dạng: ${q.type}, Khối: ${q.grade}`);
  };

  const deleteQuestion = async (id: string) => {
    if (isDemoMode) {
      setDemoQuestions(prev => prev.filter(q => q.id !== id));
    } else {
      setRealQuestions(prev => prev.filter(q => q.id !== id));
      if (isFirestoreConnected) {
        await deleteDoc(doc(db, 'questions', id));
      }
    }
    setNotification({ message: 'Đã xóa câu hỏi khỏi ngân hàng', type: 'info' });
  };

  const saveExamBlueprint = async (bp: ExamBlueprint) => {
    if (isDemoMode) {
      setDemoExamBlueprints(prev => {
        const idx = prev.findIndex(b => b.id === bp.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = bp;
          return cp;
        }
        return [...prev, bp];
      });
    } else {
      setRealExamBlueprints(prev => {
        const idx = prev.findIndex(b => b.id === bp.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = bp;
          return cp;
        }
        return [...prev, bp];
      });
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'examBlueprints', bp.id), bp);
      }
    }
    setNotification({ message: 'Đã lưu ma trận và bản đặc tả đề kiểm tra', type: 'success' });
  };

  const saveExam = async (exam: Exam) => {
    if (isDemoMode) {
      setDemoExams(prev => {
        const idx = prev.findIndex(e => e.id === exam.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = exam;
          return cp;
        }
        return [...prev, exam];
      });
    } else {
      setRealExams(prev => {
        const idx = prev.findIndex(e => e.id === exam.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = exam;
          return cp;
        }
        return [...prev, exam];
      });
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'exams', exam.id), exam);
      }
    }
    setNotification({ message: `Đã lưu đề kiểm tra: ${exam.title}`, type: 'success' });
    await logAction('Lưu đề kiểm tra', 'Exam', exam.id, `Trạng thái: ${exam.status}, Công bố: ${exam.isPublished}`);
  };

  const deleteExam = async (id: string) => {
    if (isDemoMode) {
      setDemoExams(prev => prev.filter(e => e.id !== id));
    } else {
      setRealExams(prev => prev.filter(e => e.id !== id));
      if (isFirestoreConnected) {
        await deleteDoc(doc(db, 'exams', id));
      }
    }
    setNotification({ message: 'Đã xóa đề kiểm tra', type: 'info' });
  };

  const saveExamResult = async (result: ExamResultRecord) => {
    if (isDemoMode) {
      setDemoExamResults(prev => {
        const idx = prev.findIndex(r => r.id === result.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = result;
          return cp;
        }
        return [...prev, result];
      });
    } else {
      setRealExamResults(prev => {
        const idx = prev.findIndex(r => r.id === result.id);
        if (idx >= 0) {
          const cp = [...prev];
          cp[idx] = result;
          return cp;
        }
        return [...prev, result];
      });
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'examResults', result.id), result);
      }
    }
    setNotification({ message: `Đã lưu kết quả kiểm tra lớp ${result.className}`, type: 'success' });
  };

  const saveReportSnapshot = async (snapshot: ReportSnapshot) => {
    setReportSnapshots(prev => {
      const idx = prev.findIndex(s => s.id === snapshot.id);
      if (idx >= 0) {
        const cp = [...prev];
        cp[idx] = snapshot;
        return cp;
      }
      return [...prev, snapshot];
    });
    if (!isDemoMode && isFirestoreConnected) {
      await setDoc(doc(db, 'reportSnapshots', snapshot.id), snapshot);
    }
    setNotification({
      message: `Đã lưu báo cáo: "${snapshot.title}" (${snapshot.isLocked ? 'Đã chốt & khóa' : 'Bản nháp lưu'})`,
      type: 'success',
    });
    await logAction('Lưu báo cáo định kỳ', 'ReportSnapshot', snapshot.id, `Trạng thái: ${snapshot.isLocked ? 'Chốt' : 'Nháp'}`);
  };

  const saveSpecialTopic = async (topic: SpecialTopic) => {
    if (isDemoMode) {
      SAMPLE_SPECIAL_TOPICS.push(topic);
    } else {
      setRealSpecialTopics(prev => [...prev.filter(item => item.id !== topic.id), topic]);
      if (isFirestoreConnected) await setDoc(doc(db, 'specialTopics', topic.id), topic);
    }
    setNotification({ message: 'Đã lưu chuyên đề bồi dưỡng', type: 'success' });
  };

  const saveTraining = async (t: TrainingRecord) => {
    if (isDemoMode) {
      SAMPLE_TRAININGS.push(t);
    } else {
      setRealTrainings(prev => [...prev.filter(item => item.id !== t.id), t]);
      if (isFirestoreConnected) await setDoc(doc(db, 'trainings', t.id), t);
    }
    setNotification({ message: 'Đã lưu hồ sơ bồi dưỡng thường xuyên', type: 'success' });
  };

  const saveInitiative = async (init: InitiativeRecord) => {
    if (isDemoMode) {
      SAMPLE_INITIATIVES.push(init);
    } else {
      setRealInitiatives(prev => [...prev.filter(item => item.id !== init.id), init]);
      if (isFirestoreConnected) await setDoc(doc(db, 'initiatives', init.id), init);
    }
    setNotification({ message: 'Đã lưu đăng ký sáng kiến kinh nghiệm', type: 'success' });
  };

  const saveDocument = async (docObj: SharedDocument) => {
    if (isDemoMode) {
      setDemoDocuments(prev => [docObj, ...prev.filter(item => item.id !== docObj.id)]);
    } else {
      setRealDocuments(prev => [...prev, docObj]);
      if (isFirestoreConnected) {
        await setDoc(doc(db, 'documents', docObj.id), docObj);
      }
    }
    setNotification({ message: 'Đã lưu tài liệu dùng chung', type: 'success' });
  };

  const setActiveMember = (m: Member) => {
    setActiveMemberId(m.id);
  };

  const saveSkknTopic = async (skkn: SkknTopic) => {
    if (isDemoMode) {
      SAMPLE_SKKN_TOPICS.unshift(skkn);
    } else {
      setRealSkknTopics(prev => [skkn, ...prev.filter(item => item.id !== skkn.id)]);
      if (isFirestoreConnected) await setDoc(doc(db, 'skknTopics', skkn.id), skkn);
    }
    setNotification({ message: 'Đã lưu đề tài SKKN', type: 'success' });
  };

  const saveScoreRecord = async (record: ScoreRecord) => {
    await saveExamResult(record as any);
  };

  const resetToSampleData = async () => {
    localStorage.setItem('to-toan-data-mode', 'demo');
    setIsDemoMode(true);
    setNotification({ message: 'Đã khôi phục dữ liệu mẫu thử nghiệm', type: 'info' });
  };

  const clearAllRealData = async () => {
    if (isFirestoreConnected) {
      const collectionsToClear = [
        'classes', 'assignments', 'departmentPlans', 'teacherPlans', 'lessonPlans',
        'meetings', 'observations', 'questions', 'examBlueprints', 'exams', 'examResults',
        'specialTopics', 'skknTopics', 'trainings', 'initiatives', 'documents', 'reportSnapshots',
      ];
      for (const collectionName of collectionsToClear) {
        const snapshot = await getDocs(collection(db, collectionName));
        await Promise.all(snapshot.docs.map(item => deleteDoc(item.ref)));
      }
    }
    setRealClasses([]);
    setRealAssignments([]);
    setRealDeptPlans([]);
    setRealTeacherPlans([]);
    setRealLessonPlans([]);
    setRealMeetings([]);
    setRealObservations([]);
    setRealQuestions([]);
    setRealExamBlueprints([]);
    setRealExams([]);
    setRealExamResults([]);
    setRealSpecialTopics([]);
    setRealSkknTopics([]);
    setRealTrainings([]);
    setRealInitiatives([]);
    setRealDocuments([]);
    setReportSnapshots([]);
    setRealAuditLogs([]);
    localStorage.setItem('to-toan-data-mode', 'real');
    setIsDemoMode(false);
    setNotification({ message: 'Đã xóa trắng dữ liệu thật để bắt đầu năm học mới', type: 'info' });
  };

  const exportSystemBackup = () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      config: currentConfig,
      members: currentMembers,
      classes: currentClasses,
      assignments: currentAssignments,
      departmentPlans: currentDeptPlans,
      lessonPlans: currentLessonPlans,
      meetings: currentMeetings,
      observations: currentObservations,
      questions: currentQuestions,
      examBlueprints: currentExamBlueprints,
      exams: currentExams,
      examResults: currentExamResults,
      specialTopics: currentSpecialTopics,
      skknTopics: currentSkknTopics,
      trainings: currentTrainings,
      initiatives: currentInitiatives,
      documents: currentDocuments,
      reportSnapshots,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `So_Sinh_Hoat_Chuyen_Mon_To_Toan_${currentConfig.academicYear}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotification({ message: 'Đã tải tệp sao lưu dữ liệu toàn hệ thống', type: 'success' });
  };

  const importSystemBackup = async (data: any) => {
    if (data && data.config) {
      if (data.config) setRealConfig(data.config);
      if (data.members) setRealMembers(data.members);
      if (data.classes) setRealClasses(data.classes);
      if (data.assignments) setRealAssignments(data.assignments);
      if (data.departmentPlans) setRealDeptPlans(data.departmentPlans);
      if (data.lessonPlans) setRealLessonPlans(data.lessonPlans);
      if (data.meetings) setRealMeetings(data.meetings);
      if (data.observations) setRealObservations(data.observations);
      if (data.questions) setRealQuestions(data.questions);
      if (data.exams) setRealExams(data.exams);
      if (data.examResults) setRealExamResults(data.examResults);
      if (data.specialTopics) setRealSpecialTopics(data.specialTopics);
      if (data.skknTopics) setRealSkknTopics(data.skknTopics);
      if (data.trainings) setRealTrainings(data.trainings);
      if (data.initiatives) setRealInitiatives(data.initiatives);
      if (data.documents) setRealDocuments(data.documents);
      if (data.reportSnapshots) setReportSnapshots(data.reportSnapshots);
      if (isFirestoreConnected) {
        const saveList = async (collectionName: string, items: any[] = []) => {
          await Promise.all(items.map(item => setDoc(doc(db, collectionName, item.id), item)));
        };
        await setDoc(doc(db, 'departments', data.config.id || realConfig.id), data.config);
        await saveList('members', data.members);
        await saveList('classes', data.classes);
        await saveList('assignments', data.assignments);
        await saveList('departmentPlans', data.departmentPlans);
        await saveList('lessonPlans', data.lessonPlans);
        await saveList('meetings', data.meetings);
        await saveList('observations', data.observations);
        await saveList('questions', data.questions);
        await saveList('examBlueprints', data.examBlueprints);
        await saveList('exams', data.exams);
        await saveList('examResults', data.examResults);
        await saveList('specialTopics', data.specialTopics);
        await saveList('skknTopics', data.skknTopics);
        await saveList('trainings', data.trainings);
        await saveList('initiatives', data.initiatives);
        await saveList('documents', data.documents);
        await saveList('reportSnapshots', data.reportSnapshots);
      }
      localStorage.setItem('to-toan-data-mode', 'real');
      setIsDemoMode(false);
      setNotification({ message: 'Đã phục hồi dữ liệu từ file sao lưu thành công', type: 'success' });
    } else {
      throw new Error('Định dạng tệp sao lưu không hợp lệ');
    }
  };

  return (
    <AppContext.Provider
      value={{
        isDemoMode,
        toggleDemoMode,
        activeTab,
        setActiveTab,
        currentUser,
        activeMember,
        allMembers: currentMembers,
        loginWithGoogle,
        logout,
        switchActiveRole,
        selectActiveMember,
        setActiveMember,
        isUserAuthorized,
        invitations: currentInvitations,
        inviteMemberByEmail,
        cancelInvitation,
        accessRequests: currentAccessRequests,
        submitAccessRequest,
        respondToAccessRequest,
        config: currentConfig,
        updateConfig,
        transitionToNewAcademicYear,
        classes: currentClasses,
        addClass,
        deleteClass,
        assignments: currentAssignments,
        setAssignments,
        saveAssignment,
        deleteAssignment,
        departmentPlans: currentDeptPlans,
        saveDepartmentPlan,
        submitDepartmentPlan,
        reviewDepartmentPlan,
        updatePlanDistributionStatus,
        teacherPlans: currentTeacherPlans,
        saveTeacherPlan,
        lessonPlans: currentLessonPlans,
        saveLessonPlan,
        deleteLessonPlan,
        submitLessonPlan,
        reviewLessonPlan,
        updateLessonPlanTeachingStatus,
        meetings: currentMeetings,
        saveMeeting,
        observations: currentObservations,
        saveObservation,
        questions: currentQuestions,
        saveQuestion,
        deleteQuestion,
        examBlueprints: currentExamBlueprints,
        saveExamBlueprint,
        exams: currentExams,
        saveExam,
        deleteExam,
        examResults: currentExamResults,
        saveExamResult,
        scoreRecords: currentExamResults as any,
        saveScoreRecord,
        specialTopics: currentSpecialTopics,
        saveSpecialTopic,
        skknTopics: currentSkknTopics,
        saveSkknTopic,
        trainings: currentTrainings,
        saveTraining,
        initiatives: currentInitiatives,
        saveInitiative,
        documents: currentDocuments,
        saveDocument,
        reportSnapshots,
        saveReportSnapshot,
        auditLogs: currentAuditLogs,
        logAction,
        notification,
        setNotification,
        resetToSampleData,
        clearAllRealData,
        exportSystemBackup,
        importSystemBackup,
        isFirestoreConnected,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
