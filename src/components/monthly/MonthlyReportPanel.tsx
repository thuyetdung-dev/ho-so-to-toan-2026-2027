import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Download, FileText, Printer, RotateCcw, Save, Send, Trash2, UploadCloud, Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { MonthlyReport, MonthlyReportTemplate, WorkTask } from '../../types';
import { ACCEPT, FileReaderSession, formatBytes } from '../../report/file-readers';
import { extractTasks } from '../../report/tasks';
import { detectIssueDate, formatDate, scheduleTasks, weekdayOf } from '../../report/schedule';
import { filterTaskScope, isAnnualGuidance, type SubjectFilter } from '../../report/task-filter';
import { buildReportModel } from '../../report/report-model';
import { buildDocx } from '../../report/export-docx';
import { downloadBlob } from '../../report/download';
import { currentPeriod, MONTHS, yearOptions } from '../../report/period';
import type { Period, Source, Task } from '../../report/types';
import {
  DOCUMENT_SOURCE, WORK_STATUS_LABEL, emptyMonthlyReport, payloadOf, pickedToWorkTasks, printableHtml,
  reportIdOf, snapshotOf, tasksOfMonth,
} from '../../report/kpi-bridge';
import { monthlyRouteParams } from '../../report/navigation';
import { departmentHead } from '../../utils/leaders';
import { DocumentTaskPicker, type PickItem } from './DocumentTaskPicker';
import { ReportPaper } from './ReportPaper';

const MAX_FILES = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const REPORT_STATUS: Record<MonthlyReport['status'] | 'none', { label: string; cls: string }> = {
  none: { label: 'Chưa lập', cls: 'bg-slate-100 text-slate-600' },
  draft: { label: 'Đang soạn', cls: 'bg-sky-100 text-sky-700' },
  submitted: { label: 'Đã nộp – chờ duyệt', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700' },
  returned: { label: 'Bị trả lại – cần sửa', cls: 'bg-rose-100 text-rose-700' },
};
const TASK_CLS: Record<WorkTask['status'], string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-700',
  returned: 'bg-rose-100 text-rose-700',
};

type FormFields = Pick<MonthlyReport, 'template' | 'agency' | 'school' | 'department' | 'place' | 'selfAssessment' | 'proposals'>;
const pickForm = (r: MonthlyReport): FormFields => ({
  template: r.template, agency: r.agency, school: r.school, department: r.department, place: r.place,
  selfAssessment: r.selfAssessment, proposals: r.proposals,
});

type Pending = { added: Source[]; items: PickItem[]; annualFiles: string[] };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const readPref = (key: string, fallback: string) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const savePref = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* bỏ qua */ } };

