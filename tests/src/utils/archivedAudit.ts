import type {AuditLog} from '../types';
/** Lịch sử nhập từ backup được gắn nhãn riêng, không coi là xác thực mới. */
export function archivedAuditLogs(archives: any[]): AuditLog[] {
  const logs = new Map<string,AuditLog>();
  const visit = (archive: any, depth = 0) => {
    if (depth > 16 || !Array.isArray(archive?.records)) return;
    if (archive.source === 'restoreArchives') {archive.records.forEach((a:any) => visit(a,depth+1)); return;}
    for (const record of archive.records) {
      if (archive.source === 'auditArchive' && typeof record?.timestamp === 'string' && typeof record?.action === 'string') {
        const key = `${record.id}_${record.timestamp}`;
        logs.set(key,{...record,id:`archive_${key}`,action:`[Phục hồi] ${record.action}`});
      } else if (archive.source === 'planEventArchive') {
        const seconds = record?.recordedAt?.seconds ?? record?.recordedAt?._seconds;
        if (typeof seconds !== 'number' || !Number.isFinite(seconds) || Math.abs(seconds) > 8.64e12) continue;
        const timestamp = new Date(seconds*1000).toISOString();
        const key = `event_${record.id}_${timestamp}`;
        logs.set(key,{id:`archive_${key}`,action:'[Phục hồi] Chuyển trạng thái',actorId:record.actorUid || '',
          actorUid:record.actorUid,actorEmail:record.actorEmail,actorName:record.actorEmail || record.actorUid || '',
          targetType:record.collection || '',targetId:record.planId || '',details:`${record.from} → ${record.to}`,timestamp});
      }
    }
  };
  archives.forEach(archive => visit(archive));
  return [...logs.values()];
}
