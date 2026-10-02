import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teacherKpi,priorityFor,todayIso,resolveAssigneeId,linkTaskAssignees,buildWorkCenter} from '../src/utils/management.ts';
const member:any={id:'m1',displayName:'Nguyễn Văn An',role:'teacher'};
const other:any={id:'m2',displayName:'Nguyễn Văn An Bình',role:'teacher'};
const empty:any={teacherPlans:[],lessonPlans:[],observations:[],meetings:[],trainings:[],members:[member,other]};
test('Vietnam date is correct across UTC midnight; today/overdue/7 days do not use device timezone',()=>{
 const now=new Date('2026-10-01T23:14:00Z');assert.equal(todayIso(now),'2026-10-02');
 assert.equal(priorityFor('2026-10-02',now),'today');assert.equal(priorityFor('2026-10-01',now),'overdue');
 assert.equal(priorityFor('2026-10-09',now),'soon');assert.equal(priorityFor('2026-10-10',now),'normal');
 assert.equal(priorityFor('2026-02-30',now),'normal');assert.equal(priorityFor(undefined,now),'normal');
});
test('assignees use ID or a unique exact full name; substring, blanks and duplicate names never match',()=>{
 assert.equal(resolveAssigneeId({assigneeName:other.displayName},[member,other]),'m2');
 assert.equal(resolveAssigneeId({assigneeName:'An'},[member,other]),undefined);
 assert.equal(resolveAssigneeId({assigneeName:member.displayName},[member,{...other,displayName:member.displayName}]),undefined);
 assert.equal(resolveAssigneeId({assigneeId:'m2',assigneeName:member.displayName},[member,other]),'m2');
 assert.equal(resolveAssigneeId({assigneeName:''},[member]),undefined);
 assert.equal(linkTaskAssignees([{assignee:member.displayName}],[member])[0].assigneeId,'m1');
});
test('no evidence means zero and no-data state, not automatic 15 points',()=>{
 const k=teacherKpi(member,empty);assert.equal(k.total,0);assert.equal(k.hasData,false);assert.equal(k.missingGroups,5);
});
test('approved plan points reflect all plans; only reviewed observations with lessons count and receiving a visit earns no observer points',()=>{
 const data={...empty,teacherPlans:[{id:'p1',teacherId:'m1',status:'approved',title:'A'},{id:'p2',teacherId:'m1',status:'draft',title:'B'}],observations:[
 {id:'o1',teacherId:'m1',observerId:'m2',status:'reviewed',lessonsLearned:'Done',date:'2026-10-01'},
 {id:'o2',observerId:'m1',status:'reviewed',lessonsLearned:'Useful',date:'2026-10-01'},
 {id:'o3',observerId:'m1',status:'submitted',lessonsLearned:'',date:'2026-10-01'}]};
 const k=teacherKpi(member,data);assert.equal(k.evidence[0].score,13);assert.equal(k.evidence[2].score,10);
});
test('KPI excludes other years, future-period records, unfinalized meetings and ambiguous names',()=>{
 const data={...empty,teacherPlans:[{id:'p1',teacherId:'m1',title:'Old',status:'approved',academicYear:'2025-2026'}],lessonPlans:[{id:'lp1',teacherId:'m1',createdAt:'2026-09-01',title:'Early',status:'approved'}],meetings:[
 {id:'mt1',title:'Họp',date:'2026-10-01',status:'finalized',tasks:[{id:'t1',title:'Done',assigneeId:'m1',assigneeName:member.displayName,status:'completed'},{id:'t2',assigneeName:'An',status:'completed'}]},
 {id:'mt2',title:'Draft',date:'2026-10-02',status:'draft',tasks:[{id:'t3',assigneeId:'m1',status:'completed'}]}]};
 const k=teacherKpi(member,data,{academicYear:'2026-2027',startDate:'2026-10-01',endDate:'2026-10-31'});
 assert.equal(k.evidence[0].score,0);assert.equal(k.evidence[1].score,0);assert.equal(k.evidence[3].score,15);assert.equal(k.evidence[3].refs.length,1);assert.equal(k.unassignedTasks,1);
});
test('work center never assigns another teacher by substring and honors department reviewer role',()=>{
 const args:any={...empty,departmentPlans:[{id:'dp1',title:'KH',academicYear:'2026-2027',status:'submitted',createdById:'m2',tasks:[]}],activeMember:member,isLeader:false,isMe:(id:string)=>id==='m1',academicYear:'2026-2027',meetings:[{id:'mt1',title:'Họp',date:'2026-10-02',tasks:[{id:'t1',title:'Wrong',assigneeName:other.displayName,status:'pending',deadline:'2026-10-02'},{id:'t2',title:'Own',assigneeId:'m1',status:'pending',deadline:'2026-10-02'}]}],now:new Date('2026-10-02T02:00Z')};
 assert.deepEqual(buildWorkCenter(args).map(x=>x.title),['Own']);assert.equal(buildWorkCenter(args)[0].priority,'today');
 assert.equal(buildWorkCenter({...args,isLeader:true,canApproveDeptPlan:false}).some(x=>x.id==='dp-dp1'),false);
 assert.equal(buildWorkCenter({...args,canApproveDeptPlan:true}).some(x=>x.id==='dp-dp1'),true);
});
