import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Member, Assignment, SchoolClass, UserRole } from '../../types';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  Briefcase,
  Mail,
  Send,
  Link,
  Copy,
  Check,
  Clock,
  UserPlus,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useConfirm } from '../common/ConfirmDialog';
import { newId } from '../../utils/ids';
import {
  downloadAssignmentTemplate,
  exportToExcel,
  parseExcelFile,
} from '../../utils/excel';
import { assignmentKey, compareClassName, dutyName, exportOrder, findDuplicateAssignments, groupByTeacher, isDuty, isDutyRow, sortAssignments, summarizeTeacher, summaryRows } from '../../utils/assignments';

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

interface ImportRow {
  teacherName: string;
  teacherId: string;
  className: string;
  classId: string;
  grade: 10 | 11 | 12;
  subject: string;
  periods: number;
  duties: string;
  term: 'HK1' | 'HK2';
  isNewTeacher: boolean;
  isNewClass: boolean;
  line: number;
  /** Thứ tự giáo viên trong file (để hiển thị đúng thứ tự như file) */
  teacherOrder: number;
  /** Dòng tiết quy đổi (nhiệm vụ / chủ nhiệm) */
  isDuty: boolean;
}

const cleanText = (v: unknown) => String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();

/** Khóa so khớp tên: chuẩn hóa Unicode, bỏ danh xưng (ThS., TS., Thầy, Cô...), không phân biệt hoa/thường. */
const nameKey = (name: string) =>
  cleanText(name)
    .toLowerCase()
    .replace(/^((ths|ts|pgs\.?\s*ts|cn|gv)\.?\s+|(thầy|cô)\s+)+/u, '')
    .trim();

const ROLE_LABEL: Record<string, string> = {
  admin: 'Quản trị',
  head: 'Tổ trưởng',
  deputy: 'Tổ phó',
  teacher: 'Giáo viên',
  principal: 'BGH',
};

