import type { Meeting, ObservationRecord, LessonPlan, SpecialTopic } from '../types';
export function reportRange(year: string, term: string) {
  const start = Number(year.match(/\d{4}/)?.[0]);
  const y = Number.isFinite(start) ? start : new Date().getFullYear();
  return { startDate: term === 'Giữa HK2' ? `${y + 1}-01-16` : `${y}-08-01`, endDate: term === 'Giữa HK1' ? `${y}-11-15` : term === 'Cuối HK1' ? `${y + 1}-01-15` : term === 'Giữa HK2' ? `${y + 1}-03-31` : `${y + 1}-07-31` };
}
export function validRange(start: string, end: string) {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  return valid(start) && valid(end) && start <= end;
}
export function inRange(date: string | undefined, start: string, end: string) {
  if (!date || !validRange(start, end)) return false;
  const day = date.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= start && day <= end;
}
export function reportData(data: { meetings: Meeting[]; observations: ObservationRecord[]; lessonPlans: LessonPlan[]; specialTopics: SpecialTopic[] }, start: string, end: string, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })) {
  const elapsedEnd = end < today ? end : today;
  return {
    meetings: data.meetings.filter(m => m.status === 'finalized' && inRange(m.date, start, elapsedEnd)),
    observations: data.observations.filter(o => inRange(o.date, start, elapsedEnd)),
    lessonPlans: data.lessonPlans.filter(p => inRange(p.createdAt || p.updatedAt, start, end)),
    specialTopics: data.specialTopics.filter(p => inRange(p.date, start, elapsedEnd)),
    pendingMeetings: data.meetings.filter(m => inRange(m.date, start, end) && (m.status !== 'finalized' || m.date.slice(0, 10) > today)),
  };
}
