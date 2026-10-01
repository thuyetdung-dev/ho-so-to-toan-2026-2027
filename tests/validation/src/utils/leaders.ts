import type { DepartmentConfig, SchoolLeader, UserRole } from '../types';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
const isPrincipal = (l: SchoolLeader) => /^hieu truong/.test(fold(l.title.trim()));

/**
 * Người ký duyệt kế hoạch của tổ: người được đánh dấu "ký duyệt kế hoạch";
 * nếu chưa chọn thì Phó hiệu trưởng phụ trách chuyên môn, cuối cùng là Hiệu trưởng.
 */
export function planApprover(config: Pick<DepartmentConfig, 'schoolLeaders'>): SchoolLeader | undefined {
  const list = (config.schoolLeaders || []).filter(l => l.name.trim());
  return list.find(l => l.signsPlans) || list.find(l => /chuyen mon/.test(fold(l.title))) || list.find(isPrincipal);
}

/**
 * Tổ trưởng chuyên môn – người ký ô "TỔ TRƯỞNG" của Phụ lục III.
 *
 * Khác với `planApprover`: Phụ lục I do Ban giám hiệu ký duyệt, còn Phụ lục III
 * (kế hoạch của giáo viên) do tổ trưởng của chính tổ ký, không phải Hiệu trưởng
 * hay Phó hiệu trưởng. Lấy theo vai trò trong danh sách thành viên; chưa gán ai
 * làm tổ trưởng thì để trống chứ không điền tên người khác.
 */
export function departmentHead<T extends { role: UserRole; displayName: string }>(members: T[]): T | undefined {
  const named = (members || []).filter(m => m.displayName?.trim());
  return named.find(m => m.role === 'head') || named.find(m => m.role === 'admin');
}

/** Dòng thẩm quyền ký theo thể thức văn bản: PHT ký thay Hiệu trưởng → "KT. HIỆU TRƯỞNG / PHÓ HIỆU TRƯỞNG" */
export function signatureLines(leader: SchoolLeader | undefined): string[] {
  if (!leader) return [];
  if (isPrincipal(leader)) return ['HIỆU TRƯỞNG'];
  if (/^pho hieu truong/.test(fold(leader.title))) return ['KT. HIỆU TRƯỞNG', 'PHÓ HIỆU TRƯỞNG'];
  return [leader.title.toUpperCase()];
}
