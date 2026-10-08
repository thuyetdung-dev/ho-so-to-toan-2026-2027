import type { UserRole } from '../types';
const leaders = ['admin', 'head', 'deputy'];
export const reviewFields = ['status','approvedBy','updatedAt','comments','versionHistory','version'];
/** Trường được đổi khi người soạn rút hồ sơ đã nộp/đã duyệt về bản nháp để sửa hoặc xóa */
export const reopenFields = ['status','approvedBy','updatedAt','versionHistory','version','_eventId','contentState'];
/** Người soạn (hoặc Tổ trưởng/Quản trị) rút hồ sơ cá nhân đang chờ duyệt / đã duyệt về bản nháp */
export function canReopenPlan(before: Record<string, any> | undefined, after: Record<string, any>, role: UserRole, own: boolean) {
  if (!before || !['submitted','approved'].includes(before.status) || after.status !== 'draft') return false;
  if (after.teacherId !== before.teacherId) return false;
  const headOrAdmin = role === 'admin' || role === 'head';
  if (!(headOrAdmin || (own && role !== 'principal'))) return false;
  const changed = Object.keys({...before,...after}).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  return changed.every(k => reopenFields.includes(k));
}
export function canUpdatePlan(before: Record<string, any> | undefined, after: Record<string, any>, role: UserRole, own: boolean, department = false) {
  const leader = leaders.includes(role);
  if (!before) return (leader || (!department && own && role === 'teacher')) && after.status === 'draft';
  if (department && after.createdById !== before.createdById) return false;
  if (department ? after.createdBy !== before.createdBy : after.teacherId !== before.teacherId) return false;
  const changed = Object.keys({...before,...after}).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const headOrAdmin = role === 'admin' || role === 'head';
  const reviewing = headOrAdmin || (department ? role === 'principal' : leader || role === 'principal');
  if (before.status === 'submitted' && ['approved','returned'].includes(after.status)) {
    // Tổ trưởng/Quản trị được duyệt cả hồ sơ của chính mình
    return reviewing && (!own || headOrAdmin) && changed.every(k => reviewFields.includes(k));
  }
  if (department) {
    return leader && (['draft','returned'].includes(before.status) && (['draft','submitted'].includes(after.status) || before.status === 'returned' && after.status === 'returned')
      || ['approved','submitted'].includes(before.status) && after.status === 'draft' && after.version > before.version);
  }
  if (canReopenPlan(before, after, role, own)) return true;
  if (['draft','returned'].includes(before.status)) return (leader || own && role === 'teacher') && (['draft','submitted'].includes(after.status) || before.status === 'returned' && after.status === 'returned');
  return own && before.status === after.status && changed.every(k => ['teachingStatus','isTaught','taughtDate','taughtClasses','updatedAt','contentState'].includes(k));
}
