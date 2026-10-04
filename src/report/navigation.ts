import { pushRoute } from '../utils/deepLink';
import type { Period } from './types';

/** Mở tab "Báo cáo tháng" trong phân hệ 10, có thể chọn sẵn giáo viên và tháng. */
export function openMonthlyReport(options: { memberId?: string; period?: Period } = {}) {
  pushRoute('reports');
  const params = new URLSearchParams({ tab: 'monthly' });
  if (options.memberId) params.set('member', options.memberId);
  if (options.period) params.set('period', `${options.period.year}-${options.period.month}`);
  window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Đọc tham số ?tab=monthly&member=…&period=yyyy-mm trên địa chỉ trang. */
export function monthlyRouteParams() {
  const p = new URLSearchParams(window.location.search);
  const m = /^(\d{4})-(\d{2})$/.exec(p.get('period') || '');
  return {
    monthly: p.get('tab') === 'monthly',
    memberId: p.get('member') || '',
    period: m ? { year: m[1], month: m[2] } : null,
  };
}
