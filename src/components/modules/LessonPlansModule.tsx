import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, lessonSnapshot } from '../../context/AppContext';
import { VersionDiffModal } from '../common/VersionDiffModal';
import { LessonPlanEditorModal } from './LessonPlanEditorModal';
import { useConfirm } from '../common/ConfirmDialog';
import { newId, todayISO, safeUrl } from '../../utils/ids';
import { LessonPlan, LessonPlanActivity } from '../../types';
import { MathText } from '../../utils/katex-renderer';
import {
  FileText,
  Plus,
  Copy,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  Sparkles,
  Send,
  Eye,
  Printer,
  History,
  GitCompare,
  AlertTriangle,
  Check,
  Calendar,
  X,
  ChevronRight,
  BookOpen,
  Pencil,
  Maximize2,
  Minimize2,
  Trash2,
  Printer as PrinterIcon,
  Stethoscope,
} from 'lucide-react';
import { FormulaDoctor, countFormulaIssues } from '../common/FormulaDoctor';
import { useLessonPlanDetail } from '../../hooks/useLessonPlanDetail';
import type { PlanVersionRecord } from '../../types';

export const LessonPlansModule: React.FC = () => {
  const { isMe,
    activeMember,
    lessonPlans,
    saveLessonPlan,
    getFullLessonPlan,
    loadLessonPlanHistory,
    submitLessonPlan,
    reviewLessonPlan,
    updateLessonPlanTeachingStatus,
    deleteLessonPlan,
    classes,
    setNotification,
    permissions,
  } = useApp();
  const confirm = useConfirm();

  const isLeader = permissions.isLeader;
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null);
  // Xem giáo án toàn màn hình (dùng Fullscreen API nếu trình duyệt hỗ trợ, nếu không thì phủ kín cửa sổ)
  const [fullView, setFullView] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const toggleFullView = async () => {
    if (fullView) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setFullView(false);
      return;
    }
    setFullView(true);
    try {
      if (viewRef.current && document.fullscreenEnabled) await viewRef.current.requestFullscreen();
    } catch {
      /* không hỗ trợ → vẫn dùng chế độ phủ kín cửa sổ */
    }
  };
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullView(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullView(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  const [searchText, setSearchText] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState<string>(lessonPlans[0]?.id || '');
  const [filterGrade, setFilterGrade] = useState<'all' | 10 | 11 | 12>('all');
  const [filterTeachingStatus, setFilterTeachingStatus] = useState<'all' | 'not_taught' | 'completed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlan, setNewPlan] = useState({
    title: '',
    topicTitle: '',
    grade: 10 as 10 | 11 | 12,
    week: 1,
    periodCount: 1,
  });
  const [commentText, setCommentText] = useState('');
  const [commentSection, setCommentSection] = useState('Hoạt động 1');

  // Workflow State (Lỗi 21)
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitNote, setSubmitNote] = useState('');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'return'>('approve');
  const [reviewNote, setReviewNote] = useState('');

  // Version History & Diff Viewer State (Lỗi 21)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);

  // Teaching Status Modal State (Lỗi 21)
  const [showTeachingModal, setShowTeachingModal] = useState(false);
  const [teachingStatus, setTeachingStatus] = useState<'not_taught' | 'in_progress' | 'completed'>('completed');
  const [teachingDate, setTeachingDate] = useState<string>(todayISO());
  const [teachingClasses, setTeachingClasses] = useState<string[]>([]);

  const filteredPlans = lessonPlans
    .filter(p => {
    if (filterGrade !== 'all' && p.grade !== filterGrade) return false;
    if (onlyMine && !isMe(p.teacherId)) return false;
    if (searchText.trim()) {
      const kw = searchText.trim().toLowerCase();
      if (!`${p.title} ${p.topicTitle} ${p.teacherName}`.toLowerCase().includes(kw)) return false;
    }
    if (filterTeachingStatus === 'not_taught' && p.isTaught) return false;
    if (filterTeachingStatus === 'completed' && !p.isTaught) return false;
    return true;
  })
    .sort((a, b) => a.grade - b.grade || a.week - b.week);

  const selectedPlan = lessonPlans.find(p => p.id === selectedPlanId) || filteredPlans[0];
  // Nội dung + hình chỉ tải khi mở giáo án (bản 2.4)
  const { plan: fullPlan, loading: detailLoading, error: detailError, missingImages } = useLessonPlanDetail(selectedPlan);
  const [diffHistory, setDiffHistory] = useState<PlanVersionRecord[] | null>(null);
  const openDiff = async () => {
    if (!selectedPlan) return;
    try {
      setDiffHistory(await loadLessonPlanHistory(selectedPlan));
      setShowDiffModal(true);
    } catch {
      setNotification({ message: 'Không tải được lịch sử phiên bản. Kiểm tra kết nối mạng.', type: 'error' });
    }
  };
  const isOwner = !!selectedPlan && isMe(selectedPlan.teacherId);
  const canEdit = !!selectedPlan && permissions.canContribute && (isOwner || isLeader) && (selectedPlan.status === 'draft' || selectedPlan.status === 'returned');
  const canSubmit = !!selectedPlan && isOwner && (selectedPlan.status === 'draft' || selectedPlan.status === 'returned');
  // Tổ trưởng/tổ phó được sửa lỗi công thức cả khi giáo án đang chờ duyệt / đã duyệt
  const canFixFormula = canEdit || (!!selectedPlan && isLeader && permissions.canContribute);
  const formulaIssues = useMemo(
    () => (fullPlan ? countFormulaIssues(fullPlan) : { errors: 0, suggestions: 0 }),
    [fullPlan],
  );
  const [doctorOpen, setDoctorOpen] = useState(false);
  const canDelete = !!selectedPlan && ((isOwner && selectedPlan.status === 'draft') || permissions.isAdminOrHead);

  const handleDelete = async () => {
    if (!selectedPlan) return;
    const ok = await confirm({
      title: 'Xóa kế hoạch bài dạy?',
      message: `"${selectedPlan.title}" sẽ bị xóa vĩnh viễn cùng các góp ý và lịch sử phiên bản.`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (!ok) return;
    await deleteLessonPlan(selectedPlan.id);
    setSelectedPlanId('');
  };

  const handleExecuteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    await submitLessonPlan(selectedPlan.id, submitNote);
    setShowSubmitModal(false);
    setSubmitNote('');
  };

  const handleExecuteReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    await reviewLessonPlan(selectedPlan.id, reviewAction === 'approve' ? 'approve' : 'returned', reviewNote);
    setShowReviewModal(false);
    setReviewNote('');
  };

  const handleSaveTeachingStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    await updateLessonPlanTeachingStatus(
      selectedPlan.id,
      teachingStatus,
      teachingStatus === 'completed' ? teachingDate : undefined,
      teachingClasses.length > 0 ? teachingClasses : undefined
    );
    setShowTeachingModal(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedPlan) return;

    const newComment = {
      id: newId('c'),
      authorId: activeMember.id,
      authorName: activeMember.displayName,
      sectionId: commentSection,
      content: commentText.trim(),
      isResolved: false,
      createdAt: new Date().toISOString(),
    };

    const updated: LessonPlan = {
      ...selectedPlan,
      comments: [...(selectedPlan.comments || []), newComment],
      updatedAt: new Date().toISOString(),
    };

    if (await saveLessonPlan(updated, { silent: true })) {
      setCommentText('');
      setNotification({ message: 'Đã thêm góp ý cho kế hoạch bài dạy', type: 'success' });
    }
  };

  const handleClonePlan = async (lightPlan: LessonPlan) => {
    let plan: LessonPlan | null;
    try {
      plan = await getFullLessonPlan(lightPlan);
    } catch {
      plan = null;
    }
    if (!plan) {
      setNotification({ message: 'Không tải được nội dung giáo án gốc để nhân bản.', type: 'error' });
      return;
    }
    const { storage: _s, imageIds: _i, contentBytes: _cb, imageBytes: _ib, versionBytes: _vb, ...source } = plan;
    const cloned: LessonPlan = {
      ...source,
      contentState: 'full',
      id: newId('lp'),
      approvedBy: undefined,
      taughtClasses: [],
      teacherId: activeMember.id,
      teacherName: activeMember.displayName,
      title: `${plan.title} (Bản điều chỉnh của ${activeMember.displayName})`,
      status: 'draft',
      version: 1,
      originalAuthorId: plan.teacherId,
      comments: [],
      isTaught: false,
      teachingStatus: 'not_taught',
      taughtDate: undefined,
      versionHistory: [
        {
          version: 1,
          updatedAt: new Date().toISOString(),
          updatedBy: activeMember.displayName,
          changeSummary: `Nhân bản từ giáo án gốc của ${plan.teacherName}`,
          summary: `Nhân bản từ giáo án gốc của ${plan.teacherName}`,
          status: 'draft',
          dataSnapshot: lessonSnapshot(plan),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    if (await saveLessonPlan(cloned, { silent: true })) {
      setSelectedPlanId(cloned.id);
      setNotification({ message: `Đã nhân bản kế hoạch bài dạy từ tác giả ${plan.teacherName}. Bạn có thể chỉnh sửa bản sao ngay.`, type: 'success' });
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlan.title.trim() || !newPlan.topicTitle.trim()) return;
    const now = new Date().toISOString();
    const activities: LessonPlanActivity[] = [
      ['Hoạt động 1: Mở đầu', 'Tạo hứng thú và xác định nhiệm vụ học tập'],
      ['Hoạt động 2: Hình thành kiến thức mới', 'Khám phá và hình thành kiến thức trọng tâm'],
      ['Hoạt động 3: Luyện tập', 'Củng cố kiến thức và rèn luyện kỹ năng'],
      ['Hoạt động 4: Vận dụng', 'Vận dụng kiến thức vào tình huống thực tiễn'],
    ].map(([name, objectives], index) => ({
      id: newId(`activity${index + 1}`),
      name,
      objectives,
      content: '',
      product: '',
      implementation: '',
    }));
    const plan: LessonPlan = {
      id: newId('lp'),
      teacherId: activeMember.id,
      teacherName: activeMember.displayName,
      grade: newPlan.grade,
      topicTitle: newPlan.topicTitle.trim(),
      week: Math.max(1, newPlan.week),
      periodCount: Math.max(1, newPlan.periodCount),
      classNames: [],
      title: newPlan.title.trim(),
      status: 'draft',
      version: 1,
      objectivesKnowledge: '',
      objectivesCompetence: '',
      objectivesQualities: '',
      equipment: '',
      activities,
      comments: [],
      createdAt: now,
      updatedAt: now,
      teachingStatus: 'not_taught',
      isTaught: false,
      versionHistory: [{
        version: 1,
        updatedAt: now,
        updatedBy: activeMember.displayName,
        changeSummary: 'Khởi tạo kế hoạch bài dạy',
        summary: 'Khởi tạo kế hoạch bài dạy',
        status: 'draft',
      }],
    };
    if (!(await saveLessonPlan(plan))) return;
    setSelectedPlanId(plan.id);
    setShowCreateModal(false);
    setEditingPlan(plan); // mở ngay trình soạn thảo nội dung
    setNewPlan({ title: '', topicTitle: '', grade: 10, week: 1, periodCount: 1 });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">
              Kế hoạch bài dạy (Giáo án CV 5512/BGDĐT-GDTrH)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quy trình phê duyệt, lịch sử phiên bản, so sánh thay đổi và theo dõi nhật ký thực dạy trên lớp
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {permissions.canContribute && <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo giáo án mới</span>
          </button>}
          {selectedPlan && (
            <>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <History className="w-3.5 h-3.5 text-blue-600" />
                <span>Lịch sử phiên bản ({selectedPlan.versionHistory?.length || 1})</span>
              </button>

              <button
                onClick={openDiff}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
                <span>So sánh Diff</span>
              </button>
            </>
          )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tạo kế hoạch bài dạy mới</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tạo sẵn cấu trúc 4 hoạt động theo Công văn 5512.</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreatePlan} className="grid grid-cols-2 gap-3 text-xs">
              <label className="col-span-2 font-semibold text-slate-700">Tên giáo án <span className="text-rose-600">*</span>
                <input required value={newPlan.title} onChange={e => setNewPlan(v => ({ ...v, title: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" placeholder="Ví dụ: Đường tiệm cận của đồ thị hàm số" />
              </label>
              <label className="col-span-2 font-semibold text-slate-700">Chủ đề/Bài học <span className="text-rose-600">*</span>
                <input required value={newPlan.topicTitle} onChange={e => setNewPlan(v => ({ ...v, topicTitle: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
              <label className="font-semibold text-slate-700">Khối
                <select value={newPlan.grade} onChange={e => setNewPlan(v => ({ ...v, grade: Number(e.target.value) as 10 | 11 | 12 }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-normal">
                  <option value={10}>Khối 10</option><option value={11}>Khối 11</option><option value={12}>Khối 12</option>
                </select>
              </label>
              <label className="font-semibold text-slate-700">Tuần
                <input type="number" min={1} max={35} value={newPlan.week} onChange={e => setNewPlan(v => ({ ...v, week: Number(e.target.value) }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
              <label className="font-semibold text-slate-700">Số tiết
                <input type="number" min={1} max={20} value={newPlan.periodCount} onChange={e => setNewPlan(v => ({ ...v, periodCount: Number(e.target.value) }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
              <div className="col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> Tạo giáo án</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

      {/* Main Grid: Left List / Right Full Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Plan Selector & Filter */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Tìm theo tên bài, chủ đề, người soạn..."
                className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                aria-label="Tìm giáo án"
              />
              <label className="text-[11px] text-slate-600 flex items-center gap-1 shrink-0">
                <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} /> Của tôi
              </label>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">Lọc theo khối:</span>
              <div className="flex gap-1">
                {(['all', 10, 11, 12] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setFilterGrade(g)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                      filterGrade === g ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {g === 'all' ? 'Tất cả' : `K${g}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">Thực dạy:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setFilterTeachingStatus('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    filterTeachingStatus === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilterTeachingStatus('completed')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    filterTeachingStatus === 'completed' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Đã dạy
                </button>
                <button
                  onClick={() => setFilterTeachingStatus('not_taught')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    filterTeachingStatus === 'not_taught' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  Chưa dạy
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
            {filteredPlans.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">
                Không có giáo án phù hợp bộ lọc.
              </div>
            )}
            {filteredPlans.map(plan => {
              const isSelected = plan.id === selectedPlan?.id;

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-400 shadow-xs ring-1 ring-blue-300'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      Khối {plan.grade} • Tuần {plan.week}
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          plan.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : plan.status === 'submitted'
                            ? 'bg-amber-100 text-amber-800'
                            : plan.status === 'returned'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {plan.status === 'approved'
                          ? 'Đã duyệt'
                          : plan.status === 'submitted'
                          ? 'Chờ duyệt'
                          : plan.status === 'returned'
                          ? 'Cần sửa'
                          : 'Bản nháp'}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">{plan.title}</h3>

                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>Soạn: <strong>{plan.teacherName}</strong></span>
                    <span className="font-mono text-slate-400">v{plan.version}</span>
                  </div>

                  {/* Teaching Status indicator badge */}
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span
                      className={`font-semibold flex items-center gap-1 ${
                        plan.isTaught ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {plan.isTaught ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Đã dạy: {plan.taughtDate || 'Gần đây'}</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Chưa thực dạy</span>
                        </>
                      )}
                    </span>

                    {plan.taughtClasses && plan.taughtClasses.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
                        {plan.taughtClasses.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Detailed 5512 Lesson Plan View */}
        <div className="lg:col-span-8 space-y-6">
          {selectedPlan ? (
            <div
              ref={viewRef}
              className={
                fullView
                  ? 'fixed inset-0 z-50 bg-white overflow-y-auto p-6 sm:px-12 lg:px-24 space-y-6'
                  : 'bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6'
              }
              style={fullView ? ({ zoom: 1.3 } as React.CSSProperties) : undefined}
            >
              {/* Actions & Status bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                      Toán Khối {selectedPlan.grade} • {selectedPlan.periodCount} tiết
                    </span>
                    <span className="text-xs text-slate-500">
                      Người soạn: <strong>{selectedPlan.teacherName}</strong>
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700">
                      v{selectedPlan.version}
                    </span>

                    {/* Workflow status indicator */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${
                        selectedPlan.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : selectedPlan.status === 'submitted'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : selectedPlan.status === 'returned'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {selectedPlan.status === 'approved' && `✓ ĐÃ DUYỆT (${selectedPlan.approvedBy || 'Tổ trưởng'})`}
                      {selectedPlan.status === 'submitted' && '⏳ ĐANG CHỜ DUYỆT'}
                      {selectedPlan.status === 'returned' && '⚠ YÊU CẦU SỬA'}
                      {selectedPlan.status === 'draft' && 'DỰ THẢO'}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-1">{selectedPlan.title}</h2>
                  {(selectedPlan.sourceFileUrl || selectedPlan.sourceFileName) && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Tệp gốc:{' '}
                      {safeUrl(selectedPlan.sourceFileUrl) ? (
                        <a href={safeUrl(selectedPlan.sourceFileUrl)!} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                          {selectedPlan.sourceFileName || 'Mở tệp'}
                        </a>
                      ) : (
                        <span>{selectedPlan.sourceFileName}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Teaching progress update button */}
                  {(isOwner || isLeader) && <button
                    onClick={() => {
                      const statusVal =
                        selectedPlan.teachingStatus === 'teaching' || selectedPlan.teachingStatus === 'in_progress'
                          ? 'in_progress'
                          : selectedPlan.teachingStatus === 'completed' || selectedPlan.isTaught
                          ? 'completed'
                          : 'not_taught';
                      setTeachingStatus(statusVal);
                      setTeachingDate(selectedPlan.taughtDate || todayISO());
                      setTeachingClasses(selectedPlan.taughtClasses || selectedPlan.classNames || []);
                      setShowTeachingModal(true);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1 shadow-xs transition-colors ${
                      selectedPlan.isTaught
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{selectedPlan.isTaught ? `Đã dạy (${selectedPlan.taughtDate || 'Xong'})` : 'Ghi nhận thực dạy'}</span>
                  </button>}

                  {permissions.canContribute && <button
                    onClick={() => handleClonePlan(selectedPlan)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 border border-slate-200"
                    title="Nhân bản để điều chỉnh cho lớp của bạn"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Nhân bản</span>
                  </button>}

                  {canEdit && (
                    <button
                      onClick={() => fullPlan && setEditingPlan(fullPlan)}
                      disabled={!fullPlan}
                      className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-blue-50 text-blue-700 rounded-lg flex items-center gap-1 border border-blue-200"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Soạn / Sửa</span>
                    </button>
                  )}
                  {canFixFormula && formulaIssues.errors + formulaIssues.suggestions > 0 && (
                    <button
                      onClick={() => setDoctorOpen(true)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 border print:hidden ${formulaIssues.errors ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'}`}
                      title="Phần mềm tự tìm công thức bị lỗi và đề xuất cách sửa"
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>Sửa lỗi công thức ({formulaIssues.errors + formulaIssues.suggestions})</span>
                    </button>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 border border-slate-200"
                    title="In / Xuất PDF giáo án"
                  >
                    <PrinterIcon className="w-3.5 h-3.5" />
                    <span>In</span>
                  </button>
                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-rose-50 text-rose-700 rounded-lg flex items-center gap-1 border border-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Submission control: chỉ người soạn mới trình duyệt giáo án của mình */}
                  {canSubmit && (
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{selectedPlan.status === 'returned' ? 'Nộp lại sau sửa' : 'Trình duyệt'}</span>
                    </button>
                  )}

                  <button
                    onClick={toggleFullView}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg flex items-center gap-1 shadow-xs"
                    title={fullView ? 'Thoát toàn màn hình (Esc)' : 'Xem giáo án toàn màn hình (trình chiếu, họp tổ)'}
                  >
                    {fullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    <span>{fullView ? 'Thoát toàn màn hình' : 'Toàn màn hình'}</span>
                  </button>

                  {/* Approval controls for Leader */}
                  {isLeader && selectedPlan.status === 'submitted' && (!isOwner || permissions.isAdminOrHead) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setReviewAction('approve');
                          setShowReviewModal(true);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Duyệt giáo án</span>
                      </button>

                      <button
                        onClick={() => {
                          setReviewAction('return');
                          setShowReviewModal(true);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Trả lại</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!fullPlan ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl">
                  {detailError ? <span className="text-rose-600">Không tải được nội dung giáo án: {detailError}</span> : detailLoading ? 'Đang tải nội dung giáo án… (nếu chờ lâu, hãy kiểm tra kết nối mạng)' : 'Chưa có nội dung.'}
                </div>
              ) : (
                <>
              {missingImages > 0 && (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  {missingImages} hình chưa tải được do mạng chập chờn – tải lại trang để xem đủ hình (hình vẫn được giữ nguyên khi lưu).
                </div>
              )}
              {/* I. Mục tiêu bài dạy */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  I. Mục tiêu bài dạy (Theo chuẩn GDPT 2018)
                </h3>
                <div className="space-y-2 text-xs text-slate-700">
                  <div><strong>1. Về kiến thức:</strong> <MathText as="span" images={fullPlan.images} content={fullPlan.objectivesKnowledge || '—'} /></div>
                  <div><strong>2. Về năng lực:</strong> <MathText as="span" images={fullPlan.images} content={fullPlan.objectivesCompetence || '—'} /></div>
                  <div><strong>3. Về phẩm chất:</strong> <MathText as="span" images={fullPlan.images} content={fullPlan.objectivesQualities || '—'} /></div>
                  {!fullPlan.objectivesKnowledge && canEdit && (
                    <button onClick={() => fullPlan && setEditingPlan(fullPlan)} className="text-blue-700 font-semibold underline">
                      Giáo án chưa có nội dung – bấm để soạn
                    </button>
                  )}
                </div>
              </div>

              {/* II. Thiết bị dạy học và học liệu */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  II. Thiết bị dạy học và học liệu
                </h3>
                <MathText content={fullPlan.equipment || '—'} images={fullPlan.images} className="text-xs text-slate-700" />
              </div>

              {/* III. Tiến trình dạy học: 4 Hoạt động */}
              <div className="space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  III. Tiến trình dạy học (4 Hoạt động chuẩn Phụ lục IV CV 5512)
                </h3>

                {fullPlan.activities.map((act, idx) => (
                  <div key={act.id || idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">{act.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">Hoạt động {idx + 1}</span>
                    </div>

                    <div className="text-xs space-y-2 text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-800">a) Mục tiêu: </span>
                        <MathText as="span" images={fullPlan.images} content={act.objectives || '—'} />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">b) Nội dung: </span>
                        <MathText as="span" images={fullPlan.images} content={act.content || '—'} />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">c) Sản phẩm: </span>
                        <MathText as="span" images={fullPlan.images} content={act.product || '—'} />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">d) Tổ chức thực hiện: </span>
                        <MathText
                          content={act.implementation || '—'}
                          images={fullPlan.images}
                          className="bg-white p-2.5 rounded border border-slate-200 mt-1 leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

                </>
              )}

              {/* IV. Góp ý & Bình luận chuyên môn */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span>Góp ý chuyên môn của Tổ trưởng & Đồng nghiệp ({selectedPlan.comments?.length || 0})</span>
                </h3>

                <div className="space-y-2">
                  {selectedPlan.comments?.map(c => (
                    <div key={c.id} className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between items-center text-slate-500 text-[10px]">
                        <span className="font-bold text-slate-800">{c.authorName} ({c.sectionId})</span>
                        <span>{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <p className="text-slate-800">{c.content}</p>
                    </div>
                  ))}
                </div>

                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
                  <select
                    value={commentSection}
                    onChange={e => setCommentSection(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white shrink-0"
                  >
                    <option value="Toàn bài">Toàn bài</option>
                    <option value="Mục tiêu">Mục tiêu bài dạy</option>
                    <option value="Hoạt động 1">Hoạt động 1: Mở đầu</option>
                    <option value="Hoạt động 2">Hoạt động 2: Kiến thức mới</option>
                    <option value="Hoạt động 3">Hoạt động 3: Luyện tập</option>
                    <option value="Hoạt động 4">Hoạt động 4: Vận dụng</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Nhập góp ý, đề xuất giải pháp sư phạm..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />

                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi</span>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
              Vui lòng chọn hoặc tạo kế hoạch bài dạy từ danh sách bên trái.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Submit Lesson Plan */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-blue-700">
                <Send className="w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-900">Trình duyệt Kế hoạch bài dạy</h3>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteSubmit} className="space-y-3 text-xs">
              <p className="text-slate-600">
                Giáo án <strong>{selectedPlan?.title}</strong> sẽ được gửi tới Tổ trưởng chuyên môn để kiểm duyệt.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú trình nộp (tùy chọn)</label>
                <textarea
                  rows={3}
                  value={submitNote}
                  onChange={e => setSubmitNote(e.target.value)}
                  placeholder="Ví dụ: Đã hoàn thiện 4 hoạt động và tích hợp thiết bị GeoGebra..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Xác nhận nộp duyệt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Review / Return Lesson Plan */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {reviewAction === 'approve' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
                <h3 className="text-sm font-bold text-slate-900">
                  {reviewAction === 'approve' ? 'Phê duyệt Kế hoạch bài dạy' : 'Trả lại kèm yêu cầu chỉnh sửa'}
                </h3>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteReview} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {reviewAction === 'approve' ? 'Ghi chú phê duyệt' : 'Nội dung góp ý / Lý do trả lại (bắt buộc)'}
                </label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Giáo án soạn tốt, đáp ứng đúng CV 5512...'
                      : 'Hoạt động vận dụng cần gắn với thực tiễn nhiều hơn, điều chỉnh lại câu hỏi củng cố...'
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                  required={reviewAction === 'return'}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 shadow-xs ${
                    reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {reviewAction === 'approve' ? 'Xác nhận Phê duyệt' : 'Gửi yêu cầu chỉnh sửa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Teaching Progress Status Tracking */}
      {showTeachingModal && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <BookOpen className="w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-900">Ghi nhận tiến độ thực dạy trên lớp</h3>
              </div>
              <button onClick={() => setShowTeachingModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTeachingStatus} className="space-y-3 text-xs">
              <p className="font-semibold text-slate-800 line-clamp-1">{selectedPlan.title}</p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Trạng thái giảng dạy</label>
                <select
                  value={teachingStatus}
                  onChange={e => setTeachingStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="completed">Đã hoàn thành giảng dạy trên lớp</option>
                  <option value="in_progress">Đang trong quá trình dạy</option>
                  <option value="not_taught">Chưa thực dạy</option>
                </select>
              </div>

              {teachingStatus === 'completed' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày dạy thực tế</label>
                  <input
                    type="date"
                    value={teachingDate}
                    onChange={e => setTeachingDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Các lớp đã dạy bài này</label>
                <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 max-h-28 overflow-y-auto">
                  {classes
                    .filter(c => c.grade === selectedPlan.grade)
                    .map(c => {
                      const isChecked = teachingClasses.includes(c.name);
                      return (
                        <label
                          key={c.id}
                          className={`px-2 py-1 rounded text-xs border cursor-pointer flex items-center gap-1 ${
                            isChecked ? 'bg-blue-100 border-blue-300 text-blue-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setTeachingClasses(prev => [...prev, c.name]);
                              } else {
                                setTeachingClasses(prev => prev.filter(x => x !== c.name));
                              }
                            }}
                            className="hidden"
                          />
                          {isChecked && <Check className="w-3 h-3 text-blue-600" />}
                          <span>{c.name}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTeachingModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                >
                  Lưu nhật ký dạy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Version History (Lỗi 21) */}
      {showHistoryModal && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-blue-700">
                <History className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Lịch sử Phiên bản Giáo án</h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {(selectedPlan.versionHistory || [
                {
                  version: 1,
                  updatedAt: selectedPlan.createdAt || new Date().toISOString(),
                  updatedBy: selectedPlan.teacherName,
                  summary: 'Khởi tạo giáo án ban đầu',
                },
              ]).map((ver, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-800">Phiên bản v{ver.version}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(ver.updatedAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="text-slate-700">
                    Người thực hiện: <strong>{ver.updatedBy}</strong>
                  </div>
                  <p className="text-slate-600 italic mt-0.5">"{ver.summary || 'Cập nhật tiến trình 4 hoạt động'}"</p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setShowDiffModal(true);
                }}
                className="font-semibold text-indigo-700 hover:underline flex items-center gap-1"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>So sánh hai phiên bản (Diff)</span>
              </button>

              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiffModal && selectedPlan && fullPlan && diffHistory && (
        <VersionDiffModal
          title={selectedPlan.title}
          history={diffHistory}
          current={lessonSnapshot(fullPlan)}
          onClose={() => setShowDiffModal(false)}
        />
      )}

      {doctorOpen && fullPlan && (
        <FormulaDoctor
          plan={fullPlan}
          onClose={() => setDoctorOpen(false)}
          onApply={p => saveLessonPlan(p)}
        />
      )}

      {editingPlan && (
        <LessonPlanEditorModal
          plan={editingPlan}
          classes={classes}
          onCancel={() => setEditingPlan(null)}
          onSave={plan => saveLessonPlan(plan)}
        />
      )}
    </div>
  );
};
