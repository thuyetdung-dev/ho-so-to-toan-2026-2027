import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,serverTimestamp,writeBatch,collection,deleteDoc} from 'firebase/firestore';
import {readFileSync} from 'node:fs';
const env=await initializeTestEnvironment({projectId:'demo-hoso-upgrade',firestore:{rules:readFileSync(new URL('../firestore.rules', import.meta.url),'utf8'),host:'127.0.0.1',port:8080}});
let count=0;
async function check(label,op,allowed) {await (allowed?assertSucceeds(op):assertFails(op));count++;console.log('PASS',label);}
async function traced(db, col, id, patch) {
 const ref=doc(db,col,id); const old=await getDoc(ref);
 if (!patch.status || patch.status===old.data().status) return updateDoc(ref,patch);
 const eventRef=doc(collection(db,'planEvents')); const batch=writeBatch(db);
 batch.update(ref,{...patch,_eventId:eventRef.id});
 // UID/email are mapped explicitly to each test database.
 const role=Object.keys(dbs).find(k=>dbs[k]===db);
 batch.set(eventRef,{collection:col,planId:id,from:old.data().status,to:patch.status,actorUid:role,actorEmail:`${role}@school.test`,recordedAt:serverTimestamp()});
 return batch.commit();
}
const names={teacher:'Giáo viên',head:'Tổ trưởng',deputy:'Tổ phó',principal:'BGH',admin:'Quản trị'};
const dbs={};
for(const role of Object.keys(names)) dbs[role]=env.authenticatedContext(role,{email:`${role}@school.test`,email_verified:true,name:names[role]}).firestore();
try {
 await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   for(const role of Object.keys(names)) {await setDoc(doc(db,'members',role),{email:`${role}@school.test`,role,displayName:names[role]});await setDoc(doc(db,'accessIndex',`${role}@school.test`),{memberId:role,role,email:`${role}@school.test`});}
   for(const c of ['teacherPlans','lessonPlans']) for(const owner of ['teacher','head','admin']) await setDoc(doc(db,c,`${owner}-submitted`),{teacherId:owner,status:'submitted',title:'Bài 1',version:1,comments:[]});
   await setDoc(doc(db,'lessonPlans','approved'),{teacherId:'teacher',status:'approved',title:'Đã duyệt',version:1});
   await setDoc(doc(db,'lessonPlans','draft'),{teacherId:'teacher',status:'draft',title:'Nháp',version:1});
   await setDoc(doc(db,'departmentPlans','own-principal'),{createdBy:'Tên cũ',createdById:'principal',status:'submitted',title:'Kế hoạch',version:1});
   await setDoc(doc(db,'departmentPlans','dp'),{createdBy:'Tổ trưởng',status:'submitted',title:'Kế hoạch',version:1});
   await setDoc(doc(db,'reportSnapshots','locked'),{title:'Báo cáo',isLocked:true,metrics:{meetingsCount:2}});
 });
 for(const c of ['teacherPlans','lessonPlans']) {
   await check(c+' self head denied',traced(dbs.head,c,'head-submitted',{status:'approved'}),false);
   await check(c+' self admin denied',traced(dbs.admin,c,'admin-submitted',{status:'approved'}),false);
   await check(c+' teacher self denied',traced(dbs.teacher,c,'teacher-submitted',{status:'approved'}),false);
   await check(c+' review content denied',traced(dbs.head,c,'teacher-submitted',{status:'approved',title:'Sửa'}),false);
   await check(c+' BGH reviews leader',traced(dbs.principal,c,'head-submitted',{status:'approved'}),true);
   await check(c+' head reviews teacher',traced(dbs.head,c,'teacher-submitted',{status:'returned'}),true);
 }
 for(const c of ['teacherPlans','lessonPlans']) await check(c+' create approved denied even admin',setDoc(doc(dbs.admin,c,'new-approved'),{teacherId:'admin',status:'approved'}),false);
 await check('teacher creates own draft',setDoc(doc(dbs.teacher,'teacherPlans','new-draft'),{teacherId:'teacher',status:'draft'}),true);
 await check('head creates draft on behalf',setDoc(doc(dbs.head,'lessonPlans','new-draft'),{teacherId:'teacher',status:'draft'}),true);
 await check('teacher cannot create for others',setDoc(doc(dbs.teacher,'lessonPlans','other-draft'),{teacherId:'head',status:'draft'}),false);
 await check('BGH cannot create draft',setDoc(doc(dbs.principal,'lessonPlans','principal-draft'),{teacherId:'principal',status:'draft'}),false);
 await check('approved content immutable',traced(dbs.admin,'lessonPlans','approved',{title:'Sửa'}),false);
 await check('owner teaching status',traced(dbs.teacher,'lessonPlans','approved',{isTaught:true,taughtDate:'2026-10-01'}),true);
 await check('approved split content denied',setDoc(doc(dbs.head,'lessonPlanContent','approved'),{planId:'approved',text:'Sửa'}),false);
 await check('draft split content allowed',setDoc(doc(dbs.teacher,'lessonPlanContent','draft'),{planId:'draft',text:'Nội dung'}),true);
 await check('teacher submits own draft',traced(dbs.teacher,'lessonPlans','draft',{status:'submitted'}),true);
 await check('submitted split content denied',setDoc(doc(dbs.teacher,'lessonPlanContent','draft'),{planId:'draft',text:'Sửa'}),false);
 await check('BGH cannot self approve department by id',traced(dbs.principal,'departmentPlans','own-principal',{status:'approved'}),false);
 await check('BGH cannot edit department content',traced(dbs.principal,'departmentPlans','dp',{title:'Sửa'}),false);
 await check('head cannot approve department',traced(dbs.head,'departmentPlans','dp',{status:'approved'}),false);
 await check('BGH approves department',traced(dbs.principal,'departmentPlans','dp',{status:'approved'}),true);
 await check('department cannot silently edit approved',traced(dbs.head,'departmentPlans','dp',{title:'Sửa'}),false);
 await check('new department revision',traced(dbs.head,'departmentPlans','dp',{status:'draft',version:2,title:'Điều chỉnh'}),true);
 await check('locked report content denied even admin',updateDoc(doc(dbs.admin,'reportSnapshots','locked'),{title:'Sửa'}),false);
 await check('deputy cannot unlock',updateDoc(doc(dbs.deputy,'reportSnapshots','locked'),{isLocked:false}),false);
 await check('head unlock only',updateDoc(doc(dbs.head,'reportSnapshots','locked'),{isLocked:false}),true);
 await check('head edits unlocked',updateDoc(doc(dbs.head,'reportSnapshots','locked'),{title:'Điều chỉnh'}),true);
 await check('teacher cannot create report',setDoc(doc(dbs.teacher,'reportSnapshots','new'),{isLocked:false}),false);
 const log={actorId:'teacher',actorUid:'teacher',actorEmail:'teacher@school.test',recordedAt:serverTimestamp(),action:'Kiểm thử'};
 await check('verified audit allowed',setDoc(doc(dbs.teacher,'auditLogs','log1'),log),true);
 await check('spoof actor denied',setDoc(doc(dbs.teacher,'auditLogs','log2'),{...log,actorId:'head'}),false);
 await check('spoof uid denied',setDoc(doc(dbs.teacher,'auditLogs','log3'),{...log,actorUid:'head'}),false);
 await check('audit immutable',updateDoc(doc(dbs.admin,'auditLogs','log1'),{action:'Sửa'}),false);
 await check('unauth read denied',getDoc(doc(env.unauthenticatedContext().firestore(),'lessonPlans','approved')),false);
 // Bản 2.15: tiến độ riêng, thao tác nguyên tử, lịch sử bất biến và phục hồi có thời hạn.
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'departmentPlans','progress-plan'),{createdBy:'head',createdById:'head',status:'approved',version:1,distribution:[{id:'row1'}]});
  await setDoc(doc(db,'lessonPlans','fresh'),{teacherId:'teacher',status:'draft',version:1});
 });
 const progress={id:'progress-plan__row1',planId:'progress-plan',itemId:'row1',itemIndex:0,status:'completed',dateTaught:'2026-10-01',updatedAt:'2026-10-01',updatedByUid:'head'};
 await check('head updates approved plan progress',setDoc(doc(dbs.head,'departmentProgress',progress.id),progress),true);
 await check('teacher progress denied',setDoc(doc(dbs.teacher,'departmentProgress',progress.id),{...progress,updatedByUid:'teacher'}),false);
 await check('principal progress allowed',setDoc(doc(dbs.principal,'departmentProgress',progress.id),{...progress,updatedByUid:'principal'}),true);
 await check('invalid row denied',setDoc(doc(dbs.head,'departmentProgress','progress-plan__unknown'),{...progress,id:'progress-plan__unknown',itemId:'unknown'}),false);
 await check('draft cannot self return',traced(dbs.teacher,'lessonPlans','fresh',{status:'returned'}),false);
 await check('transition without immutable event denied',updateDoc(doc(dbs.teacher,'lessonPlans','fresh'),{status:'submitted'}),false);
 const atomic=writeBatch(dbs.teacher);
 atomic.set(doc(dbs.teacher,'lessonPlans','atomic'),{teacherId:'teacher',status:'draft'});
 atomic.set(doc(dbs.teacher,'lessonPlanContent','atomic'),{planId:'atomic',text:'Nội dung'});
 atomic.set(doc(dbs.teacher,'lessonPlanVersions','atomic__v0'),{planId:'atomic',index:0,version:1,snapshot:{text:'Gốc'}});
 await check('atomic parent and parts creation',atomic.commit(),true);
 await check('version cannot be deleted separately',deleteDoc(doc(dbs.teacher,'lessonPlanVersions','atomic__v0')),false);
 await check('version immutable even draft',updateDoc(doc(dbs.teacher,'lessonPlanVersions','atomic__v0'),{snapshot:{text:'Sửa'}}),false);
 await check('append event only with real transition',setDoc(doc(dbs.teacher,'planEvents','forged'),{collection:'lessonPlans',planId:'fresh',from:'draft',to:'approved',actorUid:'teacher',actorEmail:'teacher@school.test',recordedAt:serverTimestamp()}),false);
 await check('admin cannot restore approved without session',setDoc(doc(dbs.admin,'lessonPlans','restored'),{teacherId:'teacher',status:'approved',_restoreSession:'r1'}),false);
 const session={sessionId:'r1',status:'active',expiresAt:new Date(Date.now()+29*60*1000)};
 await check('head cannot open restore session',setDoc(doc(dbs.head,'restoreSessions','head'),session),false);
 await check('admin opens bounded restore session',setDoc(doc(dbs.admin,'restoreSessions','admin'),session),true);
 await check('admin restores approved with matching session',setDoc(doc(dbs.admin,'lessonPlans','restored'),{teacherId:'teacher',status:'approved',_restoreSession:'r1'}),true);
 await check('wrong session denied',setDoc(doc(dbs.admin,'lessonPlanContent','restored'),{planId:'restored',text:'Sai',_restoreSession:'wrong'}),false);
 await check('admin restores split approved content',setDoc(doc(dbs.admin,'lessonPlanContent','restored'),{planId:'restored',text:'Đủ',_restoreSession:'r1'}),true);
 await check('admin restores locked report',setDoc(doc(dbs.admin,'reportSnapshots','locked'),{title:'Phục hồi',isLocked:true,_restoreSession:'r1'}),true);
 await check('session cannot exceed thirty minutes',updateDoc(doc(dbs.admin,'restoreSessions','admin'),{expiresAt:new Date(Date.now()+60*60*1000)}),false);
 await check('admin closes session',updateDoc(doc(dbs.admin,'restoreSessions','admin'),{status:'completed'}),true);
 await check('closed session denied',setDoc(doc(dbs.admin,'lessonPlanContent','restored'),{planId:'restored',text:'Ngoài phiên',_restoreSession:'r1'}),false);
 const cleanup=writeBatch(dbs.head);
 cleanup.delete(doc(dbs.head,'lessonPlanContent','draft'));
 cleanup.delete(doc(dbs.head,'lessonPlans','draft'));
 await check('head atomically deletes submitted parent and content',cleanup.commit(),true);
 // Cloudinary v2, Firebase v1 and task assignment regression checks.
 await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await setDoc(doc(db,'lessonPlans','cloud-draft'),{teacherId:'teacher',status:'draft'});
   await setDoc(doc(db,'lessonPlans','cloud-other'),{teacherId:'head',status:'draft'});
   await setDoc(doc(db,'lessonPlans','cloud-approved'),{teacherId:'teacher',status:'approved'});
   await setDoc(doc(db,'meetings','task-meeting'),{status:'draft',tasks:[{id:'t1',title:'One',assigneeId:'teacher',assigneeName:'GV',status:'pending'},{id:'t2',title:'Two',assigneeId:'head',assigneeName:'TT',status:'pending'}]});
 });
 const cloudMeta=(planId,imageId='h1')=>({planId,imageId,provider:'cloudinary',publicId:`ho-so-to-toan/lesson-plans/${planId}/${imageId}--12345678-1234-1234-1234-123456789abc`,secureUrl:`https://res.cloudinary.com/test-cloud/image/upload/v1/ho-so-to-toan/lesson-plans/${planId}/${imageId}.png`,bytes:100,storageVersion:2});
 await check('Cloudinary metadata own draft allowed',setDoc(doc(dbs.teacher,'lessonPlanImages','cloud-draft__h1'),cloudMeta('cloud-draft')),true);
 await check('Cloudinary ID containing double hyphen allowed',setDoc(doc(dbs.teacher,'lessonPlanImages','cloud-draft__h--2'),cloudMeta('cloud-draft','h--2')),true);
 await check('Cloudinary cannot replace same image object in historical references',updateDoc(doc(dbs.teacher,'lessonPlanImages','cloud-draft__h1'),{publicId:'ho-so-to-toan/lesson-plans/cloud-draft/h1--11111111-1111-1111-1111-111111111111'}),false);
 await check('Cloudinary cannot alter image URL in historical references',updateDoc(doc(dbs.teacher,'lessonPlanImages','cloud-draft__h1'),{secureUrl:'https://res.cloudinary.com/test-cloud/image/upload/v1/another.png'}),false);
 await check('Firebase metadata v1 still allowed',setDoc(doc(dbs.teacher,'lessonPlanImages','cloud-draft__legacy'),{planId:'cloud-draft',imageId:'legacy',storagePath:'lessonPlanImages/cloud-draft/legacy',bytes:100,storageVersion:1}),true);
 await check('other teacher image denied',setDoc(doc(dbs.teacher,'lessonPlanImages','cloud-other__h1'),cloudMeta('cloud-other')),false);
 await check('approved image denied even admin',setDoc(doc(dbs.admin,'lessonPlanImages','cloud-approved__h1'),cloudMeta('cloud-approved')),false);
 await check('provider version mismatch denied',setDoc(doc(dbs.teacher,'lessonPlanImages','cloud-draft__h2'),{...cloudMeta('cloud-draft','h2'),storageVersion:1}),false);
 await check('foreign plan publicId denied',setDoc(doc(dbs.teacher,'lessonPlanImages','cloud-draft__h2'),{...cloudMeta('cloud-draft','h2'),publicId:'ho-so-to-toan/lesson-plans/cloud-other/h2'}),false);
 await check('non-Cloudinary URL denied',setDoc(doc(dbs.teacher,'lessonPlanImages','cloud-draft__h2'),{...cloudMeta('cloud-draft','h2'),secureUrl:'https://example.test/a.png'}),false);
 await check('Cloudinary rejects base64 field',setDoc(doc(dbs.teacher,'lessonPlanImages','cloud-draft__h2'),{...cloudMeta('cloud-draft','h2'),data:'data:image/png;base64,AA'}),false);
 await check('Cloudinary oversized metadata denied',setDoc(doc(dbs.teacher,'lessonPlanImages','cloud-draft__h2'),{...cloudMeta('cloud-draft','h2'),bytes:5000000}),false);
 const originalTasks=(await getDoc(doc(dbs.teacher,'meetings','task-meeting'))).data().tasks;
 await check('teacher can update own task status by ID',updateDoc(doc(dbs.teacher,'meetings','task-meeting'),{tasks:originalTasks.map(t=>t.id==='t1'?{...t,status:'completed'}:t)}),true);
 const currentTasks=(await getDoc(doc(dbs.teacher,'meetings','task-meeting'))).data().tasks;
 await check('teacher cannot update another task',updateDoc(doc(dbs.teacher,'meetings','task-meeting'),{tasks:currentTasks.map(t=>t.id==='t2'?{...t,status:'completed'}:t)}),false);
 await check('teacher cannot change task ownership',updateDoc(doc(dbs.teacher,'meetings','task-meeting'),{tasks:currentTasks.map(t=>t.id==='t1'?{...t,assigneeId:'head'}:t)}),false);
 await check('teacher cannot change task title',updateDoc(doc(dbs.teacher,'meetings','task-meeting'),{tasks:currentTasks.map(t=>t.id==='t1'?{...t,title:'Changed'}:t)}),false);
 await check('leader can link legacy assignee ID',setDoc(doc(dbs.head,'meetings','legacy-meeting'),{status:'draft',tasks:[{id:'t1',title:'Old',assigneeName:'GV',assigneeId:'teacher',status:'pending'}]}),true);
 console.log(`RULES: ${count} checks passed`);
} finally {await env.cleanup();}
