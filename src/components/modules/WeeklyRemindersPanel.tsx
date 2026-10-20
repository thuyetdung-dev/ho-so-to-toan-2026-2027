import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { WeeklyReminder } from '../../types';
import { newId } from '../../utils/ids';
import { todayIso } from '../../utils/management';
import { WEEKDAYS, addDays, appliesTo, buildIcs, describeSchedule, googleCalendarUrl, isoDate, mondayOf, occurrencesBetween, sampleReminders2026, weekdayOf } from '../../utils/reminders';
import { BellRing, CalendarPlus, ChevronDown, ChevronUp, Download, Pencil, Plus, Trash2 } from 'lucide-react';

const ALARMS: [number, string][] = [[0, 'Đúng giờ'], [15, 'Trước 15 phút'], [30, 'Trước 30 phút'], [60, 'Trước 1 giờ'], [1440, 'Trước 1 ngày']];
const AUDIENCE: Record<WeeklyReminder['audience'], string> = { all: 'Cả tổ', leaders: 'Tổ trưởng, tổ phó', members: 'Giáo viên được chọn' };
const fmt = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

const blank = (): WeeklyReminder => ({ id: '', title: '', kind: 'weekly', weekday: 1, time: '07:00', durationMinutes: 30, intervalWeeks: 1, alarmMinutes: 15, audience: 'all', memberIds: [], active: true });

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const WeeklyRemindersPanel: React.FC = () => {
  const { config, updateConfig, workTasks, activeMember, isMe, permissions, allMembers } = useApp();
  const reminders = config.weeklyReminders || [];
  const canEdit = permissions.isAdminOrHead;
  const yearStart = config.startDate; const yearEnd = config.endDate;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<WeeklyReminder | null>(null);
  const [saving, setSaving] = useState(false);

  const today = todayIso();
  const weekStart = mondayOf(today); const weekEnd = addDays(weekStart, 6);
  const mine = useMemo(() => reminders.filter(r => appliesTo(r, activeMember.id, permissions.isLeader)), [reminders, activeMember.id, permissions.isLeader]);
  const myTasks = useMemo(() => workTasks.filter(t => t.academicYear === config.academicYear && isMe(t.assigneeId)), [workTasks, config.academicYear, isMe]);

  // Lịch tuần này: nhắc việc + hạn công việc của tôi
  const thisWeek = useMemo(() => {
    const items: { date: string; time?: string; title: string; kind: 'reminder' | 'task' }[] = [];
    for (const r of mine) for (const d of occurrencesBetween(r, weekStart, weekEnd, yearStart, yearEnd)) items.push({ date: d, time: r.time, title: r.title, kind: 'reminder' });
    for (const t of myTasks) if (t.status !== 'completed' && t.deadline >= weekStart && t.deadline <= weekEnd) items.push({ date: t.deadline, title: t.title, kind: 'task' });
    return items.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  }, [mine, myTasks, weekStart, weekEnd, yearStart, yearEnd]);
  const upcoming = useMemo(() => mine.filter(r => r.kind === 'once' && r.active && isoDate(r.date) && r.date > weekEnd && r.date <= addDays(weekEnd, 21))
    .sort((a, b) => a.date!.localeCompare(b.date!)), [mine, weekEnd]);

  const save = async (list: WeeklyReminder[]) => { setSaving(true); try { return await updateConfig({ weeklyReminders: list }); } finally { setSaving(false); } };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form || !form.title.trim()) return;
    if (form.kind === 'once' && !isoDate(form.date)) return;
    const item: WeeklyReminder = { ...form, title: form.title.trim(), note: form.note?.trim() || undefined, id: form.id || newId('rem'),
      memberIds: form.audience === 'members' ? form.memberIds || [] : undefined };
    const list = form.id ? reminders.map(r => r.id === form.id ? item : r) : [...reminders, item];
    if (await save(list)) setForm(null);
  };
  const remove = async (r: WeeklyReminder) => { if (window.confirm(`Xóa nhắc việc "${r.title}"?`)) await save(reminders.filter(x => x.id !== r.id)); };
  const toggle = async (r: WeeklyReminder) => save(reminders.map(x => x.id === r.id ? { ...x, active: !x.active } : x));
  const loadSamples = async () => {
    const have = new Set(reminders.map(r => r.id));
    const add = sampleReminders2026().filter(r => !have.has(r.id));
    if (!add.length) return;
    if (window.confirm(`Thêm ${add.length} nhắc việc mẫu theo kế hoạch tổ 2026 – 2027? Có thể sửa, tắt hoặc xóa sau.`)) await save([...reminders, ...add]);
  };
  const exportIcs = (scope: 'mine' | 'team') => {
    const ics = buildIcs({ calendarName: scope === 'mine' ? `Nhắc việc ${config.departmentName} – ${activeMember.displayName}` : `Nhắc việc ${config.departmentName}`,
      yearStart, yearEnd, reminders: scope === 'mine' ? mine : reminders.filter(r => r.audience === 'all'),
      tasks: scope === 'mine' ? myTasks : [], milestones: config.academicCalendar || config.calendarMilestones || [] });
    download(scope === 'mine' ? 'nhac-viec-cua-toi.ics' : 'nhac-viec-to-toan.ics', ics);
  };

  const f = form; const set = (p: Partial<WeeklyReminder>) => setForm(prev => prev ? { ...prev, ...p } : prev);
  return <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><BellRing className="w-5 h-5 text-amber-600" /><div><h2 className="text-sm font-bold">Nhắc việc hằng tuần</h2><p className="text-[11px] text-slate-500">Tuần này {fmt(weekStart)} – {fmt(weekEnd)}. Tải về Google Lịch để điện thoại tự nhắc.</p></div></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => exportIcs('mine')} className="px-2.5 py-1.5 text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1" title="Nhắc việc dành cho tôi + hạn các công việc tôi được giao"><Download className="w-3.5 h-3.5" />Lịch của tôi (.ics)</button>
        {permissions.isLeader && <button onClick={() => exportIcs('team')} className="px-2.5 py-1.5 text-[11px] font-semibold border border-amber-300 text-amber-800 rounded-lg flex items-center gap-1" title="Nhắc việc áp dụng cho cả tổ, gửi cho giáo viên"><Download className="w-3.5 h-3.5" />Lịch chung của tổ</button>}
        <button onClick={() => setOpen(o => !o)} className="px-2.5 py-1.5 text-[11px] font-semibold border rounded-lg flex items-center gap-1">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}{canEdit ? 'Quản lý nhắc việc' : 'Xem tất cả'} ({reminders.length})</button>
      </div>
    </div>

    <div className="grid md:grid-cols-2 gap-3">
      <div className="rounded-lg bg-amber-50/60 border border-amber-100 p-3">
        <div className="text-[11px] font-bold text-amber-900 mb-2">Trong tuần này <span className="font-normal text-slate-500">(nhắc việc + hạn việc được giao)</span></div>
        {thisWeek.length === 0 ? <div className="text-[11px] text-slate-500">Không có nhắc việc nào.</div> : <ul className="space-y-1">{thisWeek.map((x, i) =>
          <li key={i} className={`text-xs flex gap-2 ${x.kind === 'reminder' && x.date < today ? 'text-slate-400 line-through' : ''}`}><span className="font-semibold w-24 shrink-0">{WEEKDAYS[weekdayOf(x.date)]} {fmt(x.date)}</span><span className="w-11 shrink-0 text-slate-500">{x.time || (x.kind === 'task' ? 'Hạn' : '')}</span><span className={`min-w-0 line-clamp-2 ${x.kind === 'task' ? 'text-rose-700 font-semibold' : ''}`} title={x.title}>{x.kind === 'task' && x.date < today && <span className="mr-1 px-1.5 py-0.5 rounded bg-rose-100 text-[10px] font-bold">Quá hạn</span>}{x.title}</span></li>)}</ul>}
      </div>
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
        <div className="text-[11px] font-bold text-slate-700 mb-2">Mốc sắp tới (3 tuần)</div>
        {upcoming.length === 0 ? <div className="text-[11px] text-slate-500">Chưa có mốc nào.</div> : <ul className="space-y-1">{upcoming.map(r => <li key={r.id} className="text-xs flex gap-2"><span className="font-semibold w-24 shrink-0">{WEEKDAYS[weekdayOf(r.date!)]} {fmt(r.date!)}</span><span>{r.title}</span></li>)}</ul>}
      </div>
    </div>

    {open && <div className="space-y-3">
      {canEdit && <div className="flex flex-wrap gap-2">
        <button onClick={() => setForm(blank())} className="px-2.5 py-1.5 text-[11px] font-semibold bg-indigo-600 text-white rounded-lg flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Thêm nhắc việc</button>
        <button disabled={saving} onClick={loadSamples} className="px-2.5 py-1.5 text-[11px] font-semibold border rounded-lg disabled:opacity-50">Nạp mốc mẫu theo kế hoạch tổ 2026 – 2027</button>
      </div>}

      {f && canEdit && <form onSubmit={submit} className="border border-indigo-200 rounded-lg p-3 grid md:grid-cols-3 gap-3">
        <label className="text-xs font-semibold md:col-span-3">Nội dung nhắc<input required value={f.title} onChange={e => set({ title: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" placeholder="Ví dụ: Nộp kế hoạch bài dạy tuần sau" /></label>
        <label className="text-xs font-semibold">Kiểu<select value={f.kind} onChange={e => set({ kind: e.target.value as WeeklyReminder['kind'] })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white font-normal"><option value="weekly">Lặp lại hằng tuần</option><option value="once">Một mốc ngày</option></select></label>
        {f.kind === 'weekly' ? <>
          <label className="text-xs font-semibold">Thứ<select value={f.weekday || 1} onChange={e => set({ weekday: Number(e.target.value) })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white font-normal">{WEEKDAYS.slice(1).map((w, i) => <option key={w} value={i + 1}>{w}</option>)}</select></label>
          <label className="text-xs font-semibold">Chu kỳ<select value={f.intervalWeeks || 1} onChange={e => set({ intervalWeeks: Number(e.target.value) })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white font-normal"><option value={1}>Mỗi tuần</option><option value={2}>2 tuần/lần</option></select></label>
        </> : <label className="text-xs font-semibold md:col-span-2">Ngày<input required type="date" value={f.date || ''} onChange={e => set({ date: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>}
        <label className="text-xs font-semibold">Giờ (để trống = cả ngày)<input type="time" value={f.time || ''} onChange={e => set({ time: e.target.value || undefined })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
        <label className="text-xs font-semibold">Thời lượng (phút)<input type="number" min={5} step={5} value={f.durationMinutes || 30} onChange={e => set({ durationMinutes: Number(e.target.value) })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
        <label className="text-xs font-semibold">Báo trước<select value={f.alarmMinutes ?? 15} onChange={e => set({ alarmMinutes: Number(e.target.value) })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white font-normal">{ALARMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-xs font-semibold">Nhắc cho<select value={f.audience} onChange={e => set({ audience: e.target.value as WeeklyReminder['audience'] })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white font-normal">{Object.entries(AUDIENCE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        {f.kind === 'weekly' && <>
          <label className="text-xs font-semibold">Từ ngày<input type="date" value={f.startDate || ''} onChange={e => set({ startDate: e.target.value || undefined })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
          <label className="text-xs font-semibold">Đến ngày<input type="date" value={f.endDate || ''} onChange={e => set({ endDate: e.target.value || undefined })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
        </>}
        {f.audience === 'members' && <div className="md:col-span-3 text-xs"><div className="font-semibold mb-1">Chọn giáo viên</div><div className="flex flex-wrap gap-2">{allMembers.filter(m => m.status === 'active').map(m => <label key={m.id} className="flex items-center gap-1 border rounded px-2 py-1"><input type="checkbox" checked={(f.memberIds || []).includes(m.id)} onChange={e => set({ memberIds: e.target.checked ? [...(f.memberIds || []), m.id] : (f.memberIds || []).filter(x => x !== m.id) })} />{m.displayName}</label>)}</div></div>}
        <label className="text-xs font-semibold md:col-span-3">Ghi chú<input value={f.note || ''} onChange={e => set({ note: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
        <p className="md:col-span-3 text-[11px] text-slate-500">Nếu để trống "Từ ngày/Đến ngày", nhắc việc áp dụng trong cả năm học ({yearStart ? fmt(yearStart) + '/' + yearStart.slice(0, 4) : '…'} – {yearEnd ? fmt(yearEnd) + '/' + yearEnd.slice(0, 4) : '…'}).</p>
        <div className="md:col-span-3 flex justify-end gap-2"><button type="button" onClick={() => setForm(null)} className="px-3 py-2 text-xs border rounded-lg">Hủy</button><button disabled={saving} className="px-3 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg disabled:opacity-60">{saving ? 'Đang lưu...' : f.id ? 'Lưu thay đổi' : 'Thêm'}</button></div>
      </form>}

      {reminders.length === 0 ? <div className="py-6 text-center text-xs text-slate-500 border border-dashed rounded-lg">Chưa có nhắc việc nào{canEdit ? '. Bấm "Nạp mốc mẫu" để bắt đầu nhanh.' : '.'}</div> :
        <div className="divide-y border rounded-lg">{[...reminders].sort((a, b) => (a.kind === b.kind ? (a.kind === 'weekly' ? (a.weekday || 0) - (b.weekday || 0) : (a.date || '').localeCompare(b.date || '')) : a.kind === 'weekly' ? -1 : 1)).map(r => {
          const g = googleCalendarUrl(r, yearStart, yearEnd);
          return <div key={r.id} className={`p-3 flex flex-col md:flex-row md:items-center justify-between gap-2 ${r.active ? '' : 'opacity-50'}`}>
            <div className="min-w-0"><div className="text-xs font-bold text-slate-900">{r.title}{!r.active && <span className="ml-2 text-[10px] font-semibold text-slate-500">(đang tắt)</span>}</div>
              <div className="text-[11px] text-slate-500">{describeSchedule(r)} · {AUDIENCE[r.audience]}{r.audience === 'members' && ` (${(r.memberIds || []).map(id => allMembers.find(m => m.id === id)?.displayName).filter(Boolean).join(', ')})`}{r.note ? ` · ${r.note}` : ''}</div></div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {g && r.active && <a href={g} target="_blank" rel="noreferrer" className="px-2 py-1 text-[11px] font-semibold border border-blue-200 text-blue-700 rounded-lg flex items-center gap-1"><CalendarPlus className="w-3.5 h-3.5" />Google Lịch</a>}
              {canEdit && <><button disabled={saving} onClick={() => toggle(r)} className="px-2 py-1 text-[11px] border rounded-lg disabled:opacity-50">{r.active ? 'Tắt' : 'Bật'}</button>
                <button onClick={() => setForm({ ...blank(), ...r })} className="p-1.5 border rounded-lg text-slate-400 hover:text-indigo-600" title="Sửa"><Pencil className="w-3.5 h-3.5" /></button>
                <button disabled={saving} onClick={() => remove(r)} className="p-1.5 border rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-50" title="Xóa"><Trash2 className="w-3.5 h-3.5" /></button></>}
            </div>
          </div>;
        })}</div>}
      <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-3 leading-relaxed"><strong>Cách nhận nhắc trên điện thoại:</strong> bấm "Lịch của tôi (.ics)" → trên máy tính mở Google Lịch → Cài đặt → Nhập và xuất → chọn file vừa tải → Nhập. Lịch đồng bộ sang điện thoại và tự báo theo giờ đã đặt. Hoặc bấm "Google Lịch" ở từng dòng để thêm riêng từng nhắc việc. Nên nhập vào một lịch riêng (ví dụ tạo lịch "Nhắc việc tổ Toán"); khi tổ trưởng sửa nhắc việc, xóa lịch riêng đó rồi tải và nhập lại để không bị trùng.</div>
    </div>}
  </div>;
};
