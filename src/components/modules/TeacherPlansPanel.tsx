import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useConfirm } from '../common/ConfirmDialog';
import { newId } from '../../utils/ids';
import { importTeacherPlanFile } from '../../utils/teacherPlanImport';
import { planApprover } from '../../utils/leaders';
import type { TeacherPlan, TeacherPlanLine } from '../../types';
import {
  Plus,
  Edit3,
  Send,
  Check,
  RotateCcw,
  Trash2,
  X,
  FileCheck,
  Printer,
  Upload,
  Loader2,
  AlertTriangle,
  MessageSquare,
  User as UserIcon,
} from 'lucide-react';

const STATUS_BADGE: Record<TeacherPlan['status'], { label: string; cls: string }> = {
  draft: { label: 'Bản nháp', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  submitted: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: '✓ Đã duyệt', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  returned: { label: 'Trả lại để điều chỉnh', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
};

const GRADES = [10, 11, 12] as const;

const emptyLine = (order: number): TeacherPlanLine => ({
  id: newId('ln'),
  order,
  lesson: '',
  periods: 1,
  timing: '',
  equipment: '',
  location: 'Lớp học',
});

/** Nội dung của bản 2.8 (ba ô văn xuôi không có trong khung chính thức) */
const legacyText = (p: TeacherPlan) =>
  [
    p.teachingTasks?.trim() && `Nhiệm vụ được giao: ${p.teachingTasks.trim()}`,
    p.selfStudyPlan?.trim() && `Kế hoạch tự học, tự bồi dưỡng: ${p.selfStudyPlan.trim()}`,
    p.expectedResults?.trim() && `Kết quả dự kiến: ${p.expectedResults.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');

const totalPeriods = (lines?: TeacherPlanLine[]) => (lines || []).reduce((s, l) => s + (Number(l.periods) || 0), 0);

/**
 * Kế hoạch giáo dục của giáo viên – đúng khung Phụ lục III Công văn 5512/BGDĐT-GDTrH:
 *   I.1 Phân phối chương trình · I.2 Chuyên đề lựa chọn (THPT) · II. Nhiệm vụ khác
 */
export const TeacherPlansPanel: React.FC = () => {
  const {
    teacherPlans,
    saveTeacherPlan,
    deleteTeacherPlan,
    allMembers,
    activeMember,
    config,
    permissions,
    isMe,
    setNotification,
  } = useApp();
  const confirm = useConfirm();
  const approver = planApprover(config);

  const isLeader = permissions.isLeader;
  const [gradeFilter, setGradeFilter] = useState<'all' | 10 | 11 | 12>('all');
  const [onlyMine, setOnlyMine] = useState(!isLeader);
  const [editing, setEditing] = useState<{ plan: TeacherPlan; isNew: boolean } | null>(null);
  const [reviewing, setReviewing] = useState<{ plan: TeacherPlan; action: 'approve' | 'return' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [importing, setImporting] = useState(false);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectableTeachers = useMemo(
    () => (isLeader ? allMembers.filter(m => m.role !== 'principal') : allMembers.filter(m => isMe(m.id))),
    [isLeader, allMembers, isMe],
  );

  const visiblePlans = useMemo(
    () =>
      teacherPlans
        .filter(p => p.academicYear === config.academicYear)
        .filter(p => (gradeFilter === 'all' ? true : p.grade === gradeFilter))
        .filter(p => (onlyMine ? isMe(p.teacherId) : true))
        .sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'vi') || a.grade - b.grade),
    [teacherPlans, config.academicYear, gradeFilter, onlyMine, isMe],
  );

  const canEdit = (p: TeacherPlan) => isLeader || (isMe(p.teacherId) && (p.status === 'draft' || p.status === 'returned'));
  const canSubmit = (p: TeacherPlan) => isMe(p.teacherId) && (p.status === 'draft' || p.status === 'returned');
  const canReview = (p: TeacherPlan) => isLeader && p.status === 'submitted';

  const closeEditor = () => {
    setEditing(null);
    setImportNotes([]);
  };

  const blankPlan = (grade: 10 | 11 | 12, owner: { id: string; displayName: string }): TeacherPlan => ({
    id: newId('tplan'),
    teacherId: owner.id,
    teacherName: owner.displayName,
    grade,
    academicYear: config.academicYear,
    title: `Kế hoạch giáo dục của giáo viên – Môn Toán, Lớp ${grade} – Năm học ${config.academicYear}`,
    status: 'draft',
    version: 1,
    subject: 'Toán',
    className: '',
    distribution: [],
    specialTopics: [],
    otherTasks: '',
    comments: [],
    updatedAt: new Date().toISOString(),
  });

  const ownerOrWarn = () => {
    const owner = selectableTeachers.find(m => isMe(m.id)) || selectableTeachers[0];
    if (!owner) {
      setNotification({ message: 'Chưa có hồ sơ giáo viên nào để lập kế hoạch. Vào mục Thành viên & Phân công để thêm.', type: 'error' });
      return null;
    }
    return owner;
  };

  const openNew = () => {
    const owner = ownerOrWarn();
    if (!owner) return;
    setImportNotes([]);
    setEditing({ isNew: true, plan: blankPlan(gradeFilter === 'all' ? 12 : gradeFilter, owner) });
  };

  const openEdit = (p: TeacherPlan) => {
    setImportNotes([]);
    // Kế hoạch lập bằng bản 2.8: gom ba ô văn xuôi cũ vào mục II để không mất nội dung
    const legacy = legacyText(p);
    setEditing({
      isNew: false,
      plan: {
        ...p,
        distribution: p.distribution || [],
        specialTopics: p.specialTopics || [],
        otherTasks: p.otherTasks?.trim() ? p.otherTasks : legacy,
      },
    });
    if (legacy && !p.otherTasks?.trim()) {
      setImportNotes(['Kế hoạch này lập bằng bản cũ. Nội dung ba ô văn xuôi đã được gom vào mục "II. Nhiệm vụ khác"; phần phân phối chương trình thầy/cô nhập lại theo bảng bên dưới.']);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setNotification({ message: 'Tệp lớn hơn 25 MB, hãy tách nhỏ hoặc lưu lại gọn hơn.', type: 'error' });
      return;
    }
    const owner = ownerOrWarn();
    if (!owner) return;

    setImporting(true);
    try {
      const grade = gradeFilter === 'all' ? 12 : gradeFilter;
      const r = await importTeacherPlanFile(file, { grade, weeksCount: config.weeksCount || 35 });
      const notes = [...r.notes];
      if (!r.recognized) {
        notes.unshift('Không đọc được bảng phân phối chương trình nào trong tệp. Thầy/cô nhập tay hoặc kiểm tra lại định dạng bảng.');
      }
      const base = blankPlan(r.grade || grade, owner);
      setImportNotes(notes);
      setEditing({
        isNew: true,
        plan: {
          ...base,
          title: r.title?.slice(0, 200) || base.title,
          subject: r.subject || base.subject,
          className: r.className || '',
          distribution: r.distribution.map((l, i) => ({ ...l, id: newId('ln'), order: i + 1 })),
          specialTopics: r.specialTopics.map((l, i) => ({ ...l, id: newId('ln'), order: i + 1 })),
          otherTasks: r.otherTasks,
        },
      });
      setNotification({ message: `Đã đọc tệp ${r.source}. Kiểm tra lại nội dung rồi bấm Lưu.`, type: 'info' });
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Không đọc được tệp này.', type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const p = editing.plan;
    if (!p.title.trim()) {
      setNotification({ message: 'Kế hoạch phải có tiêu đề.', type: 'error' });
      return;
    }
    const lines = (p.distribution || []).filter(l => l.lesson.trim());
    if (!lines.length && !p.otherTasks?.trim()) {
      setNotification({ message: 'Hãy nhập ít nhất một bài học ở mục I.1, hoặc điền mục II. Nhiệm vụ khác.', type: 'error' });
      return;
    }
    await saveTeacherPlan({
      ...p,
      distribution: lines.map((l, i) => ({ ...l, order: i + 1 })),
      specialTopics: (p.specialTopics || []).filter(l => l.lesson.trim()).map((l, i) => ({ ...l, order: i + 1 })),
    });
    closeEditor();
  };

  const handleSubmit = async (p: TeacherPlan) => {
    const ok = await confirm({
      title: 'Nộp kế hoạch cho tổ trưởng?',
      message: `"${p.title}" sẽ chuyển sang trạng thái Chờ duyệt. Sau khi nộp, thầy/cô chỉ sửa lại được khi tổ trưởng trả lại.`,
      confirmText: 'Nộp kế hoạch',
    });
    if (!ok) return;
    await saveTeacherPlan({ ...p, status: 'submitted', version: (p.version || 1) + 1 });
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewing) return;
    const { plan, action } = reviewing;
    if (action === 'return' && !reviewNote.trim()) {
      setNotification({ message: 'Hãy ghi lý do trả lại để giáo viên biết cần điều chỉnh gì.', type: 'error' });
      return;
    }
    const comment = reviewNote.trim()
      ? [
          ...(plan.comments || []),
          {
            id: newId('cmt'),
            authorId: activeMember.id,
            authorName: activeMember.displayName,
            content: reviewNote.trim(),
            type: action === 'approve' ? ('approval_note' as const) : ('return_reason' as const),
            createdAt: new Date().toISOString(),
          },
        ]
      : plan.comments || [];
    await saveTeacherPlan({ ...plan, status: action === 'approve' ? 'approved' : 'returned', comments: comment });
    setReviewing(null);
    setReviewNote('');
  };

  const handleDelete = async (p: TeacherPlan) => {
    const ok = await confirm({
      title: 'Xóa kế hoạch cá nhân?',
      message: `"${p.title}" của ${p.teacherName} sẽ bị xóa vĩnh viễn.`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (ok) await deleteTeacherPlan(p.id);
  };

  const setField = (patch: Partial<TeacherPlan>) =>
    setEditing(cur => (cur ? { ...cur, plan: { ...cur.plan, ...patch } } : cur));

  const setLine = (key: 'distribution' | 'specialTopics', idx: number, patch: Partial<TeacherPlanLine>) =>
    setEditing(cur =>
      cur
        ? { ...cur, plan: { ...cur.plan, [key]: (cur.plan[key] || []).map((l, i) => (i === idx ? { ...l, ...patch } : l)) } }
        : cur,
    );
  const addLine = (key: 'distribution' | 'specialTopics') =>
    setEditing(cur =>
      cur ? { ...cur, plan: { ...cur.plan, [key]: [...(cur.plan[key] || []), emptyLine((cur.plan[key] || []).length + 1)] } } : cur,
    );
  const removeLine = (key: 'distribution' | 'specialTopics', idx: number) =>
    setEditing(cur => (cur ? { ...cur, plan: { ...cur.plan, [key]: (cur.plan[key] || []).filter((_, i) => i !== idx) } } : cur));

  /** Bảng chỉ đọc của mục I.1 / I.2 */
  const ReadOnlyTable: React.FC<{ lines: TeacherPlanLine[]; firstCol: string }> = ({ lines, firstCol }) => (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-left text-[11px]">
        <thead className="bg-slate-100 text-slate-700 font-semibold">
          <tr>
            <th className="p-2 w-10">STT</th>
            <th className="p-2">{firstCol} (1)</th>
            <th className="p-2 w-16 text-center">Số tiết (2)</th>
            <th className="p-2 w-28">Thời điểm (3)</th>
            <th className="p-2 w-40">Thiết bị dạy học (4)</th>
            <th className="p-2 w-36">Địa điểm dạy học (5)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {lines.map((l, i) => (
            <tr key={l.id} className="align-top">
              <td className="p-2 text-slate-500">{i + 1}</td>
              <td className="p-2 font-medium text-slate-800">{l.lesson}</td>
              <td className="p-2 text-center">{l.periods}</td>
              <td className="p-2">{l.timing}</td>
              <td className="p-2 text-slate-600">{l.equipment}</td>
              <td className="p-2 text-slate-600">{l.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  /** Bảng nhập liệu của mục I.1 / I.2 */
  const EditTable: React.FC<{ keyName: 'distribution' | 'specialTopics'; firstCol: string }> = ({ keyName, firstCol }) => {
    const lines = editing?.plan[keyName] || [];
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-100 text-slate-700 font-semibold">
              <tr>
                <th className="p-1.5 w-8">STT</th>
                <th className="p-1.5 min-w-48">{firstCol} (1)</th>
                <th className="p-1.5 w-16">Số tiết (2)</th>
                <th className="p-1.5 w-28">Thời điểm (3)</th>
                <th className="p-1.5 w-36">Thiết bị (4)</th>
                <th className="p-1.5 w-32">Địa điểm (5)</th>
                <th className="p-1.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l, i) => (
                <tr key={l.id}>
                  <td className="p-1.5 text-slate-400 text-center">{i + 1}</td>
                  <td className="p-1"><input value={l.lesson} onChange={e => setLine(keyName, i, { lesson: e.target.value })} aria-label={`${firstCol} dòng ${i + 1}`} className="w-full px-2 py-1 border border-slate-300 rounded" /></td>
                  <td className="p-1"><input type="number" min={0} value={l.periods} onChange={e => setLine(keyName, i, { periods: Number(e.target.value) })} aria-label={`Số tiết dòng ${i + 1}`} className="w-full px-2 py-1 border border-slate-300 rounded" /></td>
                  <td className="p-1"><input value={l.timing} onChange={e => setLine(keyName, i, { timing: e.target.value })} placeholder="Tuần 1" aria-label={`Thời điểm dòng ${i + 1}`} className="w-full px-2 py-1 border border-slate-300 rounded" /></td>
                  <td className="p-1"><input value={l.equipment} onChange={e => setLine(keyName, i, { equipment: e.target.value })} aria-label={`Thiết bị dòng ${i + 1}`} className="w-full px-2 py-1 border border-slate-300 rounded" /></td>
                  <td className="p-1"><input value={l.location} onChange={e => setLine(keyName, i, { location: e.target.value })} aria-label={`Địa điểm dòng ${i + 1}`} className="w-full px-2 py-1 border border-slate-300 rounded" /></td>
                  <td className="p-1 text-center">
                    <button type="button" onClick={() => removeLine(keyName, i)} aria-label={`Xóa dòng ${i + 1}`} className="text-rose-500 hover:bg-rose-50 rounded p-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {!lines.length && (
                <tr><td colSpan={7} className="p-3 text-center text-slate-400 italic">Chưa có dòng nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => addLine(keyName)} className="px-2.5 py-1 font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50">
            + Thêm dòng
          </button>
          <span className="text-slate-500">Tổng: <strong>{totalPeriods(lines)}</strong> tiết</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="teacher-plans-panel">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <span>Kế hoạch giáo dục của giáo viên (Phụ lục III CV 5512)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            I. Kế hoạch dạy học (phân phối chương trình, chuyên đề lựa chọn) · II. Nhiệm vụ khác
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openNew} className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm kế hoạch cá nhân</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".docx,.pdf,.xlsx,.xls,.csv,.txt" onChange={handleImportFile} className="hidden" aria-hidden="true" tabIndex={-1} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Đọc Phụ lục III đã soạn sẵn trong Word, Excel hoặc PDF"
            className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-blue-700 rounded-lg border border-blue-200 flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{importing ? 'Đang đọc tệp...' : 'Nhập từ Word / Excel / PDF'}</span>
          </button>
          <button onClick={() => window.print()} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-xs">
            <Printer className="w-3.5 h-3.5" />
            <span>In / Xuất PDF</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs print:hidden">
        <span className="font-semibold text-slate-600">Khối:</span>
        <div className="flex gap-1">
          {(['all', ...GRADES] as const).map(g => (
            <button key={g} onClick={() => setGradeFilter(g)} className={`px-2.5 py-1 rounded-lg font-medium border ${gradeFilter === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}>
              {g === 'all' ? 'Tất cả' : `Khối ${g}`}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
          <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
          Chỉ kế hoạch của tôi
        </label>
        <span className="text-slate-400">{visiblePlans.length} kế hoạch</span>
      </div>

      {visiblePlans.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">Chưa có kế hoạch cá nhân nào cho năm học {config.academicYear}</p>
          <p className="text-xs text-slate-400 mt-1">Bấm "Thêm kế hoạch cá nhân", hoặc nhập từ tệp Word đã soạn sẵn.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePlans.map(p => {
            const badge = STATUS_BADGE[p.status];
            const dist = p.distribution || [];
            const topics = p.specialTopics || [];
            const legacy = legacyText(p);
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 break-inside-avoid">
                {/* Đầu trang theo khung Phụ lục III */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 text-xs text-slate-600 leading-relaxed">
                    <div>TRƯỜNG: <strong className="text-slate-900">{config.schoolName}</strong></div>
                    <div>TỔ: <strong className="text-slate-900">{config.departmentName}</strong></div>
                    <div>Họ và tên giáo viên: <strong className="text-slate-900">{p.teacherName}</strong></div>
                  </div>
                  <div className="text-center text-[11px] text-slate-700 shrink-0">
                    <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="font-semibold">Độc lập - Tự do - Hạnh phúc</div>
                  </div>
                </div>

                <div className="text-center space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-900 uppercase">Kế hoạch giáo dục của giáo viên</h3>
                  <div className="text-xs text-slate-700">
                    MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC <strong>{p.subject || 'Toán'}</strong>, LỚP <strong>{p.className || `${p.grade}`}</strong>
                  </div>
                  <div className="text-xs italic text-slate-500">(Năm học {p.academicYear})</div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Khối {p.grade}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>{badge.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">v{p.version || 1}</span>
                    {p.updatedAt && <span className="text-[10px] text-slate-400">cập nhật {new Date(p.updatedAt).toLocaleDateString('vi-VN')}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 justify-end print:hidden">
                  {canEdit(p) && (
                    <button onClick={() => openEdit(p)} className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-50 text-blue-700 rounded-lg border border-blue-200 flex items-center gap-1">
                      <Edit3 className="w-3 h-3" /> Sửa
                    </button>
                  )}
                  {canSubmit(p) && (
                    <button onClick={() => handleSubmit(p)} className="px-2.5 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1">
                      <Send className="w-3 h-3" /> Nộp
                    </button>
                  )}
                  {canReview(p) && (
                    <>
                      <button onClick={() => { setReviewing({ plan: p, action: 'approve' }); setReviewNote(''); }} className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1">
                        <Check className="w-3 h-3" /> Duyệt
                      </button>
                      <button onClick={() => { setReviewing({ plan: p, action: 'return' }); setReviewNote(''); }} className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-700 rounded-lg border border-rose-200 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> Trả lại
                      </button>
                    </>
                  )}
                  {isLeader && (
                    <button onClick={() => handleDelete(p)} aria-label={`Xóa kế hoạch của ${p.teacherName}`} className="px-2 py-1 text-rose-500 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {!!(p.comments || []).length && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>Ý kiến của tổ trưởng</span>
                    </div>
                    {(p.comments || []).map(c => (
                      <p key={c.id} className="text-amber-900">
                        <strong>{c.authorName}</strong> ({new Date(c.createdAt).toLocaleDateString('vi-VN')}): {c.content}
                      </p>
                    ))}
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-800">I. Kế hoạch dạy học</h4>
                    <p className="font-semibold text-slate-700 mt-1.5 mb-1">1. Phân phối chương trình</p>
                    {dist.length ? <ReadOnlyTable lines={dist} firstCol="Bài học" /> : <p className="italic text-slate-400">Chưa nhập</p>}
                    {!!dist.length && <p className="text-slate-500 mt-1">Tổng: <strong>{totalPeriods(dist)}</strong> tiết</p>}

                    <p className="font-semibold text-slate-700 mt-3 mb-1">2. Chuyên đề lựa chọn (đối với cấp trung học phổ thông)</p>
                    {topics.length ? <ReadOnlyTable lines={topics} firstCol="Chuyên đề" /> : <p className="italic text-slate-400">Không có</p>}
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800">II. Nhiệm vụ khác (nếu có)</h4>
                    <p className="text-[11px] text-slate-500 italic">(Bồi dưỡng học sinh giỏi; Tổ chức hoạt động giáo dục...)</p>
                    <p className="text-slate-700 whitespace-pre-wrap mt-1">
                      {(p.otherTasks?.trim() || legacy) || <span className="italic text-slate-400">Không có</span>}
                    </p>
                  </div>
                </div>

                {/* Ô ký theo khung */}
                <div className="grid grid-cols-2 gap-4 pt-4 mt-2 border-t border-slate-200 text-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800">TỔ TRƯỞNG</div>
                    <div className="text-[11px] italic text-slate-500">(Ký và ghi rõ họ tên)</div>
                    <div className="h-10" />
                    <div className="font-semibold text-slate-800">{approver?.name || ''}</div>
                  </div>
                  <div>
                    <div className="text-[11px] italic text-slate-500">… ngày … tháng … năm ……</div>
                    <div className="font-bold text-slate-800">GIÁO VIÊN</div>
                    <div className="text-[11px] italic text-slate-500">(Ký và ghi rõ họ tên)</div>
                    <div className="h-6" />
                    <div className="font-semibold text-slate-800">{p.teacherName}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hộp thoại soạn/sửa */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <form onSubmit={handleSave} className="bg-white rounded-2xl max-w-5xl w-full p-5 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editing.isNew ? 'Thêm kế hoạch giáo dục của giáo viên (Phụ lục III)' : 'Chỉnh sửa kế hoạch cá nhân'}
              </h3>
              <button type="button" onClick={closeEditor} className="text-slate-400 hover:text-slate-600" aria-label="Đóng">
                <X className="w-4 h-4" />
              </button>
            </div>

            {importNotes.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1" data-testid="import-notes">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Kiểm tra lại nội dung trước khi lưu</span>
                </div>
                <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                  {importNotes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <label className="block font-semibold text-slate-700">
                Giáo viên
                <select
                  value={editing.plan.teacherId}
                  onChange={e => {
                    const m = selectableTeachers.find(x => x.id === e.target.value);
                    if (m) setField({ teacherId: m.id, teacherName: m.displayName });
                  }}
                  disabled={!isLeader}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal disabled:bg-slate-100"
                >
                  {selectableTeachers.map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                </select>
              </label>
              <label className="block font-semibold text-slate-700">
                Môn học / HĐGD
                <input value={editing.plan.subject || ''} onChange={e => setField({ subject: e.target.value })} placeholder="Toán" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
              <label className="block font-semibold text-slate-700">
                Lớp
                <input value={editing.plan.className || ''} onChange={e => setField({ className: e.target.value })} placeholder="12A1, 12A2" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
              <label className="block font-semibold text-slate-700">
                Khối
                <select value={editing.plan.grade} onChange={e => setField({ grade: Number(e.target.value) as 10 | 11 | 12 })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal">
                  {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
                </select>
              </label>
            </div>

            <label className="block font-semibold text-slate-700">
              Tiêu đề kế hoạch
              <input value={editing.plan.title} onChange={e => setField({ title: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" required />
            </label>

            <div className="pt-2">
              <h4 className="font-bold text-slate-800 mb-1">I. Kế hoạch dạy học</h4>
              <p className="font-semibold text-slate-700 mb-1">1. Phân phối chương trình</p>
              <EditTable keyName="distribution" firstCol="Bài học" />
            </div>

            <div>
              <p className="font-semibold text-slate-700 mb-1">2. Chuyên đề lựa chọn (đối với cấp trung học phổ thông)</p>
              <EditTable keyName="specialTopics" firstCol="Chuyên đề" />
            </div>

            <label className="block font-semibold text-slate-700 pt-2">
              II. Nhiệm vụ khác (nếu có)
              <span className="block font-normal text-[11px] text-slate-500">(Bồi dưỡng học sinh giỏi; Tổ chức hoạt động giáo dục...)</span>
              <textarea
                rows={4}
                value={editing.plan.otherTasks || ''}
                onChange={e => setField({ otherTasks: e.target.value })}
                placeholder="Ví dụ: Bồi dưỡng đội tuyển học sinh giỏi khối 12; phụ trách câu lạc bộ STEM..."
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal resize-y"
              />
            </label>

            <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              Ghi chú theo khung: (1) tên bài học/chuyên đề · (2) số tiết thực hiện · (3) tuần thực hiện ·
              (4) thiết bị dạy học · (5) địa điểm (lớp học, phòng bộ môn, phòng đa năng, thực địa...).
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 sticky bottom-0 bg-white">
              <button type="button" onClick={closeEditor} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Hủy</button>
              <button type="submit" className="px-3.5 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Lưu kế hoạch</button>
            </div>
          </form>
        </div>
      )}

      {/* Hộp thoại duyệt / trả lại */}
      {reviewing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <form onSubmit={handleReview} className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {reviewing.action === 'approve' ? 'Phê duyệt kế hoạch cá nhân' : 'Trả lại để điều chỉnh'}
              </h3>
              <button type="button" onClick={() => setReviewing(null)} className="text-slate-400 hover:text-slate-600" aria-label="Đóng">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{reviewing.action === 'approve' ? 'Phê duyệt' : 'Trả lại'} kế hoạch của <strong>{reviewing.plan.teacherName}</strong> (Khối {reviewing.plan.grade}).</span>
            </p>
            <label className="block font-semibold text-slate-700">
              Ý kiến của tổ trưởng {reviewing.action === 'return' && <span className="text-rose-600">(bắt buộc)</span>}
              <textarea
                rows={3}
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder={reviewing.action === 'approve' ? 'Kế hoạch đạt yêu cầu.' : 'Nêu rõ nội dung cần điều chỉnh...'}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal resize-y"
              />
            </label>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setReviewing(null)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Hủy</button>
              <button type="submit" className={`px-3.5 py-1.5 font-semibold text-white rounded-lg ${reviewing.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                {reviewing.action === 'approve' ? 'Phê duyệt' : 'Trả lại'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
