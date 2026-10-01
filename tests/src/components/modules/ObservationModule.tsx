import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ObservationRecord } from '../../types';
import { Eye, Plus, Trash2, MessageSquare, Printer, X, CheckCircle } from 'lucide-react';
import { useConfirm } from '../common/ConfirmDialog';
import { newId, todayISO } from '../../utils/ids';

type ActivityObs = ObservationRecord['activitiesObservations'][number];

const emptyActivity = (i: number): ActivityObs => ({
  activityName: `Hoạt động ${i}`,
  studentActions: '',
  difficultiesNoticed: '',
  teacherSupport: '',
});

export const ObservationModule: React.FC = () => {
  const { isMe,
    activeMember,
    allMembers,
    classes,
    lessonPlans,
    observations,
    saveObservation,
    deleteObservation,
    setNotification,
    permissions,
  } = useApp();
  const confirm = useConfirm();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedObsId, setSelectedObsId] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'about_me'>('all');

  // Form state
  const [teacherId, setTeacherId] = useState('');
  const [className, setClassName] = useState('');
  const [period, setPeriod] = useState(1);
  const [date, setDate] = useState(todayISO());
  const [lessonName, setLessonName] = useState('');
  const [lessonPlanId, setLessonPlanId] = useState('');
  const [activities, setActivities] = useState<ActivityObs[]>([emptyActivity(1)]);
  const [generalEval, setGeneralEval] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [formError, setFormError] = useState('');
  const [feedbackText, setFeedbackText] = useState('');

  const sorted = useMemo(
    () =>
      [...observations]
        .filter(o =>
          filter === 'mine' ? isMe(o.observerId) : filter === 'about_me' ? isMe(o.teacherId) : true,
        )
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.period - a.period),
    [observations, filter, activeMember.id],
  );
  const selectedObs = observations.find(o => o.id === selectedObsId) || sorted[0];

  const teachers = allMembers.filter(m => m.status === 'active' && !isMe(m.id) && m.role !== 'principal');
  const teacherPlans = lessonPlans.filter(p => p.teacherId === teacherId);

  const openForm = () => {
    // Bản cũ lấy giá trị mặc định lúc mở trang (khi dữ liệu thật chưa tải xong → rỗng)
    setTeacherId(teachers[0]?.id || '');
    setClassName(classes[0]?.name || '');
    setPeriod(1);
    setDate(todayISO());
    setLessonName('');
    setLessonPlanId('');
    setActivities([emptyActivity(1)]);
    setGeneralEval('');
    setLessonsLearned('');
    setFormError('');
    setShowAddModal(true);
  };

  const handleRegisterObs = async (e: React.FormEvent) => {
    e.preventDefault();
    const teacher = allMembers.find(m => m.id === teacherId);
    if (!teacher) return setFormError('Vui lòng chọn giáo viên dạy.');
    if (!className.trim()) return setFormError('Vui lòng chọn hoặc nhập lớp.');
    if (!lessonName.trim()) return setFormError('Vui lòng nhập tên bài dạy.');
    const filled = activities.filter(a => a.studentActions.trim() || a.difficultiesNoticed.trim() || a.teacherSupport.trim());
    if (filled.length === 0) return setFormError('Cần ghi chép quan sát ít nhất một hoạt động của học sinh.');

    const duplicate = observations.find(o => o.date === date && o.period === period && o.className === className);
    if (duplicate) {
      const ok = await confirm({
        title: 'Trùng lịch dự giờ',
        message: `Lớp ${className} tiết ${period} ngày ${date} đã có phiếu của ${duplicate.observerName}. Vẫn lưu phiếu của bạn?`,
        confirmText: 'Vẫn lưu',
      });
      if (!ok) return;
    }

    // Bản cũ tự điền nhận xét "mẫu" khi bỏ trống → hồ sơ có nội dung không có thật.
    const newObs: ObservationRecord = {
      id: newId('obs'),
      observerId: activeMember.id,
      observerName: activeMember.displayName,
      teacherId: teacher.id,
      teacherName: teacher.displayName,
      className: className.trim(),
      period,
      date,
      lessonName: lessonName.trim(),
      lessonPlanId: lessonPlanId || undefined,
      activitiesObservations: filled.map(a => ({
        activityName: a.activityName.trim() || 'Hoạt động',
        studentActions: a.studentActions.trim(),
        difficultiesNoticed: a.difficultiesNoticed.trim(),
        teacherSupport: a.teacherSupport.trim(),
      })),
      generalEvaluation: generalEval.trim(),
      lessonsLearned: lessonsLearned.trim(),
      ratingEnabled: false,
      status: 'submitted',
      updatedAt: new Date().toISOString(),
    };

    if (await saveObservation(newObs)) {
      setShowAddModal(false);
      setSelectedObsId(newObs.id);
    }
  };

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObs || !feedbackText.trim()) return;
    const ok = await saveObservation({ ...selectedObs, teacherFeedback: feedbackText.trim(), status: 'reviewed' }, { silent: true });
    if (ok) {
      setFeedbackText('');
      setNotification({ message: 'Đã gửi phản hồi cho người dự giờ', type: 'success' });
    }
  };

  const handleDelete = async () => {
    if (!selectedObs) return;
    const ok = await confirm({
      title: 'Xóa phiếu dự giờ?',
      message: `Phiếu dự giờ lớp ${selectedObs.className} ngày ${selectedObs.date} sẽ bị xóa vĩnh viễn.`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (ok) {
      await deleteObservation(selectedObs.id);
      setSelectedObsId('');
    }
  };

  const input = 'w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <span>Dự giờ & Rút kinh nghiệm (CV 5512)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ghi chép phân tích hoạt động học của học sinh, rút kinh nghiệm sư phạm và tránh áp đặt xếp loại
          </p>
        </div>
        {permissions.canContribute && (
          <button
            onClick={openForm}
            id="btn-add-observation"
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Lập phiếu dự giờ</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-3 print:hidden">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            {([
              ['all', `Tất cả (${observations.length})`],
              ['mine', 'Tôi dự'],
              ['about_me', 'Dự giờ tôi'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`flex-1 px-2 py-1 rounded-md font-semibold ${filter === k ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {sorted.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">Chưa có phiếu dự giờ.</div>
            )}
            {sorted.map(obs => {
              const isSelected = obs.id === selectedObs?.id;
              return (
                <button
                  key={obs.id}
                  onClick={() => setSelectedObsId(obs.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      Lớp {obs.className} • Tiết {obs.period}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">{obs.date}</span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 mt-2 line-clamp-1">{obs.lessonName}</h3>
                  <div className="text-[11px] text-slate-600 mt-1 flex justify-between gap-2">
                    <span className="truncate">Dạy: <strong>{obs.teacherName}</strong></span>
                    <span className="truncate">Dự: <em>{obs.observerName}</em></span>
                  </div>
                  {obs.status === 'reviewed' && (
                    <div className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Đã phản hồi
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6 print:col-span-12">
          {selectedObs ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6 print:border-none print:shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                    Lớp {selectedObs.className} • Tiết {selectedObs.period} ({selectedObs.date})
                  </span>
                  <h2 className="text-base font-bold text-slate-900 mt-1">PHIẾU DỰ GIỜ – Bài: {selectedObs.lessonName}</h2>
                  <div className="text-xs text-slate-500 mt-1">
                    Giáo viên dạy: <strong className="text-slate-800">{selectedObs.teacherName}</strong> • Người dự:{' '}
                    <strong className="text-blue-700">{selectedObs.observerName}</strong>
                  </div>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button onClick={() => window.print()} className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 border border-slate-200">
                    <Printer className="w-3.5 h-3.5" /> In phiếu
                  </button>
                  {(permissions.isLeader || isMe(selectedObs.observerId)) && (
                    <button onClick={handleDelete} className="px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1 border border-rose-200" aria-label="Xóa phiếu">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  I. Quan sát & Phân tích hoạt động học của học sinh
                </h3>
                {selectedObs.activitiesObservations?.map((act, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div className="font-bold text-slate-900">{act.activityName}</div>
                    <div className="space-y-1.5 text-slate-700">
                      <div><span className="font-semibold text-slate-800">1. Học sinh hoạt động, tương tác: </span>{act.studentActions || '—'}</div>
                      <div><span className="font-semibold text-slate-800">2. Khó khăn học sinh gặp phải: </span>{act.difficultiesNoticed || '—'}</div>
                      <div><span className="font-semibold text-slate-800">3. Biện pháp hỗ trợ của giáo viên: </span>{act.teacherSupport || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  II. Đánh giá chung & Bài học kinh nghiệm
                </h3>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-slate-800">Nhận xét chung về hiệu quả bài dạy:</div>
                  <div className="text-slate-700 whitespace-pre-wrap">{selectedObs.generalEvaluation || '—'}</div>
                </div>
                <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-blue-900">Bài học kinh nghiệm cho bản thân người dự:</div>
                  <div className="text-blue-800 whitespace-pre-wrap">{selectedObs.lessonsLearned || '—'}</div>
                </div>
                {selectedObs.teacherFeedback && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-emerald-900">Phản hồi của giáo viên dạy:</div>
                    <div className="text-emerald-800 whitespace-pre-wrap">{selectedObs.teacherFeedback}</div>
                  </div>
                )}
                {isMe(selectedObs.teacherId) && (
                  <form onSubmit={handleFeedback} className="flex gap-2 print:hidden">
                    <input
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      placeholder={selectedObs.teacherFeedback ? 'Cập nhật phản hồi của bạn...' : 'Phản hồi, tiếp thu góp ý của người dự...'}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" /> Gửi phản hồi
                    </button>
                  </form>
                )}
              </div>

              <div className="hidden print:grid grid-cols-2 pt-8 text-xs text-center">
                <div><div className="font-bold">GIÁO VIÊN DẠY</div><div className="mt-14 font-bold">{selectedObs.teacherName}</div></div>
                <div><div className="font-bold">NGƯỜI DỰ GIỜ</div><div className="mt-14 font-bold">{selectedObs.observerName}</div></div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">Chưa có phiếu dự giờ nào được chọn.</div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">Lập phiếu dự giờ</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRegisterObs} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <label className="font-semibold text-slate-700">
                  Giáo viên dạy *
                  <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className={`${input} mt-1 font-normal`} required>
                    <option value="">— Chọn —</option>
                    {teachers.map(m => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </select>
                </label>
                <label className="font-semibold text-slate-700">
                  Lớp *
                  {classes.length > 0 ? (
                    <select value={className} onChange={e => setClassName(e.target.value)} className={`${input} mt-1 font-normal`}>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={className} onChange={e => setClassName(e.target.value.toUpperCase())} className={`${input} mt-1 font-normal`} placeholder="VD: 10A1" />
                  )}
                </label>
                <label className="font-semibold text-slate-700">
                  Tiết
                  <input type="number" min={1} max={10} value={period} onChange={e => setPeriod(Number(e.target.value))} className={`${input} mt-1 font-normal`} />
                </label>
                <label className="font-semibold text-slate-700">
                  Ngày dự
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${input} mt-1 font-normal`} required />
                </label>
              </div>
              {teacherPlans.length > 0 && (
                <label className="block font-semibold text-slate-700">
                  Gắn với giáo án của giáo viên (tùy chọn)
                  <select
                    value={lessonPlanId}
                    onChange={e => {
                      setLessonPlanId(e.target.value);
                      const lp = teacherPlans.find(p => p.id === e.target.value);
                      if (lp) {
                        setLessonName(lp.title);
                        setActivities((lp.activityNames ?? (lp.activities || []).map(a => a.name)).map(name => ({ ...emptyActivity(1), activityName: name })));
                      }
                    }}
                    className={`${input} mt-1 font-normal`}
                  >
                    <option value="">— Không —</option>
                    {teacherPlans.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block font-semibold text-slate-700">
                Tên bài dạy *
                <input value={lessonName} onChange={e => setLessonName(e.target.value)} className={`${input} mt-1 font-normal`} required />
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Quan sát theo hoạt động</span>
                  <button type="button" onClick={() => setActivities(p => [...p, emptyActivity(p.length + 1)])} className="px-2 py-1 font-semibold text-blue-700 border border-blue-200 rounded-lg flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Thêm hoạt động
                  </button>
                </div>
                {activities.map((a, i) => (
                  <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <input value={a.activityName} onChange={e => setActivities(p => p.map((x, j) => (j === i ? { ...x, activityName: e.target.value } : x)))} className={`${input} font-semibold`} aria-label="Tên hoạt động" />
                      {activities.length > 1 && (
                        <button type="button" onClick={() => setActivities(p => p.filter((_, j) => j !== i))} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" aria-label="Xóa hoạt động"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    {([
                      ['studentActions', 'Học sinh hoạt động, tương tác ra sao?'],
                      ['difficultiesNoticed', 'Khó khăn học sinh gặp phải'],
                      ['teacherSupport', 'Biện pháp hỗ trợ của giáo viên'],
                    ] as const).map(([key, ph]) => (
                      <textarea key={key} rows={2} value={a[key]} placeholder={ph} aria-label={ph} onChange={e => setActivities(p => p.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x)))} className={`${input} resize-y`} />
                    ))}
                  </div>
                ))}
              </div>

              <label className="block font-semibold text-slate-700">
                Nhận xét chung về hiệu quả bài dạy
                <textarea rows={2} value={generalEval} onChange={e => setGeneralEval(e.target.value)} className={`${input} mt-1 font-normal resize-y`} />
              </label>
              <label className="block font-semibold text-slate-700">
                Bài học rút ra cho bản thân
                <textarea rows={2} value={lessonsLearned} onChange={e => setLessonsLearned(e.target.value)} className={`${input} mt-1 font-normal resize-y`} />
              </label>

              {formError && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{formError}</div>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Lưu phiếu dự giờ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
