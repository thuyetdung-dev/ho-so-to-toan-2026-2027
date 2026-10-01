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
 const store = await import('../src/services/lessonPlanStore.ts');
 const actualPlan={id:'service-flow',teacherId:'teacher',teacherName:'GV',title:'Kiểm tra nguyên tử',topicTitle:'Bài',grade:10,week:1,periodCount:1,classNames:['10A1'],status:'draft',version:1,updatedAt:'2026-10-01',comments:[],
  objectivesKnowledge:'Kiến thức',objectivesCompetence:'Năng lực',objectivesQualities:'Phẩm chất',equipment:'Bảng',activities:[{id:'a1',name:'HĐ1',objectives:'Mục tiêu',content:'![H](img:h1)',product:'Sản phẩm',implementation:'Thực hiện'}],images:{h1:'data:image/png;base64,AA'},contentState:'full',versionHistory:[]};
 const actor={uid:'teacher',email:'teacher@school.test'};
 await check('actual service atomic create',store.writeLessonPlan(dbs.teacher,actualPlan,{isNew:true,actor}),true);
 const submitted={...actualPlan,status:'submitted',version:2,versionHistory:[{version:2,updatedAt:'2026-10-01',updatedBy:'GV',changeSummary:'Nộp',status:'submitted',dataSnapshot:{title:'Bài',activities:actualPlan.activities}}]};
 await check('actual service submit with immutable snapshot and event',store.writeLessonPlan(dbs.teacher,submitted,{isNew:false,prevImageIds:['h1'],actor}),true);
 await check('actual service cannot edit submitted content',store.writeLessonPlan(dbs.teacher,{...submitted,title:'Sửa lén'},{isNew:false,prevImageIds:['h1'],actor}),false);
 await check('return service plan through trace',traced(dbs.head,'lessonPlans','service-flow',{status:'returned'}),true);
 const returned={...submitted,status:'returned',title:'Đã sửa'};
 await check('actual service preserves snapshot regardless of key ordering',store.writeLessonPlan(dbs.teacher,returned,{isNew:false,prevImageIds:['h1'],actor}),true);
 const snapshotRef=doc(dbs.teacher,'lessonPlanVersions','service-flow__v0');
 const originalSnapshot=(await getDoc(snapshotRef)).data().snapshot;
 let immutableRejected=false;
 try {await store.writeLessonPlan(dbs.teacher,{...returned,versionHistory:[{...returned.versionHistory[0],dataSnapshot:{title:'Sửa lịch sử'}}]},{isNew:false,actor});} catch {immutableRejected=true;}
 if (!immutableRejected || JSON.stringify((await getDoc(snapshotRef)).data().snapshot)!==JSON.stringify(originalSnapshot)) throw new Error('Service altered immutable version');
 count++; console.log('PASS actual service rejects altered history before commit');
 const fullBackup=await store.loadAllLessonPlansFull(dbs.head,[store.hydrateLessonPlan((await getDoc(doc(dbs.head,'lessonPlans','service-flow'))).data(),'service-flow')]);
 if (fullBackup[0].contentState!=='full' || !fullBackup[0].images.h1 || !fullBackup[0].versionHistory[0].dataSnapshot) throw new Error('Backup incomplete');
 count++; console.log('PASS actual service backup includes content images snapshots');
 await check('actual service atomic delete returned by head',store.deleteLessonPlanDeep(dbs.head,fullBackup[0]),true);
 const afterDelete=await getDoc(doc(dbs.head,'lessonPlanContent','service-flow'));
 if(afterDelete.exists()) throw new Error('Content orphan after delete');
 count++; console.log('PASS actual service deletes all parts');
 console.log(`RULES: ${count} checks passed`);
} finally {await env.cleanup();}
