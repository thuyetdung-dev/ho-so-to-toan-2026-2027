import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportData, reportRange, validRange, inRange } from '../src/utils/reporting.ts';
import { canUpdatePlan } from '../src/utils/workflow.ts';
test('Khoảng ngày bao gồm hai biên, loại ngày không hợp lệ và ngày thiếu', () => {
  assert.equal(inRange('2026-10-01T09:00:00Z','2026-10-01','2026-10-31'),true);
  assert.equal(inRange('2026-10-31','2026-10-01','2026-10-31'),true);
  assert.equal(inRange(undefined,'2026-10-01','2026-10-31'),false);
  assert.equal(validRange('2026-02-30','2026-10-31'),false);
  assert.equal(validRange('2026-11-01','2026-10-31'),false);
  assert.deepEqual(reportRange('2026-2027','Giữa HK2'),{startDate:'2027-01-16',endDate:'2027-03-31'});
});
test('Báo cáo loại họp chưa chốt, họp tương lai, hoạt động ngoài kỳ và chuyên đề thiếu ngày', () => {
  const data:any = { meetings:[{id:'a',date:'2026-10-01',status:'finalized'},{id:'b',date:'2026-10-02',status:'draft'},{id:'c',date:'2026-10-31',status:'finalized'},{id:'d',date:'2026-09-30',status:'finalized'}], observations:[{id:'o',date:'2026-10-10'},{id:'future',date:'2026-10-30'}], lessonPlans:[{id:'p',createdAt:'2026-10-02',updatedAt:'2026-11-01'},{id:'old',updatedAt:'2026-10-03'}], specialTopics:[{id:'s'},{id:'s2',date:'2026-10-12'}]};
  const result=reportData(data,'2026-10-01','2026-10-31','2026-10-15');
  assert.deepEqual(result.meetings.map(p=>p.id),['a']);
  assert.deepEqual(result.observations.map(p=>p.id),['o']);
  assert.deepEqual(result.lessonPlans.map(p=>p.id),['p','old']);
  assert.deepEqual(result.specialTopics.map(p=>p.id),['s2']);
  assert.deepEqual(result.pendingMeetings.map(p=>p.id),['b','c']);
});
const before:any={teacherId:'t1',status:'submitted',title:'Bài 1',version:1};
test('Tổ trưởng/Quản trị tự duyệt được; tổ phó, giáo viên thì không; BGH có thể duyệt',()=>{
  const after={...before,status:'approved',comments:[]};
  for(const role of ['admin','head'] as const) assert.equal(canUpdatePlan(before,after,role,true),true);
  for(const role of ['deputy','teacher','principal'] as const) assert.equal(canUpdatePlan(before,after,role,true),false);
  assert.equal(canUpdatePlan(before,after,'head',true,true),true);
  assert.equal(canUpdatePlan(before,after,'deputy',false,true),false);
  assert.equal(canUpdatePlan(before,after,'head',false),true);
  assert.equal(canUpdatePlan(before,after,'principal',false),true);
  assert.equal(canUpdatePlan(before,after,'teacher',false),false);
});
test('Duyệt không được sửa nội dung hoặc đổi chủ sở hữu',()=>{
  assert.equal(canUpdatePlan(before,{...before,status:'approved',title:'Sửa nội dung'},'head',false),false);
  assert.equal(canUpdatePlan(before,{...before,status:'approved',teacherId:'t2'},'head',false),false);
  assert.equal(canUpdatePlan(before,{...before,title:'Sửa nội dung'},'admin',false),false);
});
test('Hồ sơ đã duyệt khóa nội dung; giáo viên giữ quyền cập nhật thực dạy',()=>{
  const approved={...before,status:'approved'};
  assert.equal(canUpdatePlan(approved,{...approved,title:'Mới'},'admin',false),false);
  assert.equal(canUpdatePlan(approved,{...approved,isTaught:true,taughtDate:'2026-10-01'},'teacher',true),true);
  assert.equal(canUpdatePlan(approved,{...approved,isTaught:true},'head',false),false);
});
test('Nháp được trình; tạo mới không được tự gán trạng thái đã duyệt',()=>{
  const draft={...before,status:'draft'};
  assert.equal(canUpdatePlan(draft,{...draft,status:'submitted'},'teacher',true),true);
  assert.equal(canUpdatePlan(draft,{...draft,status:'approved'},'head',true),false);
  assert.equal(canUpdatePlan(undefined,{...draft,status:'approved'},'admin',false),false);
});
test('Kế hoạch tổ: BGH chỉ duyệt, lãnh đạo tạo bản nháp điều chỉnh phiên bản mới',()=>{
  const p:any={createdBy:'Tổ trưởng',status:'submitted',version:1,title:'Kế hoạch'};
  assert.equal(canUpdatePlan(p,{...p,status:'approved'},'principal',false,true),true);
  assert.equal(canUpdatePlan(p,{...p,status:'approved',title:'Mới'},'principal',false,true),false);
  assert.equal(canUpdatePlan(p,{...p,status:'draft',version:2},'head',true,true),true);
  assert.equal(canUpdatePlan(p,{...p,status:'draft'},'head',true,true),false);
});

test('Không tự chuyển nháp sang trả lại; hồ sơ trả lại vẫn được chỉnh sửa/nộp lại', () => {
  const draft = {...before, status:'draft'};
  for (const role of ['teacher','head','admin'] as const) {
    assert.equal(canUpdatePlan(draft, {...draft,status:'returned'},role,true),false);
  }
  const returned = {...draft,status:'returned'};
  assert.equal(canUpdatePlan(returned, {...returned,title:'Đã sửa'},'teacher',true),true);
  assert.equal(canUpdatePlan(returned, {...returned,status:'submitted'},'teacher',true),true);
  const dept:any = {createdBy:'Tổ trưởng',createdById:'head',status:'draft',version:1};
  assert.equal(canUpdatePlan(dept, {...dept,status:'returned'},'head',true,true),false);
});

test('V2.21: người soạn rút kế hoạch đã nộp/đã duyệt về bản nháp để sửa', () => {
  const base = { id: 'p1', teacherId: 'gv-1', status: 'approved', version: 3, updatedAt: '2026-10-01', approvedBy: 'Tổ trưởng', sections: [] };
  const reopen = { ...base, status: 'draft', version: 4, updatedAt: '2026-10-08', approvedBy: '' };
  assert.equal(canUpdatePlan(base, reopen, 'teacher', true), true);
  assert.equal(canUpdatePlan({ ...base, status: 'submitted' }, reopen, 'teacher', true), true);
  // Không phải người soạn thì không rút được (trừ Tổ trưởng/Quản trị)
  assert.equal(canUpdatePlan(base, reopen, 'teacher', false), false);
  assert.equal(canUpdatePlan(base, reopen, 'deputy', false), false);
  assert.equal(canUpdatePlan(base, reopen, 'head', false), true);
  assert.equal(canUpdatePlan(base, reopen, 'principal', true), false);
  // Không được kèm sửa nội dung trong bước rút về
  assert.equal(canUpdatePlan(base, { ...reopen, sections: [{ id: 'x' }] }, 'teacher', true), false);
  // Không được đổi chủ kế hoạch
  assert.equal(canUpdatePlan(base, { ...reopen, teacherId: 'gv-2' }, 'teacher', true), false);
});
