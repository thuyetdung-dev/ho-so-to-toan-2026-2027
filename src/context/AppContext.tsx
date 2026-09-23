import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Member,
  DepartmentConfig,
  SchoolClass,
  Assignment,
  DepartmentPlan,
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
  AccessIndexEntry,
  Question,
  ExamBlueprint,
  Exam,
  ExamResultRecord,
  ScoreRecord,
  SharedDocument,
} from '../types';
import { ActiveModule, MODULE_IDS } from '../components/Sidebar';
import {
  SAMPLE_DEPARTMENT_CONFIG,
  SAMPLE_MEMBERS,
  SAMPLE_CLASSES,
  SAMPLE_ASSIGNMENTS,
  SAMPLE_DEPARTMENT_PLAN,
  SAMPLE_LESSON_PLAN,
  SAMPLE_OBSERVATIONS,
  SAMPLE_MEETINGS,
  SAMPLE_TRAININGS,
  SAMPLE_INITIATIVES,
  SAMPLE_INVITATIONS,
  SAMPLE_ACCESS_REQUESTS,
  SAMPLE_QUESTIONS,
  SAMPLE_DOCUMENTS,
  SAMPLE_SKKN_TOPICS,
  SAMPLE_SPECIAL_TOPICS_ENRICHED,
} from '../services/sample-data';
import { auth, db, googleProvider, OWNER_EMAIL, describeFirebaseError } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { newId } from '../utils/ids';

type Notice = { message: string; type: 'success' | 'error' | 'info' };

/**
 * Trạng thái xác thực ở chế độ dữ liệu thật.
 * - checking: đang chờ Firebase khôi phục phiên / kiểm tra quyền
 * - signed_out: chưa đăng nhập
 * - authorized: là thành viên (hoặc chủ sở hữu hệ thống)
 * - unauthorized: đăng nhập nhưng chưa được cấp quyền
 */
export type AuthStatus = 'checking' | 'signed_out' | 'authorized' | 'unauthorized';

export interface Permissions {
  /** Tổ trưởng, tổ phó, quản trị */
  isLeader: boolean;
  /** Tổ trưởng, quản trị — được cấu hình hệ thống, chuyển năm học, phục hồi dữ liệu */
  isAdminOrHead: boolean;
  isAdmin: boolean;
  /** BGH, tổ trưởng, quản trị — được phê duyệt kế hoạch tổ */
  canApproveDeptPlan: boolean;
  /** Mọi thành viên trừ BGH (chỉ xem & duyệt) */
  canContribute: boolean;
}

