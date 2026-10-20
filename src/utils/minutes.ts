import type { Meeting } from '../types';

/** Các hàm trình bày biên bản họp tổ theo cấu trúc biên bản Hội nghị VC-NLĐ của trường. */

export function dateParts(date: string): { d: string; m: string; y: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  return m ? { d: m[3], m: m[2], y: m[1] } : null;
}

/** '07:30' -> '7 giờ 30'; trống -> '…… giờ ……' */
export function timeText(t?: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  if (!m) return '…… giờ ……';
  return `${Number(m[1])} giờ ${m[2]}`;
}

/** Tiêu đề in hoa của biên bản: "BIÊN BẢN HỘI NGHỊ VIÊN CHỨC ..." */
export function minutesHeading(m: Pick<Meeting, 'title' | 'type'>): string {
  const title = (m.title || '').trim();
  if (/^\p{L}/u.test(title)) {
    const body = title.replace(/^biên bản\s+/iu, '');
    return `BIÊN BẢN ${body.toLocaleUpperCase('vi-VN')}`;
  }
  return m.type === 'lesson_study' ? 'BIÊN BẢN SINH HOẠT CHUYÊN MÔN THEO NGHIÊN CỨU BÀI HỌC' : 'BIÊN BẢN SINH HOẠT CHUYÊN MÔN';
}

/** 'Tổ Toán' -> 'Toán' (để ghi "Tổ: Toán") */
export function departmentShortName(name?: string): string {
  return (name || '').replace(/^tổ\s+/iu, '').trim();
}

export function roleTitle(role?: string): string {
  return ({ head: 'Tổ trưởng chuyên môn', deputy: 'Tổ phó chuyên môn', teacher: 'Giáo viên', principal: 'Ban Giám hiệu' } as Record<string, string>)[role || ''] || '';
}

/** Mỗi dòng "Họ tên - Chức vụ" -> danh sách đại biểu */
export function parseNameRoleLines(text: string): { name: string; role: string }[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [name, ...rest] = l.split(' - ');
      return { name: name.trim(), role: rest.join(' - ').trim() };
    });
}

export function attendanceTotal(m: Pick<Meeting, 'attendees' | 'absentees'>): number {
  return (m.attendees?.length || 0) + (m.absentees?.length || 0);
}

/** "12/13 người tán thành, đạt 92,3%" hoặc chỗ trống để ghi tay */
export function voteText(m: Pick<Meeting, 'voteAgree' | 'attendees'>): string {
  const present = m.attendees?.length || 0;
  if (m.voteAgree === undefined || m.voteAgree === null || !present) return '……… / ……… người tán thành, đạt ……… %';
  const pct = Math.round((m.voteAgree / present) * 1000) / 10;
  return `${m.voteAgree}/${present} người tán thành, đạt ${String(pct).replace('.', ',')}%`;
}
