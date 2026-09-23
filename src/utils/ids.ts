/**
 * Sinh mã định danh duy nhất. Trước đây dùng `prefix-${Date.now()}` nên hai thao tác trong
 * cùng một mili-giây (ví dụ nhật ký "nộp" và "lưu") ghi đè lên nhau.
 */
export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/** Chỉ cho phép liên kết http(s) — chặn javascript:, data: ... khi mở hoặc nhúng. */
export function safeUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};
