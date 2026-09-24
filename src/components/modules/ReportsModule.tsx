import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ReportSnapshot } from '../../types';
import {
  PieChart,
  Printer,
  FileSpreadsheet,
  Download,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  BookOpen,
  Award,
  Lock,
  Unlock,
  RefreshCw,
  Save,
  PlusCircle,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { exportToExcel } from '../../utils/excel';
import { newId } from '../../utils/ids';
import { findDuplicateAssignments, summarizeTeacher, teacherComparator } from '../../utils/assignments';

export const ReportsModule: React.FC = () => {
  const {
    allMembers,
    assignments,
    observations,
    questions,
    meetings,
    scoreRecords,
    specialTopics,
    exams,
    config,
    reportSnapshots,
    saveReportSnapshot,
    activeMember,
    setNotification,
    permissions,
    lessonPlans,
    skknTopics,
  } = useApp();

  const isLeader = permissions.isLeader;

  const [activeReportTab, setActiveReportTab] = useState<'summary' | 'teacher_stats' | 'so_sinh_hoat'>('summary');

  // Selected Snapshot ID or 'new'
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('snap-current');

  // Working state for active report
  const [reportTitle, setReportTitle] = useState('');
  const [reportTerm, setReportTerm] = useState('Giữa HK1');
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [advantages, setAdvantages] = useState('');
  const [limitations, setLimitations] = useState('');
  const [futureDirections, setFutureDirections] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [finalizedBy, setFinalizedBy] = useState('');

  // Live aggregated metrics
  const approvedQuestionsCount = questions.filter(q => q.status === 'approved').length;
  const lessonStudyMeetingsCount = meetings.filter(m => m.type === 'lesson_study').length;
  // Bản cũ gán cứng điểm trung bình 7.42 và lấy max(số buổi NCBH, số chuyên đề) → số liệu báo cáo sai.
  const allScores = scoreRecords.flatMap(r => (Array.isArray(r.scores) ? r.scores.filter(x => typeof x === 'number' && !Number.isNaN(x)) : []));
  const avgScore = allScores.length ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) / 100 : 0;
  const activeTeachers = allMembers.filter(m => m.status === 'active' && m.role !== 'principal');
  const assignedTeacherIds = new Set(assignments.map(a => a.teacherId));
  const assignedPct = activeTeachers.length ? Math.round((activeTeachers.filter(m => assignedTeacherIds.has(m.id)).length / activeTeachers.length) * 100) : 0;

  const calculateLiveMetrics = () => ({
    membersCount: allMembers.length,
    meetingsCount: meetings.length,
    lessonStudyCount: lessonStudyMeetingsCount,
    observationsCount: observations.length,
    questionsCount: questions.length,
    examsCount: exams.length,
    avgScore,
    plansCount: lessonPlans.length,
    specialTopicsCount: specialTopics.length,
  });

  // Generate live default narrative strictly based on actual numbers
  const generateLiveNarrative = (term = 'Giữa HK1') => {
    const live = calculateLiveMetrics();
    const meetingsText = live.meetingsCount > 0
      ? `đã tổ chức ${live.meetingsCount} buổi sinh hoạt chuyên môn${live.lessonStudyCount > 0 ? ` (trong đó có ${live.lessonStudyCount} buổi theo nghiên cứu bài học)` : ' (chưa có buổi sinh hoạt theo NCBH)'}`
      : 'chưa có dữ liệu buổi sinh hoạt chuyên môn';

    const observationsText = live.observationsCount > 0
      ? `thực hiện ${live.observationsCount} lượt dự giờ trao đổi chuyên môn`
      : 'chưa có dữ liệu dự giờ';

    const questionsText = live.questionsCount > 0
      ? `đóng góp ${live.questionsCount} câu hỏi vào ngân hàng (${approvedQuestionsCount} câu đã duyệt)`
      : 'chưa có dữ liệu câu hỏi đóng góp vào ngân hàng';

    const examsText = live.examsCount > 0
      ? `xây dựng ${live.examsCount} đề kiểm tra theo định dạng mới 2025`
      : 'chưa có dữ liệu đề kiểm tra chính thức';

    const testingText = allScores.length > 0
      ? `Đã nhập ${scoreRecords.length} bảng điểm (${allScores.length} lượt học sinh), điểm trung bình ${avgScore.toFixed(2)}.`
      : 'Chưa có dữ liệu kết quả kiểm tra được nhập trong kỳ này.';

    return {
      title: `Báo cáo sơ kết hoạt động chuyên môn ${term} – Năm học ${config.academicYear}`,
      summary: `Tổ chuyên môn gồm ${live.membersCount} thành viên. Trong kỳ ${term} năm học ${config.academicYear}: ${assignedPct}% giáo viên đã được phân công giảng dạy (chuẩn gợi ý ${config.standardPeriods || 17} tiết/tuần); ${meetingsText}; ${observationsText}; ${lessonPlans.length} kế hoạch bài dạy được lưu (${lessonPlans.filter(p => p.status === 'approved').length} đã duyệt); ${specialTopics.length} chuyên đề bồi dưỡng, ${skknTopics.length} đề tài SKKN. ${testingText}`,
      adv: `1. (Tổ trưởng điền) Việc chấp hành quy chế chuyên môn, thực hiện chương trình GDPT 2018.\n2. (Tổ trưởng điền) Ứng dụng CNTT, đổi mới phương pháp dạy học.\n3. ${allScores.length > 0 ? `Đã tổng hợp kết quả kiểm tra: điểm trung bình ${avgScore.toFixed(2)}.` : '(Tổ trưởng điền) Kết quả kiểm tra, đánh giá.'}`,
      lim: `1. (Tổ trưởng điền) Những hạn chế trong thực hiện chương trình, kiểm tra đánh giá.\n2. ${live.observationsCount < 4 ? 'Hoạt động dự giờ chéo giữa các đồng nghiệp trong tổ cần được đẩy mạnh theo đúng kế hoạch.' : 'Hoạt động viết sáng kiến kinh nghiệm cấp cơ sở cần đẩy nhanh tiến độ thử nghiệm thực tiễn.'}`,
      dir: `1. Tiếp tục đổi mới kiểm tra, đánh giá theo định hướng phát triển năng lực, bám sát định dạng đề thi tốt nghiệp THPT.\n2. Tổ chức chuyên đề sinh hoạt chuyên môn theo hướng nghiên cứu bài học tập trung vào các dạng bài toán ứng dụng thực tế.\n3. Duy trì kế hoạch phụ đạo học sinh có kết quả kiểm tra dưới trung bình và bồi dưỡng học sinh khá giỏi.`,
    };
  };

  // Sync state when selected snapshot changes
  useEffect(() => {
    const found = reportSnapshots.find(s => s.id === selectedSnapshotId);
    if (found) {
      setReportTitle(found.title);
      setReportTerm(found.term);
      setExecutiveSummary(found.executiveSummary);
      setAdvantages(found.advantages);
      setLimitations(found.limitations);
      setFutureDirections(found.futureDirections);
      setIsLocked(found.isLocked);
      setFinalizedBy(found.finalizedBy);
    } else {
      // Default to live metrics
      const def = generateLiveNarrative('Giữa HK1');
      setReportTitle(def.title);
      setReportTerm('Giữa HK1');
      setExecutiveSummary(def.summary);
      setAdvantages(def.adv);
      setLimitations(def.lim);
      setFutureDirections(def.dir);
      setIsLocked(false);
      setFinalizedBy('');
    }
  }, [selectedSnapshotId, reportSnapshots]);

  // Handle sync live numbers into current narrative
  const handleSyncLiveMetrics = () => {
    if (isLocked) {
      setNotification({ message: 'Báo cáo đã chốt và khóa, không thể ghi đè dữ liệu trực tiếp!', type: 'error' });
      return;
    }
    const def = generateLiveNarrative(reportTerm);
    setExecutiveSummary(def.summary);
    setNotification({ message: 'Đã đồng bộ số liệu thời gian thực từ hệ thống vào báo cáo!', type: 'success' });
  };

  // Save or Update Snapshot
  const handleSaveSnapshot = async (lock = false) => {
    const live = calculateLiveMetrics();
    if (!isLeader) {
      setNotification({ message: 'Chỉ Tổ trưởng/Tổ phó được lưu và chốt báo cáo.', type: 'error' });
      return;
    }
    const snapshotId = selectedSnapshotId === 'snap-current' ? newId('snap') : selectedSnapshotId;
    const previous = reportSnapshots.find(s => s.id === snapshotId);
    const author = isLeader ? `${activeMember.displayName} (Tổ trưởng)` : activeMember.displayName;

    const newSnapshot: ReportSnapshot = {
      id: snapshotId,
      title: reportTitle || `Báo cáo sơ kết ${reportTerm} – Năm học ${config.academicYear}`,
      academicYear: config.academicYear,
      term: reportTerm,
      periodLabel: `Sơ kết ${reportTerm}`,
      createdAt: previous?.createdAt || new Date().toISOString(),
      finalizedBy: lock ? author : (finalizedBy || author),
      isLocked: lock,
      sectionsIncluded: [
        'Thực hiện quy chế chuyên môn',
        'Sinh hoạt chuyên môn theo NCBH',
        'Kiểm tra đánh giá theo định dạng 2025',
        'Phân tích phổ điểm và Item Analysis',
      ],
      metrics: live,
      executiveSummary,
      advantages,
      limitations,
      futureDirections,
    };

    if (!(await saveReportSnapshot(newSnapshot))) return;
    setSelectedSnapshotId(newSnapshot.id);
    setIsLocked(lock);
    if (lock) setFinalizedBy(author);
  };

  // Member stats aggregation
  // Số tiết: học kỳ hiện tại, không cộng dòng phân công trùng (tên môn viết khác)
  const effectiveAssignments = findDuplicateAssignments(assignments).keep.filter(a => a.term === config.currentTerm);
  const teacherStats = [...allMembers].sort((x, y) => teacherComparator(allMembers)(x.id, x.displayName, y.id, y.displayName)).map(member => {
    const asgs = effectiveAssignments.filter(a => a.teacherId === member.id);
    const periods = summarizeTeacher(asgs).total; // tiết theo TKB + tiết quy đổi nhiệm vụ, chủ nhiệm
    const obsDone = observations.filter(o => o.observerId === member.id).length;
    const obsReceived = observations.filter(o => o.teacherId === member.id).length;
    const questionsContributed = questions.filter(q => q.authorId === member.id).length;

    return {
      id: member.id,
      name: member.displayName,
      role: member.role,
      periods,
      classes: summarizeTeacher(asgs).classes.join(', ') || 'Chưa phân công',
      obsDone,
      obsReceived,
      questionsContributed,
    };
  });

  const handlePrintBooklet = () => {
    window.print();
  };

  const handleExportReportExcel = () => {
    const live = calculateLiveMetrics();
    const rows = [
      { 'Mục': 'Tiêu đề báo cáo', 'Nội dung': reportTitle },
      { 'Mục': 'Học kỳ / Giai đoạn', 'Nội dung': reportTerm },
      { 'Mục': 'Năm học', 'Nội dung': config.academicYear },
      { 'Mục': 'Trạng thái', 'Nội dung': isLocked ? 'Đã chốt & Khóa' : 'Bản nháp' },
      { 'Mục': 'Người lập / chốt', 'Nội dung': finalizedBy || activeMember.displayName },
      { 'Mục': 'Số thành viên tổ', 'Nội dung': live.membersCount },
      { 'Mục': 'Số buổi họp chuyên môn', 'Nội dung': live.meetingsCount },
      { 'Mục': 'Số buổi SHCM theo NCBH', 'Nội dung': live.lessonStudyCount },
      { 'Mục': 'Số tiết dự giờ', 'Nội dung': live.observationsCount },
      { 'Mục': 'Số kế hoạch bài dạy', 'Nội dung': live.plansCount },
      { 'Mục': 'Điểm trung bình các bảng điểm', 'Nội dung': live.avgScore || 'Chưa có dữ liệu' },
      { 'Mục': 'Báo cáo tổng quan', 'Nội dung': executiveSummary },
      { 'Mục': 'Ưu điểm & Kết quả đạt được', 'Nội dung': advantages },
      { 'Mục': 'Tồn tại & Hạn chế', 'Nội dung': limitations },
      { 'Mục': 'Phương hướng nhiệm vụ kỳ tới', 'Nội dung': futureDirections },
    ];
    exportToExcel([{ name: 'BaoCaoSoKet', data: rows }], `Bao_Cao_So_Ket_${reportTerm.replace(/\s+/g, '_')}_${config.academicYear}`);
  };

  const handleExportTeacherStats = () => {
    const rows = teacherStats.map(t => ({
      'Họ và tên giáo viên': t.name,
      'Chức vụ': t.role.toUpperCase(),
      'Số tiết/tuần': t.periods,
      'Lớp phụ trách': t.classes,
      'Số tiết dự giờ đồng nghiệp': t.obsDone,
      'Số tiết được dự': t.obsReceived,
    }));
    exportToExcel([{ name: 'ThongKeGiaoVien', data: rows }], `Thong_Ke_Tien_Do_To_Toan_${config.academicYear}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-600" />
            <span>Báo cáo & Thống kê hoạt động Tổ Toán</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng hợp dữ liệu chuyên môn, theo dõi tiến độ hoàn thành nhiệm vụ và xuất cuốn Sổ Sinh hoạt Chuyên môn
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveReportTab('summary')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeReportTab === 'summary' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tổng hợp chung & Sơ kết
          </button>
          <button
            onClick={() => setActiveReportTab('teacher_stats')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeReportTab === 'teacher_stats' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tiến độ giáo viên
          </button>
          <button
            onClick={() => setActiveReportTab('so_sinh_hoat')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeReportTab === 'so_sinh_hoat' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đóng cuốn Sổ chuyên môn (A4)
          </button>
        </div>
      </div>

      {/* Tab 1: General Summary Report */}
      {activeReportTab === 'summary' && (
        <div className="space-y-6">
          {/* Live KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Thành viên tổ</div>
              <div className="text-2xl font-bold text-blue-700 mt-1">{allMembers.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Giáo viên Toán THPT</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Buổi họp tổ đã tổ chức</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{meetings.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {lessonStudyMeetingsCount} buổi theo NCBH
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Tiết dự giờ đã thực hiện</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">{observations.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Theo tiêu chí CV 5512</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Kế hoạch bài dạy</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">{lessonPlans.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {lessonPlans.filter(p => p.status === 'approved').length} giáo án đã duyệt
              </div>
            </div>
          </div>

          {/* Sơ kết chuyên môn (Dynamic Report with Snapshots) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            {/* Top Toolbar for Snapshot Selection & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-700">Kỳ báo cáo:</label>
                <select
                  value={selectedSnapshotId}
                  onChange={e => setSelectedSnapshotId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="snap-current">-- Báo cáo thời gian thực (Live) --</option>
                  {reportSnapshots.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.periodLabel} ({s.isLocked ? '🔒 Đã chốt' : '📝 Nháp'}) – {new Date(s.createdAt).toLocaleDateString('vi-VN')}
                    </option>
                  ))}
                </select>

                <select
                  value={reportTerm}
                  onChange={e => {
                    const newTerm = e.target.value;
                    setReportTerm(newTerm);
                    if (!isLocked) {
                      setReportTitle(`Báo cáo sơ kết hoạt động chuyên môn ${newTerm} – Năm học ${config.academicYear}`);
                    }
                  }}
                  disabled={isLocked}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white disabled:opacity-60"
                >
                  <option value="Giữa HK1">Giữa Học kỳ 1</option>
                  <option value="Cuối HK1">Cuối Học kỳ 1</option>
                  <option value="Giữa HK2">Giữa Học kỳ 2</option>
                  <option value="Tổng kết năm học">Tổng kết cả năm học</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                {!isLocked && (
                  <button
                    onClick={handleSyncLiveMetrics}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
                    title="Cập nhật lại số liệu từ các mô đun chuyên môn"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    <span>Làm mới số liệu</span>
                  </button>
                )}

                <button
                  onClick={handleExportReportExcel}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Xuất Excel</span>
                </button>

                <button
                  onClick={() => handleSaveSnapshot(false)}
                  disabled={isLocked}
                  className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 rounded-lg border border-slate-300 flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 text-slate-600" />
                  <span>Lưu bản nháp</span>
                </button>

                {isLocked ? (
                  <div className="flex items-center gap-1.5">
                    <span className="px-3 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Đã chốt & Khóa</span>
                    </span>
                    {isLeader && (
                      <button
                        onClick={() => setIsLocked(false)}
                        className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 underline"
                      >
                        Mở khóa sửa
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleSaveSnapshot(true)}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Chốt & Khóa báo cáo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Status & Metadata banner */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <span>Năm học: <strong className="text-slate-800">{config.academicYear}</strong></span>
                <span>•</span>
                <span>Giai đoạn: <strong className="text-blue-700">{reportTerm}</strong></span>
                {finalizedBy && (
                  <>
                    <span>•</span>
                    <span>Người chốt: <strong className="text-emerald-700">{finalizedBy}</strong></span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px]">Định dạng:</span>
                <span className="font-semibold text-slate-700">Mẫu báo cáo sơ kết Tổ chuyên môn THPT</span>
              </div>
            </div>

            {/* Editable or Display Sections */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề báo cáo sơ kết:
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={e => setReportTitle(e.target.value)}
                  disabled={isLocked}
                  className="w-full text-sm font-bold text-slate-900 border border-slate-300 rounded-lg p-2.5 bg-white disabled:bg-slate-50 disabled:text-slate-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    1. Đánh giá tổng quan thực hiện quy chế và chỉ tiêu chuyên môn:
                  </label>
                  <span className="text-[11px] text-slate-400">Tự động tổng hợp số liệu thực tế</span>
                </div>
                <textarea
                  rows={4}
                  value={executiveSummary}
                  onChange={e => setExecutiveSummary(e.target.value)}
                  disabled={isLocked}
                  className="w-full text-xs text-slate-800 border border-slate-300 rounded-lg p-3 leading-relaxed bg-white disabled:bg-slate-50"
                  placeholder="Nhập nội dung tổng quan đánh giá..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Ưu điểm và kết quả nổi bật đạt được:
                </label>
                <textarea
                  rows={4}
                  value={advantages}
                  onChange={e => setAdvantages(e.target.value)}
                  disabled={isLocked}
                  className="w-full text-xs text-slate-800 border border-slate-300 rounded-lg p-3 leading-relaxed bg-white disabled:bg-slate-50"
                  placeholder="Ghi nhận các kết quả nổi bật..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  3. Tồn tại, hạn chế và khó khăn cần khắc phục:
                </label>
                <textarea
                  rows={3}
                  value={limitations}
                  onChange={e => setLimitations(e.target.value)}
                  disabled={isLocked}
                  className="w-full text-xs text-slate-800 border border-slate-300 rounded-lg p-3 leading-relaxed bg-white disabled:bg-slate-50"
                  placeholder="Chỉ ra các khó khăn hạn chế..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  4. Phương hướng và giải pháp trọng tâm thời gian tới:
                </label>
                <textarea
                  rows={4}
                  value={futureDirections}
                  onChange={e => setFutureDirections(e.target.value)}
                  disabled={isLocked}
                  className="w-full text-xs text-slate-800 border border-slate-300 rounded-lg p-3 leading-relaxed bg-white disabled:bg-slate-50"
                  placeholder="Đề ra phương hướng hành động..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Teacher Progress & Statistics */}
      {activeReportTab === 'teacher_stats' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-600">
              Tổng hợp tiến độ chuyên môn nội bộ từng giáo viên trong tổ
            </div>
            <button
              onClick={handleExportTeacherStats}
              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel thống kê</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Giáo viên</th>
                    <th className="p-3">Chức vụ</th>
                    <th className="p-3">Số tiết/tuần</th>
                    <th className="p-3">Lớp phụ trách</th>
                    <th className="p-3 text-center">Tiết dự giờ</th>
                    <th className="p-3 text-center">Tiết được dự</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {teacherStats.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{t.name}</td>
                      <td className="p-3 uppercase text-[11px] font-semibold text-slate-500">{t.role}</td>
                      <td className="p-3 font-bold text-blue-700">{t.periods} tiết</td>
                      <td className="p-3 text-slate-700 font-medium">{t.classes}</td>
                      <td className="p-3 text-center font-semibold text-slate-800">{t.obsDone}</td>
                      <td className="p-3 text-center font-semibold text-slate-800">{t.obsReceived}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Complete Booklet A4 Print */}
      {activeReportTab === 'so_sinh_hoat' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs print:hidden">
            <div>
              <div className="text-xs font-bold text-slate-900">Sổ Sinh Hoạt Chuyên Môn Số (Đóng cuốn A4)</div>
              <div className="text-[11px] text-slate-500">
                Tài liệu tổng hợp đầy đủ danh sách phân công, kế hoạch dạy học, biên bản họp và phiếu dự giờ để nộp BGH / Sở GD&ĐT
              </div>
            </div>
            <button
              onClick={handlePrintBooklet}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In toàn bộ sổ (A4 / PDF)</span>
            </button>
          </div>

          {/* Printable Booklet Mock */}
          <div className="bg-white border border-slate-300 rounded-xl p-8 shadow-sm space-y-8 print:p-0 print:border-none print:shadow-none">
            {/* Trang bìa */}
            <div className="text-center py-12 border-2 border-slate-800 rounded-xl space-y-4 print:border-2">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-700">
                SỞ GIÁO DỤC VÀ ĐÀO TẠO – {config.schoolName.toUpperCase()}
              </div>
              <div className="pt-10">
                <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">
                  SỔ SINH HOẠT CHUYÊN MÔN
                </h1>
                <h2 className="text-lg font-semibold uppercase text-blue-900 mt-2">
                  TỔ: {config.departmentName.toUpperCase()}
                </h2>
              </div>
              <div className="text-sm font-medium text-slate-600 pt-8">
                NĂM HỌC: {config.academicYear}
              </div>
              <div className="pt-12 text-xs text-slate-500">
                Tổ trưởng chuyên môn: <strong>{allMembers.find(m => m.role === 'head')?.displayName || 'ThS. Lê Quốc Dũng'}</strong>
              </div>
            </div>

            {/* Mục lục tóm tắt */}
            <div className="pt-6 border-t border-slate-200 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Mục lục các phần trong sổ:
              </h3>
              <div className="text-xs space-y-1.5 text-slate-700 font-mono">
                <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                  <span>Phần I: Danh sách thành viên và Bảng phân công chuyên môn</span>
                  <span>Trang 02</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                  <span>Phần II: Kế hoạch dạy học của Tổ chuyên môn (Phụ lục I CV 5512)</span>
                  <span>Trang 05</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                  <span>Phần III: Biên bản các kỳ sinh hoạt theo Nghiên cứu bài học</span>
                  <span>Trang 12</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                  <span>Phần IV: Tổng hợp phiếu dự giờ và phân tích hoạt động học sinh</span>
                  <span>Trang 24</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                  <span>Phần V: Báo cáo sơ kết và phân tích phổ điểm các đợt kiểm tra</span>
                  <span>Trang 30</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

