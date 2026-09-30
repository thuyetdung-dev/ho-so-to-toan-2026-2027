import type { UserRole } from '../types';
const leaders = ['admin', 'head', 'deputy'];
export const reviewFields = ['status','approvedBy','updatedAt','comments','versionHistory','version'];
export function canUpdatePlan(before: Record<string, any> | undefined, after: Record<string, any>, role: UserRole, own: boolean, department = false) {
  const leader = leaders.includes(role);
  if (!before) return (leader || (!department && own && role === 'teacher')) && after.status === 'draft';
  if (department && after.createdById !== before.createdById) return false;
  if (department ? after.createdBy !== before.createdBy : after.teacherId !== before.teacherId) return false;
  const changed = Object.keys({...before,...after}).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const reviewing = department ? role === 'principal' : leader || role === 'principal';
  if (before.status === 'submitted' && ['approved','returned'].includes(after.status)) {
    return reviewing && !own && changed.every(k => reviewFields.includes(k));
  }
  if (department) {
    return leader && (['draft','returned'].includes(before.status) && ['draft','returned','submitted'].includes(after.status)
      || ['approved','submitted'].includes(before.status) && after.status === 'draft' && after.version > before.version);
  }
  if (['draft','returned'].includes(before.status)) return (leader || own && role === 'teacher') && ['draft','returned','submitted'].includes(after.status);
  return own && before.status === after.status && changed.every(k => ['teachingStatus','isTaught','taughtDate','taughtClasses','updatedAt','contentState'].includes(k));
}
