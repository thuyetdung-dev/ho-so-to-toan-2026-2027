import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useConfirm } from '../common/ConfirmDialog';
import { newId } from '../../utils/ids';
import { importTeacherPlanFile } from '../../utils/teacherPlanImport';
import type { TeacherPlan } from '../../types';
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
  User as UserIcon,
  Upload,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

const STATUS_BADGE: Record<TeacherPlan['status'], { label: string; cls: string }> = {
  draft: { label: 'Bản nháp', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  submitted: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: '✓ Đã duyệt', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  returned: { label: 'Trả lại để điều chỉnh', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
};

const GRADES = [10, 11, 12] as const;

/**
 * Kế hoạch giáo dục của giáo viên (Phụ lục III CV 5512).
 * Trước bản 2.7 phần này có sẵn dữ liệu và quy tắc bảo mật nhưng chưa có màn hình nào,
 * nên tổ không tạo được kế hoạch cá nhân dù menu ghi "Phụ lục I, III".
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

  const isLeader = permissions.isLeader;
  const [gradeFilter, setGradeFilter] = useState<'all' | 10 | 11 | 12>('all');
  const [onlyMine, setOnlyMine] = useState(!isLeader);
  const [editing, setEditing] = useState<{ plan: TeacherPlan; isNew: boolean } | null>(null);
  const [reviewing, setReviewing] = useState<{ plan: TeacherPlan; action: 'approve' | 'return' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [importing, setImporting] = useState(false);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Giáo viên có thể đứng tên kế hoạch: tổ trưởng chọn được mọi người, giáo viên chỉ chính mình
  const selectableTeachers = useMemo(
    () => (isLeader ? allMembers.filter(m => m.role !== 'principal') : allMembers.filter(m => isMe(m.id))),
    [isLeader, allMembers, isMe],
  );

  const visiblePlans = useMemo(() => {
    return teacherPlans
      .filter(p => p.academicYear === config.academicYear)
      .filter(p => (gradeFilter === 'all' ? true : p.grade === gradeFilter))
      .filter(p => (onlyMine ? isMe(p.teacherId) : true))
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'vi') || a.grade - b.grade);
  }, [teacherPlans, config.academicYear, gradeFilter, onlyMine, isMe]);

  const canEdit = (p: TeacherPlan) => isLeader || (isMe(p.teacherId) && (p.status === 'draft' || p.status === 'returned'));
  const canSubmit = (p: TeacherPlan) => isMe(p.teacherId) && (p.status === 'draft' || p.status === 'returned');
  const canReview = (p: TeacherPlan) => isLeader && p.status === 'submitted';

  const openNew = () => {
    const owner = selectableTeachers.find(m => isMe(m.id)) || selectableTeachers[0];
    if (!owner) {
      setNotification({ message: 'Chưa có hồ sơ giáo viên nào để lập kế hoạch. Vào mục Thành viên & Phân công để thêm.', type: 'error' });
      return;
    }
    const grade = gradeFilter === 'all' ? 12 : gradeFilter;
    setEditing({
      isNew: true,
      plan: {
        id: newId('tplan'),
        teacherId: owner.id,
        teacherName: owner.displayName,
        grade,
        academicYear: config.academicYear,
        title: `Kế hoạch giáo dục của giáo viên – Môn Toán Khối ${grade} – Năm học ${config.academicYear}`,
        status: 'draft',
        version: 1,
        teachingTasks: '',
        selfStudyPlan: '',
        expectedResults: '',
        updatedAt: new Date().toISOString(),
      },
    });
  };

  /**
   * Nhập kế hoạch từ tệp Word/Excel/PDF. Nội dung đọc được chỉ ĐỔ VÀO BIỂU MẪU để thầy/cô
   * xem lại và sửa; phần mềm không tự lưu vào cơ sở dữ liệu.
   */
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại đúng tệp đó lần sau
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setNotification({ message: 'Tệp lớn hơn 25 MB, hãy tách nhỏ hoặc lưu lại gọn hơn.', type: 'error' });
      return;
    }
    const owner = selectableTeachers.find(m => isMe(m.id)) || selectableTeachers[0];
    if (!owner) {
      setNotification({ message: 'Chưa có hồ sơ giáo viên nào để lập kế hoạch.', type: 'error' });
      return;
    }
    setImporting(true);
    try {
      const r = await importTeacherPlanFile(file);
      const grade = r.grade || (gradeFilter === 'all' ? 12 : gradeFilter);
      const notes = [...r.notes];
      if (!r.recognized) {
        notes.unshift('Không nhận ra tiêu đề mục nào trong tệp. Toàn bộ nội dung được đưa vào "Nhiệm vụ được giao" để thầy/cô cắt lại cho đúng.');
      }
      if (r.grade) notes.push(`Nhận ra Khối ${r.grade} từ nội dung tệp.`);
      setImportNotes(notes);
      setEditing({
        isNew: true,
        plan: {
          id: newId('tplan'),
          teacherId: owner.id,
          teacherName: owner.displayName,
          grade,
          academicYear: config.academicYear,
          title: r.title?.slice(0, 200) || `Kế hoạch giáo dục của giáo viên – Môn Toán Khối ${grade} – Năm học ${config.academicYear}`,
          status: 'draft',
          version: 1,
          teachingTasks: r.recognized ? r.teachingTasks : r.rawText,
          selfStudyPlan: r.selfStudyPlan,
          expectedResults: r.expectedResults,
          updatedAt: new Date().toISOString(),
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
    if (!p.teachingTasks.trim()) {
      setNotification({ message: 'Hãy điền phần "Nhiệm vụ được giao" trước khi lưu.', type: 'error' });
      return;
    }
    await saveTeacherPlan(p);
    setEditing(null); setImportNotes([]);
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
    await saveTeacherPlan({
      ...plan,
      status: action === 'approve' ? 'approved' : 'returned',
      expectedResults: reviewNote.trim()
        ? `${plan.expectedResults}\n\n[Ý kiến tổ trưởng ${new Date().toLocaleDateString('vi-VN')}] ${reviewNote.trim()}`
        : plan.expectedResults,
    });
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

  return (
    <div className="space-y-4" data-testid="teacher-plans-panel">
      {/* Thanh công cụ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <span>Kế hoạch giáo dục của giáo viên (Phụ lục III CV 5512)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mỗi giáo viên lập kế hoạch cá nhân theo khối mình dạy, nộp để tổ trưởng duyệt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openNew}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm kế hoạch cá nhân</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf,.xlsx,.xls,.csv,.txt"
            onChange={handleImportFile}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Đọc kế hoạch đã soạn sẵn trong Word, Excel hoặc PDF"
            className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-blue-700 rounded-lg border border-blue-200 flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{importing ? 'Đang đọc tệp...' : 'Nhập từ Word / Excel / PDF'}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In / Xuất PDF</span>
          </button>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center gap-3 text-xs print:hidden">
        <span className="font-semibold text-slate-600">Khối:</span>
        <div className="flex gap-1">
          {(['all', ...GRADES] as const).map(g => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-2.5 py-1 rounded-lg font-medium border ${
                gradeFilter === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
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

      {/* Danh sách */}
      {visiblePlans.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">Chưa có kế hoạch cá nhân nào cho năm học {config.academicYear}</p>
          <p className="text-xs text-slate-400 mt-1">Bấm "Thêm kế hoạch cá nhân" ở trên để bắt đầu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePlans.map(p => {
            const badge = STATUS_BADGE[p.status];
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 break-inside-avoid">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Khối {p.grade}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>{badge.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono">v{p.version || 1}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1 leading-snug">{p.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <UserIcon className="w-3 h-3" />
                      {p.teacherName}
                      {p.updatedAt && <span className="text-slate-400">• cập nhật {new Date(p.updatedAt).toLocaleDateString('vi-VN')}</span>}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 print:hidden">
                    {canEdit(p) && (
                      <button
                        onClick={() => setEditing({ plan: p, isNew: false })}
                        className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-50 text-blue-700 rounded-lg border border-blue-200 flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Sửa
                      </button>
                    )}
                    {canSubmit(p) && (
                      <button
                        onClick={() => handleSubmit(p)}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> Nộp
                      </button>
                    )}
                    {canReview(p) && (
                      <>
                        <button
                          onClick={() => { setReviewing({ plan: p, action: 'approve' }); setReviewNote(''); }}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Duyệt
                        </button>
                        <button
                          onClick={() => { setReviewing({ plan: p, action: 'return' }); setReviewNote(''); }}
                          className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-700 rounded-lg border border-rose-200 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Trả lại
                        </button>
                      </>
                    )}
                    {isLeader && (
                      <button
                        onClick={() => handleDelete(p)}
                        aria-label={`Xóa kế hoạch của ${p.teacherName}`}
                        className="px-2 py-1 text-rose-500 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {[
                    ['1. Nhiệm vụ được giao', p.teachingTasks],
                    ['2. Kế hoạch tự học, tự bồi dưỡng', p.selfStudyPlan],
                    ['3. Kết quả dự kiến & Ý kiến tổ trưởng', p.expectedResults],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                      <dt className="font-semibold text-slate-700">{label}</dt>
                      <dd className="text-slate-600 mt-1 whitespace-pre-wrap leading-relaxed">
                        {value?.trim() || <span className="italic text-slate-400">Chưa điền</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}

      {/* Hộp thoại soạn/sửa */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-3 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editing.isNew ? 'Thêm kế hoạch giáo dục của giáo viên' : 'Chỉnh sửa kế hoạch cá nhân'}
              </h3>
              <button type="button" onClick={() => { setEditing(null); setImportNotes([]); }} className="text-slate-400 hover:text-slate-600" aria-label="Đóng">
                <X className="w-4 h-4" />
              </button>
            </div>

            {importNotes.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1" data-testid="import-notes">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Nội dung đọc từ tệp – hãy kiểm tra lại trước khi lưu</span>
                </div>
                <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                  {importNotes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  {selectableTeachers.map(m => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
                {!isLeader && <span className="font-normal text-[11px] text-slate-500">Thầy/cô chỉ lập kế hoạch cho chính mình.</span>}
              </label>

              <label className="block font-semibold text-slate-700">
                Khối lớp
                <select
                  value={editing.plan.grade}
                  onChange={e => setField({ grade: Number(e.target.value) as 10 | 11 | 12 })}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal"
                >
                  {GRADES.map(g => <option key={g} value={g}>Khối {g}</option>)}
                </select>
              </label>
            </div>

            <label className="block font-semibold text-slate-700">
              Tiêu đề kế hoạch
              <input
                value={editing.plan.title}
                onChange={e => setField({ title: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal"
                required
              />
            </label>

            <label className="block font-semibold text-slate-700">
              1. Nhiệm vụ được giao (giảng dạy, kiêm nhiệm, chỉ tiêu chất lượng)
              <textarea
                rows={4}
                value={editing.plan.teachingTasks}
                onChange={e => setField({ teachingTasks: e.target.value })}
                placeholder="Ví dụ: Dạy Toán lớp 12A1, 12A2; ôn thi tốt nghiệp khối 12; chỉ tiêu 85% đạt từ 5,0 trở lên..."
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal resize-y"
                required
              />
            </label>

            <label className="block font-semibold text-slate-700">
              2. Kế hoạch tự học, tự bồi dưỡng
              <textarea
                rows={3}
                value={editing.plan.selfStudyPlan}
                onChange={e => setField({ selfStudyPlan: e.target.value })}
                placeholder="Ví dụ: Hoàn thành 2 mô-đun BDTX; dự 4 tiết của đồng nghiệp; nghiên cứu ứng dụng GeoGebra vào dạy Oxyz..."
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal resize-y"
              />
            </label>

            <label className="block font-semibold text-slate-700">
              3. Kết quả dự kiến
              <textarea
                rows={3}
                value={editing.plan.expectedResults}
                onChange={e => setField({ expectedResults: e.target.value })}
                placeholder="Ví dụ: Hoàn thành chương trình đúng tiến độ; 1 chuyên đề cấp tổ; tỉ lệ học sinh khá giỏi tăng so với đầu năm..."
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal resize-y"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => { setEditing(null); setImportNotes([]); }} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">
                Hủy
              </button>
              <button type="submit" className="px-3.5 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                Lưu kế hoạch
              </button>
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
            <p className="text-slate-600">
              {reviewing.action === 'approve' ? 'Phê duyệt' : 'Trả lại'} kế hoạch của <strong>{reviewing.plan.teacherName}</strong> (Khối {reviewing.plan.grade}).
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
              <span className="font-normal text-[11px] text-slate-500">Ý kiến được ghi vào mục "Kết quả dự kiến" kèm ngày tháng.</span>
            </label>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setReviewing(null)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">
                Hủy
              </button>
              <button
                type="submit"
                className={`px-3.5 py-1.5 font-semibold text-white rounded-lg ${
                  reviewing.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {reviewing.action === 'approve' ? 'Phê duyệt' : 'Trả lại'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
