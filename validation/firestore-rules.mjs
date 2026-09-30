import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,serverTimestamp} from 'firebase/firestore';
import {readFileSync} from 'node:fs';
const env=await initializeTestEnvironment({projectId:'demo-hoso-upgrade',firestore:{rules:readFileSync(new URL('../firestore.rules', import.meta.url),'utf8'),host:'127.0.0.1',port:8080}});
let count=0;
async function check(label,op,allowed) {await (allowed?assertSucceeds(op):assertFails(op));count++;console.log('PASS',label);}
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
   await check(c+' self head denied',updateDoc(doc(dbs.head,c,'head-submitted'),{status:'approved'}),false);
   await check(c+' self admin denied',updateDoc(doc(dbs.admin,c,'admin-submitted'),{status:'approved'}),false);
   await check(c+' teacher self denied',updateDoc(doc(dbs.teacher,c,'teacher-submitted'),{status:'approved'}),false);
   await check(c+' review content denied',updateDoc(doc(dbs.head,c,'teacher-submitted'),{status:'approved',title:'Sửa'}),false);
   await check(c+' BGH reviews leader',updateDoc(doc(dbs.principal,c,'head-submitted'),{status:'approved'}),true);
   await check(c+' head reviews teacher',updateDoc(doc(dbs.head,c,'teacher-submitted'),{status:'returned'}),true);
 }
 for(const c of ['teacherPlans','lessonPlans']) await check(c+' create approved denied even admin',setDoc(doc(dbs.admin,c,'new-approved'),{teacherId:'admin',status:'approved'}),false);
 await check('teacher creates own draft',setDoc(doc(dbs.teacher,'teacherPlans','new-draft'),{teacherId:'teacher',status:'draft'}),true);
 await check('head creates draft on behalf',setDoc(doc(dbs.head,'lessonPlans','new-draft'),{teacherId:'teacher',status:'draft'}),true);
 await check('teacher cannot create for others',setDoc(doc(dbs.teacher,'lessonPlans','other-draft'),{teacherId:'head',status:'draft'}),false);
 await check('BGH cannot create draft',setDoc(doc(dbs.principal,'lessonPlans','principal-draft'),{teacherId:'principal',status:'draft'}),false);
 await check('approved content immutable',updateDoc(doc(dbs.admin,'lessonPlans','approved'),{title:'Sửa'}),false);
 await check('owner teaching status',updateDoc(doc(dbs.teacher,'lessonPlans','approved'),{isTaught:true,taughtDate:'2026-10-01'}),true);
 await check('approved split content denied',setDoc(doc(dbs.head,'lessonPlanContent','approved'),{planId:'approved',text:'Sửa'}),false);
 await check('draft split content allowed',setDoc(doc(dbs.teacher,'lessonPlanContent','draft'),{planId:'draft',text:'Nội dung'}),true);
 await check('teacher submits own draft',updateDoc(doc(dbs.teacher,'lessonPlans','draft'),{status:'submitted'}),true);
 await check('submitted split content denied',setDoc(doc(dbs.teacher,'lessonPlanContent','draft'),{planId:'draft',text:'Sửa'}),false);
 await check('BGH cannot self approve department by id',updateDoc(doc(dbs.principal,'departmentPlans','own-principal'),{status:'approved'}),false);
 await check('BGH cannot edit department content',updateDoc(doc(dbs.principal,'departmentPlans','dp'),{title:'Sửa'}),false);
 await check('head cannot approve department',updateDoc(doc(dbs.head,'departmentPlans','dp'),{status:'approved'}),false);
 await check('BGH approves department',updateDoc(doc(dbs.principal,'departmentPlans','dp'),{status:'approved'}),true);
 await check('department cannot silently edit approved',updateDoc(doc(dbs.head,'departmentPlans','dp'),{title:'Sửa'}),false);
 await check('new department revision',updateDoc(doc(dbs.head,'departmentPlans','dp'),{status:'draft',version:2,title:'Điều chỉnh'}),true);
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
 console.log(`RULES: ${count} checks passed`);
} finally {await env.cleanup();}