export const MonthlyReportPanel: React.FC = () => {
  const {
    activeMember, allMembers, config, isMe, permissions, workTasks, saveWorkTask, deleteWorkTask, addWorkTasks,
    monthlyReports, saveMonthlyReport, setNotification,
  } = useApp();

  const route = useMemo(() => monthlyRouteParams(), []);
  const [period, setPeriod] = useState<Period>(() => route.period || currentPeriod());
  const [memberId, setMemberId] = useState(() =>
    route.memberId && (permissions.isLeader || activeMember.role === 'principal') ? route.memberId : activeMember.id);
  useEffect(() => { if (!memberId) setMemberId(activeMember.id); }, [activeMember.id, memberId]);

  const canSeeTeam = permissions.isLeader || activeMember.role === 'principal';
  const teamMembers = useMemo(
    () => allMembers.filter(m => m.status === 'active' && m.role !== 'principal'),
    [allMembers],
  );
  const member = allMembers.find(m => m.id === memberId) || activeMember;
  const own = isMe(member.id);
  const head = departmentHead(allMembers);

  const id = reportIdOf(member.id, period);
  const saved = monthlyReports.find(r => r.id === id);
  const previous = useMemo(
    () => monthlyReports.filter(r => r.memberId === member.id && r.id !== id).sort((a, b) => b.id.localeCompare(a.id))[0],
    [monthlyReports, member.id, id],
  );
  const base = useMemo(
    () => saved || emptyMonthlyReport({ member, period, schoolName: config.schoolName, departmentName: config.departmentName, previous }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved, member.id, member.displayName, period.month, period.year, config.schoolName, config.departmentName, previous],
  );
  const status = saved?.status || 'none';
  const editable = own && permissions.canContribute && (status === 'none' || status === 'draft' || status === 'returned');

  const [form, setForm] = useState<FormFields>(() => pickForm(base));
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setForm(pickForm(base)); setDirty(false); }, [base]);
  const setField = <K extends keyof FormFields>(k: K, v: FormFields[K]) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  const live = useMemo(() => tasksOfMonth(workTasks, member.id, period), [workTasks, member.id, period]);
  const current: MonthlyReport = { ...base, ...form };
  const payload = payloadOf(current, live, head?.displayName);
  const model = useMemo(() => buildReportModel(payload, period), [JSON.stringify(payload), period.month, period.year]); // eslint-disable-line react-hooks/exhaustive-deps
  const paperRef = useRef<HTMLElement>(null);
  const previewBox = useRef<HTMLDivElement>(null);
  const [paperScale, setPaperScale] = useState(1);
  useEffect(() => {
    const box = previewBox.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const A4 = 794; // 210 mm ở 96 dpi
    const fit = () => {
      const inner = box.clientWidth - 40;
      setPaperScale(Math.max(0.35, Math.min(1, inner / A4)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // ---------------------------------------------------------------- đọc công văn
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState<SubjectFilter>(() => (readPref('kpi:monthly:subject', 'toan') === 'all' ? 'all' : 'toan'));
  const [taskMode, setTaskMode] = useState<'teacher' | 'school'>(() => (readPref('kpi:monthly:taskMode', 'teacher') === 'school' ? 'school' : 'teacher'));

  useEffect(() => { setPending(null); setNotes([]); }, [id]);

  async function readFiles(list: FileList | null) {
    if (!list?.length || busy || !editable) return;
    setBusy(true); setProgress(2); setNotes([]);
    const log: string[] = [];
    const added: Source[] = [];
    const items: PickItem[] = [];
    const annualFiles: string[] = [];
    const files = Array.from(list).slice(0, MAX_FILES);
    if (list.length > MAX_FILES) log.push(`Mỗi lượt đọc tối đa ${MAX_FILES} tệp; các tệp còn lại chưa được đọc.`);
    const session = new FileReaderSession((msg, pct) => { setProgressText(msg); if (pct != null) setProgress(pct); });
    try {
      for (const file of files) {
        try {
          if (file.size > MAX_FILE_BYTES) { log.push(`${file.name}: vượt quá 25 MB nên chưa được đọc.`); continue; }
          setProgressText(`Đang đọc ${file.name}…`);
          const { text, note } = await session.read(file);
          if (note) log.push(note);
          if (!text.trim()) { log.push(`${file.name}: không tìm thấy chữ trong tệp.`); continue; }
          let tasks = extractTasks(text, file.name, { staffOnly: true, teacherOnly: taskMode === 'teacher' });
          const issued = detectIssueDate(text);
          tasks = scheduleTasks(tasks, period, { notBefore: issued });
          const auto = tasks.filter(t => t.auto).length;
          if (auto) log.push(`${file.name}: ${auto} đầu việc không ghi ngày đã được tự xếp ngày${issued ? ` (từ ngày ban hành ${formatDate(issued)})` : ''} – hãy xem lại các dòng "tự xếp".`);
          const { kept, removed } = filterTaskScope(tasks, { subject });
          const annual = isAnnualGuidance(text, file.name);
          if (annual) annualFiles.push(file.name);
          items.push(...kept.map(task => ({ task, checked: !annual })), ...removed.map(({ task, reason }) => ({ task, checked: false, reason })));
          added.push({ name: file.name, size: formatBytes(file.size), lines: kept.length });
        } catch (e) {
          console.error('Lỗi đọc tệp', file.name, e);
          log.push(`Không đọc được ${file.name}: ${errorText(e)}`);
        }
      }
    } finally {
      await session.close().catch(() => undefined);
      setBusy(false); setProgress(0); setProgressText('');
      if (fileInput.current) fileInput.current.value = '';
    }
    if (added.length) {
      const kept = items.filter(x => !x.reason).length;
      log.unshift(`Đã phân tích ${added.length} tệp: nhận ra ${items.length} đầu việc, giữ ${kept}, tự loại ${items.length - kept}. Hãy tích những việc thầy/cô làm trong tháng.`);
      setPending({ added, items, annualFiles });
    }
    setNotes(log);
  }

  async function confirmPicked(chosen: Task[]) {
    if (!pending) return;
    setSaving(true);
    try {
      const tasks = pickedToWorkTasks(chosen, { member, academicYear: config.academicYear, period });
      if (!(await addWorkTasks(tasks))) return;
      const sources = [...(current.sources || []).filter(s => !pending.added.some(a => a.name === s.name)), ...pending.added];
      await saveMonthlyReport({ ...current, sources, status: status === 'returned' ? 'returned' : 'draft' }, { silent: true });
      setDirty(false);
      setNotes([`Đã thêm ${tasks.length} đầu việc vào tháng ${period.month}/${period.year}. Mỗi việc nằm cả ở mục "3. Điều hành công việc" để nộp minh chứng.`]);
      setNotification({ message: `Đã thêm ${tasks.length} đầu việc từ công văn`, type: 'success' });
      setPending(null);
    } finally { setSaving(false); }
  }

  // ---------------------------------------------------------------- thao tác đầu việc
  const changeDate = async (t: WorkTask, deadline: string) => {
    if (!deadline || deadline === t.deadline) return;
    await saveWorkTask({ ...t, deadline, autoDate: false });
  };
  const removeTask = async (t: WorkTask) => {
    if (window.confirm(`Bỏ đầu việc "${t.title.slice(0, 80)}" khỏi tháng này?`)) await deleteWorkTask(t.id);
  };
  const submitEvidence = async (t: WorkTask) => {
    const note = window.prompt('Mô tả minh chứng đã hoàn thành:', t.evidenceNote || ''); if (note === null) return;
    const url = window.prompt('Đường dẫn minh chứng (Google Drive/OneDrive...), có thể để trống:', t.evidenceUrl || ''); if (url === null) return;
    await saveWorkTask({ ...t, status: 'submitted', evidenceNote: note.trim(), evidenceUrl: url.trim(), submittedAt: new Date().toISOString() });
  };
  const confirmTask = async (t: WorkTask) => {
    const now = new Date().toISOString();
    await saveWorkTask({ ...t, status: 'completed', reviewedAt: now, completedAt: now });
  };
  const canConfirm = (t: WorkTask) => permissions.isLeader && t.status === 'submitted' && (!isMe(t.assigneeId) || permissions.isAdminOrHead);

  // ---------------------------------------------------------------- lưu / nộp / duyệt
  const save = async () => {
    setSaving(true);
    try { if (await saveMonthlyReport({ ...current, status: status === 'returned' ? 'returned' : 'draft' })) setDirty(false); }
    finally { setSaving(false); }
  };
  const submit = async () => {
    if (!live.length && !window.confirm('Tháng này chưa có đầu việc nào. Vẫn nộp báo cáo?')) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (await saveMonthlyReport({ ...current, status: 'submitted', submittedAt: now, tasksSnapshot: live.map(snapshotOf), reviewNote: '' })) setDirty(false);
    } finally { setSaving(false); }
  };
  const review = async (next: 'approved' | 'returned') => {
    if (!saved) return;
    const note = window.prompt(next === 'approved' ? 'Ghi chú khi duyệt (có thể để trống):' : 'Nội dung cần sửa/bổ sung:', '');
    if (note === null) return;
    if (next === 'returned' && !note.trim()) { setNotification({ message: 'Hãy ghi nội dung cần sửa khi trả lại.', type: 'error' }); return; }
    await saveMonthlyReport({ ...saved, status: next, reviewNote: note.trim(), reviewedBy: activeMember.displayName, reviewedAt: new Date().toISOString() });
  };
  const canReview = permissions.isLeader && status === 'submitted' && (!own || permissions.isAdminOrHead);
  const canReopen = permissions.isAdminOrHead && status === 'approved';

  const downloadWord = async () => {
    try { downloadBlob(await buildDocx(model), `${model.fileName}.docx`); }
    catch (e) { setNotification({ message: `Không tạo được file Word: ${errorText(e)}`, type: 'error' }); }
  };
  const print = () => {
    const html = paperRef.current?.outerHTML; if (!html) return;
    const w = window.open('', '_blank');
    if (!w) { setNotification({ message: 'Trình duyệt chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.', type: 'error' }); return; }
    w.document.open(); w.document.write(printableHtml(model.fileName, html)); w.document.close();
    w.onload = () => { w.focus(); w.print(); };
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* đã in */ } }, 600);
  };

  // ---------------------------------------------------------------- tổng hợp tổ
  const team = useMemo(() => canSeeTeam ? teamMembers.map(m => {
    const tasks = tasksOfMonth(workTasks, m.id, period);
    const r = monthlyReports.find(x => x.id === reportIdOf(m.id, period));
    return { m, total: tasks.length, done: tasks.filter(t => t.status === 'completed').length, status: r?.status || 'none' as const };
  }) : [], [canSeeTeam, teamMembers, workTasks, monthlyReports, period]);

  const changePeriod = (p: Partial<Period>) => setPeriod(prev => ({ ...prev, ...p }));
  const statusInfo = REPORT_STATUS[status];

  return (
    <div className="space-y-5">
      {/* Thanh chọn tháng / giáo viên */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-end gap-3 justify-between">
        <div>
          <div className="text-base font-bold text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" />Báo cáo công việc tháng</div>
          <p className="text-xs text-slate-500 mt-0.5">Đọc công văn → chọn đầu việc của mình → nộp minh chứng → nộp báo cáo tháng (Word / PDF).</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-semibold text-slate-600">Tháng
            <select value={period.month} onChange={e => changePeriod({ month: e.target.value })} className="mt-1 block border rounded-lg px-2 py-1.5 text-xs bg-white">
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-slate-600">Năm
            <select value={period.year} onChange={e => changePeriod({ year: e.target.value })} className="mt-1 block border rounded-lg px-2 py-1.5 text-xs bg-white">
              {yearOptions(period.year).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          {canSeeTeam && (
            <label className="text-[11px] font-semibold text-slate-600">Giáo viên
              <select value={member.id} onChange={e => setMemberId(e.target.value)} className="mt-1 block border rounded-lg px-2 py-1.5 text-xs bg-white max-w-[14rem]">
                {!teamMembers.some(m => m.id === activeMember.id) && <option value={activeMember.id}>{activeMember.displayName}</option>}
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.displayName}{isMe(m.id) ? ' (tôi)' : ''}</option>)}
              </select>
            </label>
          )}
          <span className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${statusInfo.cls}`}>{statusInfo.label}</span>
        </div>
      </div>

      {saved?.reviewNote && (status === 'returned' || status === 'approved') && (
        <div className={`p-3 rounded-xl border text-xs flex gap-2 ${status === 'returned' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          <AlertCircle className="w-4 h-4 shrink-0" /><div><b>{saved.reviewedBy || 'Lãnh đạo tổ'}:</b> {saved.reviewNote}</div>
        </div>
      )}

      {/* Tổng hợp tổ */}
      {canSeeTeam && (
        <details className="bg-white border rounded-xl" open={!own}>
          <summary className="px-4 py-3 text-sm font-bold cursor-pointer flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" />Báo cáo tháng {period.month}/{period.year} của cả tổ</summary>
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500 border-b"><th className="py-2 pr-2">Giáo viên</th><th className="py-2 px-2 text-center">Đầu việc</th><th className="py-2 px-2 text-center">Hoàn thành</th><th className="py-2 px-2">Báo cáo</th><th /></tr></thead>
              <tbody>
                {team.map(({ m, total, done, status: s }) => (
                  <tr key={m.id} className={`border-b last:border-b-0 ${m.id === member.id ? 'bg-blue-50/60' : ''}`}>
                    <td className="py-2 pr-2 font-semibold text-slate-800">{m.displayName}</td>
                    <td className="py-2 px-2 text-center">{total}</td>
                    <td className="py-2 px-2 text-center">{done}</td>
                    <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${REPORT_STATUS[s].cls}`}>{REPORT_STATUS[s].label}</span></td>
                    <td className="py-2 pl-2 text-right"><button onClick={() => setMemberId(m.id)} className="text-[11px] font-semibold text-blue-700 hover:underline">Xem</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Bước 1: đọc công văn */}
      {editable && (
        <section className="bg-white border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">1. Đọc công văn, kế hoạch → chọn đầu việc</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">PDF (cả bản scan), ảnh chụp, Word, Excel. Tệp được đọc ngay trên máy, không tải lên máy chủ.</p>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px]">
              <label className="font-semibold text-slate-600">Đầu việc
                <select value={taskMode} onChange={e => { const v = e.target.value as 'teacher' | 'school'; setTaskMode(v); savePref('kpi:monthly:taskMode', v); }} className="ml-1 border rounded-lg px-2 py-1 bg-white font-normal">
                  <option value="teacher">Của giáo viên</option>
                  <option value="school">Tất cả việc của trường</option>
                </select>
              </label>
              <label className="font-semibold text-slate-600">Lọc theo môn
                <select value={subject} onChange={e => { const v = e.target.value as SubjectFilter; setSubject(v); savePref('kpi:monthly:subject', v); }} className="ml-1 border rounded-lg px-2 py-1 bg-white font-normal">
                  <option value="toan">Toán</option>
                  <option value="all">Tất cả môn</option>
                </select>
              </label>
            </div>
          </div>

          {!pending && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); void readFiles(e.dataTransfer.files); }}
              className="border-2 border-dashed border-blue-200 rounded-xl p-6 text-center bg-blue-50/40"
            >
              <UploadCloud className="w-8 h-8 text-blue-500 mx-auto" />
              <p className="text-xs text-slate-700 mt-2">Kéo thả tệp vào đây hoặc</p>
              <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="mt-2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                {busy ? 'Đang đọc...' : 'Chọn tệp công văn'}
              </button>
              <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={e => void readFiles(e.target.files)} />
              {busy && (
                <div className="mt-3 max-w-md mx-auto">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>
                  <p className="text-[11px] text-slate-500 mt-1">{progressText}</p>
                </div>
              )}
            </div>
          )}

          {notes.length > 0 && (
            <ul className="text-[11px] text-slate-700 bg-slate-50 border rounded-lg p-3 space-y-1 list-disc pl-6">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          )}

          {pending && (
            <DocumentTaskPicker
              period={period}
              items={pending.items}
              annualFiles={pending.annualFiles}
              existingTitles={live.map(t => t.title)}
              busy={saving}
              onConfirm={chosen => void confirmPicked(chosen)}
              onCancel={() => { setPending(null); setNotes(['Đã hủy – chưa thêm đầu việc nào.']); }}
            />
          )}

          {(current.sources || []).length > 0 && (
            <div className="text-[11px] text-slate-500">Văn bản đã đọc trong tháng: {(current.sources || []).map(s => s.name).join(' · ')}</div>
          )}
        </section>
      )}

      {/* Bước 2: danh sách đầu việc */}
      <section className="bg-white border rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-900">{editable ? '2. ' : ''}Đầu việc tháng {period.month}/{period.year} – {member.displayName}</h2>
          <div className="text-[11px] text-slate-500">{live.length} việc · {live.filter(t => t.status === 'completed').length} đã được xác nhận hoàn thành</div>
        </div>
        {live.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed rounded-lg">Chưa có đầu việc nào có hạn trong tháng này.{editable ? ' Hãy đọc công văn ở bước 1.' : ''}</div>
        ) : (
          <div className="divide-y border-y sm:border-y-0 sm:divide-y-0">
            <div className="hidden sm:grid grid-cols-[9rem_minmax(0,1fr)_7rem_8rem_10rem] gap-2 text-left text-[11px] font-semibold text-slate-500 border-b py-2">
              <div>Ngày</div><div>Công việc</div><div>Nguồn</div><div>Trạng thái</div><div />
            </div>
            {live.map(t => {
              const mine = isMe(t.assigneeId);
              const ownDoc = mine && t.sourceType === DOCUMENT_SOURCE;
              const dateEditable = ownDoc && ['pending', 'in_progress', 'returned'].includes(t.status);
              return (
                <div key={t.id} className="py-3 sm:py-2 sm:border-b sm:last:border-b-0 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[9rem_minmax(0,1fr)_7rem_8rem_10rem] gap-x-2 gap-y-1.5 text-xs items-start">
                  <div className="col-span-1">
                    {dateEditable ? (
                      <input type="date" value={t.deadline} onChange={e => void changeDate(t, e.target.value)} className="border rounded px-1.5 py-1 text-[11px] w-full max-w-[10rem]" aria-label="Ngày thực hiện" />
                    ) : <span className="font-semibold text-slate-700">{formatDate(t.deadline)}</span>}
                    <div className="text-[10px] text-slate-500 mt-0.5">{weekdayOf(t.deadline)}{t.clock ? ` · ${t.clock}` : ''}{t.autoDate ? ' · tự xếp' : ''}</div>
                  </div>
                  <div className="sm:hidden justify-self-end"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TASK_CLS[t.status]}`}>{WORK_STATUS_LABEL[t.status]}</span></div>
                  <div className="col-span-2 sm:col-span-1 text-slate-800 leading-relaxed">
                    {t.title}
                    {t.evidenceNote && <div className="text-[10px] text-slate-500 mt-0.5">Minh chứng: {t.evidenceNote}</div>}
                    {t.reviewNote && t.status === 'returned' && <div className="text-[10px] text-rose-600 mt-0.5">Cần bổ sung: {t.reviewNote}</div>}
                    <div className="sm:hidden text-[10px] text-slate-500 mt-0.5">Nguồn: {t.sourceType === DOCUMENT_SOURCE ? (t.sourceName || 'Công văn') : 'Tổ giao'}</div>
                  </div>
                  <div className="hidden sm:block text-[11px] text-slate-500 break-words">{t.sourceType === DOCUMENT_SOURCE ? (t.sourceName || 'Công văn') : 'Tổ giao'}</div>
                  <div className="hidden sm:block"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TASK_CLS[t.status]}`}>{WORK_STATUS_LABEL[t.status]}</span></div>
                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex flex-wrap sm:justify-end gap-1">
                      {mine && permissions.canContribute && ['pending', 'in_progress', 'returned'].includes(t.status) && (
                        <button onClick={() => void submitEvidence(t)} className="px-2 py-1 text-[10px] font-semibold bg-blue-600 text-white rounded flex items-center gap-1"><Send className="w-3 h-3" />Nộp minh chứng</button>
                      )}
                      {canConfirm(t) && (
                        <button onClick={() => void confirmTask(t)} className="px-2 py-1 text-[10px] font-semibold bg-emerald-600 text-white rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Xác nhận</button>
                      )}
                      {ownDoc && ['pending', 'in_progress'].includes(t.status) && (
                        <button onClick={() => void removeTask(t)} className="p-1 border rounded text-slate-400 hover:text-rose-600" title="Bỏ đầu việc này" aria-label="Bỏ đầu việc này"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-slate-500 mt-3">Báo cáo ghi "Hoàn thành" khi minh chứng đã được lãnh đạo tổ xác nhận; đã nộp minh chứng hoặc đang làm ghi "Đang thực hiện".</p>
      </section>

      {/* Bước 3: nội dung báo cáo + xem trước */}
      <section className="grid xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-5 items-start">
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">{editable ? '3. ' : ''}Nội dung báo cáo</h2>
          <fieldset disabled={!editable} className="space-y-3 disabled:opacity-80">
            <div>
              <div className="text-[11px] font-semibold text-slate-600 mb-1">Mẫu báo cáo</div>
              <div className="grid grid-cols-2 gap-2">
                {([['admin', 'Hành chính', 'Quốc hiệu, tiêu ngữ, ký xác nhận'], ['notebook', 'Sổ tay', 'Trang bìa, phiếu chốt cuối tháng']] as [MonthlyReportTemplate, string, string][]).map(([v, l, d]) => (
                  <button type="button" key={v} onClick={() => setField('template', v)} className={`text-left p-2 rounded-lg border text-xs ${form.template === v ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}>
                    <div className="font-bold">{l}</div><div className="text-[10px] text-slate-500">{d}</div>
                  </button>
                ))}
              </div>
            </div>
            {form.template === 'admin' && (
              <label className="block text-[11px] font-semibold text-slate-600">Cơ quan chủ quản
                <input value={form.agency} onChange={e => setField('agency', e.target.value)} placeholder="Sở Giáo dục và Đào tạo …" className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs font-normal" />
              </label>
            )}
            <label className="block text-[11px] font-semibold text-slate-600">Trường
              <input value={form.school} onChange={e => setField('school', e.target.value)} className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs font-normal" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-semibold text-slate-600">Tổ
                <input value={form.department} onChange={e => setField('department', e.target.value)} className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs font-normal" />
              </label>
              {form.template === 'admin' && (
                <label className="block text-[11px] font-semibold text-slate-600">Địa danh
                  <input value={form.place} onChange={e => setField('place', e.target.value)} placeholder="TP. Hồ Chí Minh" className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs font-normal" />
                </label>
              )}
            </div>
            <label className="block text-[11px] font-semibold text-slate-600">Tự đánh giá
              <textarea rows={4} value={form.selfAssessment} onChange={e => setField('selfAssessment', e.target.value)} placeholder="Mỗi ý một dòng" className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs font-normal" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">Đề xuất, kiến nghị
              <textarea rows={3} value={form.proposals} onChange={e => setField('proposals', e.target.value)} placeholder="Mỗi ý một dòng" className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs font-normal" />
            </label>
          </fieldset>

          <div className="flex flex-wrap gap-2 pt-1">
            {editable && (
              <>
                <button onClick={() => void save()} disabled={saving} className="px-3 py-2 text-xs font-semibold border rounded-lg flex items-center gap-1 disabled:opacity-50"><Save className="w-3.5 h-3.5" />{dirty ? 'Lưu nháp' : 'Đã lưu'}</button>
                <button onClick={() => void submit()} disabled={saving} className="px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"><Send className="w-3.5 h-3.5" />Nộp báo cáo</button>
              </>
            )}
            {canReview && (
              <>
                <button onClick={() => void review('approved')} className="px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Duyệt báo cáo</button>
                <button onClick={() => void review('returned')} className="px-3 py-2 text-xs font-semibold border border-rose-200 text-rose-700 rounded-lg">Trả lại</button>
              </>
            )}
            {canReopen && (
              <button onClick={() => void review('returned')} className="px-3 py-2 text-xs font-semibold border rounded-lg flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />Mở lại để sửa</button>
            )}
          </div>
          {own && status === 'submitted' && !canReview && <p className="text-[11px] text-amber-700">Báo cáo đã nộp, đang chờ lãnh đạo tổ duyệt.</p>}
          {(status === 'submitted' || status === 'approved') && <p className="text-[10px] text-slate-500">Bản đã nộp giữ nguyên danh sách đầu việc tại thời điểm nộp{saved?.submittedAt ? ` (${new Date(saved.submittedAt).toLocaleString('vi-VN')})` : ''}.</p>}
        </div>

        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Xem trước</h2>
            <div className="flex gap-2">
              <button onClick={() => void downloadWord()} className="px-3 py-2 text-xs font-semibold border rounded-lg bg-white flex items-center gap-1"><Download className="w-3.5 h-3.5" />Tải Word</button>
              <button onClick={print} className="px-3 py-2 text-xs font-semibold border rounded-lg bg-white flex items-center gap-1"><Printer className="w-3.5 h-3.5" />In / Lưu PDF</button>
            </div>
          </div>
          <div ref={previewBox} className="bg-slate-100 border rounded-xl p-2 sm:p-5 overflow-x-auto">
            {/* Thu nhỏ tờ A4 cho vừa khung xem trước (không ảnh hưởng bản in / Word) */}
            <div style={{ zoom: paperScale }}>
              <ReportPaper ref={paperRef} model={model} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
