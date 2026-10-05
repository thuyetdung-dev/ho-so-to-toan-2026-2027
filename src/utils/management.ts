import type { DepartmentPlan, LessonPlan, Meeting, Member, ObservationRecord, TeacherPlan, TrainingRecord, AuditLog, WorkTask, KpiWeights } from '../types';
export type WorkPriority = 'overdue' | 'today' | 'soon' | 'normal';
export interface WorkItem { id:string;title:string;detail:string;deadline?:string;priority:WorkPriority;module:'plans'|'lesson-plans'|'lesson-study'|'members'|'operations';owner?:string;kind:string }
/** Date-only comparisons always use the Vietnamese calendar, independent of device timezone. */
export function todayIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = (type:string) => parts.find(p=>p.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validDay(day: string | undefined): day is string {
  return !!day && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day;
}
export function priorityFor(date?:string, now = new Date()):WorkPriority {
  if (!validDay(date)) return 'normal';
  const today=todayIso(now);
  if(date<today)return 'overdue'; if(date===today)return 'today';
  return (Date.parse(date)-Date.parse(today))/86400000<=7?'soon':'normal';
}
const normalizedName=(name:string)=>name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
/** Legacy names are only resolvable when one exact full name exists. Never substring-match. */
export function resolveAssigneeId(task:{assigneeId?:string;assigneeName?:string;assignee?:string},members:Member[]):string|undefined {
  if(task.assigneeId) return members.some(m=>m.id===task.assigneeId)?task.assigneeId:undefined;
  const name=normalizedName(task.assigneeName || task.assignee || '');
  if(!name)return undefined;
  const matches=members.filter(m=>normalizedName(m.displayName)===name);
  return matches.length===1?matches[0].id:undefined;
}
export function linkTaskAssignees<T extends {assigneeId?:string;assigneeName?:string;assignee?:string}>(tasks:T[],members:Member[]):Array<T & {assigneeId?:string}> {
  return tasks.map(t=>{const id=resolveAssigneeId(t,members);return id?{...t,assigneeId:id}:t;});
}
export interface ManagementScope { academicYear?:string;startDate?:string;endDate?:string }
export function recordInScope(record:Record<string,any>,scope:ManagementScope,date?:string):boolean {
  if ((scope.startDate && !validDay(scope.startDate)) || (scope.endDate && !validDay(scope.endDate)) || (scope.startDate && scope.endDate && scope.startDate > scope.endDate)) return false;
  if(scope.academicYear && record.academicYear && record.academicYear!==scope.academicYear)return false;
  const year=/^(\d{4})-(\d{4})$/.exec(scope.academicYear || '');
  const start=scope.startDate || (year?`${year[1]}-08-01`:undefined);
  const end=scope.endDate || (year?`${year[2]}-07-31`:undefined);
  if(!start&&!end)return true;
  const day=date?.slice(0,10);
  // A record assigned to a year without a date can count for that whole year, not a custom period.
  if(!validDay(day))return !!record.academicYear && !scope.startDate && !scope.endDate;
  return (!start || day>=start)&&(!end || day<=end);
}
export function buildWorkCenter(args:{departmentPlans:DepartmentPlan[];teacherPlans:TeacherPlan[];lessonPlans:LessonPlan[];meetings:Meeting[];workTasks?:WorkTask[];isLeader:boolean;canApproveDeptPlan?:boolean;activeMember:Member;members?:Member[];academicYear?:string;isMe:(id?:string|null)=>boolean;now?:Date}) {
  const {activeMember,isLeader,isMe}=args;
  // Tổ trưởng/Quản trị tự duyệt được hồ sơ của mình nên vẫn thấy việc cần duyệt của chính mình
  const selfReview=activeMember.role==='head'||activeMember.role==='admin';
  const notReviewable=(id?:string|null)=>!selfReview&&isMe(id);
  const members=args.members || []; const scope={academicYear:args.academicYear};
  const departmentPlans=args.departmentPlans.filter(p=>recordInScope(p,scope));
  const teacherPlans=args.teacherPlans.filter(p=>recordInScope(p,scope));
  const lessonPlans=args.lessonPlans.filter(p=>recordInScope(p,scope,p.createdAt||p.updatedAt));
  const meetings=args.meetings.filter(p=>recordInScope(p,scope,p.date));
  const items:WorkItem[]=[];
  if(args.canApproveDeptPlan) departmentPlans.filter(p=>p.status==='submitted' && !(notReviewable(p.createdById)||(!selfReview&&p.createdBy===activeMember.displayName))).forEach(p=>items.push({id:`dp-${p.id}`,title:'Duyệt kế hoạch của tổ',detail:p.title,priority:'today',module:'plans',kind:'approval'}));
  if(isLeader || activeMember.role==='principal') {
    teacherPlans.filter(p=>p.status==='submitted'&&!notReviewable(p.teacherId)).forEach(p=>items.push({id:`tp-${p.id}`,title:'Duyệt kế hoạch giáo viên',detail:`${p.teacherName} · ${p.title}`,priority:'today',module:'plans',owner:p.teacherName,kind:'approval'}));
    lessonPlans.filter(p=>p.status==='submitted'&&!notReviewable(p.teacherId)).forEach(p=>items.push({id:`lp-${p.id}`,title:'Duyệt kế hoạch bài dạy',detail:`${p.teacherName} · ${p.title||p.topicTitle}`,priority:'today',module:'lesson-plans',owner:p.teacherName,kind:'approval'}));
  }
  teacherPlans.filter(p=>isMe(p.teacherId)&&p.status==='returned').forEach(p=>items.push({id:`tp-${p.id}`,title:'Kế hoạch bị trả lại',detail:p.title,priority:'today',module:'plans',kind:'revision'}));
  lessonPlans.filter(p=>isMe(p.teacherId)&&p.status==='returned').forEach(p=>items.push({id:`lp-${p.id}`,title:'Giáo án cần chỉnh sửa',detail:p.title||p.topicTitle,priority:'today',module:'lesson-plans',kind:'revision'}));
  const mine=(t:{assigneeId?:string;assigneeName?:string;assignee?:string})=>{const id=resolveAssigneeId(t,members);return !!id&&isMe(id);};
  meetings.forEach(m=>(m.tasks||[]).filter(t=>t.status!=='completed'&&(isLeader||mine(t))).forEach(t=>items.push({id:`mt-${m.id}-${t.id}`,title:t.title,detail:`Biên bản: ${m.title} · Phụ trách: ${t.assigneeName}`,deadline:t.deadline,priority:priorityFor(t.deadline,args.now),module:'lesson-study',owner:t.assigneeName,kind:'meeting-task'})));
  departmentPlans.forEach(p=>(p.tasks||[]).filter(t=>t.status!=='completed'&&(isLeader||mine(t))).forEach(t=>items.push({id:`pt-${p.id}-${t.id}`,title:t.title,detail:`Công việc chuyên môn · ${t.assignee}`,deadline:t.deadline,priority:priorityFor(t.deadline,args.now),module:'plans',owner:t.assignee,kind:'professional-task'})));
  (args.workTasks||[]).filter(t=>t.academicYear===args.academicYear&&t.status!=='completed'&&(isLeader||isMe(t.assigneeId))).forEach(t=>items.push({id:`work-${t.id}`,title:t.title,detail:`Điều hành · ${t.assigneeName}${t.status==='submitted'?' · Chờ duyệt minh chứng':''}`,deadline:t.deadline,priority:priorityFor(t.deadline,args.now),module:'operations',owner:t.assigneeName,kind:'work-task'}));
  const rank:Record<WorkPriority,number>={overdue:0,today:1,soon:2,normal:3};
  return items.sort((a,b)=>rank[a.priority]-rank[b.priority]||(a.deadline||'9999').localeCompare(b.deadline||'9999'));
}
export interface KpiEvidence {label:string;value:string;refs:string[];score:number;max:number;hasData:boolean}
export interface TeacherKpi {total:number;evidence:KpiEvidence[];hasData:boolean;missingGroups:number;unassignedTasks:number}
/** An indicative document progress score, never a formal personnel assessment. */
export function teacherKpi(member:Member,data:{teacherPlans:TeacherPlan[];lessonPlans:LessonPlan[];observations:ObservationRecord[];meetings:Meeting[];trainings:TrainingRecord[];workTasks?:WorkTask[];members?:Member[];today?:string},scope:ManagementScope={},weights:KpiWeights={teacherPlans:25,lessonPlans:30,observations:20,professionalTasks:15,trainings:10}):TeacherKpi {
  const tp=data.teacherPlans.filter(p=>p.teacherId===member.id&&recordInScope(p,scope,p.updatedAt));
  const lp=data.lessonPlans.filter(p=>p.teacherId===member.id&&recordInScope(p,scope,p.createdAt||p.updatedAt));
  const obs=data.observations.filter(o=>o.observerId===member.id&&recordInScope(o,scope,o.date));
  const relevantMeetings=data.meetings.filter(m=>m.status==='finalized'&&recordInScope(m,scope,m.date));
  const allTasks=relevantMeetings.flatMap(m=>(m.tasks||[]).map(t=>({...t,meeting:m.title})));
  const members=data.members||[];
  const mineCentral=(data.workTasks||[]).filter(t=>t.assigneeId===member.id&&recordInScope(t,scope,t.createdAt));
  // Việc chưa đến hạn (vd. đầu việc vừa chọn từ công văn) không bị tính là "chưa hoàn thành"
  const now=new Date();
  const today=data.today||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const centralTasks=mineCentral.filter(t=>t.status==='completed'||!t.deadline||t.deadline<today);
  const notDue=mineCentral.length-centralTasks.length;
  const tasks=[...allTasks.filter(t=>resolveAssigneeId(t,members)===member.id),...centralTasks.map(t=>({...t,meeting:'Trung tâm điều hành'}))];
  const tr=data.trainings.filter(t=>t.teacherId===member.id&&recordInScope(t,scope,t.updatedAt));
  const ratio=(done:number,total:number,max:number)=>total?Math.round(max*done/total):0;
  const approvedTp=tp.filter(p=>p.status==='approved').length;
  const approvedLp=lp.filter(p=>p.status==='approved').length;
  const reviewedObs=obs.filter(o=>o.status==='reviewed'&&!!o.lessonsLearned?.trim());
  const trainDone=tr.filter(t=>['completed','hoàn thành','done'].includes(String(t.status).toLowerCase()));
  const evidence:KpiEvidence[]=[
    {label:'Kế hoạch giáo dục',value:tp.length?`${approvedTp}/${tp.length} hồ sơ được duyệt`:'Chưa có dữ liệu',refs:tp.map(p=>`${p.id} · ${p.title}`),score:ratio(approvedTp,tp.length,weights.teacherPlans),max:weights.teacherPlans,hasData:tp.length>0},
    {label:'Kế hoạch bài dạy',value:lp.length?`${approvedLp}/${lp.length} giáo án được duyệt`:'Chưa có dữ liệu',refs:lp.map(p=>`${p.id} · ${p.title||p.topicTitle}`),score:ratio(approvedLp,lp.length,weights.lessonPlans),max:weights.lessonPlans,hasData:lp.length>0},
    {label:'Dự giờ & rút kinh nghiệm',value:obs.length?`${reviewedObs.length}/${obs.length} lượt dự đã rà soát, có rút kinh nghiệm`:'Chưa có dữ liệu',refs:obs.map(o=>`${o.id} · ${o.date} · ${o.lessonName}`),score:ratio(reviewedObs.length,obs.length,weights.observations),max:weights.observations,hasData:obs.length>0},
    {label:'Nhiệm vụ SHCM',value:(tasks.length?`${tasks.filter(t=>t.status==='completed').length}/${tasks.length} nhiệm vụ đến hạn đã hoàn thành`:(notDue?'Chưa có nhiệm vụ đến hạn':'Chưa có nhiệm vụ xác định người thực hiện'))+(notDue?` · ${notDue} việc chưa đến hạn`:''),refs:tasks.map(t=>`${t.id} · ${t.meeting}: ${t.title}`),score:ratio(tasks.filter(t=>t.status==='completed').length,tasks.length,weights.professionalTasks),max:weights.professionalTasks,hasData:tasks.length>0},
    {label:'Bồi dưỡng chuyên môn',value:tr.length?`${trainDone.length}/${tr.length} nội dung hoàn thành`:'Chưa có dữ liệu',refs:tr.map(t=>`${t.id} · ${t.moduleName}`),score:ratio(trainDone.length,tr.length,weights.trainings),max:weights.trainings,hasData:tr.length>0},
  ];
  return {total:evidence.reduce((s,e)=>s+e.score,0),evidence,hasData:evidence.some(e=>e.hasData),missingGroups:evidence.filter(e=>!e.hasData).length,unassignedTasks:allTasks.filter(t=>!resolveAssigneeId(t,members)).length};
}
export function entityAudit(logs:AuditLog[],targetId:string){return logs.filter(l=>l.targetId===targetId).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));}
