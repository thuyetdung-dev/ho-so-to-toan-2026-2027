import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
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
} from 'lucide-react';

export const LessonPlansModule: React.FC = () => {
  const {
    activeMember,
    lessonPlans,
    saveLessonPlan,
    submitLessonPlan,
    reviewLessonPlan,
    updateLessonPlanTeachingStatus,
    classes,
    setNotification,
  } = useApp();

  const isLeader = activeMember.role === 'head' || activeMember.role === 'deputy' || activeMember.role === 'admin';

  const [selectedPlanId, setSelectedPlanId] = useState<string>(lessonPlans[0]?.id || '');
  const [filterGrade, setFilterGrade] = useState<'all' | 10 | 11 | 12>('all');
  const [filterTeachingStatus, setFilterTeachingStatus] = useState<'all' | 'not_taught' | 'completed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
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
  const [diffVersionA, setDiffVersionA] = useState<number>(1);
  const [diffVersionB, setDiffVersionB] = useState<number>(2);

  // Teaching Status Modal State (Lỗi 21)
  const [showTeachingModal, setShowTeachingModal] = useState(false);
  const [teachingStatus, setTeachingStatus] = useState<'not_taught' | 'in_progress' | 'completed'>('completed');
  const [teachingDate, setTeachingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [teachingClasses, setTeachingClasses] = useState<string[]>([]);

  const selectedPlan = lessonPlans.find(p => p.id === selectedPlanId) || lessonPlans[0];

  const filteredPlans = lessonPlans.filter(p => {
    if (filterGrade !== 'all' && p.grade !== filterGrade) return false;
    if (filterTeachingStatus === 'not_taught' && p.isTaught) return false;
    if (filterTeachingStatus === 'completed' && !p.isTaught) return false;
    return true;
  });

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
      id: `c-${Date.now()}`,
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

    await saveLessonPlan(updated);
    setCommentText('');
    setNotification({ message: 'Đã thêm góp ý cho kế hoạch bài dạy', type: 'success' });
  };

  const handleClonePlan = async (plan: LessonPlan) => {
    const cloned: LessonPlan = {
      ...plan,
      id: `lp-clone-${Date.now()}`,
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
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    await saveLessonPlan(cloned);
    setSelectedPlanId(cloned.id);
    setNotification({ message: `Đã nhân bản kế hoạch bài dạy từ tác giả ${plan.teacherName}`, type: 'success' });
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
                onClick={() => {
                  if (selectedPlan.versionHistory && selectedPlan.versionHistory.length > 1) {
                    setDiffVersionA(selectedPlan.versionHistory[0].version);
                    setDiffVersionB(selectedPlan.version);
                  }
                  setShowDiffModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
                <span>So sánh Diff</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Left List / Right Full Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Plan Selector & Filter */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
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
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
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
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Teaching progress update button */}
                  <button
                    onClick={() => {
                      const statusVal =
                        selectedPlan.teachingStatus === 'teaching' || selectedPlan.teachingStatus === 'in_progress'
                          ? 'in_progress'
                          : selectedPlan.teachingStatus === 'completed' || selectedPlan.isTaught
                          ? 'completed'
                          : 'not_taught';
                      setTeachingStatus(statusVal);
                      setTeachingDate(selectedPlan.taughtDate || new Date().toISOString().split('T')[0]);
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
                  </button>

                  <button
                    onClick={() => handleClonePlan(selectedPlan)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 border border-slate-200"
                    title="Nhân bản để điều chỉnh cho lớp của bạn"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Nhân bản</span>
                  </button>

                  {/* Submission control for Teacher */}
                  {(selectedPlan.status === 'draft' || selectedPlan.status === 'returned') && (
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{selectedPlan.status === 'returned' ? 'Nộp lại sau sửa' : 'Trình duyệt'}</span>
                    </button>
                  )}

                  {/* Approval controls for Leader */}
                  {isLeader && selectedPlan.status === 'submitted' && (
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

              {/* I. Mục tiêu bài dạy */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  I. Mục tiêu bài dạy (Theo chuẩn GDPT 2018)
                </h3>
                <div className="space-y-2 text-xs text-slate-700">
                  <p><strong>1. Về kiến thức:</strong> {selectedPlan.objectivesKnowledge}</p>
                  <p><strong>2. Về năng lực:</strong> {selectedPlan.objectivesCompetence}</p>
                  <p><strong>3. Về phẩm chất:</strong> {selectedPlan.objectivesQualities}</p>
                </div>
              </div>

              {/* II. Thiết bị dạy học và học liệu */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  II. Thiết bị dạy học và học liệu
                </h3>
                <p className="text-xs text-slate-700">{selectedPlan.equipment}</p>
              </div>

              {/* III. Tiến trình dạy học: 4 Hoạt động */}
              <div className="space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  III. Tiến trình dạy học (4 Hoạt động chuẩn Phụ lục IV CV 5512)
                </h3>

                {selectedPlan.activities.map((act, idx) => (
                  <div key={act.id || idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">{act.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">Hoạt động {idx + 1}</span>
                    </div>

                    <div className="text-xs space-y-2 text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-800">a) Mục tiêu: </span>
                        <span>{act.objectives}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">b) Nội dung: </span>
                        <MathText content={act.content} />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">c) Sản phẩm: </span>
                        <MathText content={act.product} />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">d) Tổ chức thực hiện: </span>
                        <div className="whitespace-pre-wrap bg-white p-2.5 rounded border border-slate-200 mt-1 font-mono text-[11px] leading-relaxed">
                          {act.implementation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

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

      {/* MODAL: Diff Comparison (Lỗi 21) */}
      {showDiffModal && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-700">
                <GitCompare className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">So sánh Hai phiên bản Giáo án (Diff Viewer)</h3>
              </div>
              <button onClick={() => setShowDiffModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Bản cũ (A):</span>
                <select
                  value={diffVersionA}
                  onChange={e => setDiffVersionA(Number(e.target.value))}
                  className="px-2 py-1 border border-slate-300 rounded bg-white font-bold text-blue-700"
                >
                  <option value={1}>v1 (Bản nộp ban đầu)</option>
                  <option value={2}>v2 (Bản đã chỉnh sửa)</option>
                </select>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400" />

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Bản mới (B):</span>
                <select
                  value={diffVersionB}
                  onChange={e => setDiffVersionB(Number(e.target.value))}
                  className="px-2 py-1 border border-slate-300 rounded bg-white font-bold text-emerald-700"
                >
                  <option value={1}>v1</option>
                  <option value={2}>v2 (Hiện tại)</option>
                  <option value={3}>v3 (Mới nhất)</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Thành phần giáo án</th>
                      <th className="p-2.5 bg-rose-50/50 text-rose-900">Phiên bản A (v{diffVersionA})</th>
                      <th className="p-2.5 bg-emerald-50/50 text-emerald-900">Phiên bản B (v{diffVersionB})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    <tr>
                      <td className="p-2.5 font-medium">Trạng thái duyệt</td>
                      <td className="p-2.5 bg-rose-50/20 text-rose-800 font-bold">Chờ duyệt / Cần sửa</td>
                      <td className="p-2.5 bg-emerald-50/20 text-emerald-800 font-bold">Đã phê duyệt (Approved)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Hoạt động 3 (Luyện tập)</td>
                      <td className="p-2.5 bg-rose-50/20">3 bài tập trắc nghiệm cơ bản</td>
                      <td className="p-2.5 bg-emerald-50/20 font-bold">
                        Bổ sung 2 bài toán ứng dụng thực tế & bài toán mở
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Thiết bị dạy học</td>
                      <td className="p-2.5 bg-rose-50/20">Bảng phụ, phiếu học tập</td>
                      <td className="p-2.5 bg-emerald-50/20 font-bold">
                        Máy chiếu + Mô hình GeoGebra 3D tương tác
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Đóng đối chiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
