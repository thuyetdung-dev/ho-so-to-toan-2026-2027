import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scopeRecords,reportData,savedEvidence,inRange} from '../src/utils/reporting.ts';
test('Cùng ngày nhưng khác năm học bị loại; trùng ID chỉ tính một lần; ngày thiếu và sai bị loại',()=>{
 const rows=[{id:'a',academicYear:'2026-2027',date:'2026-10-02'},{id:'a',academicYear:'2026-2027',date:'2026-10-02'},{id:'b',academicYear:'2025-2026',date:'2026-10-02'},{id:'c',date:'2026-10-02'},{id:'d',date:'2026-02-30'},{id:'e'}];
 assert.deepEqual(scopeRecords(rows,'2026-2027','2026-01-01','2027-07-31',r=>r.date).map(r=>r.id),['a','c']);
 assert.equal(inRange('2026-02-30','2026-01-01','2026-12-31'),false);
});
test('Báo cáo chỉ tính hồ sơ đến hôm nay, không đếm trùng',()=>{
 const data:any={meetings:[],observations:[],specialTopics:[],lessonPlans:[{id:'p',createdAt:'2026-10-02'},{id:'p',createdAt:'2026-10-02'},{id:'future',createdAt:'2026-10-03'}]};
 assert.deepEqual(reportData(data,'2026-08-01','2027-07-31','2026-10-02','2026-2027').lessonPlans.map(r=>r.id),['p']);
});
test('Xuất theo minh chứng đã lưu không lấy hồ sơ mới và từ chối minh chứng mất',()=>{
 assert.deepEqual(savedEvidence([{id:'a'},{id:'b'}],['a','a']),[{id:'a'}]);
 assert.throws(()=>savedEvidence([{id:'b'}],['a']),/không còn tồn tại/);
});