export const MembersModule: React.FC = () => {
  const { isMe,
    activeMember,
    allMembers,
    classes,
    addClass,
    deleteClass,
    assignments,
    saveAssignment,
    deleteAssignment,
    setAssignments,
    config,
    invitations,
    accessRequests,
    inviteMemberByEmail,
    cancelInvitation,
    respondToAccessRequest,
    setNotification,
    permissions,
    saveMember,
    saveMembersBulk,
    addClassesBulk,
    removeMember,
    currentUser,
    isDemoMode,
  } = useApp();
  const confirm = useConfirm();

  const isLeader = permissions.isLeader;
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [requestRoles, setRequestRoles] = useState<Record<string, UserRole>>({});

  const [activeTab, setActiveTab] = useState<'assignments' | 'members' | 'classes' | 'invitations'>('assignments');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [replaceTerms, setReplaceTerms] = useState(true);
  const [termFilter, setTermFilter] = useState<'HK1' | 'HK2'>(config.currentTerm);
  const [asgView, setAsgView] = useState<'teacher' | 'class'>('teacher');
  const [asgSearch, setAsgSearch] = useState('');
  const [asgGrade, setAsgGrade] = useState<0 | 10 | 11 | 12>(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importNewTeachers, setImportNewTeachers] = useState<Member[]>([]);
  const [importNewClasses, setImportNewClasses] = useState<SchoolClass[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Invitation Modal State (Lỗi 23)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('teacher');
  const [inviteSubject, setInviteSubject] = useState('Toán');
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Assignment Form State
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const teachingMembers = allMembers.filter(m => m.status === 'active' && m.role !== 'principal');

  const openAddAssignment = () => {
    // Bản cũ khởi tạo khi dữ liệu chưa tải → ô chọn rỗng, bấm Lưu không có tác dụng
    setSelectedTeacherId(prev => prev || teachingMembers[0]?.id || '');
    setSelectedClassId(prev => prev || classes[0]?.id || '');
    setShowAddModal(true);
  };
  const [subjectName, setSubjectName] = useState('Toán');
  const [periods, setPeriods] = useState(4);
  const [duties, setDuties] = useState('');

  // Class Form State
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<10 | 11 | 12>(10);
  const [newClassStudents, setNewClassStudents] = useState(40);

  // Phân công trùng (cùng GV, lớp, môn – kể cả khi tên môn viết khác: "Toán (T2)" = "Toán buổi 2")
  const duplicates = useMemo(() => findDuplicateAssignments(assignments), [assignments]);
  const duplicateIds = useMemo(() => new Set(duplicates.remove.map(a => a.id)), [duplicates]);

  // Định mức: tính theo học kỳ đang xem, bỏ các dòng trùng (trước đây cộng cả dòng trùng và cả 2 học kỳ)
  // Tổng tiết/tuần = tiết theo TKB + tiết quy đổi nhiệm vụ, chủ nhiệm (giống sheet TongHop của file tổ)
  const workloadByTeacher: Record<string, { totalPeriods: number; tkb: number; quyDoi: number; classes: string[]; dutyText: string; homeroom: string[] }> = {};
  allMembers.forEach(m => {
    const sum = summarizeTeacher(duplicates.keep.filter(a => a.term === termFilter && a.teacherId === m.id));
    workloadByTeacher[m.id] = { totalPeriods: sum.total, tkb: sum.tkb, quyDoi: sum.quyDoi, classes: sum.classes, dutyText: sum.dutyText, homeroom: sum.homeroom };
  });

  // Classes without teacher assignment
  const assignedClassNames = new Set(assignments.filter(a => a.term === termFilter && !isDuty(a)).map(a => a.className));
  const unassignedClasses = classes.filter(c => !assignedClassNames.has(c.name));

  const pendingInvitations = invitations.filter(i => i.status === 'pending');
  const pendingRequests = accessRequests.filter(r => r.status === 'pending');

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const teacher = allMembers.find(m => m.id === selectedTeacherId);
    const cls = classes.find(c => c.id === selectedClassId);
    if (!teacher || !cls) {
      setNotification({ message: 'Vui lòng chọn giáo viên và lớp (cần tạo danh sách lớp trước).', type: 'error' });
      return;
    }

    // Check duplicate assignment
    const exists = assignments.find(
      a =>
        assignmentKey({ ...a, academicYear: a.academicYear || config.academicYear }) ===
        assignmentKey({ teacherId: teacher.id, className: cls.name, term: config.currentTerm, academicYear: config.academicYear, subject: subjectName }),
    );
    if (exists) {
      setNotification({ message: 'Phân công này đã tồn tại trong danh sách!', type: 'error' });
      return;
    }

    const newAsg: Assignment = {
      id: newId('asg'),
      teacherId: teacher.id,
      teacherName: teacher.displayName,
      classId: cls.id,
      className: cls.name,
      grade: cls.grade,
      subject: subjectName,
      periodsPerWeek: Number(periods),
      duties: duties || undefined,
      term: config.currentTerm,
      academicYear: config.academicYear,
    };

    await saveAssignment(newAsg);
    setShowAddModal(false);
    setDuties('');
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const newCls: SchoolClass = {
      id: newId('cls'),
      name: newClassName.trim().toUpperCase(),
      grade: newClassGrade,
      studentCount: Number(newClassStudents),
    };

    await addClass(newCls);
    setNewClassName('');
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setNotification({ message: 'Vui lòng điền đủ email và họ tên giáo viên', type: 'error' });
      return;
    }

    await inviteMemberByEmail({
      email: inviteEmail.trim(),
      displayName: inviteName.trim(),
      role: inviteRole,
      subject: inviteSubject,
    });

    setInviteEmail('');
    setInviteName('');
    setShowInviteModal(false);
  };

  // Bản cũ tạo link ?invite=... nhưng ứng dụng không hề xử lý tham số này.
  // Nay: người được mời chỉ cần mở ứng dụng và đăng nhập Google đúng email được mời.
  const handleCopyInviteLink = async (invitationId: string) => {
    const inv = invitations.find(i => i.id === invitationId);
    const text = `Mời thầy/cô tham gia ${config.departmentName} trên Sổ sinh hoạt chuyên môn số.\nMở: ${window.location.origin}\nChọn "Dữ liệu thật" → "Đăng nhập bằng Google" bằng email ${inv?.email || ''}.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTokenId(invitationId);
      setNotification({ message: 'Đã sao chép lời mời (kèm đường dẫn và hướng dẫn) vào bộ nhớ tạm!', type: 'success' });
      setTimeout(() => setCopiedTokenId(null), 3000);
    } catch {
      setNotification({ message: 'Trình duyệt không cho phép sao chép. Hãy gửi đường dẫn trang cho giáo viên.', type: 'error' });
    }
  };

  const handleDeleteClass = async (c: SchoolClass) => {
    const used = assignments.filter(a => a.classId === c.id || a.className === c.name).length;
    const ok = await confirm({
      title: `Xóa lớp ${c.name}?`,
      message: used ? `Lớp đang có ${used} phân công giảng dạy. Các phân công này sẽ không còn gắn với lớp.` : 'Lớp sẽ bị xóa khỏi danh mục.',
      confirmText: 'Xóa lớp',
      danger: true,
    });
    if (ok) await deleteClass(c.id);
  };

  const handleDeleteAssignment = async (asg: Assignment) => {
    const ok = await confirm({
      title: 'Xóa phân công?',
      message: `${asg.teacherName} – lớp ${asg.className} (${asg.subject}).`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (ok) await deleteAssignment(asg.id);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    if (!editingMember.displayName.trim()) return;
    const email = editingMember.email.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotification({ message: 'Email không hợp lệ', type: 'error' });
      return;
    }
    if (email && allMembers.some(m => m.id !== editingMember.id && m.email.toLowerCase() === email)) {
      setNotification({ message: 'Email này đã được dùng cho thành viên khác', type: 'error' });
      return;
    }
    if (await saveMember({ ...editingMember, displayName: editingMember.displayName.trim() })) setEditingMember(null);
  };

  const handleRemoveMember = async (m: Member) => {
    const ok = await confirm({
      title: `Xóa ${m.displayName} khỏi tổ?`,
      message: 'Tài khoản này sẽ mất quyền truy cập dữ liệu của tổ. Hồ sơ chuyên môn đã lưu (giáo án, biên bản...) vẫn được giữ. Nếu giáo viên chỉ chuyển công tác, nên đổi trạng thái thay vì xóa.',
      confirmText: 'Xóa thành viên',
      danger: true,
    });
    if (ok) await removeMember(m.id);
  };

  const handleExportExcel = () => {
    // Giống file của tổ: sheet TongHop (tổng hợp từng giáo viên) + sheet PhanCong (sắp xếp như file)
    const sorted = exportOrder(duplicates.keep, allMembers);
    const terms = [...new Set(sorted.map(a => a.term))];
    const sheets = terms.flatMap(t => {
      const rows = sorted.filter(a => a.term === t);
      const suffix = terms.length > 1 ? `_${t}` : '';
      return [
        { name: `TongHop${suffix}`, data: summaryRows(rows) },
        {
          name: `PhanCong${suffix}`,
          data: rows.map(a => ({
            'Họ và tên giáo viên': a.teacherName,
            'Lớp': a.className || '',
            'Khối': a.className ? a.grade : '',
            'Môn/Chuyên đề': a.subject,
            'Số tiết/tuần': a.periodsPerWeek,
            'Nhiệm vụ kiêm nhiệm': a.duties || '',
            'Học kỳ': a.term,
          })),
        },
      ];
    });
    exportToExcel(sheets, `Phan_Cong_Chuyen_Mon_${config.academicYear}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại cùng một tệp
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setNotification({ message: 'Tệp Excel quá lớn (tối đa 5 MB).', type: 'error' });
      return;
    }

    try {
      const parsedData = await parseExcelFile(file);
      const rows: ImportRow[] = [];
      const errors: string[] = [];
      const plannedTeachers = new Map<string, Member>();
      const plannedClasses = new Map<string, SchoolClass>();
      const teacherOrderMap = new Map<string, number>();
      const myEmail = (currentUser?.email || '').toLowerCase();
      const iAmMember = allMembers.some(m => m.email.toLowerCase() === myEmail);

      parsedData.forEach((row: any, idx: number) => {
        const line = idx + 2;
        const teacherName = cleanText(row['Họ và tên giáo viên'] ?? row['Giáo viên'] ?? row['teacherName']);
        const className = cleanText(row['Lớp'] ?? row['className']).toUpperCase().replace(/\s+/g, '');
        const subject = cleanText(row['Môn/Chuyên đề'] ?? row['Môn'] ?? row['subject']) || 'Toán';
        const duties = cleanText(row['Nhiệm vụ kiêm nhiệm'] ?? row['Nhiệm vụ'] ?? row['duties']);
        const termRaw = cleanText(row['Học kỳ'] ?? row['term']).toUpperCase().replace(/\s+/g, '');
        const term: 'HK1' | 'HK2' = termRaw === 'HK2' || termRaw === 'HKII' || termRaw === '2' ? 'HK2' : termRaw === 'HK1' || termRaw === 'HKI' || termRaw === '1' ? 'HK1' : config.currentTerm;
        const periods = Number(String(row['Số tiết/tuần'] ?? row['periods'] ?? '').replace(',', '.'));
        if (!teacherName && !className) return; // dòng trống
        // Dòng "Quy đổi nhiệm vụ" (TTCM, TPCM, CT-CĐCS...) không có lớp; "Quy đổi chủ nhiệm" có lớp
        const dutyRow = isDutyRow(subject, className);
        if (!teacherName || (!className && !dutyRow)) {
          errors.push(`Dòng ${line}: Thiếu tên giáo viên hoặc lớp`);
          return;
        }
        if (/^(tong|cong)\b/.test(teacherName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())) return; // dòng tổng cộng
        const existingClass = className ? classes.find(c => c.name.toUpperCase() === className) : undefined;
        const grade = className ? Number(row['Khối'] || existingClass?.grade || parseInt(className, 10)) : 0;
        if (className && ![10, 11, 12].includes(grade)) {
          errors.push(`Dòng ${line}: Khối "${row['Khối'] ?? ''}" không hợp lệ (chỉ 10, 11, 12)`);
          return;
        }
        if (!(periods >= 0 && periods <= 30) || (!dutyRow && !(periods > 0))) {
          errors.push(`Dòng ${line}: Số tiết/tuần "${row['Số tiết/tuần'] ?? ''}" không hợp lệ`);
          return;
        }

        // Ghép giáo viên theo tên (bỏ qua hoa/thường, khoảng trắng thừa, danh xưng ThS./Thầy/Cô...)
        const key = nameKey(teacherName);
        if (!teacherOrderMap.has(key)) teacherOrderMap.set(key, teacherOrderMap.size);
        let teacherId: string;
        let displayName: string;
        let isNewTeacher = false;
        const member = allMembers.find(m => nameKey(m.displayName) === key);
        if (member) {
          teacherId = member.id;
          displayName = member.displayName;
        } else {
          let planned = plannedTeachers.get(key);
          if (!planned) {
            // Tên trùng với tài khoản đang đăng nhập (ví dụ Tổ trưởng/Quản trị chưa có hồ sơ) → gắn luôn email
            const isMe = !isDemoMode && !iAmMember && !!currentUser?.displayName && nameKey(currentUser.displayName) === key;
            planned = {
              id: newId('mem'),
              email: isMe ? myEmail : '',
              displayName: teacherName,
              role: isMe ? activeMember.role : /\btổ trưởng (chuyên môn|cm)\b|^tổ trưởng$|^ttcm\b/i.test(duties) ? 'head' : /\btổ phó (chuyên môn|cm)\b|^tổ phó$|^tpcm\b/i.test(duties) ? 'deputy' : 'teacher',
              subject: 'Toán',
              status: 'active',
              joinedAt: new Date().toISOString(),
            };
            // Chỉ Quản trị/Tổ trưởng mới gán được vai trò Tổ trưởng
            if (planned.role === 'head' && !permissions.isAdminOrHead) planned.role = 'teacher';
            plannedTeachers.set(key, planned);
          }
          teacherId = planned.id;
          displayName = planned.displayName;
          isNewTeacher = true;
        }

        let classId = existingClass?.id || '';
        let isNewClass = false;
        if (!classId && className) {
          let plannedCls = plannedClasses.get(className);
          if (!plannedCls) {
            plannedCls = { id: newId('cls'), name: className, grade: grade as 10 | 11 | 12, studentCount: 0 };
            plannedClasses.set(className, plannedCls);
          }
          classId = plannedCls.id;
          isNewClass = true;
        }

        rows.push({ teacherName: displayName, teacherId, className, classId, grade: grade as 10 | 11 | 12, subject, periods, duties, term, isNewTeacher, isNewClass, line, teacherOrder: teacherOrderMap.get(key)!, isDuty: dutyRow });
      });

      // Cảnh báo dòng trùng (cùng giáo viên, lớp, môn, học kỳ)
      const seen = new Map<string, number>();
      const deduped: ImportRow[] = [];
      rows.forEach(r => {
        const k = assignmentKey({ teacherId: r.teacherId, className: r.className, term: r.term, academicYear: config.academicYear, subject: r.subject, duties: r.duties });
        if (seen.has(k)) {
          errors.push(`Dòng ${r.line}: Trùng với dòng ${seen.get(k)} (cùng giáo viên, lớp, môn) – bỏ qua`);
        } else {
          seen.set(k, r.line);
          deduped.push(r);
        }
      });

      setImportRows(deduped);
      setImportErrors(errors);
      setImportNewTeachers([...plannedTeachers.values()]);
      setImportNewClasses([...plannedClasses.values()]);
      setShowImportModal(true);
    } catch (err: any) {
      setNotification({ message: `Lỗi đọc tệp Excel: ${err.message}`, type: 'error' });
    }
  };

  /** Phân công cũ sẽ bị thay (cùng học kỳ, năm học có trong file nhưng không còn trong file) */
  const importReplaced = useMemo(() => {
    if (!replaceTerms || !importRows.length) return [] as Assignment[];
    const terms = new Set(importRows.map(r => r.term));
    const inFile = new Set(importRows.map(r => assignmentKey({ teacherId: r.teacherId, className: r.className, term: r.term, academicYear: config.academicYear, subject: r.subject, duties: r.duties })));
    return assignments.filter(a => terms.has(a.term) && (a.academicYear || config.academicYear) === config.academicYear && !inFile.has(assignmentKey({ ...a, academicYear: a.academicYear || config.academicYear })));
  }, [replaceTerms, importRows, assignments, config.academicYear]);

  const confirmImport = async () => {
    setIsImporting(true);
    try {
      // 1) Hồ sơ giáo viên: tạo mới người chưa có + ghi thứ tự giáo viên theo file (để bảng hiển thị đúng thứ tự)
      const orderById = new Map<string, number>();
      importRows.forEach(r => !orderById.has(r.teacherId) && orderById.set(r.teacherId, r.teacherOrder));
      const newTeachers = importNewTeachers.map(t => ({ ...t, sortOrder: orderById.get(t.id) }));
      const reordered = allMembers
        .filter(m => orderById.has(m.id) && m.sortOrder !== orderById.get(m.id))
        .map(m => ({ ...m, sortOrder: orderById.get(m.id) }));
      if (!(await saveMembersBulk([...newTeachers, ...reordered]))) return;
      if (!(await addClassesBulk(importNewClasses))) return;

      // 2) Ghép vào bảng phân công: cùng GV + lớp + môn (kể cả tên môn viết khác) + học kỳ → cập nhật, không thêm dòng trùng
      const removeIds = new Set(importReplaced.map(a => a.id));
      const newAsgs = findDuplicateAssignments(assignments.filter(a => !removeIds.has(a.id))).keep;
      const indexByKey = new Map(newAsgs.map((a, i) => [assignmentKey({ ...a, academicYear: a.academicYear || config.academicYear }), i]));
      importRows.forEach(row => {
        const k = assignmentKey({ teacherId: row.teacherId, className: row.className, term: row.term, academicYear: config.academicYear, subject: row.subject, duties: row.duties });
        const existingIdx = indexByKey.get(k);
        const asgItem: Assignment = {
          id: existingIdx !== undefined ? newAsgs[existingIdx].id : newId('asg'),
          teacherId: row.teacherId,
          teacherName: row.teacherName,
          classId: row.classId,
          className: row.className,
          grade: row.grade,
          subject: row.subject,
          periodsPerWeek: row.periods,
          duties: row.duties,
          term: row.term,
          academicYear: config.academicYear,
          kind: row.isDuty ? 'duty' : 'teaching',
          sortOrder: row.line,
        };
        if (existingIdx !== undefined) newAsgs[existingIdx] = asgItem;
        else {
          indexByKey.set(k, newAsgs.length);
          newAsgs.push(asgItem);
        }
      });

      await setAssignments(newAsgs);
      setTermFilter(importRows[0]?.term || termFilter);
      setShowImportModal(false);
      setImportRows([]);
      setImportNewTeachers([]);
      setImportNewClasses([]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCleanDuplicates = async () => {
    const ok = await confirm({
      title: `Dọn ${duplicates.remove.length} phân công trùng?`,
      message: (
        <div className="space-y-2">
          <p>Các dòng dưới đây trùng với một phân công khác (cùng giáo viên, lớp, học kỳ và cùng môn nhưng tên môn viết khác), làm số tiết bị cộng hai lần. Phần mềm giữ bản có tên môn đầy đủ và xóa bản trùng:</p>
          <ul className="max-h-40 overflow-y-auto text-[11px] list-disc pl-4">
            {duplicates.remove.slice(0, 60).map(a => (
              <li key={a.id}>{a.teacherName} – {a.className} – {a.subject} ({a.periodsPerWeek} tiết)</li>
            ))}
          </ul>
        </div>
      ),
      confirmText: 'Dọn trùng lặp',
    });
    if (ok) await setAssignments(duplicates.keep);
  };

  // ---------- Bảng phân công: lọc + sắp xếp giống file Excel ----------
  const viewAssignments = useMemo(() => {
    const q = fold(asgSearch.trim());
    return sortAssignments(
      assignments.filter(
        a =>
          a.term === termFilter &&
          (!asgGrade || a.grade === asgGrade) &&
          (!q || fold(a.teacherName).includes(q) || fold(a.className).includes(q) || fold(a.subject).includes(q)),
      ),
      allMembers,
    );
  }, [assignments, termFilter, asgGrade, asgSearch, allMembers]);
  const teacherGroups = useMemo(() => groupByTeacher(viewAssignments), [viewAssignments]);
  const classGroups = useMemo(() => {
    const map = new Map<string, { className: string; grade: number; items: Assignment[] }>();
    viewAssignments.forEach(a => {
      if (!a.className) return; // quy đổi nhiệm vụ không gắn lớp
      if (!map.has(a.className)) map.set(a.className, { className: a.className, grade: a.grade, items: [] });
      map.get(a.className)!.items.push(a);
    });
    return [...map.values()].sort((x, y) => compareClassName(x.className, y.className));
  }, [viewAssignments]);
  const termCount = (t: 'HK1' | 'HK2') => assignments.filter(a => a.term === t).length;

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Thành viên & Phân công chuyên môn</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý phân công chuyên môn, hồ sơ thành viên, thư mời email và phê duyệt quyền truy cập hệ thống
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'assignments' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bảng phân công
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'members' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hồ sơ giáo viên ({allMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'classes' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Danh sách lớp ({classes.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'invitations' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Thư mời & Phê duyệt</span>
            {(pendingInvitations.length > 0 || pendingRequests.length > 0) && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {pendingInvitations.length + pendingRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Warning Box: Unassigned Classes */}
      {unassignedClasses.length > 0 && activeTab === 'assignments' && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs text-amber-900">
            <span className="font-bold">Cảnh báo: </span>
            Các lớp chưa có giáo viên dạy môn Toán: {unassignedClasses.map(c => c.name).join(', ')}. Tổ trưởng vui lòng phân công bổ sung.
          </div>
        </div>
      )}

      {/* Tab 1: Assignments Table */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex bg-slate-100 p-0.5 rounded-lg" role="tablist" aria-label="Học kỳ">
                {(['HK1', 'HK2'] as const).map(t => (
                  <button key={t} onClick={() => setTermFilter(t)} className={`px-2.5 py-1 rounded-md font-semibold ${termFilter === t ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}>
                    {t} ({termCount(t)})
                  </button>
                ))}
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-lg" role="tablist" aria-label="Cách xem">
                <button onClick={() => setAsgView('teacher')} className={`px-2.5 py-1 rounded-md font-semibold ${asgView === 'teacher' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}>Theo giáo viên</button>
                <button onClick={() => setAsgView('class')} className={`px-2.5 py-1 rounded-md font-semibold ${asgView === 'class' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}>Theo lớp</button>
              </div>
              <select value={asgGrade} onChange={e => setAsgGrade(Number(e.target.value) as 0 | 10 | 11 | 12)} className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white" aria-label="Lọc khối">
                <option value={0}>Tất cả khối</option>
                <option value={10}>Khối 10</option>
                <option value={11}>Khối 11</option>
                <option value={12}>Khối 12</option>
              </select>
              <input value={asgSearch} onChange={e => setAsgSearch(e.target.value)} placeholder="Tìm giáo viên, lớp..." className="px-2.5 py-1.5 border border-slate-200 rounded-lg w-40" aria-label="Tìm phân công" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadAssignmentTemplate}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải mẫu Excel</span>
              </button>

              {isLeader && (
              <label className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Nhập Excel</span>
                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              </label>
              )}

              <button
                onClick={handleExportExcel}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xuất Excel</span>
              </button>

              {isLeader && (
                <button
                  onClick={openAddAssignment}
                  id="btn-add-assignment"
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm phân công</span>
                </button>
              )}
            </div>
          </div>

          {/* Cảnh báo phân công trùng */}
          {duplicates.remove.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-wrap items-center gap-3 text-xs text-rose-900" data-testid="dup-warning">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="flex-1 min-w-[240px]">
                <strong>Phát hiện {duplicates.remove.length} phân công bị trùng</strong> – cùng giáo viên, cùng lớp, cùng môn nhưng tên môn viết khác
                (ví dụ "{duplicates.remove[0].subject}" và "{duplicates.keep.find(k => assignmentKey(k) === assignmentKey(duplicates.remove[0]))?.subject}"), nên số tiết bị cộng hai lần.
                Định mức bên dưới đã tính đúng (không cộng dòng trùng); các dòng trùng được đánh dấu <span className="px-1 rounded bg-rose-200 font-bold">TRÙNG</span>.
              </div>
              {isLeader && (
                <button onClick={handleCleanDuplicates} className="px-3 py-1.5 font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg">
                  Dọn trùng lặp
                </button>
              )}
            </div>
          )}

          {/* Bảng phân công – theo giáo viên (giống file Excel của tổ: PhanCong + TongHop) */}
          {asgView === 'teacher' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse" data-testid="assignment-table">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-10 text-center">STT</th>
                      <th className="p-3 w-64">Giáo viên – Chức vụ, nhiệm vụ</th>
                      <th className="p-3 w-24">Lớp</th>
                      <th className="p-3 w-20">Khối</th>
                      <th className="p-3">Môn / Chuyên đề</th>
                      <th className="p-3 w-24">Số tiết/tuần</th>
                      {isLeader && <th className="p-3 w-14 text-right">Xóa</th>}
                    </tr>
                  </thead>
                  {teacherGroups.map((g, gi) => {
                    const standard = config.standardPeriods || 17;
                    const badge = g.total > standard ? 'bg-amber-100 text-amber-800' : g.total < standard ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800';
                    const rowCount = g.classGroups.reduce((n, c) => n + c.items.length, 0) + 1;
                    return (
                      <tbody key={g.teacherId} className={`border-t-2 border-slate-300 ${gi % 2 ? 'bg-slate-50/60' : 'bg-white'}`} data-testid="teacher-group">
                        {g.classGroups.flatMap((c, ci) =>
                          c.items.map((asg, ii) => {
                            const duty = isDuty(asg);
                            return (
                              <tr key={asg.id} className={`${ii === 0 ? 'border-t border-slate-200' : ''} ${duplicateIds.has(asg.id) ? 'bg-rose-50' : duty ? 'bg-amber-50/60' : ''}`}>
                                {ci === 0 && ii === 0 && (
                                  <>
                                    <td rowSpan={rowCount} className="p-3 align-top text-center font-bold text-slate-500">{gi + 1}</td>
                                    <td rowSpan={rowCount} className="p-3 align-top border-r border-slate-200">
                                      <div className="font-bold text-slate-900 text-[13px]" data-testid="teacher-name">{g.teacherName}</div>
                                      {g.dutyText && (
                                        <div className="text-[11px] text-slate-600 mt-0.5" data-testid="teacher-duties" title={g.dutyCodes.join('; ')}>
                                          {g.dutyText}
                                        </div>
                                      )}
                                      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] text-slate-500 max-w-[210px]">
                                        <div className="rounded bg-white border border-slate-200 py-1">
                                          <div className="text-sm font-bold text-slate-900">{g.tkb}</div>Tiết TKB
                                        </div>
                                        <div className="rounded bg-white border border-slate-200 py-1">
                                          <div className="text-sm font-bold text-amber-700">{g.quyDoi}</div>Quy đổi
                                        </div>
                                        <div className={`rounded py-1 ${badge}`} title={`Định mức ${standard} tiết/tuần`}>
                                          <div className="text-sm font-bold" data-testid="teacher-load">{g.total}</div>Tổng/{standard}
                                        </div>
                                      </div>
                                    </td>
                                  </>
                                )}
                                {ii === 0 && (
                                  <>
                                    <td rowSpan={c.items.length} className="p-3 align-top">
                                      {c.className ? (
                                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold border border-blue-200">{c.className}</span>
                                      ) : (
                                        <span className="text-[11px] font-semibold text-amber-700">Nhiệm vụ</span>
                                      )}
                                    </td>
                                    <td rowSpan={c.items.length} className="p-3 align-top text-slate-600">{c.className ? `Khối ${c.grade}` : ''}</td>
                                  </>
                                )}
                                <td className="p-2 font-medium text-slate-700">
                                  {asg.subject}
                                  {duty && asg.duties && <span className="ml-1.5 text-[11px] text-amber-800">– {dutyName(asg.duties)}</span>}
                                  {duplicateIds.has(asg.id) && <span className="ml-1.5 px-1 rounded bg-rose-200 text-rose-800 text-[9px] font-bold">TRÙNG</span>}
                                </td>
                                <td className={`p-2 font-semibold ${duty ? 'text-amber-700' : 'text-slate-900'}`}>{asg.periodsPerWeek}</td>
                                {isLeader && (
                                  <td className="p-2 text-right">
                                    <button onClick={() => handleDeleteAssignment(asg)} className="p-1 text-slate-400 hover:text-rose-600 rounded" title="Xóa phân công" aria-label={`Xóa ${asg.subject} ${asg.className}`}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          }),
                        )}
                        <tr className="border-t border-slate-200 text-slate-600">
                          <td colSpan={3} className="px-3 py-1.5 text-right italic">
                            Tiết theo TKB {g.tkb} + quy đổi {g.quyDoi} =
                          </td>
                          <td className="px-2 py-1.5 font-bold text-slate-900" data-testid="teacher-total">{g.total} tiết</td>
                          {isLeader && <td />}
                        </tr>
                      </tbody>
                    );
                  })}
                  {teacherGroups.length > 0 && (
                    <tbody className="border-t-2 border-slate-400 bg-slate-100 font-bold text-slate-800">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-right">
                          TỔNG CỘNG: tiết TKB {teacherGroups.reduce((n, g) => n + g.tkb, 0)} + quy đổi {teacherGroups.reduce((n, g) => n + g.quyDoi, 0)} =
                        </td>
                        <td className="px-2 py-2">{teacherGroups.reduce((n, g) => n + g.total, 0)} tiết</td>
                        {isLeader && <td />}
                      </tr>
                    </tbody>
                  )}
                </table>
                {teacherGroups.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500">Chưa có phân công {termFilter}{asgSearch || asgGrade ? ' phù hợp bộ lọc' : ''}.</div>
                )}
              </div>
            </div>
          )}

          {/* Bảng phân công – theo lớp: lớp nào, môn nào, ai dạy */}
          {asgView === 'class' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" data-testid="class-table">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-24">Lớp</th>
                      <th className="p-3 w-20">Khối</th>
                      <th className="p-3">Môn / Chuyên đề – Giáo viên dạy</th>
                      <th className="p-3 w-28">Tiết TKB/tuần</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {classGroups.map(c => (
                      <tr key={c.className} className="align-top hover:bg-slate-50">
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold border border-blue-200">{c.className}</span></td>
                        <td className="p-3 text-slate-600">Khối {c.grade}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {c.items.filter(a => isDuty(a)).map(a => (
                              <span key={a.id} className="px-2 py-1 rounded-lg border bg-amber-50 border-amber-200">
                                <span className="text-amber-700">Chủ nhiệm:</span> <strong className="text-slate-900">{a.teacherName}</strong>
                              </span>
                            ))}
                            {c.items.filter(a => !isDuty(a)).map(a => (
                              <span key={a.id} className={`px-2 py-1 rounded-lg border ${duplicateIds.has(a.id) ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                                <span className="text-slate-500">{a.subject} ({a.periodsPerWeek}):</span> <strong className="text-slate-900">{a.teacherName}</strong>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 font-semibold">{c.items.filter(a => !duplicateIds.has(a.id) && !isDuty(a)).reduce((n, a) => n + a.periodsPerWeek, 0)} tiết</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {classGroups.length === 0 && <div className="p-8 text-center text-xs text-slate-500">Chưa có phân công {termFilter}.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Members Profiles */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-600">
              Tổng số thành viên trong tổ: <strong className="text-slate-900">{allMembers.length} giáo viên</strong>
            </div>

            {isLeader && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Gửi thư mời qua Email</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allMembers.map(m => {
              const stats = workloadByTeacher[m.id] || { totalPeriods: 0, tkb: 0, quyDoi: 0, classes: [], dutyText: '', homeroom: [] };
              const standard = config.standardPeriods || 17;

              return (
                <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{m.displayName}</h3>
                      <p className="text-[11px] text-slate-500">{m.email || <span className="text-amber-600 italic">Chưa có email đăng nhập</span>}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800">
                        {ROLE_LABEL[m.role] || m.role}
                      </span>
                      {isLeader && (
                        <button onClick={() => setEditingMember({ ...m })} className="p-1 text-slate-400 hover:text-blue-600" aria-label={`Sửa ${m.displayName}`}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {permissions.isAdminOrHead && !isMe(m.id) && (
                        <button onClick={() => handleRemoveMember(m)} className="p-1 text-slate-400 hover:text-rose-600" aria-label={`Xóa ${m.displayName}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {m.status !== 'active' && (
                    <div className="text-[11px] font-semibold text-slate-500 bg-slate-100 rounded px-2 py-0.5 inline-block">
                      {m.status === 'transferred' ? 'Đã chuyển công tác' : 'Đã nghỉ hưu'} – không còn quyền truy cập
                    </div>
                  )}

                  <div className="text-xs space-y-1 text-slate-600 border-t border-slate-100 pt-2">
                    <div className="flex justify-between">
                      <span>Trình độ:</span>
                      <span className="font-medium text-slate-800">{m.qualifications || 'Đại học Sư phạm'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Môn dạy:</span>
                      <span className="font-medium text-slate-800">{m.subject || 'Toán học'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SĐT:</span>
                      <span className="font-medium text-slate-800">{m.phone || 'Chưa cập nhật'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tổng tiết/tuần ({termFilter}):</span>
                      <span className="font-bold text-blue-700" title="Tiết theo TKB + tiết quy đổi">
                        {stats.tkb} + {stats.quyDoi} = {stats.totalPeriods} tiết
                      </span>
                    </div>
                    {stats.dutyText && (
                      <div className="flex justify-between gap-2">
                        <span className="shrink-0">Chức vụ, nhiệm vụ:</span>
                        <span className="font-medium text-slate-800 text-right">{stats.dutyText}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs border-t border-slate-100 pt-2">
                    <span className="text-[11px] text-slate-400">Các lớp phụ trách: </span>
                    {stats.classes.length > 0 ? (
                      <span className="font-medium text-slate-800">{stats.classes.join(', ')}</span>
                    ) : (
                      <span className="italic text-amber-600">Chưa được phân công</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Classes Management */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          {isLeader && (
            <form onSubmit={handleAddClass} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên lớp</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 10A3, 11A3..."
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Khối</label>
                <select
                  value={newClassGrade}
                  onChange={e => setNewClassGrade(Number(e.target.value) as any)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value={10}>Khối 10</option>
                  <option value={11}>Khối 11</option>
                  <option value={12}>Khối 12</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sĩ số học sinh</label>
                <input
                  type="number"
                  value={newClassStudents}
                  onChange={e => setNewClassStudents(Number(e.target.value))}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-24"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Thêm lớp học
              </button>
            </form>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {classes.map(c => {
              const teacher = assignments.find(a => a.className === c.name)?.teacherName;
              return (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs relative">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-blue-700">{c.name}</span>
                    <span className="text-[11px] text-slate-400">Khối {c.grade}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Sĩ số: {c.studentCount} HS</div>
                  <div className="text-xs text-slate-700 mt-2 font-medium">
                    GV dạy: {teacher || <span className="text-amber-600 italic">Trống</span>}
                  </div>
                  {isLeader && (
                    <button
                      onClick={() => handleDeleteClass(c)}
                      className="absolute top-2 right-2 text-slate-300 hover:text-rose-600 p-1"
                      title="Xóa lớp"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Member Invitations & Access Requests (Lỗi 23) */}
      {activeTab === 'invitations' && (
        <div className="space-y-6">
          {/* Top banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Quản lý Thư mời Email & Phê duyệt Quyền truy cập</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉ những thành viên được mời hoặc được duyệt mới có quyền truy cập dữ liệu chuyên môn của tổ
              </p>
            </div>

            {isLeader && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Tạo thư mời mới</span>
              </button>
            )}
          </div>

          {/* Pending Access Requests Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>Yêu cầu xin cấp quyền truy cập từ giáo viên ({pendingRequests.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Giáo viên đăng nhập tài khoản Google ngoài danh sách có thể gửi yêu cầu phê duyệt để tham gia tổ
                </p>
              </div>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6">
                Không có yêu cầu cấp quyền nào đang chờ xét duyệt.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map(req => (
                  <div key={req.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{req.displayName}</span>
                        <span className="text-xs text-slate-500 font-mono">({req.email})</span>
                      </div>
                      <p className="text-xs text-slate-600 italic">"Lý do: {req.reason || 'Xin tham gia tổ chuyên môn Toán'}"</p>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Gửi lúc: {new Date(req.requestedAt).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    {isLeader && (
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={requestRoles[req.id] || 'teacher'}
                          onChange={e => setRequestRoles(p => ({ ...p, [req.id]: e.target.value as UserRole }))}
                          className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                          aria-label="Vai trò được cấp"
                        >
                          <option value="teacher">Giáo viên</option>
                          <option value="deputy">Tổ phó</option>
                          <option value="principal">Ban Giám hiệu</option>
                          {permissions.isAdminOrHead && <option value="head">Tổ trưởng</option>}
                        </select>
                        <button
                          onClick={() => respondToAccessRequest(req.id, 'approved', requestRoles[req.id] || 'teacher')}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Duyệt</span>
                        </button>
                        <button
                          onClick={() => respondToAccessRequest(req.id, 'rejected')}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200"
                        >
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invitations Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>Danh sách thư mời đã phát hành ({invitations.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Người nhận có thể bấm trực tiếp vào liên kết lời mời để kích hoạt tài khoản
                </p>
              </div>
            </div>

            {invitations.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6">
                Chưa có thư mời nào được tạo. Bấm "Tạo thư mời mới" để mời giáo viên.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Giáo viên được mời</th>
                      <th className="p-3">Email nhận thư</th>
                      <th className="p-3">Vai trò dự kiến</th>
                      <th className="p-3">Người gửi lời mời</th>
                      <th className="p-3">Thời gian</th>
                      <th className="p-3">Trạng thái</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invitations.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900">{inv.displayName}</td>
                        <td className="p-3 font-mono text-slate-600">{inv.email}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            {ROLE_LABEL[inv.role] || inv.role}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{inv.invitedBy}</td>
                        <td className="p-3 text-slate-500">{new Date(inv.invitedAt).toLocaleDateString('vi-VN')}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : inv.status === 'accepted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {inv.status === 'pending' ? 'ĐANG CHỜ CHẤP NHẬN' : inv.status === 'accepted' ? 'ĐÃ THAM GIA' : 'HỦY BỎ'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inv.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleCopyInviteLink(inv.id)}
                                  className="px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md flex items-center gap-1"
                                  title="Sao chép link mời"
                                >
                                  {copiedTokenId === inv.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedTokenId === inv.id ? 'Đã chép' : 'Chép lời mời'}</span>
                                </button>
                                {isLeader && (
                                  <button
                                    onClick={() => cancelInvitation(inv.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    title="Hủy lời mời"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Invite Member by Email (Lỗi 23) */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Gửi Thư mời Giáo viên qua Email</h3>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvitation} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email giáo viên (Google Account)</label>
                <input
                  type="email"
                  placeholder="giaovien@thpt.edu.vn"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Người được mời sẽ dùng email này để đăng nhập Google và vào hệ thống.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Họ và tên giáo viên</label>
                <input
                  type="text"
                  placeholder="Thầy/Cô Nguyễn Văn A"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vai trò trong tổ</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="teacher">Giáo viên</option>
                    <option value="deputy">Tổ phó</option>
                    {permissions.isAdminOrHead && <option value="head">Tổ trưởng</option>}
                    <option value="principal">Ban Giám hiệu (chỉ xem & duyệt)</option>
                    {permissions.isAdmin && <option value="admin">Quản trị hệ thống</option>}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Môn giảng dạy</label>
                  <input
                    type="text"
                    value={inviteSubject}
                    onChange={e => setInviteSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-[11px] text-blue-900 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  Cơ chế kích hoạt lời mời:
                </span>
                <p>Giáo viên chỉ cần mở ứng dụng, chọn Dữ liệu thật và đăng nhập Google bằng đúng email này — hệ thống tự kích hoạt tài khoản với vai trò đã chọn. Bấm "Chép lời mời" để gửi hướng dẫn qua Zalo/email.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Phát hành thư mời</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Assignment */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Phân công giảng dạy mới</h2>
            <form onSubmit={handleSaveAssignment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Giáo viên</label>
                <select
                  value={selectedTeacherId}
                  onChange={e => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {teachingMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({workloadByTeacher[m.id]?.totalPeriods || 0} tiết)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lớp giảng dạy</label>
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Khối {c.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Môn học</label>
                  <input
                    type="text"
                    value={subjectName}
                    onChange={e => setSubjectName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Số tiết/tuần</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={periods}
                    onChange={e => setPeriods(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nhiệm vụ kiêm nhiệm (nếu có)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Chủ nhiệm, Bồi dưỡng HSG, Ôn tốt nghiệp..."
                  value={duties}
                  onChange={e => setDuties(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Lưu phân công
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Preview Excel Import */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <h2 className="text-base font-bold text-slate-900 mb-2">Xem trước dữ liệu phân công nhập từ Excel</h2>
            <p className="text-xs text-slate-500 mb-3">
              Dữ liệu được kiểm tra trước khi ghi vào hệ thống; phân công trùng (cùng giáo viên, lớp, môn, học kỳ) sẽ được cập nhật lại.
            </p>

            {(importNewTeachers.length > 0 || importNewClasses.length > 0) && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1.5 max-h-40 overflow-y-auto shrink-0">
                {importNewTeachers.length > 0 && (
                  <div>
                    <span className="font-bold">Sẽ tạo mới {importNewTeachers.length} hồ sơ giáo viên chưa có trong danh sách thành viên: </span>
                    {importNewTeachers.map(t => `${t.displayName}${t.email ? ' (tài khoản của bạn)' : ''}${t.role !== 'teacher' ? ` – ${ROLE_LABEL[t.role]}` : ''}`).join(', ')}.
                    <div className="text-blue-700 mt-0.5">
                      Các hồ sơ này chưa có email nên chưa đăng nhập được. Sau khi nhập, vào tab "Hồ sơ giáo viên" → biểu tượng bút chì để điền email Google của từng thầy/cô.
                    </div>
                  </div>
                )}
                {importNewClasses.length > 0 && (
                  <div>
                    <span className="font-bold">Sẽ tạo mới {importNewClasses.length} lớp: </span>
                    {importNewClasses.map(c => c.name).join(', ')} <span className="text-blue-700">(sĩ số để 0, sửa sau trong Cài đặt).</span>
                  </div>
                )}
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1 max-h-32 overflow-y-auto shrink-0">
                <div className="font-bold">Các dòng bị bỏ qua ({importErrors.length}):</div>
                {importErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg mb-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold">
                  <tr>
                    <th className="p-2.5">Giáo viên</th>
                    <th className="p-2.5">Lớp</th>
                    <th className="p-2.5">Khối</th>
                    <th className="p-2.5">Môn</th>
                    <th className="p-2.5">Số tiết</th>
                    <th className="p-2.5">Kiêm nhiệm</th>
                    <th className="p-2.5">HK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {importRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium">
                        {r.teacherName}
                        {r.isNewTeacher && <span className="ml-1 px-1 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">MỚI</span>}
                      </td>
                      <td className="p-2.5 font-bold text-blue-700">
                        {r.className}
                        {r.isNewClass && <span className="ml-1 px-1 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">MỚI</span>}
                      </td>
                      <td className="p-2.5">Khối {r.grade}</td>
                      <td className="p-2.5">{r.subject}</td>
                      <td className="p-2.5">{r.periods} tiết</td>
                      <td className="p-2.5 text-slate-500">{r.duties || '—'}</td>
                      <td className="p-2.5">{r.term}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2 shrink-0 cursor-pointer">
              <input type="checkbox" checked={replaceTerms} onChange={e => setReplaceTerms(e.target.checked)} className="mt-0.5" />
              <span>
                <strong>Dùng file này làm bảng phân công chính thức của {[...new Set(importRows.map(r => r.term))].join(', ')}</strong> – xóa các phân công cũ của học kỳ này không có trong file
                {replaceTerms && importReplaced.length > 0 ? <> (<strong>{importReplaced.length} dòng</strong>, gồm cả các dòng trùng có tên môn viết khác)</> : ''}.
                Bỏ chọn nếu file chỉ bổ sung thêm một vài phân công.
              </span>
            </label>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-500 font-medium">
                Hợp lệ: {importRows.length} dòng • {importRows.reduce((s, r) => s + r.periods, 0)} tiết/tuần
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={confirmImport}
                  disabled={importRows.length === 0 || isImporting}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                >
                  {isImporting ? 'Đang lưu...' : `Xác nhận lưu ${importRows.length} phân công`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveMember} className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Hồ sơ thành viên</h3>
              <button type="button" onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-600" aria-label="Đóng"><X className="w-4 h-4" /></button>
            </div>
            <label className="block font-semibold text-slate-700">Email Google (dùng để đăng nhập)
              <input
                type="email"
                value={editingMember.email}
                onChange={e => setEditingMember({ ...editingMember, email: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal font-mono"
                placeholder="giaovien@gmail.com"
              />
              {!editingMember.email && <span className="block mt-1 font-normal text-amber-700">Chưa có email: giáo viên này chưa đăng nhập được vào hệ thống.</span>}
            </label>
            <label className="block font-semibold text-slate-700">Họ và tên
              <input value={editingMember.displayName} onChange={e => setEditingMember({ ...editingMember, displayName: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="font-semibold text-slate-700">Vai trò
                <select
                  value={editingMember.role}
                  disabled={editingMember.role === 'admin' && !permissions.isAdmin}
                  onChange={e => setEditingMember({ ...editingMember, role: e.target.value as UserRole })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-normal"
                >
                  <option value="teacher">Giáo viên</option>
                  <option value="deputy">Tổ phó</option>
                  {(permissions.isAdminOrHead || editingMember.role === 'head') && <option value="head">Tổ trưởng</option>}
                  <option value="principal">Ban Giám hiệu</option>
                  {(permissions.isAdmin || editingMember.role === 'admin') && <option value="admin">Quản trị hệ thống</option>}
                </select>
              </label>
              <label className="font-semibold text-slate-700">Trạng thái
                <select value={editingMember.status} onChange={e => setEditingMember({ ...editingMember, status: e.target.value as Member['status'] })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-normal">
                  <option value="active">Đang công tác</option>
                  <option value="transferred">Chuyển công tác</option>
                  <option value="retired">Nghỉ hưu</option>
                </select>
              </label>
              <label className="font-semibold text-slate-700">Môn dạy
                <input value={editingMember.subject || ''} onChange={e => setEditingMember({ ...editingMember, subject: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
              <label className="font-semibold text-slate-700">Số điện thoại
                <input value={editingMember.phone || ''} onChange={e => setEditingMember({ ...editingMember, phone: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
            </div>
            <label className="block font-semibold text-slate-700">Trình độ
              <input value={editingMember.qualifications || ''} onChange={e => setEditingMember({ ...editingMember, qualifications: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
            </label>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setEditingMember(null)} className="px-3.5 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="submit" className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Lưu hồ sơ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
