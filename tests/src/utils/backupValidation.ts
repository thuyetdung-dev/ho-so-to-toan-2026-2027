import type { LessonPlan } from '../types';
import { referencedImageIds } from '../services/lessonPlanStore';

/** Kiểm tra cả hình trong phiên bản cũ trước khi bỏ metadata lưu trữ. */
export function assertCompleteLessonBackup(plan: LessonPlan) {
  if (plan.contentState === 'light') throw new Error(`Giáo án ${plan.id} chưa có nội dung đầy đủ.`);
  const history = plan.versionHistory || [];
  if (history.some(h => h.hasSnapshot && h.dataSnapshot == null)) throw new Error(`Giáo án ${plan.id} thiếu nội dung phiên bản.`);
  const referenced = referencedImageIds([JSON.stringify({
    objectivesKnowledge: plan.objectivesKnowledge, objectivesCompetence: plan.objectivesCompetence,
    objectivesQualities: plan.objectivesQualities, equipment: plan.equipment, activities: plan.activities,
    history: history.map(h => h.dataSnapshot),
  })]);
  const missing = [...new Set([...(plan.imageIds || []), ...referenced])].filter(id => !plan.images?.[id]);
  if (missing.length) throw new Error(`Giáo án ${plan.id} thiếu hình: ${missing.join(', ')}.`);
}
