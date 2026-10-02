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
  return validRange(day,day) && day >= start && day <= end;
}
export function uniqueRecords<T extends {id: string}>(records: T[]): T[] {
  return [...new Map(records.map(record => [record.id, record])).values()];
}
export function scopeRecords<T extends {id: string}>(records: T[], year: string, start: string, end: string, dateOf: (record: T) => string | undefined): T[] {
  const annual = reportRange(year, 'Tổng kết năm học');
  return uniqueRecords(records).filter(record => {
    const declared = (record as T & {academicYear?: string}).academicYear;
    const date = dateOf(record);
    return (!declared || declared === year) && inRange(date, annual.startDate, annual.endDate) && inRange(date, start, end);
  });
}
export function annualRecords<T extends {id: string; academicYear?: string}>(records: T[], year: string): T[] {
  return uniqueRecords(records).filter(record => record.academicYear === year);
}
export function reportData(data: { meetings: Meeting[]; observations: ObservationRecord[]; lessonPlans: LessonPlan[]; specialTopics: SpecialTopic[] }, start: string, end: string, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }), year?: string) {
  const elapsedEnd = end < today ? end : today;
  const select = <T extends {id:string}>(rows:T[], date:(r:T)=>string|undefined, until=elapsedEnd) => year ? scopeRecords(rows,year,start,until,date) : uniqueRecords(rows).filter(r=>inRange(date(r),start,until));
  const meetings = select(data.meetings,m=>m.date,end);
  return {
    meetings: meetings.filter(m => m.status === 'finalized' && inRange(m.date,start,elapsedEnd)),
    observations: select(data.observations,o=>o.date),
    lessonPlans: select(data.lessonPlans,p=>p.createdAt || p.updatedAt),
    specialTopics: select(data.specialTopics,p=>p.date),
    pendingMeetings: meetings.filter(m=>m.status !== 'finalized' || m.date.slice(0,10)>today),
  };
}
export function savedEvidence<T extends {id:string}>(records:T[], ids:string[]):T[] {
  const byId = new Map(records.map(r=>[r.id,r]));
  return [...new Set(ids)].map(id=> {
    const record=byId.get(id);
    if (!record) throw new Error(`Minh chứng đã lưu không còn tồn tại: ${id}. Không thể xuất hồ sơ thiếu minh chứng.`);
    return record;
  });
}
