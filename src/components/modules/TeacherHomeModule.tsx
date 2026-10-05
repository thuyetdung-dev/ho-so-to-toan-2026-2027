import React, { useMemo } from 'react';
import {
  AlertTriangle, ArrowRight, Calendar, CheckCircle2, ClipboardList, Eye, FileText, Gauge, Presentation, Printer, Send,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ActiveModule } from '../Sidebar';
import { buildWorkCenter, todayIso } from '../../utils/management';
import { STATUS_CLS, STATUS_TEXT, TERM_TEXT, teacherStandards } from '../../utils/standards';
import { pushRoute } from '../../utils/deepLink';
import { openMonthlyReport } from '../../report/navigation';
import { reportIdOf } from '../../report/kpi-bridge';

const shortDate = (v?: string) => (v ? new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN') : '');

const REPORT_TEXT: Record<string, { label: string; cls: string }> = {
  none: { label: 'Chưa lập', cls: 'text-slate-600' },
  draft: { label: 'Đang soạn', cls: 'text-sky-700' },
  submitted: { label: 'Đã nộp – chờ duyệt', cls: 'text-amber-700' },
  approved: { label: 'Đã duyệt', cls: 'text-emerald-700' },
  returned: { label: 'Bị trả lại – cần sửa', cls: 'text-rose-700' },
};

/** Trang chủ rút gọn cho giáo viên: hôm nay cần làm gì. */
export const TeacherHomeModule: React.FC<{ onNavigate: (m: ActiveModule) => void }> = ({ onNavigate }) => {
  const {
    activeMember, allMembers, config, isMe, permissions, workTasks, teacherPlans, lessonPlans, observations, meetings,
    trainings, departmentPlans, monthlyReports,
  } = useApp();
  const today = todayIso();
  const term = config.currentTerm || 'HK1';

  const openOperations = (filter: string, taskId?: string) => {
    pushRoute('operations');
    const params = new URLSearchParams({ filter });
    if (taskId) params.set('task', taskId);
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const myTasks = useMemo(
    () => workTasks.filter(t => t.academicYear === config.academicYear && isMe(t.assigneeId)),
    [workTasks, config.academicYear, isMe],
  );
  const open = myTasks.filter(t => t.status !== 'completed');
  const overdue = open.filter(t => t.deadline && t.deadline < today && t.status !== 'submitted');
  const returned = myTasks.filter(t => t.status === 'returned');
  const waiting = myTasks.filter(t => t.status === 'submitted');
  const upcoming = [...open]
    .filter(t => t.status !== 'submitted')
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'))
    .slice(0, 6);

  const items = buildWorkCenter({
    departmentPlans, teacherPlans, lessonPlans, meetings, workTasks, isLeader: false, activeMember, isMe,
    members: allMembers, academicYear: config.academicYear,
  }).filter(w => w.kind !== 'work-task');

  const standards = teacherStandards(
    activeMember, { teacherPlans, lessonPlans, observations, meetings, trainings, workTasks, members: allMembers }, config, term, today,
  );

  const now = new Date(`${today}T00:00:00`);
  const period = { month: String(now.getMonth() + 1).padStart(2, '0'), year: String(now.getFullYear()) };
  const report = monthlyReports.find(r => r.id === reportIdOf(activeMember.id, period));
  const reportInfo = REPORT_TEXT[report?.status || 'none'];

  const nextMeeting = [...meetings].filter(m => (m.date || '') >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const myObs = observations.filter(o => isMe(o.observerId) || isMe(o.teacherId));

  const salutation = activeMember.displayName;

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h1 className="text-xl lg:text-2xl font-black text-slate-900">Chào {salutation}</h1>
        <p className="text-xs text-slate-500 mt-1">{config.departmentName} • Năm học {config.academicYear} • {TERM_TEXT[term]}</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => onNavigate('lesson-plans')} className="px-3 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-2"><FileText className="w-4 h-4" />Soạn / nộp giáo án</button>
          <button onClick={() => openOperations('mine')} className="px-3 py-2.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-100 text-xs font-bold flex items-center gap-2"><Send className="w-4 h-4" />Nộp minh chứng</button>
          <button onClick={() => openMonthlyReport({ memberId: activeMember.id })} className="px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-bold flex items-center gap-2"><Printer className="w-4 h-4" />Báo cáo tháng</button>
          <button onClick={() => onNavigate('observations')} className="px-3 py-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-100 text-xs font-bold flex items-center gap-2"><Eye className="w-4 h-4" />Dự giờ</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={() => openOperations(overdue.length ? 'overdue' : 'mine')} className={`rounded-2xl border p-4 text-left ${overdue.length ? 'bg-rose-50 border-rose-200' : 'bg-white'}`}>
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">Việc đang mở <ClipboardList className="w-4 h-4 text-blue-600" /></div>
          <div className="text-3xl font-black mt-1">{open.length}</div>
          <div className={`text-[11px] mt-0.5 ${overdue.length ? 'text-rose-700 font-bold' : 'text-slate-500'}`}>{overdue.length ? `${overdue.length} việc quá hạn` : 'Không có việc quá hạn'}</div>
        </button>
        <button onClick={() => openOperations('mine')} className={`rounded-2xl border p-4 text-left ${returned.length || items.length ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">Cần sửa / bổ sung <AlertTriangle className="w-4 h-4 text-amber-600" /></div>
          <div className="text-3xl font-black mt-1">{returned.length + items.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{waiting.length} minh chứng đang chờ duyệt</div>
        </button>
        <button onClick={() => onNavigate('teacher-360')} className="rounded-2xl border bg-white p-4 text-left">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">Định mức {TERM_TEXT[term]} <Gauge className="w-4 h-4 text-violet-600" /></div>
          <div className="text-3xl font-black mt-1">{standards.counted ? `${standards.met}/${standards.counted}` : '—'}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{standards.counted ? `nhóm đã đạt · ${STATUS_TEXT[standards.overall]}` : 'Tổ chưa đặt định mức'}</div>
        </button>
        <button onClick={() => openMonthlyReport({ memberId: activeMember.id })} className="rounded-2xl border bg-white p-4 text-left">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">Báo cáo tháng {period.month} <Printer className="w-4 h-4 text-emerald-600" /></div>
          <div className={`text-sm font-black mt-2 ${reportInfo.cls}`}>{reportInfo.label}</div>
          <div className="text-[11px] text-slate-500 mt-1">Mở để đọc công văn, chọn đầu việc</div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
        <section className="bg-white border rounded-2xl p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-600" />Việc cần làm</h2>
            <button onClick={() => openOperations('mine')} className="text-[11px] font-semibold text-blue-700">Tất cả việc của tôi <ArrowRight className="inline w-3 h-3" /></button>
          </div>
          {items.length + upcoming.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 border border-dashed rounded-lg"><CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />Không có việc tồn đọng.</div>
          ) : (
            <div className="space-y-2">
              {items.map(w => (
                <button key={w.id} onClick={() => onNavigate(w.module)} className="w-full text-left border border-rose-200 bg-rose-50/40 rounded-lg p-3 flex gap-3 items-start">
                  <span className="mt-1 w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800">{w.title}</span><span className="block text-[11px] text-slate-500 truncate">{w.detail}</span></span>
                </button>
              ))}
              {upcoming.map(t => {
                const late = !!t.deadline && t.deadline < today;
                return (
                  <button key={t.id} onClick={() => openOperations(late ? 'overdue' : 'mine', t.id)} className="w-full text-left border rounded-lg p-3 flex gap-3 items-start hover:border-blue-300">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${late ? 'bg-rose-500' : t.status === 'returned' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-800 line-clamp-2">{t.title}</span>
                      <span className="block text-[11px] text-slate-500">{t.status === 'returned' ? 'Cần bổ sung minh chứng · ' : ''}{t.sourceType === 'document' ? (t.sourceName || 'Công văn') : 'Tổ giao'}</span>
                    </span>
                    <span className={`text-[10px] font-semibold shrink-0 ${late ? 'text-rose-700' : 'text-slate-500'}`}>{shortDate(t.deadline)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="bg-white border rounded-2xl p-5 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><Gauge className="w-4 h-4 text-violet-600" />Định mức {TERM_TEXT[term]}</h2>
              <button onClick={() => onNavigate('teacher-360')} className="text-[11px] font-semibold text-blue-700">Chi tiết <ArrowRight className="inline w-3 h-3" /></button>
            </div>
            <div className="space-y-2">
              {standards.groups.map(g => (
                <div key={g.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-700 min-w-0">{g.label}<span className="block text-[10px] text-slate-500">{g.detail}</span></span>
                  <span className={`shrink-0 px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${STATUS_CLS[g.status]}`}>{STATUS_TEXT[g.status]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border rounded-2xl p-5 min-w-0">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-blue-600" />Sinh hoạt tổ sắp tới</h2>
            {nextMeeting ? (
              <button onClick={() => onNavigate('lesson-study')} className="w-full text-left p-3 rounded-lg bg-slate-50 border">
                <div className="text-xs font-bold text-slate-800">{nextMeeting.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{shortDate(nextMeeting.date)}</div>
              </button>
            ) : <p className="text-xs text-slate-500">Chưa có lịch họp sắp tới.</p>}
            <button onClick={() => onNavigate('lesson-study')} className="mt-2 text-[11px] font-semibold text-blue-700 flex items-center gap-1"><Presentation className="w-3.5 h-3.5" />Biên bản & góp ý</button>
          </section>

          <section className="bg-white border rounded-2xl p-5 text-xs text-slate-600">
            <div className="flex items-center justify-between"><span>Phiếu dự giờ liên quan đến tôi</span><b>{myObs.length}</b></div>
            {permissions.canContribute && <button onClick={() => onNavigate('observations')} className="mt-2 text-[11px] font-semibold text-blue-700">Mở dự giờ <ArrowRight className="inline w-3 h-3" /></button>}
          </section>
        </div>
      </div>
    </div>
  );
};
