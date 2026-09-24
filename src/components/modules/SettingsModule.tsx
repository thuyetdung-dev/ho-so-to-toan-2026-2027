import React, { useEffect, useState } from 'react';
import { useConfirm } from '../common/ConfirmDialog';
import { newId } from '../../utils/ids';
import { useApp } from '../../context/AppContext';
import { StoragePanel } from '../common/StoragePanel';
import {
  Settings,
  Shield,
  Database,
  History,
  Save,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  GraduationCap,
  Award,
  FileCheck2,
  FileSpreadsheet,
  Plus,
  Edit2,
  ArrowRight,
  Info,
  Clock,
  Sparkles,
  UserCheck,
  Check,
  X,
  BookOpen,
} from 'lucide-react';
import {
  SchoolClass,
  CurriculumTopic,
  MathCompetencyTag,
  ObservationCriterionItem,
  ExamTemplateStructure,
  AcademicCalendarMilestone,
} from '../../types';

export const SettingsModule: React.FC = () => {
  const {
    activeMember,
    setActiveMember,
    allMembers,
    config,
    updateConfig,
    classes,
    addClass,
    deleteClass,
    transitionToNewAcademicYear,
    isDemoMode,
    toggleDemoMode,
    resetToSampleData,
    clearAllRealData,
    auditLogs,
    exportSystemBackup,
    importSystemBackup,
    setNotification,
    permissions,
    canSimulateRoles,
    isLoading,
  } = useApp();
  const confirm = useConfirm();

  const isLeader = permissions.isAdminOrHead;

  // Navigation tab in Settings
  const [activeTab, setActiveTab] = useState<
    'general' | 'classes' | 'calendar' | 'topics' | 'competencies' | 'criteria' | 'exam_structures' | 'roles' | 'data' | 'audit'
  >('general');

  // General Config State
  const [schoolName, setSchoolName] = useState(config.schoolName);
  const [departmentName, setDepartmentName] = useState(config.departmentName);
  const [academicYear, setAcademicYear] = useState(config.academicYear);
  const [currentTerm, setCurrentTerm] = useState(config.currentTerm);
  const [standardPeriods, setStandardPeriods] = useState(config.standardPeriods || 17);
  const [weeksCount, setWeeksCount] = useState(config.weeksCount || 35);

  // Modal: New Academic Year Transition (Lỗi 20)
  const [showYearModal, setShowYearModal] = useState(false);
  const [nextYearInput, setNextYearInput] = useState('2027-2028');
  const [copyConfigOption, setCopyConfigOption] = useState(true);
  const [copyPlansOption, setCopyPlansOption] = useState(true);
  const [keepQuestionsNotice, setKeepQuestionsNotice] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Classes Form State
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<number>(0); // 0 = all
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<10 | 11 | 12>(10);
  const [newClassTrack, setNewClassTrack] = useState<'KHTN' | 'KHXH' | 'Cơ bản'>('KHTN');
  const [newClassStudents, setNewClassStudents] = useState(42);
  const [newClassHomeroom, setNewClassHomeroom] = useState('');
  const [newClassRoom, setNewClassRoom] = useState('');

  // Calendar Milestone State
  const [milestones, setMilestones] = useState<AcademicCalendarMilestone[]>(config.academicCalendar || config.calendarMilestones || []);
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneTerm, setNewMilestoneTerm] = useState<'HK1' | 'HK2' | 'CaNam'>('HK1');
  const [newMilestoneStart, setNewMilestoneStart] = useState('');
  const [newMilestoneEnd, setNewMilestoneEnd] = useState('');
  const [newMilestoneNotes, setNewMilestoneNotes] = useState('');

  // Curriculum Topics State
  const [topics, setTopics] = useState<CurriculumTopic[]>(config.curriculumTopics || []);
  const [selectedTopicGrade, setSelectedTopicGrade] = useState<number>(12);
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [newTopicCode, setNewTopicCode] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicGrade, setNewTopicGrade] = useState<10 | 11 | 12>(12);
  const [newTopicStrand, setNewTopicStrand] = useState<'Đại số & Giải tích' | 'Hình học & Đo lường' | 'Thống kê & Xác suất' | 'Hoạt động trải nghiệm'>('Đại số & Giải tích');
  const [newTopicPeriods, setNewTopicPeriods] = useState(15);
  const [newTopicTerm, setNewTopicTerm] = useState<'HK1' | 'HK2'>('HK1');

  // Competency Tags State
  const [competencies, setCompetencies] = useState<MathCompetencyTag[]>(config.competencyTags || []);
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [newCompCode, setNewCompCode] = useState('');
  const [newCompName, setNewCompName] = useState('');
  const [newCompDesc, setNewCompDesc] = useState('');
  const [newCompIndicators, setNewCompIndicators] = useState('');

  // Observation Criteria State
  const [criteria, setCriteria] = useState<ObservationCriterionItem[]>(config.observationCriteria || []);
  const [showAddCritModal, setShowAddCritModal] = useState(false);
  const [newCritCategory, setNewCritCategory] = useState<'ke_hoach' | 'hoat_dong_day' | 'hoat_dong_hoc'>('ke_hoach');
  const [newCritName, setNewCritName] = useState('');
  const [newCritMaxScore, setNewCritMaxScore] = useState(2.0);

  // Exam Template Structure State
  const [examTemplates, setExamTemplates] = useState<ExamTemplateStructure[]>(config.examTemplates || []);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDuration, setNewTemplateDuration] = useState(90);
  const [newTemplateMcqCount, setNewTemplateMcqCount] = useState(12);
  const [newTemplateMcqPoints, setNewTemplateMcqPoints] = useState(3.0);
  const [newTemplateTfCount, setNewTemplateTfCount] = useState(4);
  const [newTemplateTfPoints, setNewTemplateTfPoints] = useState(4.0);
  const [newTemplateShortCount, setNewTemplateShortCount] = useState(6);
  const [newTemplateShortPoints, setNewTemplateShortPoints] = useState(3.0);
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

  // Đồng bộ lại biểu mẫu khi cấu hình thay đổi (dữ liệu thật tải về sau, đổi chế độ demo/thật...).
  // Bản cũ chỉ đọc cấu hình lúc mở trang → khi lưu có thể ghi đè cấu hình thật bằng giá trị mặc định.
  useEffect(() => {
    setSchoolName(config.schoolName);
    setDepartmentName(config.departmentName);
    setAcademicYear(config.academicYear);
    setCurrentTerm(config.currentTerm);
    setStandardPeriods(config.standardPeriods || 17);
    setWeeksCount(config.weeksCount || 35);
    setMilestones(config.academicCalendar || config.calendarMilestones || []);
    setTopics(config.curriculumTopics || []);
    setCompetencies(config.competencyTags || []);
    setCriteria(config.observationCriteria || []);
    setExamTemplates(config.examTemplates || []);
    const [y1] = (config.academicYear || '').split('-').map(Number);
    if (y1) setNextYearInput(`${y1 + 1}-${y1 + 2}`);
  }, [config]);

  // Handlers
  const handleSaveGeneralConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateConfig({
      schoolName,
      departmentName,
      academicYear,
      currentTerm,
      standardPeriods: Number(standardPeriods),
      weeksCount: Number(weeksCount),
    });
  };

  const handleExecuteYearTransition = async () => {
    if (!/^\d{4}-\d{4}$/.test(nextYearInput.trim())) {
      setNotification({ message: 'Năm học mới phải có dạng YYYY-YYYY (ví dụ 2027-2028)', type: 'error' });
      return;
    }
    const ok = await confirm({
      title: `Chuyển sang năm học ${nextYearInput.trim()}?`,
      message: 'Toàn bộ phân công giảng dạy năm hiện tại sẽ bị xóa để phân công lại. Nên tải tệp sao lưu JSON trước khi thực hiện.',
      confirmText: 'Chuyển năm học',
      danger: true,
    });
    if (!ok) return;
    setIsTransitioning(true);
    try {
      await transitionToNewAcademicYear(nextYearInput.trim(), {
        copyConfig: copyConfigOption,
        copyPlans: copyPlansOption,
        keepQuestions: keepQuestionsNotice,
      });
      setAcademicYear(nextYearInput.trim());
      setShowYearModal(false);
    } catch (err: any) {
      setNotification({ message: `Lỗi chuyển năm học: ${err.message}`, type: 'error' });
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const newCls: SchoolClass = {
      id: newId('cls'),
      name: newClassName.trim().toUpperCase(),
      grade: newClassGrade,
      track: newClassTrack,
      studentCount: Number(newClassStudents),
      homeroomTeacher: newClassHomeroom.trim() || undefined,
      roomNumber: newClassRoom.trim() || undefined,
    };
    await addClass(newCls);
    setNewClassName('');
    setShowAddClassModal(false);
  };

  const handleSaveCalendar = async (newList: AcademicCalendarMilestone[]) => {
    if (await updateConfig({ academicCalendar: newList, calendarMilestones: newList })) setMilestones(newList);
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneName.trim()) return;
    const newM: AcademicCalendarMilestone = {
      id: newId('milestone'),
      title: newMilestoneName.trim(),
      term: newMilestoneTerm,
      startDate: newMilestoneStart || new Date().toISOString().split('T')[0],
      endDate: newMilestoneEnd || newMilestoneStart || new Date().toISOString().split('T')[0],
      notes: newMilestoneNotes.trim(),
      status: 'upcoming',
    };
    const updated = [...milestones, newM];
    await handleSaveCalendar(updated);
    setNewMilestoneName('');
    setNewMilestoneNotes('');
    setShowAddMilestoneModal(false);
  };

  const handleDeleteMilestone = async (id: string) => {
    const updated = milestones.filter(m => m.id !== id);
    await handleSaveCalendar(updated);
  };

  const handleSaveTopics = async (newList: CurriculumTopic[]) => {
    setTopics(newList);
    await updateConfig({ curriculumTopics: newList });
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    const topic: CurriculumTopic = {
      id: newId('top'),
      code: newTopicCode.trim() || `TOP-${Date.now().toString().slice(-4)}`,
      name: newTopicName.trim(),
      grade: newTopicGrade,
      strand: newTopicStrand,
      standardPeriods: Number(newTopicPeriods),
      term: newTopicTerm,
    };
    const updated = [...topics, topic];
    await handleSaveTopics(updated);
    setNewTopicName('');
    setNewTopicCode('');
    setShowAddTopicModal(false);
  };

  const handleDeleteTopic = async (id: string) => {
    const updated = topics.filter(t => t.id !== id);
    await handleSaveTopics(updated);
  };

  const handleSaveCompetencies = async (newList: MathCompetencyTag[]) => {
    setCompetencies(newList);
    await updateConfig({ competencyTags: newList });
  };

  const handleAddCompetency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim() || !newCompCode.trim()) return;
    const comp: MathCompetencyTag = {
      id: newId('comp'),
      code: newCompCode.trim().toUpperCase(),
      name: newCompName.trim(),
      description: newCompDesc.trim(),
      indicators: newCompIndicators.split(';').map(s => s.trim()).filter(Boolean),
      color: 'blue',
    };
    const updated = [...competencies, comp];
    await handleSaveCompetencies(updated);
    setNewCompCode('');
    setNewCompName('');
    setNewCompDesc('');
    setNewCompIndicators('');
    setShowAddCompModal(false);
  };

  const handleDeleteCompetency = async (id: string) => {
    const updated = competencies.filter(c => c.id !== id);
    await handleSaveCompetencies(updated);
  };

  const handleSaveCriteria = async (newList: ObservationCriterionItem[]) => {
    setCriteria(newList);
    await updateConfig({ observationCriteria: newList });
  };

  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCritName.trim()) return;
    const crit: ObservationCriterionItem = {
      id: newId('crit'),
      code: `TC-${Date.now().toString().slice(-3)}`,
      category: newCritCategory,
      name: newCritName.trim(),
      maxScore: Number(newCritMaxScore),
    };
    const updated = [...criteria, crit];
    await handleSaveCriteria(updated);
    setNewCritName('');
    setShowAddCritModal(false);
  };

  const handleDeleteCriterion = async (id: string) => {
    const updated = criteria.filter(c => c.id !== id);
    await handleSaveCriteria(updated);
  };

  const handleSaveTemplates = async (newList: ExamTemplateStructure[]) => {
    setExamTemplates(newList);
    await updateConfig({ examTemplates: newList });
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    const totalScore = Number(newTemplateMcqPoints) + Number(newTemplateTfPoints) + Number(newTemplateShortPoints);
    const tmpl: ExamTemplateStructure = {
      id: newId('tmpl'),
      name: newTemplateName.trim(),
      durationMinutes: Number(newTemplateDuration),
      totalQuestions: Number(newTemplateMcqCount) + Number(newTemplateTfCount) + Number(newTemplateShortCount),
      totalScore: Number(totalScore.toFixed(1)),
      mcqCount: Number(newTemplateMcqCount),
      mcqPoints: Number(newTemplateMcqPoints),
      trueFalseCount: Number(newTemplateTfCount),
      trueFalsePoints: Number(newTemplateTfPoints),
      shortAnswerCount: Number(newTemplateShortCount),
      shortAnswerPoints: Number(newTemplateShortPoints),
      description: newTemplateDesc.trim(),
    };
    const updated = [...examTemplates, tmpl];
    await handleSaveTemplates(updated);
    setNewTemplateName('');
    setNewTemplateDesc('');
    setShowAddTemplateModal(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    const updated = examTemplates.filter(t => t.id !== id);
    await handleSaveTemplates(updated);
  };

  const handleBackupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setNotification({ message: 'Tệp sao lưu quá lớn (tối đa 20 MB).', type: 'error' });
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const ok = await confirm({
        title: 'Phục hồi dữ liệu từ tệp sao lưu?',
        message: isDemoMode
          ? 'Dữ liệu trong tệp sẽ được nạp vào chế độ DỮ LIỆU MẪU để xem thử (không ảnh hưởng dữ liệu thật).'
          : 'Các bản ghi trong tệp sẽ GHI ĐÈ bản ghi cùng mã trên Firestore. Nên tải bản sao lưu hiện tại trước.',
        confirmText: 'Phục hồi',
        danger: !isDemoMode,
      });
      if (!ok) return;
      await importSystemBackup(parsed);
    } catch (err: any) {
      setNotification({ message: `Lỗi đọc file sao lưu: ${err.message}`, type: 'error' });
    }
  };

  const handleClearAll = async () => {
    const ok = await confirm({
      title: 'XÓA TRẮNG toàn bộ dữ liệu chuyên môn?',
      message: 'Toàn bộ lớp, phân công, kế hoạch, giáo án, biên bản, dự giờ, câu hỏi, đề, tài liệu, báo cáo trên Firestore sẽ bị xóa VĨNH VIỄN. Thành viên, cấu hình và nhật ký được giữ lại. Hãy tải tệp sao lưu trước!',
      confirmText: 'Xóa vĩnh viễn',
      danger: true,
      requireText: 'XOA TRANG',
    });
    if (ok) await clearAllRealData();
  };

  const handleResetSample = async () => {
    const ok = await confirm({
      title: 'Khôi phục dữ liệu mẫu?',
      message: 'Mọi thay đổi bạn đã thử trong chế độ demo sẽ mất. Dữ liệu thật không bị ảnh hưởng.',
      confirmText: 'Khôi phục',
    });
    if (ok) await resetToSampleData();
  };

  const filteredClasses = selectedGradeFilter === 0
    ? classes
    : classes.filter(c => c.grade === selectedGradeFilter);

  const filteredTopics = topics.filter(t => t.grade === selectedTopicGrade);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Cài đặt Hệ thống & Cấu hình Chuyên môn</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
              NĂM HỌC {config.academicYear}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý lớp học, lịch năm học, danh mục GDPT 2018, năng lực toán học, tiêu chí dự giờ CV 5555, cấu trúc đề mẫu 2025 và chuyển năm học mới
          </p>
        </div>

        {/* Quick Transition Button for Leaders */}
        {isLeader && (
          <button
            onClick={() => setShowYearModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
          >
            <Sparkles className="w-4 h-4 text-indigo-200" />
            <span>Chuyển năm học mới</span>
          </button>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        {[
          { id: 'general', label: 'Thông tin chung', icon: Settings },
          { id: 'classes', label: `Lớp & Khối (${classes.length})`, icon: Layers },
          { id: 'calendar', label: `Lịch năm học (${milestones.length})`, icon: Calendar },
          { id: 'topics', label: `Chủ đề GDPT (${topics.length})`, icon: BookOpen },
          { id: 'competencies', label: `Năng lực Toán (${competencies.length})`, icon: Award },
          { id: 'criteria', label: `Tiêu chí dự giờ (${criteria.length})`, icon: FileCheck2 },
          { id: 'exam_structures', label: `Cấu trúc đề mẫu (${examTemplates.length})`, icon: FileSpreadsheet },
          { id: 'roles', label: 'Phân quyền RBAC', icon: Shield },
          { id: 'data', label: 'Dữ liệu & Sao lưu', icon: Database },
          { id: 'audit', label: `Nhật ký (${auditLogs.length})`, icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: General Configuration & Year Transition */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Thông tin đơn vị & Định mức chuyên môn</h2>
                <p className="text-xs text-slate-500">Thiết lập các thông số hoạt động cơ sở của Tổ Toán</p>
              </div>
            </div>

            <form onSubmit={handleSaveGeneralConfig} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tên trường THPT</label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={e => setSchoolName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tên tổ chuyên môn</label>
                  <input
                    type="text"
                    value={departmentName}
                    onChange={e => setDepartmentName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Năm học hiện tại</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={e => setAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Học kỳ hiện tại</label>
                  <select
                    value={currentTerm}
                    onChange={e => setCurrentTerm(e.target.value as 'HK1' | 'HK2')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="HK1">Học kỳ 1 (HK1)</option>
                    <option value="HK2">Học kỳ 2 (HK2)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Định mức số tiết dạy / tuần (chuẩn THPT: 17 tiết)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={35}
                    value={standardPeriods}
                    onChange={e => setStandardPeriods(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Căn cứ Thông tư 28/2009/TT-BGDĐT cho giáo viên THPT công lập.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tổng số tuần thực học trong năm (chuẩn: 35 tuần)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={45}
                    value={weeksCount}
                    onChange={e => setWeeksCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Khung thời gian năm học do Bộ GD&ĐT quy định (HK1: 18 tuần, HK2: 17 tuần).
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu cấu hình hệ thống</span>
                </button>
              </div>
            </form>
          </div>

          {/* New Academic Year Transition Box (Lỗi 20) */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-indigo-900">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
              <h2 className="text-sm font-bold">Chuyển tiếp Năm học Mới</h2>
            </div>
            <p className="text-xs text-indigo-900/80 leading-relaxed">
              Tính năng hỗ trợ kết thúc năm học cũ và bước vào năm học mới theo đúng quy chế quản trị giáo dục:
            </p>
            <ul className="text-xs space-y-2 text-indigo-950">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Sao chép có chọn lọc cấu hình và kế hoạch dạy học tổ sang năm mới ở trạng thái <em>Dự thảo</em>.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Giữ nguyên toàn vẹn</strong> Ngân hàng câu hỏi & Cấu trúc đề mẫu.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Làm mới:</strong> Không mang theo phân công giảng dạy cũ và các biên bản sinh hoạt tổ cũ.</span>
              </li>
            </ul>

            <div className="pt-3 border-t border-indigo-200">
              <button
                onClick={() => setShowYearModal(true)}
                className="w-full py-2 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors"
              >
                <span>Bắt đầu quy trình chuyển năm học</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Class & Grade Management */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Lọc theo khối:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { val: 0, label: 'Tất cả' },
                  { val: 10, label: 'Khối 10' },
                  { val: 11, label: 'Khối 11' },
                  { val: 12, label: 'Khối 12' },
                ].map(f => (
                  <button
                    key={f.val}
                    onClick={() => setSelectedGradeFilter(f.val)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                      selectedGradeFilter === f.val ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {isLeader && (
              <button
                onClick={() => setShowAddClassModal(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm lớp học mới</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredClasses.map(cls => (
              <div key={cls.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-blue-700">{cls.name}</h3>
                    <span className="text-[11px] font-medium text-slate-500">Khối {cls.grade} • {cls.track || 'Cơ bản'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {cls.studentCount} HS
                  </span>
                </div>

                <div className="mt-3 text-xs space-y-1 text-slate-600 border-t border-slate-100 pt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">GV Chủ nhiệm:</span>
                    <span className="font-medium text-slate-800">{cls.homeroomTeacher || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Phòng học:</span>
                    <span className="font-medium text-slate-800">{cls.roomNumber || 'Phòng học chính'}</span>
                  </div>
                </div>

                {isLeader && (
                  <button
                    onClick={() => deleteClass(cls.id)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-rose-600 p-1 rounded-md transition-colors"
                    title="Xóa lớp học"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Academic Calendar & Weeks */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Lịch trình năm học & Các mốc chuyên môn</h2>
              <p className="text-xs text-slate-500">Theo dõi kế hoạch thời gian 35 tuần thực học, các đợt kiểm tra định kỳ và sự kiện trọng tâm</p>
            </div>

            {isLeader && (
              <button
                onClick={() => setShowAddMilestoneModal(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm mốc lịch trình</span>
              </button>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Mốc sự kiện / Kế hoạch</th>
                  <th className="p-3">Học kỳ</th>
                  <th className="p-3">Thời gian bắt đầu</th>
                  <th className="p-3">Thời gian kết thúc</th>
                  <th className="p-3">Ghi chú chuyên môn</th>
                  {isLeader && <th className="p-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {milestones.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{m.title}</span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {m.term}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-600">{m.startDate}</td>
                    <td className="p-3 font-mono text-slate-600">{m.endDate}</td>
                    <td className="p-3 text-slate-600">{m.notes || '—'}</td>
                    {isLeader && (
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteMilestone(m.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Xóa mốc"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Curriculum Topics (GDPT 2018) */}
      {activeTab === 'topics' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Khối chương trình:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {[10, 11, 12].map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedTopicGrade(g)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md ${
                      selectedTopicGrade === g ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Khối {g}
                  </button>
                ))}
              </div>
            </div>

            {isLeader && (
              <button
                onClick={() => {
                  setNewTopicGrade(selectedTopicGrade as any);
                  setShowAddTopicModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm chủ đề GDPT 2018</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTopics.map(t => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2 relative">
                <div className="flex items-start justify-between pr-6">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {t.code}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 mt-1">{t.name}</h3>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1 border-t border-slate-100 pt-2">
                  <div className="flex justify-between">
                    <span>Mạch kiến thức:</span>
                    <span className="font-semibold text-slate-800">{t.strand}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Học kỳ / Định mức:</span>
                    <span className="font-bold text-blue-700">{t.term} • {t.standardPeriods} tiết</span>
                  </div>
                </div>

                {isLeader && (
                  <button
                    onClick={() => handleDeleteTopic(t.id)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-rose-600 p-1"
                    title="Xóa chủ đề"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Mathematical Competency Tags (Thông tư 32/2018) */}
      {activeTab === 'competencies' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">5 Thành phần Năng lực Toán học Cốt lõi (GDPT 2018)</h2>
              <p className="text-xs text-slate-500">Quy định theo Thông tư 32/2018/TT-BGDĐT để gán nhãn câu hỏi và bài dạy</p>
            </div>

            {isLeader && (
              <button
                onClick={() => setShowAddCompModal(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm thẻ thành phần</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {competencies.map(comp => (
              <div key={comp.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 relative">
                <div className="flex items-start justify-between pr-6">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      {comp.code}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 mt-1">{comp.name}</h3>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{comp.description}</p>

                {comp.indicators && comp.indicators.length > 0 && (
                  <div className="border-t border-slate-100 pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Chỉ báo hành vi:
                    </span>
                    <ul className="text-[11px] text-slate-600 space-y-0.5 list-disc list-inside">
                      {comp.indicators.slice(0, 3).map((ind: string, i: number) => (
                        <li key={i} className="truncate">{ind}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {isLeader && (
                  <button
                    onClick={() => handleDeleteCompetency(comp.id)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-rose-600 p-1"
                    title="Xóa năng lực"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Observation Criteria (CV 5555/BGDĐT) */}
      {activeTab === 'criteria' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Bộ tiêu chí Đánh giá Dự giờ & Sinh hoạt chuyên môn</h2>
              <p className="text-xs text-slate-500">Chuẩn hóa theo Công văn số 5555/BGDĐT-GDTrH chia theo 3 nhóm hoạt động</p>
            </div>

            {isLeader && (
              <button
                onClick={() => setShowAddCritModal(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm tiêu chí</span>
              </button>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Mã</th>
                  <th className="p-3">Nhóm tiêu chuẩn (CV 5555)</th>
                  <th className="p-3">Nội dung tiêu chí đánh giá</th>
                  <th className="p-3 text-center">Điểm tối đa</th>
                  {isLeader && <th className="p-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {criteria.map(crit => {
                  const catLabel =
                    crit.category === 'ke_hoach'
                      ? '1. Kế hoạch và tài liệu dạy học'
                      : crit.category === 'hoat_dong_day'
                      ? '2. Tổ chức hoạt động dạy học'
                      : '3. Hoạt động học của học sinh';

                  return (
                    <tr key={crit.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{crit.code}</td>
                      <td className="p-3 font-medium text-slate-600">{catLabel}</td>
                      <td className="p-3 font-medium text-slate-900">{crit.name}</td>
                      <td className="p-3 text-center font-bold text-emerald-700">{(crit.maxScore ?? 2.0).toFixed(1)} đ</td>
                      {isLeader && (
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteCriterion(crit.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Xóa tiêu chí"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: Exam Template Structures (Định dạng mới 2025) */}
      {activeTab === 'exam_structures' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Cấu trúc Ma trận Đề thi Mẫu (Định dạng mới 2025)</h2>
              <p className="text-xs text-slate-500">Cấu trúc chuẩn Bộ GD&ĐT: 12 câu TN nhiều lựa chọn + 4 câu Đúng/Sai + 6 câu Trả lời ngắn</p>
            </div>

            {isLeader && (
              <button
                onClick={() => setShowAddTemplateModal(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm cấu trúc mẫu</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examTemplates.map(tmpl => (
              <div key={tmpl.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 relative hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between pr-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{tmpl.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{tmpl.description || 'Định dạng chuẩn GDPT 2018'}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {tmpl.durationMinutes} phút
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                  <div>
                    <span className="block text-[11px] text-slate-500">Phần I (Nhiều LC)</span>
                    <span className="text-xs font-bold text-slate-900">{tmpl.mcqCount ?? 12} câu</span>
                    <span className="block text-[10px] text-blue-700 font-semibold">({(tmpl.mcqPoints ?? 3.0).toFixed(1)} đ)</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-500">Phần II (Đúng/Sai)</span>
                    <span className="text-xs font-bold text-slate-900">{tmpl.trueFalseCount ?? 4} câu</span>
                    <span className="block text-[10px] text-blue-700 font-semibold">({(tmpl.trueFalsePoints ?? 4.0).toFixed(1)} đ)</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-500">Phần III (Ngắn)</span>
                    <span className="text-xs font-bold text-slate-900">{tmpl.shortAnswerCount ?? 6} câu</span>
                    <span className="block text-[10px] text-blue-700 font-semibold">({(tmpl.shortAnswerPoints ?? 3.0).toFixed(1)} đ)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
                  <span>Tổng số câu: <strong>{tmpl.totalQuestions ?? 22} câu</strong></span>
                  <span className="text-emerald-700 font-bold">Thang điểm: {(tmpl.totalScore ?? tmpl.totalPoints ?? 10.0).toFixed(1)} điểm</span>
                </div>

                {isLeader && (
                  <button
                    onClick={() => handleDeleteTemplate(tmpl.id)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-rose-600 p-1"
                    title="Xóa mẫu đề"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: RBAC Matrix */}
      {activeTab === 'roles' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Bảng phân quyền tham khảo theo quy chế hoạt động tổ chuyên môn (RBAC)</h2>
            <p className="text-xs text-slate-500 mt-1">
              Khung phân quyền khuyến nghị dựa trên Điều lệ trường trung học và quy chế hoạt động tổ chuyên môn.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Lưu ý đối chiếu văn bản pháp quy & Quy chế nhà trường:</p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Bảng phân quyền và các quy tắc thẩm quyền chuyên môn dưới đây là <strong>biểu mẫu và tham số gợi ý mặc định</strong> của phần mềm. Tổ chuyên môn và nhà trường cần chủ động đối chiếu các văn bản chỉ đạo hiện hành của Bộ GD&ĐT, Sở GD&ĐT và Quy chế làm việc nội bộ của trường trước khi phân quyền áp dụng thực tế.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Tính năng / Quyền hạn</th>
                  <th className="p-3 text-center">Tổ trưởng (Head)</th>
                  <th className="p-3 text-center">Tổ phó (Deputy)</th>
                  <th className="p-3 text-center">Giáo viên (Teacher)</th>
                  <th className="p-3 text-center">Ban Giám hiệu (Principal)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                <tr>
                  <td className="p-3 font-medium">Phân công chuyên môn & Lập KH dạy học</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Toàn quyền</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Toàn quyền</td>
                  <td className="p-3 text-center text-slate-400">Chỉ xem</td>
                  <td className="p-3 text-center text-blue-700 font-bold">Phê duyệt</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">Phê duyệt Kế hoạch bài dạy (Giáo án)</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Duyệt chính</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Duyệt chính</td>
                  <td className="p-3 text-center text-slate-400">Chỉ soạn & nộp</td>
                  <td className="p-3 text-center text-blue-700 font-bold">Kiểm tra</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">Chốt & Khóa biên bản sinh hoạt chuyên môn</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Có quyền</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Có quyền</td>
                  <td className="p-3 text-center text-slate-400">Chỉ thảo luận</td>
                  <td className="p-3 text-center text-slate-400">Xem</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">Xem đề kiểm tra chưa công bố (Bảo mật)</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Có quyền</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Có quyền</td>
                  <td className="p-3 text-center text-slate-400">Chỉ xem nếu là tác giả/phản biện</td>
                  <td className="p-3 text-center text-slate-400">Chỉ xem khi đã công bố</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium">Xem bảng đối sánh chất lượng theo Giáo viên</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Có quyền</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Có quyền</td>
                  <td className="p-3 text-center text-rose-600 font-semibold">Bị ẩn bảo mật</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">Toàn quyền xem</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Switch Role Simulator – chỉ có ở chế độ demo (bản cũ cho mạo danh cả ở dữ liệu thật) */}
          {canSimulateRoles && <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800">Mô phỏng vai trò làm việc: </span>
              <span className="text-xs text-slate-500">
                Bạn đang đóng vai <strong>{activeMember.displayName}</strong> ({activeMember.role.toUpperCase()})
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {allMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveMember(m);
                    setNotification({ message: `Đã chuyển sang tài khoản: ${m.displayName} (${m.role})`, type: 'info' });
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium border ${
                    m.id === activeMember.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {m.displayName.split(' ').slice(-2).join(' ')} ({m.role})
                </button>
              ))}
            </div>
          </div>}
        </div>
      )}

      {/* TAB 9: Data & Backups */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <StoragePanel />
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>Quản lý chế độ Dữ liệu thử nghiệm (Demo Mode)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cách ly hoàn toàn dữ liệu thử nghiệm (6 giáo viên, 5 lớp, 30 câu hỏi) khỏi cơ sở dữ liệu thật của trường
                </p>
              </div>

              <button
                onClick={toggleDemoMode}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  isDemoMode
                    ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                }`}
              >
                {isDemoMode ? 'ĐANG BẬT DEMO (Dữ liệu mẫu)' : 'ĐANG DÙNG FIRESTORE THẬT'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleResetSample}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Khôi phục dữ liệu mẫu gốc</span>
              </button>

              {permissions.isAdmin && !isDemoMode && <button
                onClick={handleClearAll}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa trắng để đưa vào sử dụng thật</span>
              </button>}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Sao lưu & Phục hồi toàn bộ hệ thống (JSON Backup)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Xuất tất cả dữ liệu ra tệp JSON dự phòng để lưu trữ an toàn hoặc chuyển giao hệ thống
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={exportSystemBackup}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Tải tệp sao lưu JSON</span>
              </button>

              {(isLeader || isDemoMode) && (
              <label className={`px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 flex items-center gap-1.5 cursor-pointer ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload className="w-4 h-4 text-blue-600" />
                <span>{isLoading ? 'Đang phục hồi...' : 'Phục hồi từ tệp JSON'}</span>
                <input type="file" accept=".json,application/json" onChange={handleBackupUpload} className="hidden" />
              </label>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <span>Nhật ký hoạt động hệ thống (Audit Trail)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ghi nhận minh bạch mọi thao tác thêm, sửa, xóa, duyệt và xuất báo cáo kèm mốc thời gian
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 font-semibold text-slate-700">
                <tr>
                  <th className="p-2.5">Thời gian</th>
                  <th className="p-2.5">Người thực hiện</th>
                  <th className="p-2.5">Hành động</th>
                  <th className="p-2.5">Phân hệ</th>
                  <th className="p-2.5">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-2.5 text-slate-500">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="p-2.5 font-bold text-slate-900">{log.actorName || (log as any).userName}</td>
                    <td className="p-2.5 uppercase font-semibold text-blue-700">{log.action}</td>
                    <td className="p-2.5 text-slate-600">{log.targetType || (log as any).entityType}</td>
                    <td className="p-2.5 text-slate-700 font-sans">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Transition to New Academic Year (Lỗi 20) */}
      {showYearModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-700">
                <Sparkles className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Khởi tạo & Chuyển Năm học Mới</h3>
              </div>
              <button
                onClick={() => setShowYearModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn đang thực hiện chuyển đổi hệ thống sang một chu kỳ năm học mới. Vui lòng thiết lập tên năm học và các tùy chọn sao chép dữ liệu có chọn lọc:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên năm học mới</label>
                <input
                  type="text"
                  value={nextYearInput}
                  onChange={e => setNextYearInput(e.target.value)}
                  placeholder="Ví dụ: 2027-2028"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <span className="text-xs font-bold text-slate-800 block">Tùy chọn sao chép có chọn lọc:</span>

                <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={copyConfigOption}
                    onChange={e => setCopyConfigOption(e.target.checked)}
                    className="rounded text-indigo-600 mt-0.5"
                  />
                  <span>Bảo lưu danh mục chủ đề GDPT 2018, bộ tiêu chí dự giờ CV 5555 và cấu trúc đề mẫu</span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={copyPlansOption}
                    onChange={e => setCopyPlansOption(e.target.checked)}
                    className="rounded text-indigo-600 mt-0.5"
                  />
                  <span>Sao chép khung kế hoạch tổ (phân phối chương trình) sang năm học mới ở trạng thái <em>Dự thảo (Draft v1)</em></span>
                </label>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Cam kết bảo toàn dữ liệu tài sản số:</span>
                </div>
                <p>• <strong>Ngân hàng câu hỏi:</strong> Được giữ nguyên toàn bộ 100% để tiếp tục tái sử dụng và kiểm định chất lượng.</p>
                <p>• <strong>Làm mới chuyên môn:</strong> Bảng phân công giảng dạy cũ và các biên bản họp cũ sẽ không mang theo sang năm học mới.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowYearModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteYearTransition}
                disabled={isTransitioning}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isTransitioning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang thiết lập...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Xác nhận chuyển năm học</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Class */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900">Thêm lớp học mới</h3>
              <button onClick={() => setShowAddClassModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên lớp học</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 10A3, 11B2..."
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={newClassGrade}
                    onChange={e => setNewClassGrade(Number(e.target.value) as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={10}>Khối 10</option>
                    <option value={11}>Khối 11</option>
                    <option value={12}>Khối 12</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Định hướng ban</label>
                  <select
                    value={newClassTrack}
                    onChange={e => setNewClassTrack(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="KHTN">KHTN (Tự nhiên)</option>
                    <option value="KHXH">KHXH (Xã hội)</option>
                    <option value="Cơ bản">Cơ bản</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sĩ số học sinh</label>
                  <input
                    type="number"
                    min={15}
                    max={55}
                    value={newClassStudents}
                    onChange={e => setNewClassStudents(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phòng học</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: P.204"
                    value={newClassRoom}
                    onChange={e => setNewClassRoom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Giáo viên chủ nhiệm</label>
                <input
                  type="text"
                  placeholder="Họ tên GVCN"
                  value={newClassHomeroom}
                  onChange={e => setNewClassHomeroom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Thêm lớp học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Calendar Milestone */}
      {showAddMilestoneModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900">Thêm mốc lịch trình năm học</h3>
              <button onClick={() => setShowAddMilestoneModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên mốc sự kiện / Kế hoạch</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Kiểm tra giữa học kỳ 1, Nghỉ Tết..."
                  value={newMilestoneName}
                  onChange={e => setNewMilestoneName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Áp dụng học kỳ</label>
                <select
                  value={newMilestoneTerm}
                  onChange={e => setNewMilestoneTerm(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="HK1">Học kỳ 1 (HK1)</option>
                  <option value="HK2">Học kỳ 2 (HK2)</option>
                  <option value="CaNam">Cả năm học</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={newMilestoneStart}
                    onChange={e => setNewMilestoneStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày kết thúc</label>
                  <input
                    type="date"
                    value={newMilestoneEnd}
                    onChange={e => setNewMilestoneEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú chuyên môn</label>
                <textarea
                  rows={2}
                  placeholder="Lưu ý về kế hoạch ra đề, nộp giáo án..."
                  value={newMilestoneNotes}
                  onChange={e => setNewMilestoneNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMilestoneModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Thêm mốc lịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Curriculum Topic */}
      {showAddTopicModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900">Thêm chủ đề GDPT 2018</h3>
              <button onClick={() => setShowAddTopicModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTopic} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã chủ đề</label>
                  <input
                    type="text"
                    placeholder="VD: CDE-12-01"
                    value={newTopicCode}
                    onChange={e => setNewTopicCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối</label>
                  <select
                    value={newTopicGrade}
                    onChange={e => setNewTopicGrade(Number(e.target.value) as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={10}>Khối 10</option>
                    <option value={11}>Khối 11</option>
                    <option value={12}>Khối 12</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Học kỳ</label>
                  <select
                    value={newTopicTerm}
                    onChange={e => setNewTopicTerm(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="HK1">HK1</option>
                    <option value="HK2">HK2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên chủ đề bài học</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Ứng dụng đạo hàm để khảo sát hàm số..."
                  value={newTopicName}
                  onChange={e => setNewTopicName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mạch kiến thức</label>
                  <select
                    value={newTopicStrand}
                    onChange={e => setNewTopicStrand(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Đại số & Giải tích">Đại số & Giải tích</option>
                    <option value="Hình học & Đo lường">Hình học & Đo lường</option>
                    <option value="Thống kê & Xác suất">Thống kê & Xác suất</option>
                    <option value="Hoạt động trải nghiệm">Hoạt động trải nghiệm</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số tiết chuẩn</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={newTopicPeriods}
                    onChange={e => setNewTopicPeriods(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTopicModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Thêm chủ đề
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Competency */}
      {showAddCompModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900">Thêm thẻ năng lực toán học</h3>
              <button onClick={() => setShowAddCompModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCompetency} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã viết tắt</label>
                  <input
                    type="text"
                    placeholder="VD: NLTDD"
                    value={newCompCode}
                    onChange={e => setNewCompCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Tên năng lực thành phần</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Năng lực tư duy và lập luận toán học"
                    value={newCompName}
                    onChange={e => setNewCompName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mô tả đặc trưng</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả tóm tắt theo Thông tư 32/2018..."
                  value={newCompDesc}
                  onChange={e => setNewCompDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Các chỉ báo hành vi (cách nhau dấu chấm phẩy ;)</label>
                <textarea
                  rows={2}
                  placeholder="Chỉ báo 1; Chỉ báo 2; Chỉ báo 3..."
                  value={newCompIndicators}
                  onChange={e => setNewCompIndicators(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCompModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Thêm năng lực
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Observation Criterion */}
      {showAddCritModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900">Thêm tiêu chí dự giờ CV 5555</h3>
              <button onClick={() => setShowAddCritModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCriterion} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nhóm tiêu chuẩn</label>
                <select
                  value={newCritCategory}
                  onChange={e => setNewCritCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ke_hoach">1. Kế hoạch và tài liệu dạy học</option>
                  <option value="hoat_dong_day">2. Tổ chức hoạt động dạy học</option>
                  <option value="hoat_dong_hoc">3. Hoạt động học của học sinh</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nội dung tiêu chí</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả tiêu chí đánh giá..."
                  value={newCritName}
                  onChange={e => setNewCritName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Điểm tối đa</label>
                <input
                  type="number"
                  step={0.5}
                  min={1}
                  max={5}
                  value={newCritMaxScore}
                  onChange={e => setNewCritMaxScore(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCritModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Thêm tiêu chí
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Exam Template Structure */}
      {showAddTemplateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900">Thêm cấu trúc đề thi mẫu</h3>
              <button onClick={() => setShowAddTemplateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTemplate} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Tên cấu trúc đề</label>
                  <input
                    type="text"
                    placeholder="VD: Đề kiểm tra 45 phút Khối 12"
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thời gian (phút)</label>
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={newTemplateDuration}
                    onChange={e => setNewTemplateDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phần I: Số câu Nhiều LC</label>
                    <input
                      type="number"
                      min={0}
                      value={newTemplateMcqCount}
                      onChange={e => setNewTemplateMcqCount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Điểm Phần I</label>
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      value={newTemplateMcqPoints}
                      onChange={e => setNewTemplateMcqPoints(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phần II: Số câu Đúng/Sai</label>
                    <input
                      type="number"
                      min={0}
                      value={newTemplateTfCount}
                      onChange={e => setNewTemplateTfCount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Điểm Phần II</label>
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      value={newTemplateTfPoints}
                      onChange={e => setNewTemplateTfPoints(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phần III: Số câu Trả lời ngắn</label>
                    <input
                      type="number"
                      min={0}
                      value={newTemplateShortCount}
                      onChange={e => setNewTemplateShortCount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Điểm Phần III</label>
                    <input
                      type="number"
                      step={0.25}
                      min={0}
                      value={newTemplateShortPoints}
                      onChange={e => setNewTemplateShortPoints(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mô tả mục tiêu</label>
                <input
                  type="text"
                  placeholder="Định dạng trắc nghiệm theo Thông tư 22/2021..."
                  value={newTemplateDesc}
                  onChange={e => setNewTemplateDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTemplateModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Lưu cấu trúc đề mẫu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
