import type { DepartmentPlan } from '../types';
export interface DepartmentProgress {
  id: string;
  planId: string;
  itemId: string;
  itemIndex: number;
  status: NonNullable<DepartmentPlan['distribution'][number]['status']>;
  dateTaught: string;
  updatedAt: string;
  updatedByUid: string;
}
/** Ghép tiến độ để hiển thị; không sửa bản nội dung đã phê duyệt. */
export function applyDepartmentProgress(plans: DepartmentPlan[], records: DepartmentProgress[]): DepartmentPlan[] {
  const index = new Map(records.map(record => [`${record.planId}\0${record.itemId}`, record]));
  return plans.map(plan => ({...plan, distribution: plan.distribution.map(item => {
    const record = index.get(`${plan.id}\0${item.id}`);
    return record ? {...item, status: record.status, dateTaught: record.dateTaught || undefined} : item;
  })}));
}
