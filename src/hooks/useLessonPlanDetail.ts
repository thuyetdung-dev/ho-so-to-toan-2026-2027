import { useEffect, useMemo, useState } from 'react';
import type { LessonPlan } from '../types';
import { useApp } from '../context/AppContext';
import { db, describeFirebaseError } from '../firebase';
import { loadLessonPlanImages, mergeLessonPlan, subscribeLessonPlanContent, type LessonPlanContentDoc } from '../services/lessonPlanStore';

/**
 * Giáo án đầy đủ (nội dung + hình) cho giáo án đang mở.
 * Danh sách giáo án chỉ có phần tóm tắt; nội dung được tải (và cập nhật trực tiếp) khi mở,
 * hình lấy từ bộ nhớ trên máy nếu đã tải trước đó.
 */
export function useLessonPlanDetail(plan: LessonPlan | undefined) {
  const { isDemoMode } = useApp();
  const needsLoad = !!plan && !isDemoMode && plan.contentState === 'light';
  const [state, setState] = useState<{ id: string; content: LessonPlanContentDoc | null; images: Record<string, string>; loaded: boolean; error: string }>({
    id: '',
    content: null,
    images: {},
    loaded: false,
    error: '',
  });

  useEffect(() => {
    if (!needsLoad || !plan) return;
    let alive = true;
    let seq = 0; // chỉ nhận kết quả của lần cập nhật mới nhất (tránh bản cũ đè bản mới)
    const planId = plan.id;
    setState(s => (s.id === planId ? s : { id: planId, content: null, images: {}, loaded: false, error: '' }));
    const unsub = subscribeLessonPlanContent(
      db,
      planId,
      async content => {
        const mine = ++seq;
        if (!content) {
          if (alive) setState({ id: planId, content: null, images: {}, loaded: true, error: 'Không tìm thấy nội dung giáo án trên máy chủ.' });
          return;
        }
        try {
          const images = await loadLessonPlanImages(db, planId, content.imageIds || []);
          if (alive && mine === seq) setState({ id: planId, content, images, loaded: true, error: '' });
        } catch (err) {
          if (alive && mine === seq) setState({ id: planId, content, images: {}, loaded: true, error: '' });
          console.warn('Không tải được hình giáo án', err);
        }
      },
      err => alive && setState(s => ({ ...s, id: planId, loaded: true, error: describeFirebaseError(err) })),
    );
    return () => {
      alive = false;
      unsub();
    };
  }, [needsLoad, plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const full = useMemo(() => {
    if (!plan) return null;
    if (!needsLoad) return plan;
    // Lỗi hoặc chưa có nội dung → null (KHÔNG trả về giáo án rỗng để tránh bị lưu đè)
    if (state.id !== plan.id || !state.loaded || state.error || !state.content) return null;
    return mergeLessonPlan(plan, state.content, state.images);
  }, [plan, needsLoad, state]);

  const missingImages = full && state.content ? (state.content.imageIds || []).filter(id => !(id in state.images)).length : 0;
  return {
    plan: full,
    /** Số hình chưa tải được (mạng chập chờn) – hình vẫn được giữ khi lưu */
    missingImages,
    loading: needsLoad && (!full || state.id !== plan?.id) && !state.error,
    error: state.id === plan?.id ? state.error : '',
  };
}
