import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ActiveModule } from '../Sidebar';
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  Gauge,
  ListChecks,
  PlusCircle,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { buildWorkCenter, todayIso } from '../../utils/management';
import { STATUS_TEXT, TERM_TEXT, teacherStandards } from '../../utils/standards';
import { pushRoute } from '../../utils/deepLink';
import { openMonthlyReport } from '../../report/navigation';

interface OverviewModuleProps {
  onNavigate: (module: ActiveModule) => void;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Đã dạy', cls: 'bg-emerald-100 text-emerald-800' },
  in_progress: { label: 'Đang dạy', cls: 'bg-amber-100 text-amber-800' },
  planned: { label: 'Theo kế hoạch', cls: 'bg-slate-100 text-slate-700' },
  delayed: { label: 'Chậm tiến độ', cls: 'bg-rose-100 text-rose-800' },
  make_up: { label: 'Dạy bù', cls: 'bg-violet-100 text-violet-800' },
};

const TASK_STATUS_LABEL: Record<string, string> = {
  pending: 'Chưa thực hiện',
  in_progress: 'Đang thực hiện',
  submitted: 'Chờ duyệt',
  returned: 'Cần bổ sung',
  completed: 'Hoàn thành',
};

const TASK_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-800',
  returned: 'bg-rose-100 text-rose-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

function shortDate(value?: string) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

