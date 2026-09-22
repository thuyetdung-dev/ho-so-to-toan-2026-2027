import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ObservationRecord } from '../../types';
import {
  Eye,
  Plus,
  Calendar,
  User,
  CheckCircle,
  FileCheck,
  MessageSquare,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';

export const ObservationModule: React.FC = () => {
  const {
    activeMember,
    allMembers,
    classes,
    observations,
    saveObservation,
    setNotification,
  } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedObsId, setSelectedObsId] = useState<string>(observations[0]?.id || '');

  // Form State
  const [teacherId, setTeacherId] = useState(allMembers[0]?.id || '');
  const [className, setClassName] = useState(classes[0]?.name || '10A1');
  const [period, setPeriod] = useState(2);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [lessonName, setLessonName] = useState('');
  const [act1Notes, setAct1Notes] = useState('');
  const [act1Difficulties, setAct1Difficulties] = useState('');
  const [act1Support, setAct1Support] = useState('');
  const [generalEval, setGeneralEval] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');

  const selectedObs = observations.find(o => o.id === selectedObsId) || observations[0];

  const handleRegisterObs = async (e: React.FormEvent) => {
    e.preventDefault();
    const teacher = allMembers.find(m => m.id === teacherId);
    if (!teacher || !lessonName.trim()) return;

    // Check duplicate slot
    const duplicate = observations.find(
      o => o.date === date && o.period === period && o.className === className
    );
    if (duplicate) {
      setNotification({
        message: `Cảnh báo: Lớp ${className} vào tiết ${period} ngày ${date} đã có người đăng ký dự giờ (${duplicate.observerName})!`,
        type: 'error',
      });
      return;
    }

    const newObs: ObservationRecord = {
      id: `obs-${Date.now()}`,
      observerId: activeMember.id,
      observerName: activeMember.displayName,
      teacherId: teacher.id,
      teacherName: teacher.displayName,
      className,
      period,
      date,
      lessonName: lessonName.trim(),
      activitiesObservations: [
        {
          activityName: 'Quan sát hoạt động học sinh (CV 5512)',
          studentActions: act1Notes || 'Học sinh tích cực tham gia hoạt động, làm việc nhóm chủ động.',
          difficultiesNoticed: act1Difficulties || 'Một số em còn lúng túng khi trình bày công thức toán học.',
          teacherSupport: act1Support || 'Giáo viên hỗ trợ gợi mở và kịp thời sửa sai.',
        },
      ],
      generalEvaluation: generalEval || 'Tiết học đạt được mục tiêu bài dạy, học sinh hiểu và vận dụng tốt kiến thức.',
      lessonsLearned: lessonsLearned || 'Cần chú ý phân hóa thêm câu hỏi cho học sinh khá giỏi.',
      ratingEnabled: false,
      status: 'submitted',
      updatedAt: new Date().toISOString(),
    };

    await saveObservation(newObs);
    setShowAddModal(false);
    setSelectedObsId(newObs.id);
    setNotification({ message: 'Đã đăng ký và lưu phiếu dự giờ thành công', type: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <span>Dự giờ & Rút kinh nghiệm (CV 5512)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ghi chép phân tích hoạt động học của học sinh, rút kinh nghiệm sư phạm và tránh áp đặt xếp loại
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            id="btn-add-observation"
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Đăng ký phiếu dự giờ</span>
          </button>
        </div>
      </div>

      {/* Grid: List of observations and Detailed View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold text-slate-700 px-1">Lịch sử dự giờ ({observations.length})</div>
          <div className="space-y-2">
            {observations.map(obs => {
              const isSelected = obs.id === selectedObs?.id;
              const isMyObs = obs.observerId === activeMember.id;

              return (
                <div
                  key={obs.id}
                  onClick={() => setSelectedObsId(obs.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-400 shadow-xs ring-1 ring-blue-300'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      Lớp {obs.className} • Tiết {obs.period}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">{obs.date}</span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 mt-2 line-clamp-1">{obs.lessonName}</h3>

                  <div className="text-[11px] text-slate-600 mt-1 flex justify-between">
                    <span>Người dạy: <strong>{obs.teacherName}</strong></span>
                    <span>Dự: <em>{obs.observerName}</em></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detail Card: Observation Sheet */}
        <div className="lg:col-span-8 space-y-6">
          {selectedObs ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                      Lớp {selectedObs.className} • Tiết {selectedObs.period} ({selectedObs.date})
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-1">Bài dạy: {selectedObs.lessonName}</h2>
                </div>

                <div className="text-right text-xs">
                  <div className="text-slate-500">Giáo viên dạy: <strong className="text-slate-800">{selectedObs.teacherName}</strong></div>
                  <div className="text-slate-500">Người dự giờ: <strong className="text-blue-700">{selectedObs.observerName}</strong></div>
                </div>
              </div>

              {/* I. Phân tích hoạt động học sinh (CV 5512) */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  I. Quan sát & Phân tích hoạt động học của học sinh
                </h3>

                {selectedObs.activitiesObservations?.map((act, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div className="font-bold text-slate-900">{act.activityName}</div>
                    <div className="space-y-1.5 text-slate-700">
                      <div>
                        <span className="font-semibold text-slate-800">1. Học sinh hoạt động, tương tác ra sao: </span>
                        <span>{act.studentActions}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">2. Khó khăn học sinh gặp phải: </span>
                        <span>{act.difficultiesNoticed}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">3. Biện pháp hỗ trợ của giáo viên: </span>
                        <span>{act.teacherSupport}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* II. Đánh giá chung & Rút kinh nghiệm */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  II. Đánh giá chung & Bài học kinh nghiệm cho bản thân
                </h3>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-slate-800">Nhận xét chung về hiệu quả bài dạy:</div>
                  <div className="text-slate-700">{selectedObs.generalEvaluation}</div>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-blue-900">Bài học kinh nghiệm rút ra cho bản thân người dự:</div>
                  <div className="text-blue-800">{selectedObs.lessonsLearned}</div>
                </div>

                {selectedObs.teacherFeedback && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-emerald-900">Phản hồi của giáo viên dạy:</div>
                    <div className="text-emerald-800">{selectedObs.teacherFeedback}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
              Chưa có phiếu dự giờ nào được chọn.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Register Observation */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-900 mb-3">Đăng ký & Lập phiếu dự giờ</h2>
            <form onSubmit={handleRegisterObs} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giáo viên dạy</label>
                  <select
                    value={teacherId}
                    onChange={e => setTeacherId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    {allMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lớp</label>
                  <select
                    value={className}
                    onChange={e => setClassName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tiết dạy</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={period}
                    onChange={e => setPeriod(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày dự</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên bài dạy</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Một số bài toán tối ưu trong đời sống và kinh tế..."
                  value={lessonName}
                  onChange={e => setLessonName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  1. Quan sát hoạt động học của học sinh (Học sinh thực hiện ra sao?)
                </label>
                <textarea
                  rows={2}
                  value={act1Notes}
                  onChange={e => setAct1Notes(e.target.value)}
                  placeholder="Ghi nhận hoạt động, sự tương tác của học sinh..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  2. Khó khăn học sinh gặp phải
                </label>
                <textarea
                  rows={2}
                  value={act1Difficulties}
                  onChange={e => setAct1Difficulties(e.target.value)}
                  placeholder="Lúng túng về công thức, chưa hiểu đề bài..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  3. Bài học rút ra cho bản thân
                </label>
                <textarea
                  rows={2}
                  value={lessonsLearned}
                  onChange={e => setLessonsLearned(e.target.value)}
                  placeholder="Kinh nghiệm bản thân khi dạy bài này..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Lưu phiếu dự giờ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
