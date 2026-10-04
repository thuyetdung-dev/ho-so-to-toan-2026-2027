import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { WorkTask, WorkTaskPriority, WorkTaskStatus } from '../../types';
import { newId, safeUrl } from '../../utils/ids';
import { priorityFor, todayIso } from '../../utils/management';
import { openReportApp } from '../../utils/reportIntegration';
import { AlertTriangle, CheckCircle2, ClipboardList, ExternalLink, Filter, Plus, Send, Trash2, UserCheck } from 'lucide-react';

const STATUS: Record<WorkTaskStatus, {label:string; cls:string}> = {
  pending:{label:'Chưa thực hiện',cls:'bg-slate-100 text-slate-700'},
  in_progress:{label:'Đang thực hiện',cls:'bg-blue-100 text-blue-700'},
  submitted:{label:'Chờ duyệt minh chứng',cls:'bg-amber-100 text-amber-800'},
  completed:{label:'Hoàn thành',cls:'bg-emerald-100 text-emerald-800'},
  returned:{label:'Cần bổ sung',cls:'bg-rose-100 text-rose-800'},
};
const PRIORITY: Record<WorkTaskPriority,string> = {low:'Thấp',normal:'Bình thường',high:'Cao',urgent:'Khẩn'};
const CATEGORIES = [
  ['plan','Kế hoạch'],['lesson','Kế hoạch bài dạy'],['observation','Dự giờ'],['meeting','SHCM'],['training','Bồi dưỡng'],['other','Khác'],
] as const;

type TaskFilter = 'all'|'mine'|'open'|'overdue'|'submitted'|'completed';
const FILTERS: readonly TaskFilter[] = ['all','mine','open','overdue','submitted','completed'];
function routeState(isLeader:boolean){
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('filter') as TaskFilter | null;
  return {
    filter: requested && FILTERS.includes(requested) ? requested : (isLeader ? 'all' : 'mine'),
    memberId: isLeader ? (params.get('member') || '') : '',
    memberEmail: params.get('memberEmail') || '',
    taskId: params.get('task') || '',
  };
}

