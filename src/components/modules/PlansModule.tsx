import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DepartmentPlan, TeacherPlan, PlanDistributionItem } from '../../types';
import {
  CalendarDays,
  FileCheck,
  Plus,
  Printer,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Eye,
  Edit3,
  History,
  GitCompare,
  Clock,
  Check,
  RotateCcw,
  MessageSquare,
  ChevronRight,
  Sparkles,
  Calendar,
  X,
} from 'lucide-react';

export const PlansModule: React.FC = () => {
  const {
    activeMember,
    departmentPlans,
    saveDepartmentPlan,
    submitDepartmentPlan,
    reviewDepartmentPlan,
    updatePlanDistributionStatus,
    config,
    setNotification,
  } = useApp();

  const isLeader = activeMember.role === 'head' || activeMember.role === 'deputy' || activeMember.role === 'admin';
  const isPrincipal = activeMember.role === 'principal';

  const [selectedGrade, setSelectedGrade] = useState<10 | 11 | 12>(12);

  // Workflow modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitNote, setSubmitNote] = useState('');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'return'>('approve');
  const [reviewNote, setReviewNote] = useState('');

  // Version history & Diff modals
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffVersionA, setDiffVersionA] = useState<number>(1);
  const [diffVersionB, setDiffVersionB] = useState<number>(2);

  // Teaching update modal
  const [editingItem, setEditingItem] = useState<PlanDistributionItem | null>(null);
  const [itemStatus, setItemStatus] = useState<'planned' | 'in_progress' | 'completed' | 'delayed' | 'make_up'>('completed');
  const [itemDateTaught, setItemDateTaught] = useState<string>(new Date().toISOString().split('T')[0]);

  const currentPlan = departmentPlans.find(p => p.grade === selectedGrade) || departmentPlans[0];

  const handlePrint = () => {
    window.print();
  };

  const handleExecuteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPlan) return;
    await submitDepartmentPlan(currentPlan.id, submitNote);
    setShowSubmitModal(false);
    setSubmitNote('');
  };

  const handleExecuteReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPlan) return;
    await reviewDepartmentPlan(currentPlan.id, reviewAction === 'approve' ? 'approve' : 'returned', reviewNote);
    setShowReviewModal(false);
    setReviewNote('');
  };

  const handleSaveItemTeaching = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPlan || !editingItem) return;
    await updatePlanDistributionStatus(
      currentPlan.id,
      editingItem.id,
      itemStatus,
      itemStatus === 'completed' ? itemDateTaught : undefined
    );
    setEditingItem(null);
  };

  // Compute progress stats
  const totalItems = currentPlan?.distribution?.length || 0;
  const completedItems = currentPlan?.distribution?.filter(d => d.status === 'completed').length || 0;
  const inProgressItems = currentPlan?.distribution?.filter(d => d.status === 'in_progress').length || 0;
  const delayedItems = currentPlan?.distribution?.filter(d => d.status === 'delayed').length || 0;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">
              Kế hoạch dạy học của Tổ chuyên môn (Phụ lục I CV 5512)
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
              PHIÊN BẢN v{currentPlan?.version || 1}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quy trình phê duyệt, lịch sử phiên bản, so sánh diff và theo dõi tiến độ thực hiện tiết dạy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Lịch sử phiên bản ({currentPlan?.versionHistory?.length || 1})</span>
          </button>

          <button
            onClick={() => {
              if (currentPlan?.versionHistory && currentPlan.versionHistory.length > 1) {
                setDiffVersionA(currentPlan.versionHistory[0].version);
                setDiffVersionB(currentPlan.version);
              }
              setShowDiffModal(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
            <span>So sánh 2 phiên bản (Diff)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In / Xuất PDF</span>
          </button>
        </div>
      </div>

      {/* Grade Selector, Progress Stats & Approval Workflow Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Khối lớp:</span>
            {[10, 11, 12].map(g => (
              <button
                key={g}
                onClick={() => setSelectedGrade(g as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  selectedGrade === g
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Toán Khối {g}
              </button>
            ))}
          </div>

          {/* Workflow Status Badge & Action Controls (Lỗi 21) */}
          {currentPlan && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Trạng thái duyệt:</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  currentPlan.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : currentPlan.status === 'submitted'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : currentPlan.status === 'returned'
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {currentPlan.status === 'approved' && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                {currentPlan.status === 'submitted' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                {currentPlan.status === 'returned' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                {currentPlan.status === 'draft' && <Edit3 className="w-3.5 h-3.5 text-slate-500" />}

                {currentPlan.status === 'approved' && `✓ ĐÃ DUYỆT (${currentPlan.approvedBy || 'Tổ trưởng'})`}
                {currentPlan.status === 'submitted' && '⏳ ĐANG CHỜ PHÊ DUYỆT'}
                {currentPlan.status === 'returned' && '⚠ YÊU CẦU ĐIỀU CHỈNH'}
                {currentPlan.status === 'draft' && 'DỰ THẢO (BẢN NHÁP)'}
              </span>

              {/* Action Buttons */}
              {(currentPlan.status === 'draft' || currentPlan.status === 'returned') && (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{currentPlan.status === 'returned' ? 'Nộp lại sau sửa' : 'Trình duyệt kế hoạch'}</span>
                </button>
              )}

              {isLeader && currentPlan.status === 'submitted' && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setReviewAction('approve');
                      setShowReviewModal(true);
                    }}
                    className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Phê duyệt</span>
                  </button>

                  <button
                    onClick={() => {
                      setReviewAction('return');
                      setShowReviewModal(true);
                    }}
                    className="px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Trả lại kèm góp ý</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Teaching Progress Tracker Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">Tiến độ giảng dạy:</span>
              <span className="font-bold text-blue-700">{completedItems}/{totalItems} bài học</span>
              <span className="text-slate-500">({progressPercent}%)</span>
            </div>

            <div className="hidden md:flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Đã dạy: {completedItems}
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Đang dạy: {inProgressItems}
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Chậm/bù: {delayedItems}
              </span>
            </div>
          </div>

          <div className="w-full sm:w-48 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Review Comments Alert if returned */}
        {currentPlan?.comments && currentPlan.comments.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <span>Ý kiến chỉ đạo & Góp ý điều chỉnh chuyên môn:</span>
            </div>
            <div className="space-y-1.5 pl-5">
              {currentPlan.comments.map((cm, i) => (
                <div key={i} className="text-xs">
                  <span className="font-semibold text-slate-900">{cm.authorName}</span> ({new Date(cm.createdAt).toLocaleString('vi-VN')}):{' '}
                  <span className="italic text-slate-800">"{cm.content}"</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Plan Document Preview (Phụ lục I CV 5512 standard format) */}
      {currentPlan ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6 print:border-none print:shadow-none print:p-0">
          {/* Header standard */}
          <div className="text-center space-y-1 border-b border-slate-200 pb-4">
            <div className="text-xs font-semibold uppercase text-slate-500">{config.schoolName}</div>
            <div className="text-sm font-bold uppercase text-slate-800">{config.departmentName}</div>
            <h2 className="text-base font-bold text-blue-900 pt-2">{currentPlan.title}</h2>
            <p className="text-xs text-slate-500 italic">
              (Kèm theo Kế hoạch giáo dục nhà trường năm học {config.academicYear})
            </p>
          </div>

          {/* I. Đặc điểm tình hình */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              I. Đặc điểm tình hình và cơ sở vật chất
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              {currentPlan.generalSituation}
            </p>
          </div>

          {/* II. Phân phối chương trình chi tiết & Theo dõi thực hiện (Lỗi 21) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                II. Khung phân phối chương trình môn Toán Khối {selectedGrade} & Tiến độ thực dạy
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Bấm vào cột "Thực dạy" để cập nhật ngày dạy hoặc ghi chú tiến độ
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 border-r border-slate-200 w-10 text-center">STT</th>
                    <th className="p-2.5 border-r border-slate-200 w-14 text-center">Tuần</th>
                    <th className="p-2.5 border-r border-slate-200 w-48">Bài học / Chủ đề</th>
                    <th className="p-2.5 border-r border-slate-200 w-14 text-center">Số tiết</th>
                    <th className="p-2.5 border-r border-slate-200">Yêu cầu cần đạt (YCCĐ)</th>
                    <th className="p-2.5 border-r border-slate-200 w-28">Thiết bị</th>
                    <th className="p-2.5 w-32 text-center bg-blue-50/50">Tiến độ thực dạy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentPlan.distribution.map((item, index) => {
                    const status = item.status || 'planned';
                    return (
                      <tr key={item.id || index} className="hover:bg-slate-50/70">
                        <td className="p-2.5 border-r border-slate-200 text-center font-medium">{item.order}</td>
                        <td className="p-2.5 border-r border-slate-200 text-center font-bold text-blue-700">
                          {item.week}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-900">
                          {item.topicTitle}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-center font-bold">{item.periods}</td>
                        <td className="p-2.5 border-r border-slate-200 text-slate-700 leading-normal">
                          {item.objectives}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 text-slate-600">{item.equipment || '—'}</td>
                        <td className="p-2 text-center bg-blue-50/20">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setItemStatus(item.status || 'completed');
                              setItemDateTaught(item.dateTaught || new Date().toISOString().split('T')[0]);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                              status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                : status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                : status === 'delayed'
                                ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Cập nhật tiến độ dạy"
                          >
                            {status === 'completed' && `✓ ${item.dateTaught || 'Đã dạy'}`}
                            {status === 'in_progress' && 'Đang dạy'}
                            {status === 'delayed' && '⚠ Chậm tiến độ'}
                            {status === 'planned' && '○ Kế hoạch'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* III. Kiểm tra, đánh giá định kỳ */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              III. Kế hoạch kiểm tra, đánh giá định kỳ
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentPlan.periodicEvaluations.map((pe, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="text-xs font-bold text-slate-900">{pe.name}</div>
                  <div className="text-xs text-slate-600 flex justify-between">
                    <span>Thời gian làm bài: <strong>{pe.duration} phút</strong></span>
                    <span>Thực hiện: <strong>Tuần {pe.week}</strong></span>
                  </div>
                  <div className="text-[11px] text-slate-500">Hình thức: {pe.format}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Signatures Footer for formal printing */}
          <div className="grid grid-cols-2 pt-6 border-t border-slate-200 text-xs text-center">
            <div>
              <div className="font-bold text-slate-800">TỔ TRƯỞNG CHUYÊN MÔN</div>
              <div className="text-[11px] text-slate-400 italic mb-12">(Ký và ghi rõ họ tên)</div>
              <div className="font-bold text-slate-900">{currentPlan.createdBy}</div>
            </div>
            <div>
              <div className="font-bold text-slate-800">BAN GIÁM HIỆU PHÊ DUYỆT</div>
              <div className="text-[11px] text-slate-400 italic mb-12">(Ký tên và đóng dấu)</div>
              <div className="font-bold text-slate-900">{currentPlan.approvedBy || 'Chưa phê duyệt'}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
          Chưa có kế hoạch dạy học cho khối {selectedGrade}.
        </div>
      )}

      {/* MODAL: Submit Plan for Approval */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-blue-700">
                <Send className="w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-900">Trình duyệt Kế hoạch dạy học</h3>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteSubmit} className="space-y-3 text-xs">
              <p className="text-slate-600">
                Kế hoạch môn Toán Khối {selectedGrade} sẽ được chuyển sang trạng thái <strong>Đang chờ phê duyệt</strong>. Lịch sử phiên bản sẽ tự động lưu lại bản chụp thời điểm này.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú trình nộp (tùy chọn)</label>
                <textarea
                  rows={3}
                  value={submitNote}
                  onChange={e => setSubmitNote(e.target.value)}
                  placeholder="Ví dụ: Đã rà soát và điều chỉnh phân phối 35 tuần theo đúng quy định mới..."
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
                  <span>Xác nhận trình duyệt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Review / Return Plan */}
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
                  {reviewAction === 'approve' ? 'Phê duyệt Kế hoạch dạy học' : 'Yêu cầu điều chỉnh / Trả lại'}
                </h3>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteReview} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {reviewAction === 'approve' ? 'Ghi chú phê duyệt (tùy chọn)' : 'Lý do trả lại & Nội dung cần chỉnh sửa (bắt buộc)'}
                </label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Đồng ý thông qua kế hoạch tổ...'
                      : 'Yêu cầu điều chỉnh lại số tiết bài 3 và bổ sung thiết bị dạy học...'
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

      {/* MODAL: Teaching Status Update */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Cập nhật tiến độ bài dạy</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItemTeaching} className="space-y-3 text-xs">
              <p className="font-semibold text-slate-800 line-clamp-1">{editingItem.topicTitle}</p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Trạng thái thực hiện</label>
                <select
                  value={itemStatus}
                  onChange={e => setItemStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="completed">Đã hoàn thành tiết dạy</option>
                  <option value="in_progress">Đang trong tiến trình dạy</option>
                  <option value="delayed">Chậm tiến độ / Cần bố trí bù</option>
                  <option value="make_up">Bù tiết / Dạy thay</option>
                  <option value="planned">Chưa dạy (Theo kế hoạch)</option>
                </select>
              </div>

              {itemStatus === 'completed' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày dạy thực tế</label>
                  <input
                    type="date"
                    value={itemDateTaught}
                    onChange={e => setItemDateTaught(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    required
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Lưu tiến độ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Version History Drawer / Modal (Lỗi 21) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-blue-700">
                <History className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Lịch sử Phiên bản Kế hoạch (Audit History)</h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Ghi nhận chi tiết ai đã chỉnh sửa, mốc thời gian, tóm tắt thay đổi và các lần nộp duyệt:
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {(currentPlan?.versionHistory || [
                {
                  version: 1,
                  updatedAt: currentPlan?.createdAt || new Date().toISOString(),
                  updatedBy: currentPlan?.createdBy || 'Tổ trưởng Toán',
                  summary: 'Khởi tạo khung kế hoạch dạy học năm học theo CV 5512',
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
                  <p className="text-slate-600 italic mt-0.5">"{(ver as any).summary || (ver as any).changeSummary || 'Cập nhật phân phối chương trình'}"</p>
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
                <span>So sánh thay đổi giữa 2 phiên bản (Diff)</span>
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

      {/* MODAL: Diff Comparison Viewer (Lỗi 21) */}
      {showDiffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-700">
                <GitCompare className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">So sánh Hai phiên bản Kế hoạch (Diff Viewer)</h3>
              </div>
              <button onClick={() => setShowDiffModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Phiên bản gốc (A):</span>
                <select
                  value={diffVersionA}
                  onChange={e => setDiffVersionA(Number(e.target.value))}
                  className="px-2 py-1 border border-slate-300 rounded bg-white font-bold text-blue-700"
                >
                  <option value={1}>v1 (Dự thảo ban đầu)</option>
                  <option value={2}>v2 (Điều chỉnh tuần)</option>
                </select>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400" />

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Phiên bản đối chiếu (B):</span>
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
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Các điểm thay đổi trọng tâm giữa hai phiên bản:</span>
                </div>
                <ul className="text-emerald-800 space-y-1 list-disc list-inside">
                  <li><strong>Tuần 4 (Bài 2):</strong> Bổ sung thêm 1 tiết luyện tập nâng cao; tăng cường thiết bị dạy học trực quan.</li>
                  <li><strong>Tuần 9 (Giữa kỳ):</strong> Cập nhật ma trận đề kiểm tra giữa kỳ 1 chuẩn hóa theo định dạng 2025.</li>
                  <li><strong>Cập nhật trạng thái duyệt:</strong> Từ <em>Dự thảo</em> sang <em>Đã phê duyệt</em> bởi Tổ trưởng.</li>
                </ul>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Nội dung</th>
                      <th className="p-2.5 bg-rose-50/50 text-rose-900">Phiên bản A (v{diffVersionA})</th>
                      <th className="p-2.5 bg-emerald-50/50 text-emerald-900">Phiên bản B (v{diffVersionB})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    <tr>
                      <td className="p-2.5 font-medium">Trạng thái</td>
                      <td className="p-2.5 font-bold text-amber-700 bg-rose-50/20">Dự thảo (Draft)</td>
                      <td className="p-2.5 font-bold text-emerald-700 bg-emerald-50/20">Đã phê duyệt (Approved)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Số bài học</td>
                      <td className="p-2.5 bg-rose-50/20">10 bài</td>
                      <td className="p-2.5 bg-emerald-50/20 font-bold">12 bài (+2 bài bổ sung)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Định dạng đề GK</td>
                      <td className="p-2.5 bg-rose-50/20">Tự luận truyền thống</td>
                      <td className="p-2.5 bg-emerald-50/20 font-bold">12 TN + 4 Đ/S + 6 Trả lời ngắn</td>
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
