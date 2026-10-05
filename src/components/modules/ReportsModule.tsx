import { scopeRecords, annualRecords, savedEvidence } from '../../utils/reporting';
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
import { DocumentExportDialog } from '../common/DocumentExportDialog';
import { reportDocument } from '../../utils/documentModel';
import { Booklet } from './Booklet';
import { reportRange, reportData, validRange } from '../../utils/reporting';
import { newId } from '../../utils/ids';
import { findDuplicateAssignments, summarizeTeacher, teacherComparator } from '../../utils/assignments';
import { exportPeriodDossier } from '../../utils/periodDossier';
import { db, storage } from '../../firebase';
import { loadAllLessonPlansFull } from '../../services/lessonPlanStore';
import { MonthlyReportPanel } from '../monthly/MonthlyReportPanel';
import { monthlyRouteParams } from '../../report/navigation';

export const ReportsModule: React.FC = () => {
  const {
    allMembers,
    assignments,
    observations,
    meetings,
    specialTopics,
    config,
    reportSnapshots,
    saveReportSnapshot,
    activeMember,
    setNotification,
    permissions,
    lessonPlans,
    skknTopics,
    departmentPlans,
    teacherPlans,
    trainings,
    initiatives,
    isDemoMode,
  } = useApp();

  const [exportOpen,setExportOpen] = useState(false);
  const isLeader = permissions.isLeader;

  const [reportTab, setActiveReportTab] = useState<'monthly' | 'summary' | 'teacher_stats' | 'so_sinh_hoat'>(() =>
    monthlyRouteParams().monthly || !permissions.isLeader ? 'monthly' : 'summary');

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

  const [reportYear, setReportYear] = useState(config.academicYear);
  const initialRange = reportRange(config.academicYear, 'Giữa HK1');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [savedMetrics, setSavedMetrics] = useState<ReportSnapshot['metrics'] | null>(null);
  const [evidence, setEvidence] = useState<ReportSnapshot['evidence']>();
  const [rangeDirty, setRangeDirty] = useState(false);
  const {syncStatus, isFirestoreConnected} = useApp();
  const scopeReady = isDemoMode || (isFirestoreConnected && !syncStatus.cached && !syncStatus.errors.length && !syncStatus.pendingWrites && !syncStatus.saving);
  const scoped = reportData({ meetings, observations, lessonPlans, specialTopics }, startDate, endDate, undefined, reportYear);
  // Live aggregated metrics
  const lessonStudyMeetingsCount = scoped.meetings.filter(m => m.type === 'lesson_study').length;
  const activeTeachers = allMembers.filter(m => m.status === 'active' && m.role !== 'principal');
  const assignedTeacherIds = new Set(assignments.filter(a => a.academicYear === reportYear).map(a => a.teacherId));
  const assignedPct = activeTeachers.length ? Math.round((activeTeachers.filter(m => assignedTeacherIds.has(m.id)).length / activeTeachers.length) * 100) : 0;

  const calculateLiveMetrics = () => ({
    membersCount: allMembers.length,
    meetingsCount: scoped.meetings.length,
    lessonStudyCount: lessonStudyMeetingsCount,
    observationsCount: scoped.observations.length,
    plansCount: scoped.lessonPlans.length,
    approvedPlansCount: scoped.lessonPlans.filter(p => p.status === 'approved').length,
    specialTopicsCount: scoped.specialTopics.length,
  });

  const shownMetrics = savedMetrics || calculateLiveMetrics();

  // Generate live default narrative strictly based on actual numbers
  const generateLiveNarrative = (term = 'Giữa HK1') => {
    const live = calculateLiveMetrics();
    const meetingsText = live.meetingsCount > 0
      ? `đã tổ chức ${live.meetingsCount} buổi sinh hoạt chuyên môn${live.lessonStudyCount > 0 ? ` (trong đó có ${live.lessonStudyCount} buổi theo nghiên cứu bài học)` : ' (chưa có buổi sinh hoạt theo NCBH)'}`
      : 'chưa có dữ liệu buổi sinh hoạt chuyên môn';

    const observationsText = live.observationsCount > 0
      ? `thực hiện ${live.observationsCount} lượt dự giờ trao đổi chuyên môn`
      : 'chưa có dữ liệu dự giờ';

    return {
      title: `Báo cáo sơ kết hoạt động chuyên môn ${term} – Năm học ${reportYear}`,
      summary: `Tổ chuyên môn gồm ${live.membersCount} thành viên. Trong kỳ ${term} năm học ${reportYear} (${startDate} đến ${endDate}): ${assignedPct}% giáo viên đã được phân công giảng dạy (chuẩn gợi ý ${config.standardPeriods || 17} tiết/tuần); ${meetingsText}; ${observationsText}; ${live.plansCount} kế hoạch bài dạy được lưu (${scoped.lessonPlans.filter(p => p.status === 'approved').length} đã duyệt); ${live.specialTopicsCount} chuyên đề bồi dưỡng, ${skknTopics.filter(p => p.academicYear === reportYear).length} đề tài SKKN trong năm học.`,
      adv: `1. (Tổ trưởng điền) Việc chấp hành quy chế chuyên môn, thực hiện chương trình GDPT 2018.\n2. (Tổ trưởng điền) Ứng dụng CNTT, đổi mới phương pháp dạy học.\n3. (Tổ trưởng điền) Kết quả kiểm tra, đánh giá.`,
      lim: `1. (Tổ trưởng điền) Những hạn chế trong thực hiện chương trình, kiểm tra đánh giá.\n2. Chưa đủ dữ liệu chỉ tiêu và minh chứng để tự đánh giá mức độ hoàn thành; tổ trưởng bổ sung nhận xét.`,
      dir: `1. Tiếp tục đổi mới kiểm tra, đánh giá theo định hướng phát triển năng lực, bám sát định dạng đề thi tốt nghiệp THPT.\n2. Tổ chức chuyên đề sinh hoạt chuyên môn theo hướng nghiên cứu bài học tập trung vào các dạng bài toán ứng dụng thực tế.\n3. Duy trì kế hoạch phụ đạo học sinh có kết quả kiểm tra dưới trung bình và bồi dưỡng học sinh khá giỏi.`,
    };
  };

  // Sync state when selected snapshot changes
  useEffect(() => {
    const found = reportSnapshots.find(s => s.id === selectedSnapshotId);
    if (found) {
      setReportYear(found.academicYear);
      const range = reportRange(found.academicYear, found.term);
      setStartDate(found.startDate || range.startDate); setEndDate(found.endDate || range.endDate);
      setSavedMetrics(found.metrics); setEvidence(found.evidence); setRangeDirty(false);
      setReportTitle(found.title);
      setReportTerm(found.term);
      setExecutiveSummary(found.executiveSummary);
      setAdvantages(found.advantages);
      setLimitations(found.limitations);
      setFutureDirections(found.futureDirections);
      setIsLocked(found.isLocked);
      setFinalizedBy(found.finalizedBy);
    } else {
      setReportYear(config.academicYear); setSavedMetrics(null); setEvidence(undefined); setRangeDirty(true);
      const range = reportRange(config.academicYear, 'Giữa HK1'); setStartDate(range.startDate); setEndDate(range.endDate);
      // Default to live metrics
      const def = generateLiveNarrative('Giữa HK1');
      setReportTitle(def.title);
      setReportTerm('Giữa HK1');
      setReportTitle(def.title);
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
    if (!scopeReady) {setNotification({message:'Dữ liệu chưa được xác nhận đầy đủ từ máy chủ. Hãy chờ đồng bộ trước khi tổng hợp.',type:'error'});return;}
    if (isLocked) {
      setNotification({ message: 'Báo cáo đã chốt và khóa, không thể ghi đè dữ liệu trực tiếp!', type: 'error' });
      return;
    }
    if (!validRange(startDate, endDate)) { setNotification({message: 'Khoảng ngày báo cáo không hợp lệ.', type: 'error'}); return; }
    setSavedMetrics(calculateLiveMetrics()); setRangeDirty(false);
    setEvidence({meetings:scoped.meetings.map(p => p.id), observations:scoped.observations.map(p => p.id), lessonPlans:scoped.lessonPlans.map(p => p.id), specialTopics:scoped.specialTopics.map(p => p.id)});
    const def = generateLiveNarrative(reportTerm);
    setReportTitle(def.title);
    setExecutiveSummary(def.summary);
    setNotification({ message: 'Đã đồng bộ số liệu thời gian thực từ hệ thống vào báo cáo!', type: 'success' });
  };

  // Save or Update Snapshot
  const handleSaveSnapshot = async (lock = false) => {
    const live = savedMetrics || calculateLiveMetrics();
    if (isLocked || rangeDirty || !validRange(startDate, endDate)) { setNotification({message: 'Hãy đồng bộ số liệu trước khi lưu. Bản đã chốt cần mở khóa riêng.', type: 'error'}); return; }
    if (!isLeader) {
      setNotification({ message: 'Chỉ Tổ trưởng/Tổ phó được lưu và chốt báo cáo.', type: 'error' });
      return;
    }
    const snapshotId = selectedSnapshotId === 'snap-current' ? newId('snap') : selectedSnapshotId;
    const previous = reportSnapshots.find(s => s.id === snapshotId);
    const author = activeMember.displayName;

    const newSnapshot: ReportSnapshot = {
      id: snapshotId,
      title: reportTitle || `Báo cáo sơ kết ${reportTerm} – Năm học ${reportYear}`,
      academicYear: reportYear,
      startDate, endDate, evidence,
      term: reportTerm,
      periodLabel: `Sơ kết ${reportTerm}`,
      createdAt: previous?.createdAt || new Date().toISOString(),
      finalizedBy: lock ? author : (finalizedBy || author),
      isLocked: lock,
      sectionsIncluded: ['Tổng quan', 'Ưu điểm', 'Hạn chế', 'Phương hướng'],
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
  const effectiveAssignments = findDuplicateAssignments(assignments).keep.filter(a => a.term === config.currentTerm && a.academicYear === reportYear);
  const teacherStats = [...allMembers].sort((x, y) => teacherComparator(allMembers)(x.id, x.displayName, y.id, y.displayName)).map(member => {
    const asgs = effectiveAssignments.filter(a => a.teacherId === member.id);
    const periods = summarizeTeacher(asgs).total; // tiết theo TKB + tiết quy đổi nhiệm vụ, chủ nhiệm
    const obsDone = scoped.observations.filter(o => o.observerId === member.id).length;
    const obsReceived = scoped.observations.filter(o => o.teacherId === member.id).length;

    return {
      id: member.id,
      name: member.displayName,
      role: member.role,
      periods,
      classes: summarizeTeacher(asgs).classes.join(', ') || 'Chưa phân công',
      obsDone,
      obsReceived,
    };
  });

  const handleExportReportExcel = () => {
    if (rangeDirty) { setNotification({message: 'Hãy đồng bộ số liệu trước khi xuất.', type: 'error'}); return; }
    const live = savedMetrics || calculateLiveMetrics();
    const rows = [
      { 'Mục': 'Tiêu đề báo cáo', 'Nội dung': reportTitle },
      { 'Mục': 'Học kỳ / Giai đoạn', 'Nội dung': reportTerm },
      { 'Mục': 'Năm học', 'Nội dung': reportYear },
      { 'Mục': 'Khoảng ngày', 'Nội dung': reportSnapshots.some(s => s.id === selectedSnapshotId && !s.startDate) ? 'Báo cáo cũ chưa lưu khoảng ngày' : `${startDate} – ${endDate}` },
      { 'Mục': 'Trạng thái', 'Nội dung': isLocked ? 'Đã chốt & Khóa' : 'Bản nháp' },
      { 'Mục': 'Người lập / chốt', 'Nội dung': finalizedBy || activeMember.displayName },
      { 'Mục': 'Số thành viên tổ', 'Nội dung': live.membersCount },
      { 'Mục': 'Số buổi họp chuyên môn', 'Nội dung': live.meetingsCount },
      { 'Mục': 'Số buổi SHCM theo NCBH', 'Nội dung': live.lessonStudyCount },
      { 'Mục': 'Số tiết dự giờ', 'Nội dung': live.observationsCount },
      { 'Mục': 'Số kế hoạch bài dạy', 'Nội dung': live.plansCount },
      { 'Mục': 'Báo cáo tổng quan', 'Nội dung': executiveSummary },
      { 'Mục': 'Ưu điểm & Kết quả đạt được', 'Nội dung': advantages },
      { 'Mục': 'Tồn tại & Hạn chế', 'Nội dung': limitations },
      { 'Mục': 'Phương hướng nhiệm vụ kỳ tới', 'Nội dung': futureDirections },
    ];
    exportToExcel([{ name: 'BaoCaoSoKet', data: rows }], `Bao_Cao_So_Ket_${reportTerm.replace(/\s+/g, '_')}_${reportYear}`);
  };

  const handleExportDossier = async () => {
    if (!scopeReady) {setNotification({message:'Hãy chờ dữ liệu đồng bộ đầy đủ trước khi xuất hồ sơ.',type:'error'});return;}
    if (rangeDirty || !validRange(startDate, endDate)) {
      setNotification({message:'Hãy đồng bộ số liệu và kiểm tra khoảng ngày trước khi đóng gói hồ sơ.', type:'error'});
      return;
    }
    try {
      if (savedMetrics && !evidence) throw new Error('Báo cáo cũ chưa có danh sách minh chứng. Hãy mở khóa và đồng bộ trước khi xuất.');
      const source = evidence ? {
        lessonPlans: savedEvidence(lessonPlans,evidence.lessonPlans || []),
        meetings: savedEvidence(meetings,evidence.meetings || []),
        observations: savedEvidence(observations,evidence.observations || []),
        specialTopics: savedEvidence(specialTopics,evidence.specialTopics || []),
      } : scoped;
      const fullPlans = isDemoMode ? source.lessonPlans : await loadAllLessonPlansFull(db, storage, source.lessonPlans);
      await exportPeriodDossier({
        academicYear: reportYear, term: reportTerm, startDate, endDate,
        schoolName: config.schoolName, departmentName: config.departmentName,
        report: {title:reportTitle, metrics:shownMetrics, executiveSummary, advantages, limitations, futureDirections, finalizedBy, isLocked, evidence},
        members: allMembers,
        assignments: findDuplicateAssignments(annualRecords(assignments, reportYear)).keep,
        departmentPlans: annualRecords(departmentPlans,reportYear),
        teacherPlans: annualRecords(teacherPlans,reportYear),
        lessonPlans: fullPlans, meetings: source.meetings, observations: source.observations, specialTopics: source.specialTopics,
        trainings: scopeRecords(trainings, reportYear, startDate, endDate, (x:any) => x.date || x.completedAt || x.createdAt),
        initiatives: scopeRecords(initiatives, reportYear, startDate, endDate, (x:any) => x.date || x.createdAt),
        reportSnapshots: reportSnapshots.filter(r => r.id === selectedSnapshotId),
      });
      setNotification({message:`Đã xuất gói hồ sơ điện tử ${reportTerm} – ${reportYear}.`, type:'success'});
    } catch (err) {
      setNotification({message:`Không xuất được gói hồ sơ: ${err instanceof Error ? err.message : String(err)}`, type:'error'});
    }
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
    exportToExcel([{ name: 'ThongKeGiaoVien', data: rows }], `Thong_Ke_Tien_Do_To_Toan_${reportYear}`);
  };

  // Giáo viên chỉ dùng báo cáo tháng của mình; các tab tổng hợp dành cho lãnh đạo tổ và BGH
  const seeTeamReports = permissions.isLeader || activeMember.role === 'principal';
  const activeReportTab = seeTeamReports ? reportTab : 'monthly';

  return (
    <div className="space-y-6">
      {exportOpen && <DocumentExportDialog model={reportDocument({title:reportTitle || `Báo cáo ${reportTerm}`,academicYear:reportYear,startDate,endDate,isLocked,metrics:shownMetrics,executiveSummary,advantages,limitations,futureDirections,finalizedBy,evidence},config)} onClose={() => setExportOpen(false)} />}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-600" />
            <span>{seeTeamReports ? 'Báo cáo & Thống kê hoạt động Tổ Toán' : 'Báo cáo tháng của tôi'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {seeTeamReports
              ? 'Tổng hợp dữ liệu chuyên môn, theo dõi tiến độ hoàn thành nhiệm vụ và xuất cuốn Sổ Sinh hoạt Chuyên môn'
              : 'Đọc công văn, chọn đầu việc của mình, nộp minh chứng và nộp báo cáo tháng'}
          </p>
        </div>

        {/* Tab Buttons */}
        {seeTeamReports && (
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveReportTab('monthly')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeReportTab === 'monthly' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Báo cáo tháng
          </button>
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
        )}
      </div>

      {/* Tab 1: General Summary Report */}
      {activeReportTab === 'summary' && (
        <div className="space-y-6">
          {/* Live KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Thành viên tổ</div>
              <div className="text-2xl font-bold text-blue-700 mt-1">{shownMetrics.membersCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Giáo viên Toán THPT</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Buổi họp tổ đã tổ chức</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{shownMetrics.meetingsCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {shownMetrics.lessonStudyCount} buổi theo NCBH
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Tiết dự giờ đã thực hiện</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">{shownMetrics.observationsCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Theo tiêu chí CV 5512</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Kế hoạch bài dạy</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">{shownMetrics.plansCount ?? 0}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {shownMetrics.approvedPlansCount ?? 'Chưa lưu số'} giáo án đã duyệt
              </div>
            </div>
          </div>

          <details className="bg-white rounded border p-3 text-xs">
            <summary className="cursor-pointer font-bold">Minh chứng số liệu {savedMetrics ? '(bản đã lưu/đồng bộ)' : '(theo khoảng ngày đang chọn)'}</summary>
            {(['meetings','observations','lessonPlans','specialTopics'] as const).map(kind => <div key={kind} className="mt-3"><strong>{{meetings:'Biên bản họp',observations:'Phiếu dự giờ',lessonPlans:'Giáo án',specialTopics:'Chuyên đề'}[kind]}</strong><ul>{(evidence?.[kind] || (savedMetrics ? [] : scoped[kind].map(p => p.id))).map(id => {
              const item = [...meetings,...observations,...lessonPlans,...specialTopics].find(p => p.id === id) as any;
              return <li key={id}>{item?.title || item?.lessonName || `Hồ sơ ${id} (không còn trong dữ liệu hiện tại)`}</li>;
            })}</ul></div>)}
            {savedMetrics && !evidence && <p>Báo cáo phiên bản cũ chưa lưu danh sách minh chứng. Số liệu được giữ nguyên từ bản đã lưu.</p>}
            <p className="mt-2">Họp chưa chốt/tương lai trong khoảng ngày hiện tại: {scoped.pendingMeetings.length}. Chuyên đề thiếu ngày không được tự tính. Thành viên là danh sách hiện tại tại thời điểm đồng bộ.</p>
          </details>
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
                    const range = reportRange(reportYear, newTerm);
                    setStartDate(range.startDate); setEndDate(range.endDate); setRangeDirty(true);
                    if (!isLocked) {
                      setReportTitle(`Báo cáo sơ kết hoạt động chuyên môn ${newTerm} – Năm học ${reportYear}`);
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

              <div className="flex flex-wrap gap-2 text-xs">
                <label>Năm học <input aria-label="Năm học báo cáo" disabled={isLocked} value={reportYear} onChange={e => {setReportYear(e.target.value); setRangeDirty(true);}} className="border rounded p-1 w-24" /></label>
                <label>Từ ngày <input type="date" disabled={isLocked} value={startDate} onChange={e => {setStartDate(e.target.value); setRangeDirty(true);}} className="border rounded p-1" /></label>
                <label>Đến ngày <input type="date" disabled={isLocked} value={endDate} onChange={e => {setEndDate(e.target.value); setRangeDirty(true);}} className="border rounded p-1" /></label>
                <p className="w-full text-amber-700">{reportSnapshots.some(s => s.id === selectedSnapshotId && !s.startDate) ? 'Báo cáo cũ chưa lưu khoảng ngày; các mốc hiển thị chỉ là gợi ý. ' : ''}Mốc ngày gợi ý cần đối chiếu lịch trường. Chỉ tính họp đã chốt và hoạt động đã đến ngày; giáo án tính theo ngày tạo (bản cũ dùng ngày cập nhật). {rangeDirty ? 'Hãy bấm Đồng bộ số liệu.' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isLocked && (
                  <button
                    onClick={handleSyncLiveMetrics}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
                    title="Cập nhật lại số liệu từ các mô đun chuyên môn"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    <span>Đồng bộ số liệu</span>
                  </button>
                )}

                <button disabled={rangeDirty} onClick={() => setExportOpen(true)} className="px-3 py-2 border rounded-lg text-xs disabled:opacity-40">Xuất Word / PDF</button>
                <button
                  onClick={handleExportReportExcel}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Xuất Excel</span>
                </button>
                <button
                  disabled={rangeDirty}
                  onClick={handleExportDossier}
                  className="px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg border border-indigo-600 flex items-center gap-1.5 disabled:opacity-40"
                  title="Đóng gói hồ sơ cuối kỳ/năm gồm báo cáo, thành viên, phân công, kế hoạch, giáo án, SHCM, dự giờ và minh chứng"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Gói hồ sơ kỳ/năm ZIP</span>
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
                    {permissions.isAdminOrHead && (
                      <button
                        onClick={async () => {
                          const original = reportSnapshots.find(s => s.id === selectedSnapshotId);
                          if (original && window.confirm('Mở khóa bản báo cáo đã chốt để chỉnh sửa?')) await saveReportSnapshot({...original,isLocked:false});
                        }}
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
                <span>Năm học: <strong className="text-slate-800">{reportYear}</strong></span>
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

      {activeReportTab === 'so_sinh_hoat' && <Booklet />}
      {activeReportTab === 'monthly' && <MonthlyReportPanel />}
    </div>
  );
};
