import type { DepartmentConfig, SchoolLeader } from '../types';

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

/** Dòng thẩm quyền ký theo thể thức văn bản: PHT ký thay Hiệu trưởng → "KT. HIỆU TRƯỞNG / PHÓ HIỆU TRƯỞNG" */
export function signatureLines(leader: SchoolLeader | undefined): string[] {
  if (!leader) return [];
  if (isPrincipal(leader)) return ['HIỆU TRƯỞNG'];
  if (/^pho hieu truong/.test(fold(leader.title))) return ['KT. HIỆU TRƯỞNG', 'PHÓ HIỆU TRƯỞNG'];
  return [leader.title.toUpperCase()];
}