export const OperationsModule: React.FC = () => {
  const {workTasks,saveWorkTask,deleteWorkTask,allMembers,activeMember,isMe,permissions,config,setNotification} = useApp();
  const initialRoute = routeState(permissions.isLeader);
  const [filter,setFilter] = useState<TaskFilter>(initialRoute.filter);
  const [memberFilter,setMemberFilter] = useState(initialRoute.memberId);
  const [memberEmailFilter] = useState(initialRoute.memberEmail);
  const [focusTaskId,setFocusTaskId] = useState(initialRoute.taskId);
  const focusRef = useRef<HTMLDivElement | null>(null);
  const [showForm,setShowForm] = useState(false);
  const [title,setTitle] = useState(''); const [description,setDescription] = useState('');
  const [assigneeId,setAssigneeId] = useState(allMembers[0]?.id || '');
  const [deadline,setDeadline] = useState(todayIso()); const [category,setCategory] = useState<WorkTask['category']>('other');
  const [priority,setPriority] = useState<WorkTaskPriority>('normal');
  const [saving,setSaving] = useState(false);
  const [busyTaskId,setBusyTaskId] = useState<string | null>(null);

  const scoped = useMemo(()=>workTasks.filter(t=>t.academicYear===config.academicYear),[workTasks,config.academicYear]);
  const memberScoped = useMemo(()=>memberFilter ? scoped.filter(t=>t.assigneeId===memberFilter) : scoped,[scoped,memberFilter]);
  const visible = useMemo(()=>memberScoped.filter(t=>{
    if(filter==='mine') return isMe(t.assigneeId);
    if(filter==='open') return t.status!=='completed';
    if(filter==='overdue') return t.status!=='completed' && priorityFor(t.deadline)==='overdue';
    if(filter==='submitted') return t.status==='submitted';
    if(filter==='completed') return t.status==='completed';
    return permissions.isLeader || isMe(t.assigneeId);
  }).sort((a,b)=>{
    if (focusTaskId && a.id===focusTaskId) return -1;
    if (focusTaskId && b.id===focusTaskId) return 1;
    const rank=(x:WorkTask)=>x.status==='completed'?5:priorityFor(x.deadline)==='overdue'?0:x.priority==='urgent'?1:x.priority==='high'?2:3;
    return rank(a)-rank(b)||a.deadline.localeCompare(b.deadline);
  }),[memberScoped,filter,isMe,permissions.isLeader,focusTaskId]);

  const stats = {
    total: memberScoped.length,
    open: memberScoped.filter(t=>t.status!=='completed').length,
    overdue: memberScoped.filter(t=>t.status!=='completed'&&priorityFor(t.deadline)==='overdue').length,
    submitted: memberScoped.filter(t=>t.status==='submitted').length,
    completed: memberScoped.filter(t=>t.status==='completed').length,
  };

  const selectedMember = memberFilter ? allMembers.find(m=>m.id===memberFilter) : null;
  const syncRoute = (nextFilter:TaskFilter, nextMember=memberFilter, nextTask='') => {
    setFilter(nextFilter); setMemberFilter(nextMember); setFocusTaskId(nextTask);
    const params = new URLSearchParams();
    params.set('filter', nextFilter);
    if(nextMember) params.set('member', nextMember);
    if(nextTask) params.set('task', nextTask);
    window.history.replaceState({},'',`/operations?${params.toString()}`);
  };

  useEffect(()=>{
    if(!focusTaskId) return;
    const timer=window.setTimeout(()=>focusRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),80);
    return ()=>window.clearTimeout(timer);
  },[focusTaskId,visible.length]);

  useEffect(()=>{
    if(!permissions.isLeader || memberFilter || !memberEmailFilter) return;
    const normalized=memberEmailFilter.trim().toLowerCase();
    const matched=allMembers.find(m=>{
      const email=(m as unknown as {email?:string}).email;
      return typeof email==='string' && email.trim().toLowerCase()===normalized;
    });
    if(matched) setMemberFilter(matched.id);
  },[permissions.isLeader,memberFilter,memberEmailFilter,allMembers]);

  const createTask = async (e:React.FormEvent) => {
    e.preventDefault();
    if(saving) return;
    const member=allMembers.find(m=>m.id===assigneeId); if(!member||!title.trim()) return;
    const now=new Date().toISOString();
    const task:WorkTask={id:newId('work'),title:title.trim(),description:description.trim(),category,assigneeId:member.id,assigneeName:member.displayName,deadline,priority,status:'pending',academicYear:config.academicYear,createdById:activeMember.id,createdByName:activeMember.displayName,createdAt:now,updatedAt:now};
    setSaving(true);
    try {
      if(await saveWorkTask(task)){
        setTitle('');setDescription('');setShowForm(false);syncRoute('all','');
      }
    } finally { setSaving(false); }
  };

  const patch = async (task:WorkTask, changes:Partial<WorkTask>) => {
    setBusyTaskId(task.id);
    try { return await saveWorkTask({...task,...changes,updatedAt:new Date().toISOString()}); }
    finally { setBusyTaskId(null); }
  };
  const submitEvidence = async (task:WorkTask) => {
    const evidenceNote=window.prompt('Mô tả minh chứng đã hoàn thành:',task.evidenceNote||'') ?? null; if(evidenceNote===null)return;
    const evidenceUrl=window.prompt('Đường dẫn minh chứng (Google Drive/OneDrive/website), có thể để trống:',task.evidenceUrl||'') ?? null; if(evidenceUrl===null)return;
    const now=new Date().toISOString(); await patch(task,{status:'submitted',evidenceNote:evidenceNote.trim(),evidenceUrl:evidenceUrl.trim(),submittedAt:now});
  };
  const review = async (task:WorkTask, action:'completed'|'returned') => {
    const note=window.prompt(action==='completed'?'Ghi chú xác nhận (có thể để trống):':'Nội dung cần bổ sung:','') ?? null; if(note===null)return;
    const now=new Date().toISOString(); await patch(task,{status:action,reviewNote:note.trim(),reviewedAt:now,completedAt:action==='completed'?now:undefined});
  };

  return <div className="space-y-5">
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
      <div><div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-600"/><h1 className="text-xl font-bold">Điều hành công việc & minh chứng</h1></div><p className="text-xs text-slate-500 mt-1">Giao việc → thực hiện → nộp minh chứng → duyệt → tự động đưa vào tiến độ/KPI.</p></div>
      {permissions.isLeader&&<button onClick={()=>setShowForm(v=>!v)} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2"><Plus className="w-4 h-4"/>Giao việc mới</button>}
    </div>

    {showForm&&permissions.isLeader&&<form onSubmit={createTask} className="bg-white border border-indigo-200 rounded-xl p-5 grid md:grid-cols-2 gap-3">
      <label className="text-xs font-semibold md:col-span-2">Tên công việc<input required value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" placeholder="Ví dụ: Hoàn thiện hồ sơ chuyên đề tháng 10"/></label>
      <label className="text-xs font-semibold">Người phụ trách<select value={assigneeId} onChange={e=>setAssigneeId(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white font-normal">{allMembers.filter(m=>m.status==='active').map(m=><option key={m.id} value={m.id}>{m.displayName}</option>)}</select></label>
      <label className="text-xs font-semibold">Hạn hoàn thành<input required type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"/></label>
      <label className="text-xs font-semibold">Nhóm công việc<select value={category} onChange={e=>setCategory(e.target.value as WorkTask['category'])} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white font-normal">{CATEGORIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="text-xs font-semibold">Mức ưu tiên<select value={priority} onChange={e=>setPriority(e.target.value as WorkTaskPriority)} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white font-normal">{Object.entries(PRIORITY).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="text-xs font-semibold md:col-span-2">Yêu cầu / sản phẩm cần nộp<textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"/></label>
      <div className="md:col-span-2 flex justify-end gap-2"><button type="button" disabled={saving} onClick={()=>setShowForm(false)} className="px-3 py-2 text-xs border rounded-lg disabled:opacity-50">Hủy</button><button disabled={saving} className="px-3 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg disabled:opacity-60 disabled:cursor-not-allowed">{saving?'Đang lưu...':'Lưu & giao việc'}</button></div>
    </form>}

    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[['Tổng việc',stats.total,'all'],['Đang mở',stats.open,'open'],['Quá hạn',stats.overdue,'overdue'],['Chờ duyệt',stats.submitted,'submitted'],['Hoàn thành',stats.completed,'completed']].map(([l,v,f],i)=><button key={String(l)} onClick={()=>syncRoute(f as TaskFilter)} className={`bg-white border rounded-xl p-4 text-left hover:shadow-sm hover:border-blue-300 transition ${filter===f?'ring-2 ring-blue-100 border-blue-300':''}`}><div className="text-[11px] text-slate-500">{l}</div><div className={`text-2xl font-black mt-1 ${i===2&&Number(v)>0?'text-rose-600':'text-slate-900'}`}>{v}</div></button>)}
    </div>

    <div className="bg-white border rounded-xl p-4">
      {selectedMember&&<div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"><div className="text-xs text-blue-900"><strong>Đang lọc giáo viên:</strong> {selectedMember.displayName}</div><button onClick={()=>syncRoute(filter,'')} className="text-[11px] font-semibold text-blue-700 hover:underline">Bỏ lọc giáo viên</button></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2 text-xs font-bold"><Filter className="w-4 h-4 text-slate-500"/>Danh sách công việc</div><div className="flex flex-wrap gap-1">{([['mine','Của tôi'],['all','Toàn tổ'],['open','Đang mở'],['overdue','Quá hạn'],['submitted','Chờ duyệt'],['completed','Hoàn thành']] as const).map(([v,l])=><button key={v} onClick={()=>syncRoute(v)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${filter===v?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'}`}>{l}</button>)}</div></div>
      {visible.length===0?<div className="py-10 text-center text-xs text-slate-500 border border-dashed rounded-lg">Không có công việc phù hợp bộ lọc.</div>:<div className="space-y-3">{visible.map(task=>{
        const overdue=task.status!=='completed'&&priorityFor(task.deadline)==='overdue'; const mine=isMe(task.assigneeId); const url=safeUrl(task.evidenceUrl);
        return <div key={task.id} ref={focusTaskId===task.id?focusRef:undefined} className={`border rounded-xl p-4 transition ${focusTaskId===task.id?'ring-2 ring-indigo-300 border-indigo-300 bg-indigo-50/30':overdue?'border-rose-200 bg-rose-50/30':'border-slate-200'}`}>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900">{task.title}</h3><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS[task.status].cls}`}>{STATUS[task.status].label}</span>{overdue&&<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Quá hạn</span>}</div><div className="text-[11px] text-slate-500 mt-1">{task.assigneeName} · Hạn {new Date(task.deadline+'T00:00:00').toLocaleDateString('vi-VN')} · Ưu tiên {PRIORITY[task.priority]}</div>{task.description&&<p className="text-xs text-slate-700 mt-2">{task.description}</p>}{task.evidenceNote&&<div className="mt-2 p-2 bg-slate-50 rounded text-[11px]"><strong>Minh chứng:</strong> {task.evidenceNote}{url&&<a href={url} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 inline-flex items-center gap-1">Mở link <ExternalLink className="w-3 h-3"/></a>}</div>}{task.reviewNote&&<div className="mt-2 text-[11px] text-slate-600"><strong>Phản hồi:</strong> {task.reviewNote}</div>}{task.submittedAt&&<div className="mt-1 text-[10px] text-slate-400">Nộp minh chứng: {new Date(task.submittedAt).toLocaleString('vi-VN')}</div>}{task.completedAt&&<div className="mt-1 text-[10px] text-emerald-600 font-semibold">Xác nhận hoàn thành: {new Date(task.completedAt).toLocaleString('vi-VN')}</div>}</div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {mine&&['pending','returned'].includes(task.status)&&<button disabled={busyTaskId===task.id} onClick={()=>patch(task,{status:'in_progress'})} className="px-2.5 py-1.5 text-[11px] font-semibold border rounded-lg disabled:opacity-50">{busyTaskId===task.id?'Đang cập nhật...':'Bắt đầu'}</button>}
            {mine&&['pending','in_progress','returned'].includes(task.status)&&<button disabled={busyTaskId===task.id} onClick={()=>submitEvidence(task)} className="px-2.5 py-1.5 text-[11px] font-semibold bg-blue-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"><Send className="w-3 h-3"/>{busyTaskId===task.id?'Đang nộp...':'Nộp minh chứng'}</button>}
            {permissions.isLeader&&task.status==='submitted'&&<><button disabled={busyTaskId===task.id} onClick={()=>review(task,'completed')} className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"><CheckCircle2 className="w-3 h-3"/>{busyTaskId===task.id?'Đang duyệt...':'Xác nhận'}</button><button disabled={busyTaskId===task.id} onClick={()=>review(task,'returned')} className="px-2.5 py-1.5 text-[11px] font-semibold border border-rose-200 text-rose-700 rounded-lg disabled:opacity-50">Yêu cầu bổ sung</button></>}
            <button onClick={()=>{const member=allMembers.find(m=>m.id===task.assigneeId);openReportApp({task,member});}} className="px-2.5 py-1.5 text-[11px] font-semibold border border-indigo-200 text-indigo-700 rounded-lg flex items-center gap-1" title="Mở công việc này trong App Báo cáo"><ExternalLink className="w-3 h-3"/>Báo cáo</button>
            {permissions.isLeader&&<button onClick={async()=>{if(window.confirm('Xóa công việc này?'))await deleteWorkTask(task.id)}} className="p-1.5 border rounded-lg text-slate-400 hover:text-rose-600" title="Xóa"><Trash2 className="w-3.5 h-3.5"/></button>}
          </div></div>
        </div>})}</div>}
    </div>
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3"><UserCheck className="w-5 h-5 text-indigo-600 shrink-0"/><div className="text-xs text-indigo-900"><strong>Nguyên tắc quản trị:</strong> KPI không nhập thủ công. Chỉ công việc đã có người phụ trách, deadline và được xác nhận hoàn thành mới được tính vào nhóm nhiệm vụ chuyên môn.</div></div>
  </div>;
};
