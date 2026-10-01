import {test} from 'node:test';
import assert from 'node:assert/strict';
import {archivedAuditLogs} from '../src/utils/archivedAudit.ts';
const record={id:'old1',timestamp:'2026-09-01T00:00:00.000Z',action:'Nộp hồ sơ',actorName:'Cô A',actorId:'gv1'};
test('Nhật ký phục hồi giữ người/thời điểm cũ và được gắn nhãn nguồn nhập',()=>{
 const [log]=archivedAuditLogs([{source:'auditArchive',records:[record]}]);
 assert.equal(log.action,'[Phục hồi] Nộp hồ sơ');
 assert.equal(log.timestamp,record.timestamp);
 assert.equal(log.actorName,'Cô A');
 assert.notEqual(log.id,record.id);
});
test('Lịch sử lồng từ backup trước được đọc và khử trùng',()=>{
 const archive={source:'auditArchive',records:[record]};
 const logs=archivedAuditLogs([archive,{source:'restoreArchives',records:[archive]}]);
 assert.equal(logs.length,1);
});
test('Thời gian snapshot Firebase trong nhật ký chuyển trạng thái được giữ nguyên',()=>{
 const [log]=archivedAuditLogs([{source:'planEventArchive',records:[{id:'e1',recordedAt:{seconds:1788220800},from:'draft',to:'submitted',actorUid:'gv1',actorEmail:'a@school.test',collection:'lessonPlans',planId:'p'}]}]);
 assert.equal(log.timestamp,'2026-09-01T00:00:00.000Z');
 assert.equal(log.action,'[Phục hồi] Chuyển trạng thái');
 assert.equal(log.actorName,'a@school.test');
});