export const OverviewModule: React.FC<OverviewModuleProps> = ({ onNavigate }) => {
  const openRoute = (module: ActiveModule, options?: { id?: string; filter?: string; memberId?: string; taskId?: string }) => {
    pushRoute(module, options?.id);
    const params = new URLSearchParams();
    if (options?.filter) params.set('filter', options.filter);
    if (options?.memberId) params.set('member', options.memberId);
    if (options?.taskId) params.set('task', options.taskId);
    const query = params.toString();
    if (query) window.history.replaceState({}, '', `${window.location.pathname}?${query}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const openOperations = (filter: 'all' | 'open' | 'overdue' | 'submitted' | 'completed', memberId?: string, taskId?: string) =>
    openRoute('operations', { filter, memberId, taskId });

  const openTeacher360 = (memberId: string) => openRoute('teacher-360', { id: memberId });

  const {
    isMe,
    activeMember,
    isDemoMode,
    isSimulatingMember,
    config,
    allMembers,
    classes,
    departmentPlans,
    lessonPlans,
    teacherPlans,
    meetings,
    workTasks,
    observations,
    trainings,
    permissions,
  } = useApp();

  const isLeaderView = permissions.isLeader;
  const today = todayIso();
  const activeTeachers = useMemo(
    () => allMembers.filter(m => m.status === 'active' && ['teacher', 'head', 'deputy', 'admin'].includes(m.role)),
    [allMembers],
  );

  const visibleTasks = useMemo(
    () => workTasks.filter(t => t.academicYear === config.academicYear && (isLeaderView || isMe(t.assigneeId))),
    [workTasks, config.academicYear, isLeaderView, isMe],
  );
  const openTasks = visibleTasks.filter(t => t.status !== 'completed');
  const overdueTasks = openTasks.filter(t => t.status !== 'submitted' && !!t.deadline && t.deadline < today);
  const dueSoonTasks = openTasks.filter(t => {
    if (!t.deadline || t.deadline < today) return false;
    const diff = (Date.parse(t.deadline) - Date.parse(today)) / 86400000;
    return diff <= 7;
  });
  const submittedTasks = visibleTasks.filter(t => t.status === 'submitted');
  const completedTasks = visibleTasks.filter(t => t.status === 'completed');
  const returnedTasks = visibleTasks.filter(t => t.status === 'returned');
  const completionRate = visibleTasks.length ? Math.round((completedTasks.length / visibleTasks.length) * 100) : 0;

  const pendingLessonPlans = lessonPlans.filter(p => p.status === 'submitted');
  const myObservations = observations.filter(o => isMe(o.observerId) || isMe(o.teacherId));
  const workItems = buildWorkCenter({
    departmentPlans,
    teacherPlans,
    lessonPlans,
    meetings,
    workTasks,
    isLeader: permissions.isLeader,
    activeMember,
    isMe,
    members: allMembers,
    academicYear: config.academicYear,
    canApproveDeptPlan: permissions.canApproveDeptPlan,
  });
  const overdueCount = workItems.filter(w => w.priority === 'overdue').length;
  const soonCount = workItems.filter(w => w.priority === 'today' || w.priority === 'soon').length;

  const teacherRows = useMemo(() => {
    if (!isLeaderView) return [];
    return activeTeachers.map(member => {
      const tasks = workTasks.filter(t => t.academicYear === config.academicYear && t.assigneeId === member.id);
      const open = tasks.filter(t => t.status !== 'completed').length;
      const completed = tasks.filter(t => t.status === 'completed').length;
      const overdue = tasks.filter(t => !['completed', 'submitted'].includes(t.status) && !!t.deadline && t.deadline < today).length;
      const waiting = tasks.filter(t => t.status === 'submitted').length;
      const kpi = teacherStandards(
        member,
        { teacherPlans, lessonPlans, observations, meetings, trainings, workTasks, members: allMembers },
        config,
        config.currentTerm || 'HK1',
        today,
      );
      return { member, tasks: tasks.length, open, completed, overdue, waiting, kpi };
    });
  }, [isLeaderView, activeTeachers, workTasks, config.academicYear, config, teacherPlans, lessonPlans, observations, meetings, trainings, allMembers, today]);

  const termLabel = TERM_TEXT[config.currentTerm || 'HK1'];
  const teachersMet = teacherRows.filter(r => r.kpi.overall === 'dat').length;
  const teachersFailed = teacherRows.filter(r => r.kpi.overall === 'chua_dat').length;
  const myStandards = isLeaderView ? null : teacherStandards(activeMember, { teacherPlans, lessonPlans, observations, meetings, trainings, workTasks, members: allMembers }, config, config.currentTerm || 'HK1', today);
  const teachersNeedAttention = teacherRows.filter(r => r.overdue > 0 || r.waiting > 0 || r.kpi.failed > 0).length;

  const futureMeetings = meetings.filter(m => (m.date || '') >= today).sort((a, b) => a.date.localeCompare(b.date));
  const upcomingMeetings = (futureMeetings.length
    ? futureMeetings
    : [...meetings].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  ).slice(0, 2);

  const start = new Date(config.startDate || `${config.academicYear.slice(0, 4)}-09-05`);
  const weeksTotal = config.weeksCount || 35;
  const rawWeek = Math.floor((Date.now() - start.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  const currentWeek = Number.isFinite(rawWeek) ? Math.min(Math.max(rawWeek, 1), weeksTotal) : 1;
  const weekRows = ([12, 11, 10] as const).flatMap(grade => {
    const plans = departmentPlans.filter(p => p.grade === grade);
    const plan = plans.find(p => p.academicYear === config.academicYear) || plans[0];
    return (plan?.distribution || []).filter(it => Number(it.week) === currentWeek).map(item => ({ grade, item }));
  });

  const priorityTasks = [...visibleTasks]
    .filter(t => t.status !== 'completed')
    .sort((a, b) => {
      const aOver = a.deadline && a.deadline < today ? 0 : 1;
      const bOver = b.deadline && b.deadline < today ? 0 : 1;
      return aOver - bOver || (a.deadline || '9999-12-31').localeCompare(b.deadline || '9999-12-31');
    })
    .slice(0, 6);

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-sm flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
              {isLeaderView ? 'Trung tâm điều hành Tổ Toán' : `Bàn điều hành của ${activeMember.displayName}`}
            </h1>
            {isDemoMode && <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 border border-amber-300">Chế độ trải nghiệm</span>}
            {isSimulatingMember && <span className="px-2 py-0.5 text-xs font-semibold rounded bg-violet-100 text-violet-800 border border-violet-300">Đang giả lập giáo viên</span>}
          </div>
          <p className="text-sm text-slate-600 mt-1.5">
            {config.departmentName} • Năm học {config.academicYear} ({config.currentTerm}) • Tuần {currentWeek}
          </p>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            {isLeaderView
              ? 'Theo dõi công việc, hồ sơ, minh chứng, cảnh báo và chỉ số tiến độ toàn tổ trên một màn hình.'
              : 'Theo dõi việc được giao, hồ sơ cần hoàn thiện và minh chứng của chính bạn.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isLeaderView && (
            <button onClick={() => onNavigate('operations')} className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5" /> Giao việc mới
            </button>
          )}
          <button onClick={() => onNavigate('lesson-plans')} className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Kế hoạch bài dạy
          </button>
          <button onClick={() => onNavigate('teacher-360')} className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-200 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-violet-600" /> Hồ sơ 360° & KPI
          </button>
          <button onClick={() => openMonthlyReport({ memberId: activeMember.id })} className="px-3 py-2 text-xs font-semibold bg-white hover:bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Báo cáo tháng
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <button onClick={() => openOperations('open')} className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-blue-300 hover:shadow-sm transition" title="Mở danh sách công việc đang mở">
          <div className="flex justify-between items-start"><span className="text-[11px] font-semibold text-slate-500">Công việc đang mở</span><ListChecks className="w-4 h-4 text-blue-600" /></div>
          <div className="text-4xl font-black text-slate-900 mt-2">{openTasks.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">/{visibleTasks.length} công việc trong năm học</div>
        </button>
        <button onClick={() => openOperations('overdue')} className={`border rounded-2xl p-5 text-left transition hover:shadow-sm ${overdueTasks.length ? 'bg-rose-50 border-rose-200 hover:border-rose-400' : 'bg-white border-slate-200 hover:border-emerald-300'}`} title="Mở danh sách công việc quá hạn">
          <div className="flex justify-between items-start"><span className="text-[11px] font-semibold text-slate-500">Quá hạn</span><BellRing className={`w-4 h-4 ${overdueTasks.length ? 'text-rose-600' : 'text-emerald-600'}`} /></div>
          <div className={`text-4xl font-black mt-2 ${overdueTasks.length ? 'text-rose-700' : 'text-slate-900'}`}>{overdueTasks.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">{dueSoonTasks.length} việc đến hạn trong 7 ngày</div>
        </button>
        <button onClick={() => openOperations('submitted')} className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-amber-300 hover:shadow-sm transition" title="Mở danh sách chờ duyệt minh chứng">
          <div className="flex justify-between items-start"><span className="text-[11px] font-semibold text-slate-500">Chờ duyệt minh chứng</span><ClipboardCheck className="w-4 h-4 text-amber-600" /></div>
          <div className="text-4xl font-black text-slate-900 mt-2">{submittedTasks.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">{returnedTasks.length} việc cần bổ sung</div>
        </button>
        <button onClick={() => openOperations('completed')} className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-emerald-300 hover:shadow-sm transition" title="Mở danh sách công việc hoàn thành">
          <div className="flex justify-between items-start"><span className="text-[11px] font-semibold text-slate-500">Hoàn thành</span><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          <div className="text-4xl font-black text-slate-900 mt-2">{completedTasks.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">Tỷ lệ {completionRate}%</div>
        </button>
        <button onClick={() => onNavigate('teacher-360')} className="sm:col-span-2 xl:col-span-1 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl p-5 text-left hover:opacity-95 hover:shadow-md transition">
          <div className="flex justify-between items-start"><span className="text-[11px] font-semibold text-indigo-100">Định mức {termLabel}</span><TrendingUp className="w-4 h-4 text-white" /></div>
          <div className="text-4xl font-black mt-2">{isLeaderView ? `${teachersMet}/${teacherRows.length}` : (myStandards?.counted ? `${myStandards.met}/${myStandards.counted}` : '—')}</div>
          <div className="text-[10px] text-indigo-100 mt-1">{isLeaderView ? `giáo viên đạt đủ${teachersFailed ? ` · ${teachersFailed} GV có nhóm chưa đạt` : ''}` : (myStandards?.counted ? `nhóm đã đạt · ${STATUS_TEXT[myStandards.overall]}` : 'Tổ chưa đặt định mức')}</div>
        </button>
      </div>

      {isLeaderView && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" />Bảng điều hành giáo viên</h2>
                <p className="text-xs lg:text-sm text-slate-500 mt-1">Không xếp hạng nhân sự; chỉ tổng hợp tiến độ hồ sơ và công việc có minh chứng.</p>
              </div>
              <button onClick={() => onNavigate('teacher-360')} className="text-xs font-semibold text-blue-600 hover:underline">Mở Hồ sơ 360° <ArrowRight className="inline w-3 h-3" /></button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full table-fixed text-xs lg:text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left p-3 lg:p-4 w-[24%]">Giáo viên</th>
                    <th className="text-center p-2 lg:p-4 w-[10%]">Đang mở</th>
                    <th className="text-center p-2 lg:p-4 w-[10%]">Quá hạn</th>
                    <th className="text-center p-2 lg:p-4 w-[11%]">Chờ duyệt</th>
                    <th className="text-center p-2 lg:p-4 w-[11%]">Hoàn thành</th>
                    <th className="text-left p-3 lg:p-4 w-[34%]">Định mức {termLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {teacherRows.map(({ member, open, overdue, waiting, completed, kpi }) => (
                    <tr key={member.id} className="hover:bg-slate-50">
                      <td className="p-3 lg:p-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <button onClick={() => openTeacher360(member.id)} className="text-left group min-w-0 flex-1" title={`Mở Hồ sơ 360° của ${member.displayName}`}>
                            <div className="font-bold text-slate-800 truncate group-hover:text-blue-700 group-hover:underline">{member.displayName}</div>
                            <div className="text-[10px] lg:text-xs text-slate-500 truncate">{member.subject || 'Toán'}</div>
                          </button>
                          <button onClick={() => openMonthlyReport({ memberId: member.id })} className="text-[10px] font-semibold text-indigo-600 hover:underline shrink-0" title={`Mở báo cáo tháng của ${member.displayName}`}>Báo cáo</button>
                        </div>
                      </td>
                      <td className="p-2 lg:p-4 text-center"><button onClick={() => openOperations('open', member.id)} className="font-bold text-slate-800 min-w-8 h-8 rounded-lg hover:bg-blue-50 hover:text-blue-700" title={`Xem việc đang mở của ${member.displayName}`}>{open}</button></td>
                      <td className="p-2 lg:p-4 text-center"><button onClick={() => openOperations('overdue', member.id)} className={overdue ? 'inline-flex min-w-8 h-8 items-center justify-center rounded-full bg-rose-100 font-black text-rose-700 hover:bg-rose-200' : 'min-w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100'} title={`Xem việc quá hạn của ${member.displayName}`}>{overdue}</button></td>
                      <td className="p-2 lg:p-4 text-center"><button onClick={() => openOperations('submitted', member.id)} className={waiting ? 'inline-flex min-w-8 h-8 items-center justify-center rounded-full bg-amber-100 font-black text-amber-700 hover:bg-amber-200' : 'min-w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100'} title={`Xem việc chờ duyệt của ${member.displayName}`}>{waiting}</button></td>
                      <td className="p-2 lg:p-4 text-center"><button onClick={() => openOperations('completed', member.id)} className="min-w-8 h-8 rounded-lg text-emerald-700 font-bold hover:bg-emerald-50" title={`Xem việc hoàn thành của ${member.displayName}`}>{completed}</button></td>
                      <td className="p-3 lg:p-4">
                        <button onClick={() => openTeacher360(member.id)} className="w-full text-left group" title={`Mở Hồ sơ 360° của ${member.displayName}`}>
                          <div className="flex items-center gap-1.5">
                            {kpi.groups.map(g => <span key={g.key} title={`${g.label}: ${STATUS_TEXT[g.status]} (${g.detail})`} className={`h-2.5 flex-1 rounded-full ${g.status === 'dat' ? 'bg-emerald-500' : g.status === 'chua_dat' ? 'bg-rose-500' : g.status === 'chua_den_han' ? 'bg-amber-300' : 'bg-slate-200'}`} />)}
                            <span className="font-bold text-slate-700 w-10 text-right group-hover:text-blue-700">{kpi.counted ? `${kpi.met}/${kpi.counted}` : '—'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 group-hover:text-blue-600">{kpi.failed ? `${kpi.failed} nhóm chưa đạt` : kpi.pending ? `${kpi.pending} nhóm chưa đến hạn` : kpi.counted ? 'Đạt đủ định mức' : 'Tổ chưa đặt định mức'}</div>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => openOperations(overdueTasks.length ? 'overdue' : submittedTasks.length ? 'submitted' : 'open')} className={`border rounded-2xl p-5 text-left ${teachersNeedAttention ? 'bg-amber-50 border-amber-200 hover:border-amber-400' : 'bg-emerald-50 border-emerald-200 hover:border-emerald-400'}`} title="Mở danh sách cần xử lý">
              <div className="flex items-center gap-2"><ShieldCheck className={`w-5 h-5 ${teachersNeedAttention ? 'text-amber-600' : 'text-emerald-600'}`} /><span className="text-xs font-bold">Tình trạng toàn tổ</span></div>
              <div className="text-4xl font-black mt-2">{teachersNeedAttention}</div>
              <div className="text-[11px] text-slate-600">giáo viên có việc quá hạn/chờ duyệt hoặc có nhóm định mức chưa đạt</div>
            </button>
            <button onClick={() => openOperations(overdueTasks.length ? 'overdue' : submittedTasks.length ? 'submitted' : 'open')} className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-5 text-left shadow-sm">
              <Clock3 className="w-5 h-5" /><div className="text-sm font-bold mt-2">Xử lý công việc tồn</div><div className="text-[11px] text-slate-300 mt-1">{overdueTasks.length} quá hạn · {submittedTasks.length} chờ duyệt · {returnedTasks.length} cần bổ sung.</div>
            </button>
            <button onClick={() => onNavigate('reports')} className="w-full bg-white hover:border-blue-300 border border-slate-200 rounded-2xl p-5 text-left shadow-sm">
              <FileCheck2 className="w-5 h-5 text-blue-600" /><div className="text-sm font-bold mt-2 text-slate-800">Báo cáo & In</div><div className="text-[11px] text-slate-500 mt-1">Tổng hợp dữ liệu tháng, học kỳ và xuất báo cáo.</div>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div><h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><ListChecks className="w-4 h-4 text-blue-600" />Việc cần xử lý</h2><p className="text-[11px] text-slate-500 mt-1">Gộp hồ sơ chờ duyệt, hồ sơ bị trả lại và nhiệm vụ chuyên môn chưa hoàn thành.</p></div>
            <div className="flex items-center gap-2 text-[10px]"><span className="px-2 py-1 rounded bg-rose-50 text-rose-700 font-bold">{overdueCount} quá hạn</span><span className="px-2 py-1 rounded bg-amber-50 text-amber-700 font-bold">{soonCount} cần sớm</span></div>
          </div>
          {workItems.length === 0 ? <div className="text-xs text-slate-500 py-8 text-center border border-dashed rounded-lg">Không có công việc tồn đọng theo dữ liệu hiện tại.</div> : <div className="space-y-2 max-h-80 overflow-auto pr-1">{workItems.slice(0, 12).map(w => <button key={w.id} onClick={() => w.module === 'operations' && w.id.startsWith('work-') ? openOperations(w.priority === 'overdue' ? 'overdue' : 'open', undefined, w.id.slice(5)) : onNavigate(w.module)} className="w-full text-left border rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 transition flex items-start gap-3"><span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${w.priority === 'overdue' ? 'bg-rose-500' : w.priority === 'today' ? 'bg-amber-500' : w.priority === 'soon' ? 'bg-yellow-400' : 'bg-slate-300'}`} /><span className="flex-1 min-w-0"><span className="text-xs font-bold text-slate-800 block">{w.title}</span><span className="text-[11px] text-slate-500 block truncate">{w.detail}</span></span><span className="text-[10px] font-semibold text-slate-500 shrink-0">{w.deadline ? shortDate(w.deadline) : 'Xử lý'}</span></button>)}</div>}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Clock3 className="w-4 h-4 text-violet-600" />Deadline gần nhất</h2><button onClick={() => openOperations('open')} className="text-[11px] font-semibold text-blue-600 hover:underline">Xem tất cả</button></div>
          {priorityTasks.length === 0 ? <div className="text-xs text-slate-500 py-8 text-center border border-dashed rounded-lg">Không có deadline đang mở.</div> : <div className="space-y-3">{priorityTasks.map(task => {
            const isOverdue = !!task.deadline && task.deadline < today;
            return <button key={task.id} onClick={() => openOperations(task.status === 'submitted' ? 'submitted' : isOverdue ? 'overdue' : 'open', task.assigneeId, task.id)} className="w-full text-left border-b last:border-0 pb-3 last:pb-0 rounded-lg hover:bg-slate-50 px-1 transition" title="Mở đúng công việc này"><div className="flex items-start justify-between gap-2"><div className="text-xs font-semibold text-slate-800 line-clamp-2">{task.title}</div><span className={`text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap ${TASK_STATUS_CLASS[task.status] || 'bg-slate-100'}`}>{TASK_STATUS_LABEL[task.status] || task.status}</span></div><div className="text-[10px] text-slate-500 mt-1">{task.assigneeName} · <span className={isOverdue ? 'text-rose-700 font-bold' : ''}>{shortDate(task.deadline)}</span></div></button>;
          })}</div>}
        </div>
      </div>

      {permissions.isLeader && pendingLessonPlans.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3"><AlertCircle className="w-5 h-5 text-amber-600 shrink-0" /><div><p className="text-xs font-bold text-amber-900">Có {pendingLessonPlans.length} kế hoạch bài dạy đang chờ phê duyệt</p><p className="text-[11px] text-amber-700">Hồ sơ đã gửi cần được rà soát nội dung và mục tiêu theo CV 5512.</p></div></div>
          <button onClick={() => onNavigate('lesson-plans')} className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg">Xem và duyệt ngay →</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => onNavigate('members')} className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-blue-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2"><span className="text-xs font-medium">Giáo viên trong tổ</span><span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">{allMembers.length}</span></div>
          <div className="text-2xl font-black text-slate-900">{allMembers.length} giáo viên</div><div className="text-[11px] text-slate-500 mt-1">Phụ trách {classes.length} lớp</div>
        </button>
        <button onClick={() => onNavigate('lesson-plans')} className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-blue-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2"><span className="text-xs font-medium">Kế hoạch bài dạy</span><FileText className="w-4 h-4 text-emerald-600" /></div>
          <div className="text-2xl font-black text-slate-900">{lessonPlans.length} giáo án</div><div className="text-[11px] text-slate-500 mt-1">{pendingLessonPlans.length > 0 ? `${pendingLessonPlans.length} chờ duyệt` : `${lessonPlans.filter(p => p.status === 'approved').length} đã được phê duyệt`}</div>
        </button>
        <button onClick={() => onNavigate('observations')} className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-blue-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2"><span className="text-xs font-medium">Phiếu dự giờ rút KN</span><Eye className="w-4 h-4 text-amber-600" /></div>
          <div className="text-2xl font-black text-slate-900">{observations.length} lượt dự giờ</div><div className="text-[11px] text-slate-500 mt-1">{myObservations.length} phiếu liên quan đến bạn</div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="w-full min-w-0 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600" /><h2 className="text-sm font-bold text-slate-800">Lịch sinh hoạt chuyên môn & Nghiên cứu bài học</h2></div><button onClick={() => onNavigate('lesson-study')} className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">Xem tất cả →</button></div>
            {upcomingMeetings.length === 0 ? <p className="text-xs text-slate-500 py-4 text-center">Chưa có lịch họp sắp tới</p> : <div className="space-y-3">{upcomingMeetings.map(m => <div key={m.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="flex items-center gap-2"><span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800">{m.type === 'lesson_study' ? 'Nghiên cứu bài học' : 'Định kỳ'}</span><span className="text-xs font-semibold text-slate-800 line-clamp-1">{m.title}</span></div><div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3"><span>Ngày: {m.date}</span><span>•</span><span>Địa điểm: {m.location}</span></div></div><span className={`text-[10px] px-2 py-0.5 rounded font-medium ${m.status === 'finalized' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{m.status === 'finalized' ? 'Đã chốt biên bản' : 'Đang soạn thảo'}</span></div>)}</div>}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-600" /><h2 className="text-sm font-bold text-slate-800">Kế hoạch dạy học theo CV 5512 (Tuần {currentWeek})</h2></div><button onClick={() => onNavigate('plans')} className="text-xs text-blue-600 hover:underline font-medium">Chi tiết →</button></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden"><thead className="bg-slate-100 text-slate-700 font-semibold"><tr><th className="p-2.5">Khối</th><th className="p-2.5">Chủ đề / Tên bài học</th><th className="p-2.5">Số tiết</th><th className="p-2.5">Thiết bị & Đồ dùng</th><th className="p-2.5">Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-200">{weekRows.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-slate-500">{departmentPlans.length === 0 ? 'Chưa có Kế hoạch dạy học của tổ.' : `Tuần ${currentWeek}: kế hoạch các khối chưa có bài dạy nào.`}</td></tr> : weekRows.map(({ grade, item }) => { const st = STATUS_LABEL[item.status || 'planned'] || STATUS_LABEL.planned; return <tr key={`${grade}-${item.id}`} className="hover:bg-slate-50"><td className={`p-2.5 font-bold ${grade === 12 ? 'text-blue-700' : grade === 11 ? 'text-cyan-700' : 'text-emerald-700'}`}>Khối {grade}</td><td className="p-2.5 font-medium text-slate-800">{item.topicTitle}</td><td className="p-2.5">{item.periods} tiết</td><td className="p-2.5 text-slate-500">{item.equipment || '—'}</td><td className="p-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${st.cls}`}>{st.label}</span></td></tr>; })}</tbody></table></div>
          </div>
        </div>
      </div>
    </div>
  );
};