interface AppContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  activeTab: ActiveModule;
  setActiveTab: (tab: ActiveModule) => void;

  currentUser: User | null;
  authStatus: AuthStatus;
  activeMember: Member;
  allMembers: Member[];
  permissions: Permissions;
  loginWithGoogle: (options?: { keepDemo?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  switchActiveRole: (role: UserRole) => void;
  selectActiveMember: (memberId: string) => void;
  setActiveMember: (member: Member) => void;
  /** Đổi vai chỉ được phép trong chế độ demo */
  canSimulateRoles: boolean;
  isUserAuthorized: boolean;
  saveMember: (member: Member) => Promise<boolean>;
  /** Tạo/cập nhật nhiều hồ sơ thành viên một lần (dùng khi nhập phân công từ Excel) */
  saveMembersBulk: (members: Member[]) => Promise<boolean>;
  /** Thêm nhiều lớp một lần (bỏ qua lớp đã tồn tại) */
  addClassesBulk: (classes: SchoolClass[]) => Promise<boolean>;
  removeMember: (memberId: string) => Promise<boolean>;

  invitations: MemberInvitation[];
  inviteMemberByEmail: (inv: { email: string; displayName: string; role: UserRole; subject?: string }) => Promise<void>;
  cancelInvitation: (id: string) => Promise<void>;
  accessRequests: AccessRequest[];
  submitAccessRequest: (email: string, displayName: string, reason: string) => Promise<void>;
  respondToAccessRequest: (id: string, action: 'approved' | 'rejected', role?: UserRole) => Promise<void>;

  config: DepartmentConfig;
  updateConfig: (newConfig: Partial<DepartmentConfig>) => Promise<boolean>;
  transitionToNewAcademicYear: (newYear: string, options?: { copyConfig?: boolean; copyPlans?: boolean; keepQuestions?: boolean }) => Promise<void>;

  classes: SchoolClass[];
  addClass: (cls: SchoolClass) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  assignments: Assignment[];
  setAssignments: (asgs: Assignment[]) => Promise<void>;
  saveAssignment: (asg: Assignment) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;

  departmentPlans: DepartmentPlan[];
  saveDepartmentPlan: (plan: DepartmentPlan, options?: { silent?: boolean }) => Promise<boolean>;
  deleteDepartmentPlan: (id: string) => Promise<void>;
  submitDepartmentPlan: (planId: string, comment?: string) => Promise<void>;
  reviewDepartmentPlan: (planId: string, action: 'approve' | 'returned', note: string) => Promise<void>;
  updatePlanDistributionStatus: (planId: string, itemId: string, status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'make_up', dateTaught?: string) => Promise<void>;

  teacherPlans: TeacherPlan[];
  saveTeacherPlan: (plan: TeacherPlan) => Promise<void>;
  lessonPlans: LessonPlan[];
  saveLessonPlan: (plan: LessonPlan, options?: { silent?: boolean }) => Promise<boolean>;
  deleteLessonPlan: (id: string) => Promise<void>;
  submitLessonPlan: (planId: string, comment?: string) => Promise<void>;
  reviewLessonPlan: (planId: string, action: 'approve' | 'returned', note: string) => Promise<void>;
  updateLessonPlanTeachingStatus: (planId: string, status: 'not_taught' | 'in_progress' | 'completed', taughtDate?: string, classes?: string[]) => Promise<void>;

  meetings: Meeting[];
  saveMeeting: (meeting: Meeting, options?: { silent?: boolean }) => Promise<boolean>;
  deleteMeeting: (id: string) => Promise<void>;
  observations: ObservationRecord[];
  saveObservation: (obs: ObservationRecord, options?: { silent?: boolean }) => Promise<boolean>;
  deleteObservation: (id: string) => Promise<void>;

  questions: Question[];
  saveQuestion: (q: Question) => Promise<boolean>;
  deleteQuestion: (id: string) => Promise<void>;
  examBlueprints: ExamBlueprint[];
  saveExamBlueprint: (bp: ExamBlueprint) => Promise<void>;
  exams: Exam[];
  saveExam: (exam: Exam) => Promise<boolean>;
  deleteExam: (id: string) => Promise<void>;
  examResults: ExamResultRecord[];
  saveExamResult: (result: ExamResultRecord) => Promise<boolean>;
  deleteExamResult: (id: string) => Promise<void>;
  scoreRecords: ScoreRecord[];
  saveScoreRecord: (record: ScoreRecord) => Promise<boolean>;
  documents: SharedDocument[];
  saveDocument: (document: SharedDocument) => Promise<boolean>;
  deleteDocument: (id: string) => Promise<void>;

  specialTopics: SpecialTopic[];
  saveSpecialTopic: (topic: SpecialTopic) => Promise<boolean>;
  deleteSpecialTopic: (id: string) => Promise<void>;
  skknTopics: SkknTopic[];
  saveSkknTopic: (topic: SkknTopic) => Promise<boolean>;
  deleteSkknTopic: (id: string) => Promise<void>;
  trainings: TrainingRecord[];
  saveTraining: (t: TrainingRecord) => Promise<void>;
  initiatives: InitiativeRecord[];
  saveInitiative: (init: InitiativeRecord) => Promise<void>;

  reportSnapshots: ReportSnapshot[];
  saveReportSnapshot: (snapshot: ReportSnapshot) => Promise<boolean>;

  auditLogs: AuditLog[];
  logAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
  notification: Notice | null;
  setNotification: (notif: Notice | null) => void;

  resetToSampleData: () => Promise<void>;
  clearAllRealData: () => Promise<void>;
  exportSystemBackup: () => void;
  importSystemBackup: (backupData: unknown) => Promise<void>;

  isFirestoreConnected: boolean;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEMO_AUDIT_LOGS: AuditLog[] = [
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
];

const DEFAULT_REAL_CONFIG: DepartmentConfig = {
  id: 'dept-real-01',
  schoolName: 'Trường THPT ...',
  departmentName: 'Tổ Toán',
  academicYear: '2026-2027',
  currentTerm: 'HK1',
  startDate: '2026-09-05',
  endDate: '2027-05-28',
  weeksCount: 35,
  standardPeriods: 17,
};

const LEADER_ROLES: UserRole[] = ['admin', 'head', 'deputy'];

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

/** Chèn hoặc thay thế phần tử theo id. */
function upsertById<T extends { id: string }>(list: T[], item: T, prepend = false): T[] {
  const idx = list.findIndex(x => x.id === item.id);
  if (idx >= 0) {
    const copy = [...list];
    copy[idx] = item;
    return copy;
  }
  return prepend ? [item, ...list] : [...list, item];
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** Các collection được sao lưu/phục hồi/xóa (không gồm members/auditLogs). */
const CONTENT_COLLECTIONS = [
  'classes', 'assignments', 'departmentPlans', 'teacherPlans', 'lessonPlans',
  'meetings', 'observations', 'questions', 'examBlueprints', 'exams', 'examResults',
  'specialTopics', 'skknTopics', 'trainings', 'initiatives', 'documents', 'reportSnapshots',
] as const;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('to-toan-data-mode') !== 'real';
    } catch {
      return true;
    }
  });
  const [activeTabState, setActiveTabState] = useState<ActiveModule>(() => {
    try {
      const saved = localStorage.getItem('to-toan-active-module') as ActiveModule | null;
      return saved && MODULE_IDS.includes(saved) ? saved : 'overview';
    } catch {
      return 'overview';
    }
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [myAccess, setMyAccess] = useState<{ email: string; role: UserRole; memberId: string } | null | undefined>(undefined);
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotificationState] = useState<Notice | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const setNotification = useCallback((notif: Notice | null) => {
    setNotificationState(notif);
    window.clearTimeout(noticeTimer.current);
    if (notif && notif.type !== 'error') {
      noticeTimer.current = window.setTimeout(() => setNotificationState(null), 5000);
    }
  }, []);

  // ---------- Dữ liệu thật ----------
  const [realConfig, setRealConfig] = useState<DepartmentConfig>(DEFAULT_REAL_CONFIG);
  const [realMembers, setRealMembers] = useState<Member[]>([]);
  const [realAccessIndex, setRealAccessIndex] = useState<AccessIndexEntry[]>([]);
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
  const [realReportSnapshots, setRealReportSnapshots] = useState<ReportSnapshot[]>([]);
  const [realInvitations, setRealInvitations] = useState<MemberInvitation[]>([]);
  const [realAccessRequests, setRealAccessRequests] = useState<AccessRequest[]>([]);

  // ---------- Dữ liệu mẫu (mọi thứ đều là state để giao diện cập nhật đúng) ----------
  const [demoConfig, setDemoConfig] = useState<DepartmentConfig>(() => clone(SAMPLE_DEPARTMENT_CONFIG));
  const [demoMembers, setDemoMembers] = useState<Member[]>(() => clone(SAMPLE_MEMBERS));
  const [demoClasses, setDemoClasses] = useState<SchoolClass[]>(() => clone(SAMPLE_CLASSES));
  const [demoAssignments, setDemoAssignments] = useState<Assignment[]>(() => clone(SAMPLE_ASSIGNMENTS));
  const [demoDeptPlans, setDemoDeptPlans] = useState<DepartmentPlan[]>(() => [clone(SAMPLE_DEPARTMENT_PLAN)]);
  const [demoTeacherPlans, setDemoTeacherPlans] = useState<TeacherPlan[]>([]);
  const [demoLessonPlans, setDemoLessonPlans] = useState<LessonPlan[]>(() => [clone(SAMPLE_LESSON_PLAN)]);
  const [demoInvitations, setDemoInvitations] = useState<MemberInvitation[]>(() => clone(SAMPLE_INVITATIONS));
  const [demoAccessRequests, setDemoAccessRequests] = useState<AccessRequest[]>(() => clone(SAMPLE_ACCESS_REQUESTS));
  const [demoMeetings, setDemoMeetings] = useState<Meeting[]>(() => clone(SAMPLE_MEETINGS));
  const [demoObservations, setDemoObservations] = useState<ObservationRecord[]>(() => clone(SAMPLE_OBSERVATIONS));
  const [demoSpecialTopics, setDemoSpecialTopics] = useState<SpecialTopic[]>(() => clone(SAMPLE_SPECIAL_TOPICS_ENRICHED));
  const [demoSkknTopics, setDemoSkknTopics] = useState<SkknTopic[]>(() => clone(SAMPLE_SKKN_TOPICS));
  const [demoTrainings, setDemoTrainings] = useState<TrainingRecord[]>(() => clone(SAMPLE_TRAININGS));
  const [demoInitiatives, setDemoInitiatives] = useState<InitiativeRecord[]>(() => clone(SAMPLE_INITIATIVES));
  const [demoAuditLogs, setDemoAuditLogs] = useState<AuditLog[]>(() => clone(DEMO_AUDIT_LOGS));
  const [demoReportSnapshots, setDemoReportSnapshots] = useState<ReportSnapshot[]>([]);
  const [demoQuestions, setDemoQuestions] = useState<Question[]>(() => clone(SAMPLE_QUESTIONS));
  const [demoExamBlueprints, setDemoExamBlueprints] = useState<ExamBlueprint[]>([]);
  const [demoExams, setDemoExams] = useState<Exam[]>([]);
  const [demoExamResults, setDemoExamResults] = useState<ExamResultRecord[]>([]);
  const [demoDocuments, setDemoDocuments] = useState<SharedDocument[]>(() => clone(SAMPLE_DOCUMENTS));

  const [demoActiveMemberId, setDemoActiveMemberId] = useState<string>('gv-01');

  const persistMode = (mode: 'demo' | 'real') => {
    try {
      localStorage.setItem('to-toan-data-mode', mode);
    } catch {
      /* bộ nhớ trình duyệt bị chặn — bỏ qua */
    }
  };

  const setActiveTab = (tab: ActiveModule) => {
    try {
      localStorage.setItem('to-toan-active-module', tab);
    } catch {
      /* bỏ qua */
    }
    setActiveTabState(tab);
  };

  // ---------- Theo dõi mạng & phiên đăng nhập ----------
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setAuthResolved(true);
      if (!user) setMyAccess(null);
    });
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      unsubscribeAuth();
    };
  }, []);

  const userEmail = normalizeEmail(currentUser?.email);
  const isOwner = !!currentUser && userEmail === OWNER_EMAIL && currentUser.emailVerified !== false;

  // ---------- Kiểm tra quyền truy cập (accessIndex / thư mời) ----------
  useEffect(() => {
    if (isDemoMode || !currentUser || !userEmail) return;
    let cancelled = false;
    setMyAccess(undefined);

    (async () => {
      try {
        const idxSnap = await getDoc(doc(db, 'accessIndex', userEmail));
        if (cancelled) return;
        if (idxSnap.exists()) {
          const data = idxSnap.data() as AccessIndexEntry;
          setMyAccess({ email: userEmail, role: data.role, memberId: data.memberId });
          return;
        }
        if (isOwner) {
          setMyAccess({ email: userEmail, role: 'admin', memberId: 'owner' });
          return;
        }
        // Có thư mời đang chờ theo email → tự động nhận lời mời
        const invSnap = await getDoc(doc(db, 'invitations', userEmail));
        if (cancelled) return;
        if (invSnap.exists() && (invSnap.data() as MemberInvitation).status === 'pending') {
          const inv = invSnap.data() as MemberInvitation;
          const memberId = newId('mem');
          const now = new Date().toISOString();
          const member: Member = {
            id: memberId,
            uid: currentUser.uid,
            email: userEmail,
            displayName: inv.displayName || currentUser.displayName || userEmail,
            role: inv.role,
            subject: inv.subject || 'Toán',
            status: 'active',
            joinedAt: now,
          };
          const batch = writeBatch(db);
          batch.set(doc(db, 'members', memberId), member);
          batch.set(doc(db, 'accessIndex', userEmail), { id: userEmail, email: userEmail, role: inv.role, memberId, updatedAt: now });
          batch.update(doc(db, 'invitations', userEmail), { status: 'accepted', acceptedAt: now });
          await batch.commit();
          if (cancelled) return;
          setMyAccess({ email: userEmail, role: inv.role, memberId });
          setNotification({ message: `Chào mừng ${member.displayName}! Bạn đã tham gia ${realConfig.departmentName}.`, type: 'success' });
          return;
        }
        setMyAccess(null);
      } catch (err) {
        if (cancelled) return;
        console.warn('Access check failed:', err);
        setMyAccess(isOwner ? { email: userEmail, role: 'admin', memberId: 'owner' } : null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, currentUser, userEmail, isOwner]);

  const authStatus: AuthStatus = !authResolved
    ? 'checking'
    : !currentUser
    ? 'signed_out'
    : myAccess === undefined
    ? 'checking'
    : myAccess
    ? 'authorized'
    : 'unauthorized';

  const myRole: UserRole | null = myAccess?.role ?? null;
  const iAmLeader = !!myRole && LEADER_ROLES.includes(myRole);

  // ---------- Đồng bộ Firestore (chỉ khi đã được cấp quyền) ----------
  useEffect(() => {
    if (isDemoMode || authStatus !== 'authorized') return;

    const subscriptions: Array<() => void> = [];
    const onError = (name: string) => (err: unknown) => {
      console.warn(`Firestore listen error (${name}):`, err);
    };
    const subscribeList = <T,>(collectionName: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      subscriptions.push(
        onSnapshot(
          collection(db, collectionName),
          snapshot => {
            const list: T[] = [];
            snapshot.forEach(docSnap => list.push({ ...docSnap.data(), id: docSnap.id } as T));
            setter(list);
          },
          onError(collectionName),
        ),
      );
    };

    subscriptions.push(
      onSnapshot(
        collection(db, 'departments'),
        snapshot => {
          const preferred = snapshot.docs.find(item => item.id === DEFAULT_REAL_CONFIG.id) || snapshot.docs[0];
          if (preferred) setRealConfig({ ...DEFAULT_REAL_CONFIG, ...preferred.data(), id: preferred.id } as DepartmentConfig);
        },
        onError('departments'),
      ),
    );

    subscribeList<Member>('members', setRealMembers);
    subscribeList<SchoolClass>('classes', setRealClasses);
    subscribeList<Assignment>('assignments', setRealAssignments);
    subscribeList<DepartmentPlan>('departmentPlans', setRealDeptPlans);
    subscribeList<TeacherPlan>('teacherPlans', setRealTeacherPlans);
    subscribeList<LessonPlan>('lessonPlans', setRealLessonPlans);
    subscribeList<Meeting>('meetings', setRealMeetings);
    subscribeList<ObservationRecord>('observations', setRealObservations);
    subscribeList<Question>('questions', setRealQuestions);
    subscribeList<ExamBlueprint>('examBlueprints', setRealExamBlueprints);
    subscribeList<ExamResultRecord>('examResults', setRealExamResults);
    subscribeList<SpecialTopic>('specialTopics', setRealSpecialTopics);
    subscribeList<SkknTopic>('skknTopics', setRealSkknTopics);
    subscribeList<TrainingRecord>('trainings', setRealTrainings);
    subscribeList<InitiativeRecord>('initiatives', setRealInitiatives);
    subscribeList<SharedDocument>('documents', setRealDocuments);
    subscribeList<ReportSnapshot>('reportSnapshots', setRealReportSnapshots);

    if (iAmLeader || myRole === 'principal') {
      // Tổ trưởng/BGH xem toàn bộ đề (kể cả chưa công bố)
      subscribeList<Exam>('exams', setRealExams);
    } else {
      // Giáo viên: rules chỉ cho đọc đề đã công bố hoặc đề của mình
      const merge = new Map<string, Exam[]>();
      const push = (key: string) => (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => {
        merge.set(key, snapshot.docs.map(d => ({ ...(d.data() as object), id: d.id }) as Exam));
        const all = new Map<string, Exam>();
        merge.forEach(list => list.forEach(e => all.set(e.id, e)));
        setRealExams([...all.values()]);
      };
      subscriptions.push(onSnapshot(query(collection(db, 'exams'), where('isPublished', '==', true)), push('pub'), onError('exams')));
      if (currentUser) {
        subscriptions.push(onSnapshot(query(collection(db, 'exams'), where('authorUid', '==', currentUser.uid)), push('mine'), onError('exams')));
      }
    }

    if (iAmLeader) {
      subscribeList<MemberInvitation>('invitations', setRealInvitations);
      subscribeList<AccessRequest>('accessRequests', setRealAccessRequests);
      subscribeList<AccessIndexEntry>('accessIndex', setRealAccessIndex);
      subscribeList<AuditLog>('auditLogs', setRealAuditLogs);
    }

    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, [isDemoMode, authStatus, iAmLeader, myRole, currentUser]);

  // Người chưa được cấp quyền: chỉ theo dõi yêu cầu cấp quyền của chính mình
  useEffect(() => {
    if (isDemoMode || authStatus !== 'unauthorized' || !userEmail) return;
    return onSnapshot(
      query(collection(db, 'accessRequests'), where('email', '==', userEmail)),
      snapshot => setRealAccessRequests(snapshot.docs.map(d => ({ ...(d.data() as AccessRequest), id: d.id }))),
      err => console.warn('accessRequests listen error:', err),
    );
  }, [isDemoMode, authStatus, userEmail]);

  // Tổ trưởng/Tổ phó: tự đồng bộ chỉ mục phân quyền (accessIndex) theo danh sách thành viên.
  // Chỉ đụng tới các vai trò mình được phép gán (khớp hàm canAssignRole trong firestore.rules),
  // nếu không cả lô ghi sẽ bị từ chối.
  useEffect(() => {
    if (isDemoMode || authStatus !== 'authorized' || !iAmLeader || realMembers.length === 0) return;
    const canAssign = (role: UserRole) =>
      role === 'admin' ? myRole === 'admin' : role === 'head' ? myRole === 'admin' || myRole === 'head' : true;
    const indexByEmail = new Map(realAccessIndex.map(e => [e.id, e]));
    const batch = writeBatch(db);
    let changes = 0;
    const now = new Date().toISOString();
    realMembers.forEach(m => {
      const email = normalizeEmail(m.email);
      if (!email || !canAssign(m.role)) return;
      const existing = indexByEmail.get(email);
      if (existing && !canAssign(existing.role)) return;
      if (m.status === 'active') {
        if (!existing || existing.role !== m.role || existing.memberId !== m.id) {
          batch.set(doc(db, 'accessIndex', email), { id: email, email, role: m.role, memberId: m.id, updatedAt: now });
          changes++;
        }
      } else if (existing && existing.memberId === m.id) {
        batch.delete(doc(db, 'accessIndex', email));
        changes++;
      }
    });
    // Xóa chỉ mục mồ côi (thành viên đã bị xóa hoặc đã đổi sang email khác)
    const memberById = new Map(realMembers.map(m => [m.id, m]));
    realAccessIndex.forEach(entry => {
      const owner = memberById.get(entry.memberId);
      const stale = !owner || normalizeEmail(owner.email) !== entry.id;
      if (stale && entry.id !== OWNER_EMAIL && canAssign(entry.role)) {
        batch.delete(doc(db, 'accessIndex', entry.id));
        changes++;
      }
    });
    if (changes > 0) {
      batch.commit().catch(err => console.warn('accessIndex sync failed:', err));
    }
  }, [isDemoMode, authStatus, iAmLeader, myRole, realMembers, realAccessIndex]);

  // Khi đăng xuất khỏi chế độ thật: xóa dữ liệu thật khỏi bộ nhớ
  useEffect(() => {
    if (currentUser) return;
    setRealMembers([]);
    setRealAccessIndex([]);
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
    setRealReportSnapshots([]);
    setRealInvitations([]);
    setRealAccessRequests([]);
    setRealAuditLogs([]);
    setRealConfig(DEFAULT_REAL_CONFIG);
  }, [currentUser]);

  // ---------- Dữ liệu hiệu lực ----------
  const currentMembers = isDemoMode ? demoMembers : realMembers;
  const currentConfig = isDemoMode ? demoConfig : realConfig;
  const currentClasses = isDemoMode ? demoClasses : realClasses;
  const currentAssignments = isDemoMode ? demoAssignments : realAssignments;
  const currentDeptPlans = isDemoMode ? demoDeptPlans : realDeptPlans;
  const currentTeacherPlans = isDemoMode ? demoTeacherPlans : realTeacherPlans;
  const currentLessonPlans = isDemoMode ? demoLessonPlans : realLessonPlans;
  const currentInvitations = isDemoMode ? demoInvitations : realInvitations;
  const currentAccessRequests = isDemoMode ? demoAccessRequests : realAccessRequests;
  const currentMeetings = isDemoMode ? demoMeetings : realMeetings;
  const currentObservations = isDemoMode ? demoObservations : realObservations;
  const currentSpecialTopics = isDemoMode ? demoSpecialTopics : realSpecialTopics;
  const currentSkknTopics = isDemoMode ? demoSkknTopics : realSkknTopics;
  const currentTrainings = isDemoMode ? demoTrainings : realTrainings;
  const currentInitiatives = isDemoMode ? demoInitiatives : realInitiatives;
  const currentAuditLogs = useMemo(
    () => [...(isDemoMode ? demoAuditLogs : realAuditLogs)].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')),
    [isDemoMode, demoAuditLogs, realAuditLogs],
  );
  const currentQuestions = isDemoMode ? demoQuestions : realQuestions;
  const currentExamBlueprints = isDemoMode ? demoExamBlueprints : realExamBlueprints;
  const currentExams = isDemoMode ? demoExams : realExams;
  const currentExamResults = isDemoMode ? demoExamResults : realExamResults;
  const currentDocuments = isDemoMode ? demoDocuments : realDocuments;
  const currentReportSnapshots = isDemoMode ? demoReportSnapshots : realReportSnapshots;

  const isUserAuthorized = isDemoMode || authStatus === 'authorized';

  // ---------- Người dùng hiện tại ----------
  const activeMember: Member = useMemo(() => {
    if (isDemoMode) {
      return (
        demoMembers.find(m => m.id === demoActiveMemberId) ||
        demoMembers[0] || {
          id: 'default',
          email: 'guest@toan.edu.vn',
          displayName: 'Khách',
          role: 'teacher',
          subject: 'Toán',
          status: 'active',
          joinedAt: new Date().toISOString(),
        }
      );
    }
    // Chế độ thật: danh tính luôn lấy từ tài khoản Google đang đăng nhập
    const byEmail = realMembers.find(m => normalizeEmail(m.email) === userEmail);
    if (byEmail) return byEmail;
    return {
      id: myAccess?.memberId || currentUser?.uid || 'guest',
      uid: currentUser?.uid,
      email: userEmail || 'guest@toan.edu.vn',
      displayName: currentUser?.displayName || (isOwner ? 'Quản trị viên Tổ Toán' : 'Khách'),
      role: myAccess?.role || 'teacher',
      subject: 'Toán',
      status: 'active',
      joinedAt: new Date().toISOString(),
    };
  }, [isDemoMode, demoMembers, demoActiveMemberId, realMembers, userEmail, myAccess, currentUser, isOwner]);

  const permissions: Permissions = useMemo(() => {
    const role = activeMember.role;
    const isRealUnauthorized = !isDemoMode && authStatus !== 'authorized';
    if (isRealUnauthorized) {
      return { isLeader: false, isAdminOrHead: false, isAdmin: false, canApproveDeptPlan: false, canContribute: false };
    }
    return {
      isLeader: LEADER_ROLES.includes(role),
      isAdminOrHead: role === 'admin' || role === 'head',
      isAdmin: role === 'admin',
      canApproveDeptPlan: role === 'principal' || role === 'admin' || role === 'head',
      canContribute: role !== 'principal',
    };
  }, [activeMember.role, isDemoMode, authStatus]);

  // ---------- Ghi dữ liệu an toàn ----------
  /**
   * Thực hiện thao tác ghi Firestore (chỉ ở chế độ thật). Trả về false và hiện thông báo lỗi
   * nếu thất bại — trước đây lỗi bị nuốt và vẫn báo "thành công".
   */
  const persist = async (op: () => Promise<unknown>): Promise<boolean> => {
    if (isDemoMode) return true;
    if (authStatus !== 'authorized') {
      setNotification({ message: 'Bạn cần đăng nhập bằng tài khoản đã được cấp quyền để lưu dữ liệu.', type: 'error' });
      return false;
    }
    try {
      await op();
      return true;
    } catch (err) {
      console.error(err);
      setNotification({ message: `Không lưu được: ${describeFirebaseError(err)}`, type: 'error' });
      return false;
    }
  };

  /** Lưu một phần tử vào collection (thật) hoặc state (demo). */
  const upsertItem = async <T extends { id: string }>(
    collectionName: string,
    item: T,
    setDemo: React.Dispatch<React.SetStateAction<T[]>>,
    setReal: React.Dispatch<React.SetStateAction<T[]>>,
    prepend = false,
  ): Promise<boolean> => {
    if (isDemoMode) {
      setDemo(prev => upsertById(prev, item, prepend));
      return true;
    }
    const ok = await persist(() => setDoc(doc(db, collectionName, item.id), item));
    if (ok) setReal(prev => upsertById(prev, item, prepend));
    return ok;
  };

  const removeItem = async <T extends { id: string }>(
    collectionName: string,
    id: string,
    setDemo: React.Dispatch<React.SetStateAction<T[]>>,
    setReal: React.Dispatch<React.SetStateAction<T[]>>,
  ): Promise<boolean> => {
    if (isDemoMode) {
      setDemo(prev => prev.filter(x => x.id !== id));
      return true;
    }
    const ok = await persist(() => deleteDoc(doc(db, collectionName, id)));
    if (ok) setReal(prev => prev.filter(x => x.id !== id));
    return ok;
  };

  const logAction = async (action: string, targetType: string, targetId: string, details: string) => {
    const newLog: AuditLog = {
      id: newId('log'),
      action,
      actorId: activeMember.id,
      actorName: activeMember.displayName,
      targetType,
      targetId,
      details,
      timestamp: new Date().toISOString(),
    };
    if (isDemoMode) {
      setDemoAuditLogs(prev => [newLog, ...prev].slice(0, 500));
      return;
    }
    if (authStatus !== 'authorized') return;
    setRealAuditLogs(prev => [newLog, ...prev]);
    try {
      await setDoc(doc(db, 'auditLogs', newLog.id), newLog);
    } catch (e) {
      console.warn('Audit log write error:', e);
    }
  };

  // ---------- Đăng nhập / chế độ ----------
  const loginWithGoogle = async (options: { keepDemo?: boolean } = {}) => {
    try {
      setIsLoading(true);
      await signInWithPopup(auth, googleProvider);
      if (!options.keepDemo) {
        persistMode('real');
        setIsDemoMode(false);
      }
      setNotification({ message: 'Đăng nhập Google thành công!', type: 'success' });
    } catch (err) {
      console.error(err);
      setNotification({ message: `Đăng nhập thất bại: ${describeFirebaseError(err)}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setNotification({ message: 'Đã đăng xuất khỏi hệ thống.', type: 'info' });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleDemoMode = () => {
    const next = !isDemoMode;
    persistMode(next ? 'demo' : 'real');
    setIsDemoMode(next);
    setNotification({
      message: next
        ? 'Đã chuyển sang [CHẾ ĐỘ TRẢI NGHIỆM - DỮ LIỆU MẪU]. Mọi thay đổi chỉ lưu tạm trong phiên này.'
        : 'Đã chuyển sang [DỮ LIỆU CHÍNH THỨC]. Dữ liệu mẫu không ảnh hưởng cơ sở dữ liệu thật.',
      type: 'info',
    });
  };

  const switchActiveRole = (newRole: UserRole) => {
    if (!isDemoMode) return;
    const found = demoMembers.find(m => m.role === newRole);
    setDemoActiveMemberId(found?.id || demoMembers[0]?.id || 'gv-01');
    setNotification({ message: `Đã đổi vai trò kiểm thử sang: ${newRole.toUpperCase()}`, type: 'info' });
  };

  const selectActiveMember = (memberId: string) => {
    if (!isDemoMode) return; // Chế độ thật: không cho phép mạo danh người khác
    setDemoActiveMemberId(memberId);
  };

  const setActiveMember = (m: Member) => selectActiveMember(m.id);

  // ---------- Thành viên ----------
  const saveMember = async (member: Member) => {
    if (!permissions.isLeader) {
      setNotification({ message: 'Chỉ Tổ trưởng/Tổ phó/Quản trị được sửa hồ sơ thành viên.', type: 'error' });
      return false;
    }
    if (member.role === 'admin' && !permissions.isAdmin) {
      setNotification({ message: 'Chỉ Quản trị viên mới được cấp quyền Quản trị.', type: 'error' });
      return false;
    }
    const normalized = { ...member, email: normalizeEmail(member.email) };
    const ok = await upsertItem('members', normalized, setDemoMembers, setRealMembers);
    if (ok) {
      setNotification({ message: `Đã lưu hồ sơ ${normalized.displayName}`, type: 'success' });
      await logAction('Cập nhật thành viên', 'Member', normalized.id, `${normalized.displayName} – vai trò ${normalized.role}, trạng thái ${normalized.status}`);
    }
    return ok;
  };

  const saveMembersBulk = async (members: Member[]) => {
    if (!members.length) return true;
    if (!permissions.isLeader) {
      setNotification({ message: 'Chỉ Tổ trưởng/Tổ phó/Quản trị được thêm hồ sơ thành viên.', type: 'error' });
      return false;
    }
    const normalized = members.map(m => ({ ...m, email: normalizeEmail(m.email) }));
    if (isDemoMode) {
      setDemoMembers(prev => normalized.reduce((acc, m) => upsertById(acc, m), prev));
      return true;
    }
    const ok = await persist(async () => {
      for (let i = 0; i < normalized.length; i += 400) {
        const batch = writeBatch(db);
        normalized.slice(i, i + 400).forEach(m => batch.set(doc(db, 'members', m.id), m));
        await batch.commit();
      }
    });
    if (ok) {
      setRealMembers(prev => normalized.reduce((acc, m) => upsertById(acc, m), prev));
      await logAction('Thêm hồ sơ thành viên', 'Member', 'bulk', normalized.map(m => m.displayName).join(', '));
    }
    return ok;
  };

  const addClassesBulk = async (list: SchoolClass[]) => {
    const existing = new Set(currentClasses.map(c => c.name.toUpperCase()));
    const fresh = list.filter(c => !existing.has(c.name.toUpperCase()));
    if (!fresh.length) return true;
    if (isDemoMode) {
      setDemoClasses(prev => [...prev, ...fresh]);
      return true;
    }
    const ok = await persist(async () => {
      const batch = writeBatch(db);
      fresh.forEach(c => batch.set(doc(db, 'classes', c.id), c));
      await batch.commit();
    });
    if (ok) {
      setRealClasses(prev => [...prev, ...fresh]);
      await logAction('Thêm lớp học', 'SchoolClass', 'bulk', fresh.map(c => c.name).join(', '));
    }
    return ok;
  };

  const removeMember = async (memberId: string) => {
    if (!permissions.isAdminOrHead) {
      setNotification({ message: 'Chỉ Tổ trưởng/Quản trị được xóa thành viên.', type: 'error' });
      return false;
    }
    const m = currentMembers.find(x => x.id === memberId);
    if (!m) return false;
    if (normalizeEmail(m.email) === userEmail && !isDemoMode) {
      setNotification({ message: 'Bạn không thể tự xóa chính mình.', type: 'error' });
      return false;
    }
    const ok = await removeItem('members', memberId, setDemoMembers, setRealMembers);
    if (ok && !isDemoMode) {
      await persist(() => deleteDoc(doc(db, 'accessIndex', normalizeEmail(m.email))));
    }
    if (ok) {
      setNotification({ message: `Đã xóa ${m.displayName} khỏi tổ`, type: 'info' });
      await logAction('Xóa thành viên', 'Member', memberId, m.displayName);
    }
    return ok;
  };

  // ---------- Cấu hình ----------
  const updateConfig = async (newConfig: Partial<DepartmentConfig>) => {
    const merged = { ...currentConfig, ...newConfig };
    if (isDemoMode) {
      setDemoConfig(merged);
      setNotification({ message: 'Cập nhật cấu hình trong chế độ mẫu thành công!', type: 'success' });
    } else {
      const ok = await persist(() => setDoc(doc(db, 'departments', realConfig.id), merged));
      if (!ok) return false;
      setRealConfig(merged);
      setNotification({ message: 'Đã lưu cấu hình tổ!', type: 'success' });
    }
    await logAction('Cập nhật cấu hình tổ', 'DepartmentConfig', 'config', `Cập nhật: ${Object.keys(newConfig).join(', ')}`);
    return true;
  };

  const makeNewYearPlans = (plans: DepartmentPlan[], newYear: string): DepartmentPlan[] =>
    plans
      .filter(p => p.academicYear !== newYear)
      .map(p => ({
        ...p,
        id: `dplan-${newYear.replace(/[^0-9]/g, '')}-${p.grade}`,
        academicYear: newYear,
        title: p.title.replace(/\d{4}\s*[-–]\s*\d{4}/, newYear),
        status: 'draft' as const,
        version: 1,
        approvedBy: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versionHistory: [
          {
            version: 1,
            updatedAt: new Date().toISOString(),
            updatedBy: activeMember.displayName,
            changeSummary: `Khởi tạo kế hoạch năm học mới ${newYear} từ kế hoạch năm ${p.academicYear}`,
            status: 'draft' as const,
            dataSnapshot: planSnapshot(p),
          },
        ],
        comments: [],
        distribution: p.distribution.map(item => ({ ...item, status: 'planned' as const, dateTaught: undefined })),
      }));

  const transitionToNewAcademicYear = async (
    newYear: string,
    options: { copyConfig?: boolean; copyPlans?: boolean; keepQuestions?: boolean } = {},
  ) => {
    if (!permissions.isAdminOrHead) {
      setNotification({ message: 'Chỉ Tổ trưởng/Quản trị được chuyển năm học.', type: 'error' });
      return;
    }
    if (!/^\d{4}\s*-\s*\d{4}$/.test(newYear.trim())) {
      throw new Error('Năm học phải có dạng YYYY-YYYY, ví dụ 2027-2028');
    }
    const updatedConfig: DepartmentConfig = {
      ...currentConfig,
      academicYear: newYear,
      currentTerm: 'HK1',
      ...(options.copyConfig === false
        ? { academicCalendar: [], calendarMilestones: [], examTemplates: [], curriculumTopics: currentConfig.curriculumTopics }
        : {}),
    };
    const newPlans = options.copyPlans ? makeNewYearPlans(currentDeptPlans, newYear) : [];

    if (isDemoMode) {
      setDemoConfig(updatedConfig);
      setDemoAssignments([]);
      if (options.copyPlans) setDemoDeptPlans(prev => [...prev, ...newPlans.filter(np => !prev.some(p => p.id === np.id))]);
    } else {
      const ok = await persist(async () => {
        await setDoc(doc(db, 'departments', realConfig.id), updatedConfig);
        // Xóa phân công của năm cũ (trước đây chỉ xóa trên màn hình, tải lại là hiện lại)
        const batch = writeBatch(db);
        realAssignments.forEach(a => batch.delete(doc(db, 'assignments', a.id)));
        newPlans.forEach(p => batch.set(doc(db, 'departmentPlans', p.id), p));
        await batch.commit();
      });
      if (!ok) return;
      setRealConfig(updatedConfig);
      setRealAssignments([]);
      setRealDeptPlans(prev => [...prev, ...newPlans.filter(np => !prev.some(p => p.id === np.id))]);
    }
    setNotification({
      message: `Đã chuyển sang năm học ${newYear}. Phân công đã được làm mới${options.copyPlans ? `, đã tạo ${newPlans.length} kế hoạch dự thảo` : ''}; ngân hàng câu hỏi, biên bản và hồ sơ năm cũ được giữ nguyên.`,
      type: 'success',
    });
    await logAction('Chuyển năm học', 'AcademicYear', newYear, `Thiết lập năm học mới ${newYear}`);
  };

  // ---------- Lớp & phân công ----------
  const addClass = async (cls: SchoolClass) => {
    if (currentClasses.some(c => c.name.toUpperCase() === cls.name.toUpperCase())) {
      setNotification({ message: `Lớp ${cls.name} đã tồn tại`, type: 'error' });
      return;
    }
    const ok = await upsertItem('classes', cls, setDemoClasses, setRealClasses);
    if (!ok) return;
    setNotification({ message: `Đã thêm lớp ${cls.name}`, type: 'success' });
    await logAction('Thêm lớp học', 'SchoolClass', cls.id, `Lớp ${cls.name} - Khối ${cls.grade}`);
  };

  const deleteClass = async (id: string) => {
    const ok = await removeItem('classes', id, setDemoClasses, setRealClasses);
    if (!ok) return;
    setNotification({ message: 'Đã xóa lớp học', type: 'info' });
    await logAction('Xóa lớp học', 'SchoolClass', id, 'Xóa lớp khỏi danh mục');
  };

  const saveAssignment = async (asg: Assignment) => {
    const ok = await upsertItem('assignments', asg, setDemoAssignments, setRealAssignments);
    if (ok) setNotification({ message: `Đã lưu phân công cho ${asg.teacherName}`, type: 'success' });
  };

  const setAssignments = async (asgs: Assignment[]) => {
    if (isDemoMode) {
      setDemoAssignments(asgs);
    } else {
      // Trước đây dữ liệu nhập Excel chỉ nằm trên màn hình, không được ghi vào Firestore.
      const ok = await persist(async () => {
        const keep = new Set(asgs.map(a => a.id));
        const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
        realAssignments.filter(a => !keep.has(a.id)).forEach(a => ops.push(b => b.delete(doc(db, 'assignments', a.id))));
        asgs.forEach(a => ops.push(b => b.set(doc(db, 'assignments', a.id), a)));
        for (let i = 0; i < ops.length; i += 400) {
          const batch = writeBatch(db);
          ops.slice(i, i + 400).forEach(fn => fn(batch));
          await batch.commit();
        }
      });
      if (!ok) return;
      setRealAssignments(asgs);
    }
    setNotification({ message: `Đã lưu ${asgs.length} phân công giảng dạy`, type: 'success' });
    await logAction('Nhập phân công từ Excel', 'Assignment', 'bulk', `${asgs.length} phân công`);
  };

  const deleteAssignment = async (id: string) => {
    const ok = await removeItem('assignments', id, setDemoAssignments, setRealAssignments);
    if (ok) setNotification({ message: 'Đã xóa phân công giảng dạy', type: 'info' });
  };

  // ---------- Kế hoạch tổ ----------
  const saveDepartmentPlan = async (plan: DepartmentPlan, options: { silent?: boolean } = {}) => {
    const updatedPlan: DepartmentPlan = { ...plan, updatedAt: new Date().toISOString() };
    const ok = await upsertItem('departmentPlans', updatedPlan, setDemoDeptPlans, setRealDeptPlans);
    if (!ok) return false;
    if (!options.silent) {
      setNotification({ message: `Đã lưu kế hoạch dạy học: ${updatedPlan.title}`, type: 'success' });
      await logAction('Lưu kế hoạch tổ', 'DepartmentPlan', updatedPlan.id, `Phiên bản v${updatedPlan.version}`);
    }
    return true;
  };

  const deleteDepartmentPlan = async (id: string) => {
    const ok = await removeItem('departmentPlans', id, setDemoDeptPlans, setRealDeptPlans);
    if (ok) {
      setNotification({ message: 'Đã xóa kế hoạch tổ', type: 'info' });
      await logAction('Xóa kế hoạch tổ', 'DepartmentPlan', id, '');
    }
  };

  const submitDepartmentPlan = async (planId: string, comment?: string) => {
    const plan = currentDeptPlans.find(p => p.id === planId);
    if (!plan) return;
    const nextVersion = (plan.version || 1) + 1;
    const now = new Date().toISOString();
    const updatedPlan: DepartmentPlan = {
      ...plan,
      status: 'submitted',
      version: nextVersion,
      updatedAt: now,
      versionHistory: [
        ...(plan.versionHistory || []),
        {
          version: nextVersion,
          updatedAt: now,
          updatedBy: activeMember.displayName,
          changeSummary: 'Nộp kế hoạch dạy học lên Ban Giám hiệu phê duyệt',
          status: 'submitted',
          comment: comment || 'Kính trình Ban Giám hiệu xem xét, góp ý và phê duyệt.',
          dataSnapshot: planSnapshot(plan),
        },
      ],
    };
    if (!(await saveDepartmentPlan(updatedPlan, { silent: true }))) return;
    setNotification({ message: 'Đã trình Kế hoạch dạy học lên BGH phê duyệt!', type: 'success' });
    await logAction('Nộp kế hoạch tổ', 'DepartmentPlan', planId, `Nộp phiên bản v${nextVersion}`);
  };

  const reviewDepartmentPlan = async (planId: string, action: 'approve' | 'returned', note: string) => {
    if (!permissions.canApproveDeptPlan) {
      setNotification({ message: 'Bạn không có quyền phê duyệt kế hoạch tổ.', type: 'error' });
      return;
    }
    const plan = currentDeptPlans.find(p => p.id === planId);
    if (!plan) return;
    const isApprove = action === 'approve';
    const nextStatus = isApprove ? ('approved' as const) : ('returned' as const);
    const now = new Date().toISOString();
    const updatedPlan: DepartmentPlan = {
      ...plan,
      status: nextStatus,
      approvedBy: isApprove ? activeMember.displayName : plan.approvedBy,
      updatedAt: now,
      versionHistory: [
        ...(plan.versionHistory || []),
        {
          version: plan.version,
          updatedAt: now,
          updatedBy: activeMember.displayName,
          changeSummary: isApprove ? 'Phê duyệt kế hoạch' : 'Yêu cầu điều chỉnh, bổ sung kế hoạch',
          status: nextStatus,
          comment: note,
          dataSnapshot: planSnapshot(plan),
        },
      ],
      comments: [
        ...(plan.comments || []),
        {
          id: newId('pcom'),
          authorId: activeMember.id,
          authorName: activeMember.displayName,
          content: note || (isApprove ? 'Đồng ý phê duyệt.' : ''),
          type: isApprove ? 'approval_note' : 'return_reason',
          createdAt: now,
        },
      ],
    };
    if (!(await saveDepartmentPlan(updatedPlan, { silent: true }))) return;
    setNotification({
      message: isApprove ? 'Đã phê duyệt Kế hoạch dạy học!' : 'Đã trả lại Kế hoạch dạy học kèm góp ý điều chỉnh.',
      type: isApprove ? 'success' : 'info',
    });
    await logAction('Duyệt kế hoạch tổ', 'DepartmentPlan', planId, `${isApprove ? 'Phê duyệt' : 'Yêu cầu điều chỉnh'}: ${note}`);
  };

  const updatePlanDistributionStatus = async (
    planId: string,
    itemId: string,
    status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'make_up',
    dateTaught?: string,
  ) => {
    const plan = currentDeptPlans.find(p => p.id === planId);
    if (!plan) return;
    const updatedPlan: DepartmentPlan = {
      ...plan,
      distribution: plan.distribution.map(item =>
        item.id === itemId
          ? {
              ...item,
              status,
              dateTaught:
                status === 'completed' || status === 'make_up'
                  ? dateTaught || item.dateTaught || new Date().toISOString().split('T')[0]
                  : undefined,
            }
          : item,
      ),
    };
    if (await saveDepartmentPlan(updatedPlan, { silent: true })) {
      setNotification({ message: 'Đã cập nhật tiến độ thực hiện tiết dạy!', type: 'success' });
    }
  };

  const saveTeacherPlan = async (plan: TeacherPlan) => {
    const ok = await upsertItem('teacherPlans', plan, setDemoTeacherPlans, setRealTeacherPlans);
    if (ok) setNotification({ message: 'Đã lưu kế hoạch cá nhân của giáo viên', type: 'success' });
  };

  // ---------- Kế hoạch bài dạy ----------
  const saveLessonPlan = async (plan: LessonPlan, options: { silent?: boolean } = {}) => {
    const updatedPlan: LessonPlan = { ...plan, updatedAt: new Date().toISOString() };
    const ok = await upsertItem('lessonPlans', updatedPlan, setDemoLessonPlans, setRealLessonPlans, true);
    if (!ok) return false;
    if (!options.silent) {
      setNotification({ message: `Đã lưu kế hoạch bài dạy: ${updatedPlan.title}`, type: 'success' });
      await logAction('Lưu kế hoạch bài dạy', 'LessonPlan', updatedPlan.id, `Trạng thái: ${updatedPlan.status}`);
    }
    return true;
  };

  const deleteLessonPlan = async (id: string) => {
    const ok = await removeItem('lessonPlans', id, setDemoLessonPlans, setRealLessonPlans);
    if (ok) {
      setNotification({ message: 'Đã xóa kế hoạch bài dạy', type: 'info' });
      await logAction('Xóa kế hoạch bài dạy', 'LessonPlan', id, '');
    }
  };

  const submitLessonPlan = async (planId: string, comment?: string) => {
    const plan = currentLessonPlans.find(p => p.id === planId);
    if (!plan) return;
    const nextVersion = (plan.version || 1) + 1;
    const now = new Date().toISOString();
    const updatedPlan: LessonPlan = {
      ...plan,
      status: 'submitted',
      version: nextVersion,
      updatedAt: now,
      versionHistory: [
        ...(plan.versionHistory || []),
        {
          version: nextVersion,
          updatedAt: now,
          updatedBy: activeMember.displayName,
          changeSummary: 'Nộp kế hoạch bài dạy lên Tổ trưởng chuyên môn',
          status: 'submitted',
          comment: comment || 'Kính gửi Tổ trưởng phê duyệt kế hoạch bài dạy.',
          dataSnapshot: lessonSnapshot(plan),
        },
      ],
    };
    if (await saveLessonPlan(updatedPlan, { silent: true })) {
      setNotification({ message: 'Đã nộp kế hoạch bài dạy lên Tổ chuyên môn duyệt!', type: 'success' });
      await logAction('Nộp kế hoạch bài dạy', 'LessonPlan', planId, `v${nextVersion}`);
    }
  };

  const reviewLessonPlan = async (planId: string, action: 'approve' | 'returned', note: string) => {
    if (!permissions.isLeader) {
      setNotification({ message: 'Chỉ Tổ trưởng/Tổ phó được duyệt kế hoạch bài dạy.', type: 'error' });
      return;
    }
    const plan = currentLessonPlans.find(p => p.id === planId);
    if (!plan) return;
    const isApprove = action === 'approve';
    const nextStatus = isApprove ? ('approved' as const) : ('returned' as const);
    const now = new Date().toISOString();
    const updatedPlan: LessonPlan = {
      ...plan,
      status: nextStatus,
      approvedBy: isApprove ? activeMember.displayName : plan.approvedBy,
      updatedAt: now,
      versionHistory: [
        ...(plan.versionHistory || []),
        {
          version: plan.version || 1,
          updatedAt: now,
          updatedBy: activeMember.displayName,
          changeSummary: isApprove ? 'Tổ chuyên môn phê duyệt kế hoạch bài dạy' : 'Yêu cầu chỉnh sửa, bổ sung giáo án',
          status: nextStatus,
          comment: note,
          dataSnapshot: lessonSnapshot(plan),
        },
      ],
      comments: note
        ? [
            ...(plan.comments || []),
            {
              id: newId('c'),
              authorId: activeMember.id,
              authorName: activeMember.displayName,
              sectionId: isApprove ? 'Phê duyệt' : 'Yêu cầu sửa',
              content: note,
              isResolved: false,
              createdAt: now,
            },
          ]
        : plan.comments || [],
    };
    if (await saveLessonPlan(updatedPlan, { silent: true })) {
      setNotification({
        message: isApprove ? 'Đã phê duyệt kế hoạch bài dạy!' : 'Đã trả lại kế hoạch bài dạy kèm góp ý.',
        type: isApprove ? 'success' : 'info',
      });
      await logAction('Duyệt kế hoạch bài dạy', 'LessonPlan', planId, `${isApprove ? 'Phê duyệt' : 'Trả lại'}: ${note}`);
    }
  };

  const updateLessonPlanTeachingStatus = async (
    planId: string,
    status: 'not_taught' | 'in_progress' | 'completed',
    taughtDate?: string,
    classes?: string[],
  ) => {
    const plan = currentLessonPlans.find(p => p.id === planId);
    if (!plan) return;
    const isCompleted = status === 'completed';
    const updatedPlan: LessonPlan = {
      ...plan,
      teachingStatus: status,
      isTaught: isCompleted,
      taughtDate: isCompleted ? taughtDate || new Date().toISOString().split('T')[0] : undefined,
      taughtClasses: classes || plan.taughtClasses || plan.classNames,
    };
    if (await saveLessonPlan(updatedPlan, { silent: true })) {
      setNotification({ message: 'Đã cập nhật trạng thái thực dạy của giáo án!', type: 'success' });
    }
  };

  // ---------- Thư mời & yêu cầu truy cập ----------
  const inviteMemberByEmail = async (invData: { email: string; displayName: string; role: UserRole; subject?: string }) => {
    const email = normalizeEmail(invData.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotification({ message: 'Địa chỉ email không hợp lệ', type: 'error' });
      return;
    }
    if (currentMembers.some(m => normalizeEmail(m.email) === email)) {
      setNotification({ message: 'Email này đã là thành viên của tổ', type: 'error' });
      return;
    }
    if (invData.role === 'admin' && !permissions.isAdmin) {
      setNotification({ message: 'Chỉ Quản trị viên mới được mời với vai trò Quản trị.', type: 'error' });
      return;
    }
    // Đã có hồ sơ cùng tên nhưng chưa có email (ví dụ tạo từ file phân công) → gắn email vào hồ sơ đó,
    // tránh tạo hồ sơ trùng khi giáo viên nhận lời mời.
    const sameName = (a: string, b: string) => a.normalize('NFC').trim().toLowerCase() === b.normalize('NFC').trim().toLowerCase();
    const profile = currentMembers.find(m => !m.email && sameName(m.displayName, invData.displayName));
    if (profile) {
      if (await saveMember({ ...profile, email, role: invData.role, subject: invData.subject || profile.subject })) {
        setNotification({ message: `Đã gắn email ${email} vào hồ sơ có sẵn của ${profile.displayName}. Thầy/cô đăng nhập Google bằng email này là vào được tổ.`, type: 'success' });
      }
      return;
    }
    const newInv: MemberInvitation = {
      // id = email để Firestore rules kiểm tra được thư mời khi người được mời đăng nhập
      id: email,
      email,
      displayName: invData.displayName.trim(),
      role: invData.role,
      subject: invData.subject || 'Toán',
      status: 'pending',
      invitedBy: activeMember.displayName,
      invitedAt: new Date().toISOString(),
    };
    const ok = await upsertItem('invitations', newInv, setDemoInvitations, setRealInvitations, true);
    if (!ok) return;
    setNotification({
      message: `Đã tạo thư mời cho ${newInv.email}. Người được mời chỉ cần đăng nhập Google bằng email này là được vào tổ.`,
      type: 'success',
    });
    await logAction('Gửi thư mời', 'MemberInvitation', newInv.id, `Mời ${newInv.displayName} (${newInv.email}) vai trò ${newInv.role}`);
  };

  const cancelInvitation = async (id: string) => {
    const ok = await removeItem('invitations', id, setDemoInvitations, setRealInvitations);
    if (ok) setNotification({ message: 'Đã hủy thư mời tham gia', type: 'info' });
  };

  const submitAccessRequest = async (email: string, displayName: string, reason: string) => {
    const req: AccessRequest = {
      id: newId('req'),
      email: normalizeEmail(email),
      displayName: displayName.trim(),
      reason: reason.trim(),
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    if (isDemoMode) {
      setDemoAccessRequests(prev => [req, ...prev]);
    } else {
      try {
        await setDoc(doc(db, 'accessRequests', req.id), req);
        setRealAccessRequests(prev => [req, ...prev]);
      } catch (err) {
        setNotification({ message: `Không gửi được yêu cầu: ${describeFirebaseError(err)}`, type: 'error' });
        return;
      }
    }
    setNotification({ message: 'Yêu cầu cấp quyền truy cập đã được gửi đến Tổ trưởng và Quản trị viên.', type: 'success' });
  };

  const respondToAccessRequest = async (id: string, action: 'approved' | 'rejected', role: UserRole = 'teacher') => {
    if (!permissions.isLeader) return;
    const req = currentAccessRequests.find(r => r.id === id);
    if (!req) return;

    if (action === 'approved') {
      const email = normalizeEmail(req.email);
      const now = new Date().toISOString();
      const existing = currentMembers.find(m => normalizeEmail(m.email) === email);
      const newMember: Member = existing
        ? { ...existing, status: 'active', role }
        : { id: newId('mem'), email, displayName: req.displayName, role, subject: 'Toán', status: 'active', joinedAt: now };
      if (isDemoMode) {
        setDemoMembers(prev => upsertById(prev, newMember));
        setDemoAccessRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'approved' } : r)));
      } else {
        const ok = await persist(async () => {
          const batch = writeBatch(db);
          batch.set(doc(db, 'members', newMember.id), newMember);
          batch.set(doc(db, 'accessIndex', email), { id: email, email, role, memberId: newMember.id, updatedAt: now });
          batch.update(doc(db, 'accessRequests', id), { status: 'approved' });
          await batch.commit();
        });
        if (!ok) return;
        setRealMembers(prev => upsertById(prev, newMember));
        setRealAccessRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'approved' } : r)));
      }
      setNotification({ message: `Đã phê duyệt quyền truy cập cho ${req.displayName}`, type: 'success' });
    } else {
      if (isDemoMode) {
        setDemoAccessRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'rejected' } : r)));
      } else {
        const ok = await persist(() => updateDoc(doc(db, 'accessRequests', id), { status: 'rejected' }));
        if (!ok) return;
        setRealAccessRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'rejected' } : r)));
      }
      setNotification({ message: `Đã từ chối yêu cầu của ${req.displayName}`, type: 'info' });
    }
    await logAction('Xử lý yêu cầu truy cập', 'AccessRequest', id, `${action === 'approved' ? 'Phê duyệt' : 'Từ chối'} quyền của ${req.displayName}`);
  };

  // ---------- Họp tổ & dự giờ ----------
  const saveMeeting = async (meeting: Meeting, options: { silent?: boolean } = {}) => {
    const updated = { ...meeting, updatedAt: new Date().toISOString() };
    const ok = await upsertItem('meetings', updated, setDemoMeetings, setRealMeetings, true);
    if (ok && !options.silent) {
      setNotification({ message: 'Đã lưu biên bản sinh hoạt chuyên môn', type: 'success' });
      await logAction('Lưu biên bản họp', 'Meeting', meeting.id, `Trạng thái: ${meeting.status}`);
    }
    return ok;
  };

  const deleteMeeting = async (id: string) => {
    const ok = await removeItem('meetings', id, setDemoMeetings, setRealMeetings);
    if (ok) {
      setNotification({ message: 'Đã xóa biên bản', type: 'info' });
      await logAction('Xóa biên bản họp', 'Meeting', id, '');
    }
  };

  const saveObservation = async (obs: ObservationRecord, options: { silent?: boolean } = {}) => {
    const updated = { ...obs, updatedAt: new Date().toISOString() };
    const ok = await upsertItem('observations', updated, setDemoObservations, setRealObservations, true);
    if (ok && !options.silent) {
      setNotification({ message: `Đã lưu phiếu dự giờ tiết ${obs.period} - lớp ${obs.className}`, type: 'success' });
      await logAction('Lưu phiếu dự giờ', 'Observation', obs.id, `Người dạy: ${obs.teacherName}`);
    }
    return ok;
  };

  const deleteObservation = async (id: string) => {
    const ok = await removeItem('observations', id, setDemoObservations, setRealObservations);
    if (ok) setNotification({ message: 'Đã xóa phiếu dự giờ', type: 'info' });
  };

  // ---------- Ngân hàng câu hỏi & đề ----------
  const saveQuestion = async (q: Question) => {
    const ok = await upsertItem<Question>('questions', { ...q, updatedAt: new Date().toISOString() }, setDemoQuestions, setRealQuestions, true);
    if (ok) {
      setNotification({ message: 'Đã lưu câu hỏi vào ngân hàng', type: 'success' });
      await logAction('Lưu câu hỏi', 'Question', q.id, `Dạng: ${q.type}, Khối: ${q.grade}`);
    }
    return ok;
  };

  const deleteQuestion = async (id: string) => {
    const ok = await removeItem('questions', id, setDemoQuestions, setRealQuestions);
    if (ok) setNotification({ message: 'Đã xóa câu hỏi khỏi ngân hàng', type: 'info' });
  };

  const saveExamBlueprint = async (bp: ExamBlueprint) => {
    const ok = await upsertItem('examBlueprints', bp, setDemoExamBlueprints, setRealExamBlueprints);
    if (ok) setNotification({ message: 'Đã lưu ma trận và bản đặc tả đề kiểm tra', type: 'success' });
  };

  const saveExam = async (exam: Exam) => {
    const withAuthor: Exam = { ...exam, authorUid: exam.authorUid || currentUser?.uid, updatedAt: new Date().toISOString() };
    const ok = await upsertItem('exams', withAuthor, setDemoExams, setRealExams, true);
    if (ok) {
      setNotification({ message: `Đã lưu đề kiểm tra: ${exam.title}`, type: 'success' });
      await logAction('Lưu đề kiểm tra', 'Exam', exam.id, `Trạng thái: ${exam.status}, Công bố: ${exam.isPublished ? 'có' : 'chưa'}`);
    }
    return ok;
  };

  const deleteExam = async (id: string) => {
    const ok = await removeItem('exams', id, setDemoExams, setRealExams);
    if (ok) setNotification({ message: 'Đã xóa đề kiểm tra', type: 'info' });
  };

  const saveExamResult = async (result: ExamResultRecord) => {
    const ok = await upsertItem('examResults', result, setDemoExamResults, setRealExamResults, true);
    if (ok) setNotification({ message: `Đã lưu kết quả kiểm tra lớp ${result.className}`, type: 'success' });
    return ok;
  };

  const deleteExamResult = async (id: string) => {
    const ok = await removeItem('examResults', id, setDemoExamResults, setRealExamResults);
    if (ok) setNotification({ message: 'Đã xóa bảng điểm', type: 'info' });
  };

  const saveReportSnapshot = async (snapshot: ReportSnapshot) => {
    const existing = currentReportSnapshots.find(s => s.id === snapshot.id);
    if (existing?.isLocked && !permissions.isAdminOrHead) {
      setNotification({ message: 'Báo cáo đã chốt, chỉ Tổ trưởng/Quản trị được mở khóa.', type: 'error' });
      return false;
    }
    const ok = await upsertItem('reportSnapshots', snapshot, setDemoReportSnapshots, setRealReportSnapshots);
    if (!ok) return false;
    setNotification({
      message: `Đã lưu báo cáo: "${snapshot.title}" (${snapshot.isLocked ? 'Đã chốt & khóa' : 'Bản nháp'})`,
      type: 'success',
    });
    await logAction('Lưu báo cáo định kỳ', 'ReportSnapshot', snapshot.id, `Trạng thái: ${snapshot.isLocked ? 'Chốt' : 'Nháp'}`);
    return true;
  };

  // ---------- Chuyên đề, SKKN, bồi dưỡng, tài liệu ----------
  const saveSpecialTopic = async (topic: SpecialTopic) => {
    const ok = await upsertItem<SpecialTopic>('specialTopics', { ...topic, updatedAt: new Date().toISOString() }, setDemoSpecialTopics, setRealSpecialTopics, true);
    if (ok) {
      setNotification({ message: 'Đã lưu chuyên đề bồi dưỡng', type: 'success' });
      await logAction('Lưu chuyên đề', 'SpecialTopic', topic.id, topic.title);
    }
    return ok;
  };

  const deleteSpecialTopic = async (id: string) => {
    const ok = await removeItem('specialTopics', id, setDemoSpecialTopics, setRealSpecialTopics);
    if (ok) setNotification({ message: 'Đã xóa chuyên đề', type: 'info' });
  };

  const saveTraining = async (t: TrainingRecord) => {
    const ok = await upsertItem('trainings', t, setDemoTrainings, setRealTrainings);
    if (ok) setNotification({ message: 'Đã lưu hồ sơ bồi dưỡng thường xuyên', type: 'success' });
  };

  const saveInitiative = async (init: InitiativeRecord) => {
    const ok = await upsertItem('initiatives', init, setDemoInitiatives, setRealInitiatives);
    if (ok) setNotification({ message: 'Đã lưu đăng ký sáng kiến kinh nghiệm', type: 'success' });
  };

  const saveDocument = async (docObj: SharedDocument) => {
    const ok = await upsertItem<SharedDocument>('documents', { ...docObj, updatedAt: new Date().toISOString() }, setDemoDocuments, setRealDocuments, true);
    if (ok) {
      setNotification({ message: 'Đã lưu tài liệu dùng chung', type: 'success' });
      await logAction('Lưu tài liệu', 'SharedDocument', docObj.id, docObj.title);
    }
    return ok;
  };

  const deleteDocument = async (id: string) => {
    const ok = await removeItem('documents', id, setDemoDocuments, setRealDocuments);
    if (ok) setNotification({ message: 'Đã xóa tài liệu', type: 'info' });
  };

  const saveSkknTopic = async (skkn: SkknTopic) => {
    const ok = await upsertItem('skknTopics', skkn, setDemoSkknTopics, setRealSkknTopics, true);
    if (ok) {
      setNotification({ message: 'Đã lưu đề tài SKKN', type: 'success' });
      await logAction('Lưu đề tài SKKN', 'SkknTopic', skkn.id, skkn.title);
    }
    return ok;
  };

  const deleteSkknTopic = async (id: string) => {
    const ok = await removeItem('skknTopics', id, setDemoSkknTopics, setRealSkknTopics);
    if (ok) setNotification({ message: 'Đã xóa đề tài SKKN', type: 'info' });
  };

  const saveScoreRecord = (record: ScoreRecord) => saveExamResult(record);

  // ---------- Quản trị dữ liệu ----------
  const resetToSampleData = async () => {
    setDemoConfig(clone(SAMPLE_DEPARTMENT_CONFIG));
    setDemoMembers(clone(SAMPLE_MEMBERS));
    setDemoClasses(clone(SAMPLE_CLASSES));
    setDemoAssignments(clone(SAMPLE_ASSIGNMENTS));
    setDemoDeptPlans([clone(SAMPLE_DEPARTMENT_PLAN)]);
    setDemoTeacherPlans([]);
    setDemoLessonPlans([clone(SAMPLE_LESSON_PLAN)]);
    setDemoInvitations(clone(SAMPLE_INVITATIONS));
    setDemoAccessRequests(clone(SAMPLE_ACCESS_REQUESTS));
    setDemoMeetings(clone(SAMPLE_MEETINGS));
    setDemoObservations(clone(SAMPLE_OBSERVATIONS));
    setDemoSpecialTopics(clone(SAMPLE_SPECIAL_TOPICS_ENRICHED));
    setDemoSkknTopics(clone(SAMPLE_SKKN_TOPICS));
    setDemoTrainings(clone(SAMPLE_TRAININGS));
    setDemoInitiatives(clone(SAMPLE_INITIATIVES));
    setDemoAuditLogs(clone(DEMO_AUDIT_LOGS));
    setDemoReportSnapshots([]);
    setDemoQuestions(clone(SAMPLE_QUESTIONS));
    setDemoExamBlueprints([]);
    setDemoExams([]);
    setDemoExamResults([]);
    setDemoDocuments(clone(SAMPLE_DOCUMENTS));
    setDemoActiveMemberId('gv-01');
    persistMode('demo');
    setIsDemoMode(true);
    setNotification({ message: 'Đã khôi phục dữ liệu mẫu thử nghiệm ban đầu', type: 'info' });
  };

  const clearAllRealData = async () => {
    if (isDemoMode) {
      setNotification({ message: 'Hãy chuyển sang chế độ Dữ liệu thật trước khi xóa trắng.', type: 'error' });
      return;
    }
    if (!permissions.isAdmin) {
      setNotification({ message: 'Chỉ Quản trị viên được xóa trắng dữ liệu.', type: 'error' });
      return;
    }
    const ok = await persist(async () => {
      for (const collectionName of CONTENT_COLLECTIONS) {
        const snapshot = await getDocs(collection(db, collectionName));
        for (let i = 0; i < snapshot.docs.length; i += 400) {
          const batch = writeBatch(db);
          snapshot.docs.slice(i, i + 400).forEach(item => batch.delete(item.ref));
          await batch.commit();
        }
      }
    });
    if (!ok) return;
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
    setRealReportSnapshots([]);
    setNotification({ message: 'Đã xóa trắng dữ liệu chuyên môn (giữ lại thành viên, cấu hình và nhật ký).', type: 'info' });
    await logAction('Xóa trắng dữ liệu', 'System', 'all', 'Xóa toàn bộ dữ liệu chuyên môn để bắt đầu sử dụng thật');
  };

  const exportSystemBackup = () => {
    const backup = {
      app: 'so-sinh-hoat-chuyen-mon-to-toan',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      mode: isDemoMode ? 'demo' : 'real',
      config: currentConfig,
      members: currentMembers,
      classes: currentClasses,
      assignments: currentAssignments,
      departmentPlans: currentDeptPlans,
      teacherPlans: currentTeacherPlans,
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
      reportSnapshots: currentReportSnapshots,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `So_Sinh_Hoat_Chuyen_Mon_To_Toan_${currentConfig.academicYear}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotification({ message: 'Đã tải tệp sao lưu dữ liệu toàn hệ thống', type: 'success' });
  };

  const importSystemBackup = async (raw: unknown) => {
    if (!permissions.isAdminOrHead) {
      throw new Error('Chỉ Tổ trưởng/Quản trị được phục hồi dữ liệu.');
    }
    const data = raw as Record<string, unknown>;
    if (!data || typeof data !== 'object' || !data.config || typeof data.config !== 'object') {
      throw new Error('Định dạng tệp sao lưu không hợp lệ (thiếu mục config).');
    }
    const listOf = (key: string): Array<{ id: string }> => {
      const v = data[key];
      if (v === undefined) return [];
      if (!Array.isArray(v)) throw new Error(`Mục "${key}" trong tệp sao lưu không phải danh sách.`);
      return v.filter(item => item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' && (item as { id: string }).id.length > 0 && !(item as { id: string }).id.includes('/'));
    };
    const byKey: Record<string, Array<{ id: string }>> = {};
    for (const key of [...CONTENT_COLLECTIONS, 'members']) byKey[key] = listOf(key);

    // Không cho phục hồi đè vai trò Quản trị nếu người thao tác không phải Quản trị
    if (!permissions.isAdmin) {
      byKey.members = (byKey.members as Member[]).map(m => (m.role === 'admin' ? { ...m, role: 'head' as UserRole } : m));
    }
    const cfg = { ...(data.config as DepartmentConfig), id: isDemoMode ? demoConfig.id : realConfig.id };

    if (isDemoMode) {
      setDemoConfig(cfg);
      if (data.members) setDemoMembers(byKey.members as Member[]);
      setDemoClasses(byKey.classes as SchoolClass[]);
      setDemoAssignments(byKey.assignments as Assignment[]);
      setDemoDeptPlans(byKey.departmentPlans as DepartmentPlan[]);
      setDemoTeacherPlans(byKey.teacherPlans as TeacherPlan[]);
      setDemoLessonPlans(byKey.lessonPlans as LessonPlan[]);
      setDemoMeetings(byKey.meetings as Meeting[]);
      setDemoObservations(byKey.observations as ObservationRecord[]);
      setDemoQuestions(byKey.questions as Question[]);
      setDemoExamBlueprints(byKey.examBlueprints as ExamBlueprint[]);
      setDemoExams(byKey.exams as Exam[]);
      setDemoExamResults(byKey.examResults as ExamResultRecord[]);
      setDemoSpecialTopics(byKey.specialTopics as SpecialTopic[]);
      setDemoSkknTopics(byKey.skknTopics as SkknTopic[]);
      setDemoTrainings(byKey.trainings as TrainingRecord[]);
      setDemoInitiatives(byKey.initiatives as InitiativeRecord[]);
      setDemoDocuments(byKey.documents as SharedDocument[]);
      setDemoReportSnapshots(byKey.reportSnapshots as ReportSnapshot[]);
      setNotification({ message: 'Đã nạp tệp sao lưu vào chế độ dữ liệu mẫu (không ảnh hưởng dữ liệu thật).', type: 'success' });
      return;
    }

    setIsLoading(true);
    try {
      const ok = await persist(async () => {
        await setDoc(doc(db, 'departments', cfg.id), cfg);
        const ops: Array<[string, { id: string }]> = [];
        for (const key of Object.keys(byKey)) byKey[key].forEach(item => ops.push([key, item]));
        for (let i = 0; i < ops.length; i += 400) {
          const batch = writeBatch(db);
          ops.slice(i, i + 400).forEach(([key, item]) => batch.set(doc(db, key, item.id), item));
          await batch.commit();
        }
      });
      if (!ok) return;
      setNotification({ message: 'Đã phục hồi dữ liệu từ file sao lưu thành công', type: 'success' });
      await logAction('Phục hồi dữ liệu', 'System', 'backup', `Phục hồi từ tệp sao lưu ${String(data.exportedAt || '')}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        isDemoMode,
        toggleDemoMode,
        activeTab: activeTabState,
        setActiveTab,
        currentUser,
        authStatus,
        activeMember,
        allMembers: currentMembers,
        permissions,
        loginWithGoogle,
        logout,
        switchActiveRole,
        selectActiveMember,
        setActiveMember,
        canSimulateRoles: isDemoMode,
        isUserAuthorized,
        saveMember,
        saveMembersBulk,
        addClassesBulk,
        removeMember,
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
        deleteDepartmentPlan,
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
        deleteMeeting,
        observations: currentObservations,
        saveObservation,
        deleteObservation,
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
        deleteExamResult,
        scoreRecords: currentExamResults,
        saveScoreRecord,
        specialTopics: currentSpecialTopics,
        saveSpecialTopic,
        deleteSpecialTopic,
        skknTopics: currentSkknTopics,
        saveSkknTopic,
        deleteSkknTopic,
        trainings: currentTrainings,
        saveTraining,
        initiatives: currentInitiatives,
        saveInitiative,
        documents: currentDocuments,
        saveDocument,
        deleteDocument,
        reportSnapshots: currentReportSnapshots,
        saveReportSnapshot,
        auditLogs: currentAuditLogs,
        logAction,
        notification,
        setNotification,
        resetToSampleData,
        clearAllRealData,
        exportSystemBackup,
        importSystemBackup,
        isFirestoreConnected: isOnline,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

/** Ảnh chụp đầy đủ nội dung kế hoạch tổ để so sánh phiên bản (diff). */
export function planSnapshot(plan: DepartmentPlan) {
  return {
    title: plan.title,
    generalSituation: plan.generalSituation,
    distribution: plan.distribution.map(({ id, order, week, topicTitle, periods, objectives, equipment }) => ({
      id,
      order,
      week,
      topicTitle,
      periods,
      objectives,
      equipment: equipment || '',
    })),
    periodicEvaluations: plan.periodicEvaluations || [],
    totalPeriods: plan.distribution.reduce((s, i) => s + (Number(i.periods) || 0), 0),
  };
}

/** Ảnh chụp đầy đủ nội dung giáo án để so sánh phiên bản (diff). */
export function lessonSnapshot(plan: LessonPlan) {
  return {
    title: plan.title,
    topicTitle: plan.topicTitle,
    periodCount: plan.periodCount,
    week: plan.week,
    objectivesKnowledge: plan.objectivesKnowledge,
    objectivesCompetence: plan.objectivesCompetence,
    objectivesQualities: plan.objectivesQualities,
    equipment: plan.equipment,
    activities: (plan.activities || []).map(a => ({ ...a })),
  };
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
