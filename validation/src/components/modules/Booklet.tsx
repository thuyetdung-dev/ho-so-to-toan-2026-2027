import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MathText } from '../../utils/katex-renderer';
import { inRange, reportRange, validRange } from '../../utils/reporting';

const labels: Record<string, string> = {
  periodLabel:'Kỳ báo cáo', sectionsIncluded:'Các phần báo cáo',
  lesson:'Bài học', periods:'Số tiết', timing:'Thời điểm', requirements:'Yêu cầu cần đạt', digitalAi:'Thiết bị và định hướng năng lực số, AI', assigneeName:'Người thực hiện', dateTaught:'Ngày thực dạy', notes:'Ghi chú', duties:'Nhiệm vụ kiêm nhiệm', kind:'Loại phân công', version:'Phiên bản', sourceFileName:'Tệp nguồn', sourceFileUrl:'Liên kết tệp nguồn', teachingStatus:'Tiến độ thực dạy', isTaught:'Đã dạy', taughtDate:'Ngày dạy', taughtClasses:'Lớp đã dạy', comments:'Ý kiến phê duyệt', sectionId:'Phần góp ý', isResolved:'Đã xử lý', changeSummary:'Nội dung thay đổi', type:'Loại',
  title:'Tên hồ sơ', displayName:'Họ và tên', teacherName:'Giáo viên', observerName:'Người dự',
  role:'Vai trò', subject:'Môn học', className:'Lớp', classNames:'Các lớp', term:'Học kỳ',
  periodsPerWeek:'Số tiết/tuần', grade:'Khối', academicYear:'Năm học', generalSituation:'Nội dung kế hoạch',
  distribution:'Phân phối chương trình', periodicEvaluations:'Kiểm tra định kỳ', name:'Tên', duration:'Thời lượng',
  week:'Tuần', format:'Hình thức', topicTitle:'Chủ đề', periodCount:'Số tiết', period:'Tiết',
  objectivesKnowledge:'Mục tiêu kiến thức', objectivesCompetence:'Mục tiêu năng lực', objectivesQualities:'Mục tiêu phẩm chất',
  equipment:'Thiết bị', activities:'Hoạt động dạy học', content:'Nội dung', status:'Trạng thái',
  date:'Ngày', location:'Địa điểm', isOnline:'Trực tuyến', chairPerson:'Chủ trì', secretary:'Thư ký',
  attendees:'Thành viên dự họp', absentees:'Vắng mặt', reason:'Lý do', memberOpinions:'Ý kiến thành viên',
  author:'Người góp ý', conclusions:'Kết luận', tasks:'Nhiệm vụ', assignedTo:'Người thực hiện', deadline:'Thời hạn',
  activitiesObservations:'Phân tích hoạt động học sinh', activityName:'Tên hoạt động', studentActions:'Hoạt động học sinh',
  difficultiesNoticed:'Khó khăn', teacherSupport:'Hỗ trợ của giáo viên', generalEvaluation:'Nhận xét chung',
  lessonsLearned:'Bài học rút ra', teacherFeedback:'Phản hồi người dạy', rating:'Xếp loại', ratingEnabled:'Có xếp loại',
  executiveSummary:'Tổng quan', advantages:'Ưu điểm', limitations:'Hạn chế', futureDirections:'Phương hướng',
  finalizedBy:'Người chốt', isLocked:'Đã khóa', metrics:'Số liệu đã lưu', membersCount:'Thành viên', meetingsCount:'Họp đã chốt',
  lessonStudyCount:'Họp nghiên cứu bài học', observationsCount:'Lượt dự giờ', plansCount:'Giáo án', specialTopicsCount:'Chuyên đề',
  sections:'Các phần kế hoạch', coreLines:'Bài học', topicLines:'Chuyên đề lựa chọn', otherTasks:'Nhiệm vụ khác',
  lessonName:'Bài dạy', topic:'Chủ đề', currentStep:'Bước thực hiện', stepDetails:'Nội dung từng bước',
  step1Notes:'Chuẩn bị', step2Date:'Ngày dạy minh họa', step2Observers:'Người dự', step3Conclusions:'Phân tích', step4Applications:'Ứng dụng',
  reporterName:'Báo cáo viên', materialsSummary:'Nội dung học liệu', results:'Kết quả', description:'Mô tả',
  targetStudents:'Đối tượng', totalPeriods:'Tổng số tiết', materialsUrl:'Liên kết học liệu', abstract:'Tóm tắt',
  evaluationLevel:'Cấp đánh giá', authorName:'Tác giả', scope:'Phạm vi', fileUrl:'Liên kết tệp', approvedBy:'Người duyệt',
  objectives:'Mục tiêu', implementation:'Tổ chức thực hiện', estimatedTime:'Thời lượng dự kiến', teachingTasks:'Nhiệm vụ giảng dạy', selfStudyPlan:'Kế hoạch tự học', expectedResults:'Kết quả dự kiến', planKind:'Loại kế hoạch', 
  createdBy:'Người lập', updatedAt:'Cập nhật', createdAt:'Ngày tạo', startDate:'Từ ngày', endDate:'Đến ngày',
  lessonTitle:'Bài học', numberOfPeriods:'Số tiết', time:'Thời điểm', teachingEquipment:'Thiết bị dạy học', teachingLocation:'Địa điểm dạy học',
  objective:'Mục tiêu', product:'Sản phẩm', organization:'Tổ chức thực hiện', teacherActivity:'Hoạt động giáo viên', studentActivity:'Hoạt động học sinh',
};
const statuses: Record<string,string> = {draft:'Bản nháp', submitted:'Chờ duyệt', approved:'Đã duyệt', returned:'Trả lại', finalized:'Đã chốt', reviewed:'Đã xem', ongoing:'Đang thực hiện', completed:'Hoàn thành', head:'Tổ trưởng', deputy:'Tổ phó', teacher:'Giáo viên', admin:'Quản trị', principal:'Ban giám hiệu', regular:'Định kỳ', extraordinary:'Đột xuất', lesson_study:'Nghiên cứu bài học', in_progress:'Đang thực hiện', planned:'Dự kiến', pending:'Chưa hoàn thành', delayed:'Chậm tiến độ', make_up:'Dạy bù', teaching:'Giảng dạy', duty:'Quy đổi nhiệm vụ', professional:'Chuyên môn chung', experience:'Trải nghiệm', inclusive:'Giáo dục hòa nhập', approval_note:'Ý kiến phê duyệt', return_reason:'Lý do trả lại', hsg:'Bồi dưỡng học sinh giỏi', tot_nghiep:'Ôn tốt nghiệp', phu_dao:'Phụ đạo'};
Object.assign(labels,{evidence:'Minh chứng',tasks:'Công việc và phân công',indicators:'Chỉ tiêu và kết quả',assignee:'Người phụ trách',deadline:'Thời hạn',deadlineText:'Thời hạn trong tệp',product:'Sản phẩm',target:'Chỉ tiêu',actual:'Thực hiện',unit:'Đơn vị',category:'Nhóm',source:'Nguồn nhập',fileName:'Tên tệp',table:'Bảng',row:'Dòng'});
const hidden = new Set(['id','images','versionHistory','dataSnapshot','contentState','storage','imageIds','activityNames','contentBytes','imageBytes','versionBytes','totalBytes','hasSnapshot','schemaVersion','email','uid','phone','sortOrder','order']);
function Fields({value, images, names}: {value: unknown; images?: Record<string,string>; names: Map<string,string>}) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return <span>{value ? 'Có' : 'Không'}</span>;
  if (Array.isArray(value)) {
    const records = value.filter(v => v && typeof v === 'object' && !Array.isArray(v));
    const keys = [...new Set(records.flatMap(v => Object.keys(v)))].filter(k => !hidden.has(k) && !k.endsWith('Id'));
    if (records.length === value.length && value.length && keys.length <= 10 && records.every(v => keys.every(k => v[k] == null || typeof v[k] !== 'object'))) {
      return <table className="book-table"><thead><tr><th>STT</th>{keys.map(k => <th key={k}>{labels[k] || k}</th>)}</tr></thead><tbody>{records.map((v,i) => <tr key={i}><td>{i+1}</td>{keys.map(k => <td key={k}><Fields value={v[k]} images={images} names={names}/></td>)}</tr>)}</tbody></table>;
    }
    return <div>{value.map((v,i) => <div key={i} className="book-entry"><Fields value={v} images={images} names={names}/></div>)}</div>;
  }
  if (typeof value === 'object') return <dl>{Object.entries(value).filter(([k,v]) => !hidden.has(k) && !k.endsWith('Id') && v !== undefined && v !== '').map(([k,v]) => <div key={k} className="book-field"><dt>{labels[k] || k}:</dt><dd><Fields value={v} images={images} names={names}/></dd></div>)}</dl>;
  const raw = String(value);
  return <MathText content={names.get(raw) || statuses[raw] || raw} images={images} as="div" />;
}
export function Booklet() {
  const app = useApp();
  const {config, allMembers, departmentPlans, teacherPlans, lessonPlans, meetings, observations, specialTopics, reportSnapshots, assignments, skknTopics, getFullLessonPlan, setNotification} = app;
  const range = reportRange(config.academicYear, 'Tổng kết năm học');
  const [start, setStart] = useState(range.startDate);
  const [end, setEnd] = useState(range.endDate);
  const [selected, setSelected] = useState(['members','department','teacher','lessons','meetings','observations','studies','topics','reports']);
  const [prepared, setPrepared] = useState<null | Array<{key:string; title:string; records:unknown[]}>>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  useEffect(() => {generation.current++; setPrepared(null);}, [start,end,selected,config,allMembers,departmentPlans,teacherPlans,lessonPlans,meetings,observations,specialTopics,reportSnapshots,assignments,skknTopics]);
  const names = new Map(allMembers.map(m => [m.id,m.displayName]));
  const groups = [
    {key:'members', title:'I. Thành viên và phân công', records:[...allMembers.map(m => ({displayName:m.displayName,role:m.role,subject:m.subject})), ...assignments.filter(a => a.term === config.currentTerm)]},
    {key:'department', title:'II. Kế hoạch của tổ', records:departmentPlans.filter(p => p.academicYear === config.academicYear)},
    {key:'teacher', title:'III. Kế hoạch giáo viên', records:teacherPlans.filter(p => p.academicYear === config.academicYear)},
    {key:'lessons', title:'IV. Kế hoạch bài dạy', records:lessonPlans.filter(p => inRange(p.createdAt || p.updatedAt,start,end))},
    {key:'meetings', title:'V. Biên bản sinh hoạt chuyên môn', records:meetings.filter(p => inRange(p.date,start,end))},
    {key:'observations', title:'VI. Phiếu dự giờ', records:observations.filter(p => inRange(p.date,start,end))},
    {key:'studies', title:'VII. Nghiên cứu bài học', records:meetings.filter(p => p.type === 'lesson_study' && inRange(p.date,start,end))},
    {key:'topics', title:'VIII. Chuyên đề và sáng kiến', records:[...specialTopics.filter(p => inRange(p.date || p.createdAt,start,end)),...skknTopics.filter(p => p.academicYear === config.academicYear)]},
    {key:'reports', title:'IX. Báo cáo đã lưu', records:reportSnapshots.filter(p => p.academicYear === config.academicYear && (p.startDate && p.endDate ? p.startDate <= end && p.endDate >= start : inRange(p.createdAt,start,end)))},
  ];
  const prepare = async () => {
    if (!validRange(start,end)) {setNotification({message:'Khoảng ngày không hợp lệ.',type:'error'}); return;}
    const token = generation.current;
    setBusy(true); setPrepared(null);
    try {
      const chosen = groups.filter(g => selected.includes(g.key));
      for (const group of chosen) if (group.key === 'lessons') {
        const full = [];
        for (const plan of group.records as typeof lessonPlans) {
          const p = await getFullLessonPlan(plan);
          if (p && (p.imageIds || []).some(id => !p.images?.[id])) throw new Error(`Chưa tải đủ hình của giáo án: ${plan.title}`);
          if (!p) throw new Error(`Chưa tải đủ giáo án: ${plan.title}`);
          full.push(p);
        }
        group.records = full;
      }
      if (token === generation.current) setPrepared(chosen);
    } catch(e) {setNotification({message:e instanceof Error ? e.message : 'Không thể tải đủ hồ sơ.',type:'error'});}
    finally {setBusy(false);}
  };
  const print = async () => {
    if (!prepared || !ref.current) return;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1000px';
    document.body.appendChild(frame);
    try {
      const doc = frame.contentDocument!;
      doc.open(); doc.write('<!doctype html><html><head><title>Sổ chuyên môn</title></head><body></body></html>'); doc.close();
      document.querySelectorAll('style,link[rel="stylesheet"]').forEach(n => doc.head.appendChild(n.cloneNode(true)));
      doc.body.appendChild(ref.current.cloneNode(true));
      await Promise.all(Array.from(doc.querySelectorAll('link')).map(link => new Promise<void>(resolve => {link.onload = () => resolve(); link.onerror = () => resolve(); setTimeout(resolve,3000);} )));
      await Promise.all(Array.from(doc.images).map(img => img.decode().catch(() => undefined)));
      await doc.fonts.ready;
      frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), {once:true});
      frame.contentWindow!.focus(); frame.contentWindow!.print();
      setTimeout(() => frame.remove(),60000);
    } catch {frame.remove(); setNotification({message:'Không thể mở bản in. Hãy thử lại.',type:'error'});}
  };
  return <section className="space-y-4">
    <div className="bg-white p-4 rounded-xl border space-y-3">
      <h2 className="font-bold">Đóng cuốn Sổ chuyên môn</h2>
      <p className="text-xs">Chọn phần hồ sơ và tải bản xem trước trước khi in. Kế hoạch, thành viên và sáng kiến lấy theo năm học; phân công lấy học kỳ hiện tại. Khoảng ngày áp dụng cho các hoạt động và giáo án. Hồ sơ nháp vẫn in kèm trạng thái.</p>
      <div className="flex flex-wrap gap-3 text-sm"><label>Từ ngày <input type="date" value={start} onChange={e => setStart(e.target.value)}/></label><label>Đến ngày <input type="date" value={end} onChange={e => setEnd(e.target.value)}/></label></div>
      <div className="grid sm:grid-cols-2 gap-2 text-sm">{groups.map(g => <label key={g.key}><input type="checkbox" checked={selected.includes(g.key)} onChange={e => setSelected(e.target.checked ? [...selected,g.key] : selected.filter(k => k !== g.key))}/> {g.title} ({g.records.length})</label>)}</div>
      <div className="flex gap-3"><button disabled={busy || !selected.length} onClick={prepare} className="bg-blue-700 text-white rounded px-4 py-2 disabled:opacity-50">{busy ? 'Đang tải đầy đủ hồ sơ…' : 'Tạo bản xem trước'}</button><button disabled={!prepared || busy} onClick={print} className="border rounded px-4 py-2 disabled:opacity-50">In toàn bộ / Lưu PDF</button></div>
    </div>
    {prepared && <div ref={ref} className="booklet bg-white p-8 border rounded">
      <div className="book-cover"><p>{config.schoolName}</p><h1>SỔ SINH HOẠT CHUYÊN MÔN</h1><h2>{config.departmentName.toUpperCase()}</h2><p>Năm học: {config.academicYear}</p><p>Phạm vi hoạt động: {start} – {end}</p><p>Tổ trưởng: {allMembers.find(m => m.role === 'head')?.displayName || 'Chưa khai báo – cần bổ sung'}</p></div>
      <section className="book-section"><h2>MỤC LỤC NỘI DUNG</h2>{prepared.map(g => <p key={g.key}>{g.title} — {g.records.length} hồ sơ</p>)}<p className="text-xs">Mục lục liệt kê phần thực tế; số trang do trình duyệt tạo khi bật đầu trang/chân trang trong hộp thoại in.</p></section>
      {prepared.map(g => <section className="book-section" key={g.key}><h2>{g.title}</h2>{g.key === 'members' ? <><h3>Danh sách thành viên</h3><Fields value={g.records.filter((r:any) => r.displayName)} names={names}/><h3>Bảng phân công</h3><Fields value={g.records.filter((r:any) => r.teacherName).map((r:any) => ({teacherName:r.teacherName,className:r.className,subject:r.subject,periodsPerWeek:r.periodsPerWeek,duties:r.duties,term:r.term}))} names={names}/></> : g.records.length ? g.records.map((record:any,i) => <article key={record.id || i}><h3>{i+1}. {record.title || record.displayName || record.lessonName || record.teacherName || 'Hồ sơ'}</h3><Fields value={record} images={record.images} names={names}/></article>) : <p>Chưa có hồ sơ trong phạm vi đã chọn.</p>}</section>)}
    </div>}
  </section>;
}
