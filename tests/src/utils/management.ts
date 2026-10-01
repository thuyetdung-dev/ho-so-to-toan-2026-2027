import type { DepartmentPlan, LessonPlan, Meeting, Member, ObservationRecord, TeacherPlan, TrainingRecord, AuditLog } from '../types';

export type WorkPriority = 'overdue' | 'today' | 'soon' | 'normal';
export interface WorkItem {
  id: string; title: string; detail: string; deadline?: string; priority: WorkPriority;
  module: 'plans'|'lesson-plans'|'lesson-study'|'members'; owner?: string; kind: string;
}

const isoToday = () => new Date().toISOString().slice(0,10);
const dayDiff = (date?: string) => date ? Math.ceil((new Date(date+'T23:59:59').getTime()-Date.now())/86400000) : 9999;
const priorityFor = (date?: string): WorkPriority => {
  const d=dayDiff(date); if(d<0) return 'overdue'; if(d===0) return 'today'; if(d<=7) return 'soon'; return 'normal';
};

export function buildWorkCenter(args:{departmentPlans:DepartmentPlan[]; teacherPlans:TeacherPlan[]; lessonPlans:LessonPlan[]; meetings:Meeting[]; isLeader:boolean; activeMember:Member; isMe:(id?:string|null)=>boolean}){
  const {departmentPlans,teacherPlans,lessonPlans,meetings,isLeader,activeMember,isMe}=args;
  const items:WorkItem[]=[];
  if(isLeader){
    departmentPlans.filter(p=>p.status==='submitted').forEach(p=>items.push({id:`dp-${p.id}`,title:'Duyệt kế hoạch của tổ',detail:p.title,priority:'today',module:'plans',kind:'approval'}));
    teacherPlans.filter(p=>p.status==='submitted').forEach(p=>items.push({id:`tp-${p.id}`,title:'Duyệt kế hoạch giáo viên',detail:`${p.teacherName} · ${p.title}`,priority:'today',module:'plans',owner:p.teacherName,kind:'approval'}));
    lessonPlans.filter(p=>p.status==='submitted').forEach(p=>items.push({id:`lp-${p.id}`,title:'Duyệt kế hoạch bài dạy',detail:`${p.teacherName} · ${p.title||p.topicTitle}`,priority:'today',module:'lesson-plans',owner:p.teacherName,kind:'approval'}));
  } else {
    teacherPlans.filter(p=>isMe(p.teacherId)&&p.status==='returned').forEach(p=>items.push({id:`tp-${p.id}`,title:'Kế hoạch bị trả lại',detail:p.title,priority:'today',module:'plans',kind:'revision'}));
    lessonPlans.filter(p=>isMe(p.teacherId)&&p.status==='returned').forEach(p=>items.push({id:`lp-${p.id}`,title:'Giáo án cần chỉnh sửa',detail:p.title||p.topicTitle,priority:'today',module:'lesson-plans',kind:'revision'}));
  }
  meetings.forEach(m=>m.tasks.filter(t=>t.status!=='completed' && (isLeader || t.assigneeName.toLowerCase().includes(activeMember.displayName.toLowerCase()) || activeMember.displayName.toLowerCase().includes(t.assigneeName.toLowerCase()))).forEach(t=>items.push({id:`mt-${m.id}-${t.id}`,title:t.title,detail:`Biên bản: ${m.title} · Phụ trách: ${t.assigneeName}`,deadline:t.deadline,priority:priorityFor(t.deadline),module:'lesson-study',owner:t.assigneeName,kind:'meeting-task'})));
  departmentPlans.flatMap(p=>p.tasks||[]).filter(t=>t.status!=='completed' && (isLeader || t.assignee.toLowerCase().includes(activeMember.displayName.toLowerCase()))).forEach(t=>items.push({id:`pt-${t.id}`,title:t.title,detail:`Công việc chuyên môn · ${t.assignee}`,deadline:t.deadline,priority:priorityFor(t.deadline),module:'plans',owner:t.assignee,kind:'professional-task'}));
  const rank:Record<WorkPriority,number>={overdue:0,today:1,soon:2,normal:3};
  return items.sort((a,b)=>rank[a.priority]-rank[b.priority] || (a.deadline||'9999').localeCompare(b.deadline||'9999'));
}

export interface KpiEvidence { label:string; value:string; refs:string[]; score:number; max:number }
export interface TeacherKpi { total:number; evidence:KpiEvidence[] }
export function teacherKpi(member:Member, data:{teacherPlans:TeacherPlan[];lessonPlans:LessonPlan[];observations:ObservationRecord[];meetings:Meeting[];trainings:TrainingRecord[]}):TeacherKpi{
  const tp=data.teacherPlans.filter(p=>p.teacherId===member.id); const lp=data.lessonPlans.filter(p=>p.teacherId===member.id);
  const obs=data.observations.filter(o=>o.teacherId===member.id||o.observerId===member.id);
  const tasks=data.meetings.flatMap(m=>m.tasks.map(t=>({...t,meeting:m.title}))).filter(t=>t.assigneeName.toLowerCase().includes(member.displayName.toLowerCase())||member.displayName.toLowerCase().includes(t.assigneeName.toLowerCase()));
  const tr=data.trainings.filter(t=>t.teacherId===member.id);
  const planScore=tp.some(p=>p.status==='approved')?25:tp.some(p=>p.status==='submitted')?18:tp.length?10:0;
  const lpApproved=lp.filter(p=>p.status==='approved').length; const lessonScore=lp.length?Math.round(30*lpApproved/lp.length):0;
  const obsScore=Math.min(20,obs.length*10);
  const done=tasks.filter(t=>t.status==='completed').length; const taskScore=tasks.length?Math.round(15*done/tasks.length):15;
  const trainDone=tr.filter(t=>['completed','hoàn thành','done'].includes(String(t.status).toLowerCase())).length; const trainScore=tr.length?Math.round(10*trainDone/tr.length):0;
  const evidence:KpiEvidence[]=[
    {label:'Kế hoạch giáo dục',value:`${tp.filter(p=>p.status==='approved').length}/${tp.length||1} hồ sơ được duyệt`,refs:tp.map(p=>p.title),score:planScore,max:25},
    {label:'Kế hoạch bài dạy',value:`${lpApproved}/${lp.length} giáo án được duyệt`,refs:lp.map(p=>p.title||p.topicTitle),score:lessonScore,max:30},
    {label:'Dự giờ & rút kinh nghiệm',value:`${obs.length} lượt liên quan`,refs:obs.map(o=>`${o.date} · ${o.lessonName}`),score:obsScore,max:20},
    {label:'Nhiệm vụ SHCM',value:`${done}/${tasks.length} nhiệm vụ hoàn thành`,refs:tasks.map(t=>`${t.meeting}: ${t.title}`),score:taskScore,max:15},
    {label:'Bồi dưỡng chuyên môn',value:`${trainDone}/${tr.length} nội dung hoàn thành`,refs:tr.map(t=>t.moduleName),score:trainScore,max:10},
  ];
  return {total:evidence.reduce((s,e)=>s+e.score,0),evidence};
}

export function entityAudit(logs:AuditLog[], targetId:string){ return logs.filter(l=>l.targetId===targetId).sort((a,b)=>b.timestamp.localeCompare(a.timestamp)); }
export const todayIso=isoToday;
