import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Meeting, MeetingTask } from '../../types';
import {
  Presentation,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  Calendar,
  Clock,
  UserCheck,
  FileCheck,
  Send,
  Sparkles,
} from 'lucide-react';

export const LessonStudyModule: React.FC = () => {
  const {
    activeMember,
    meetings,
    saveMeeting,
    allMembers,
    config,
    setNotification,
  } = useApp();

  const isLeader = activeMember.role === 'head' || activeMember.role === 'deputy' || activeMember.role === 'admin';

  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(meetings[0]?.id || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [opinionText, setOpinionText] = useState('');
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(2);

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId) || meetings[0];

  const handleLockMeeting = async () => {
    if (!selectedMeeting) return;
    const isLocked = selectedMeeting.status === 'finalized';
    const updated: Meeting = {
      ...selectedMeeting,
      status: isLocked ? 'draft' : 'finalized',
      lockedAt: isLocked ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveMeeting(updated);
    setNotification({
      message: isLocked ? 'Đã mở khóa biên bản sinh hoạt' : 'Đã chốt và khóa biên bản sinh hoạt chuyên môn',
      type: 'info',
    });
  };

  const handleAddOpinion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opinionText.trim() || !selectedMeeting || selectedMeeting.status === 'finalized') return;

    const newOp = {
      author: activeMember.displayName,
      content: opinionText.trim(),
    };

    const updated: Meeting = {
      ...selectedMeeting,
      memberOpinions: [...(selectedMeeting.memberOpinions || []), newOp],
      updatedAt: new Date().toISOString(),
    };

    await saveMeeting(updated);
    setOpinionText('');
    setNotification({ message: 'Đã lưu ý kiến phát biểu vào biên bản', type: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Presentation className="w-5 h-5 text-blue-600" />
            <span>Sinh hoạt chuyên môn & Nghiên cứu bài học</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chu trình 4 bước nghiên cứu bài học và lưu trữ biên bản họp tổ chuyên môn
          </p>
        </div>

        {isLeader && (
          <button
            onClick={() => setShowAddModal(true)}
            id="btn-add-meeting"
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo cuộc họp mới</span>
          </button>
        )}
      </div>

      {/* Chu trình 4 bước Nghiên cứu bài học banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
          Chu trình 4 bước sinh hoạt chuyên môn theo Nghiên cứu bài học
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            onClick={() => setActiveStep(1)}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              activeStep === 1
                ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs font-bold text-blue-700">Bước 1</div>
            <div className="text-xs font-semibold text-slate-800 mt-0.5">Xây dựng bài dạy minh họa</div>
            <p className="text-[11px] text-slate-500 mt-1">Cùng thiết kế kế hoạch bài dạy theo CV 5512</p>
          </div>

          <div
            onClick={() => setActiveStep(2)}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              activeStep === 2
                ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs font-bold text-blue-700">Bước 2</div>
            <div className="text-xs font-semibold text-slate-800 mt-0.5">Dạy minh họa & Dự giờ</div>
            <p className="text-[11px] text-slate-500 mt-1">Quan sát hoạt động học của học sinh</p>
          </div>

          <div
            onClick={() => setActiveStep(3)}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              activeStep === 3
                ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs font-bold text-blue-700">Bước 3</div>
            <div className="text-xs font-semibold text-slate-800 mt-0.5">Phân tích bài học</div>
            <p className="text-[11px] text-slate-500 mt-1">Chia sẻ thực tế học tập của học sinh</p>
          </div>

          <div
            onClick={() => setActiveStep(4)}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              activeStep === 4
                ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs font-bold text-blue-700">Bước 4</div>
            <div className="text-xs font-semibold text-slate-800 mt-0.5">Vận dụng vào thực tiễn</div>
            <p className="text-[11px] text-slate-500 mt-1">Điều chỉnh cho các lớp tiếp theo</p>
          </div>
        </div>
      </div>

      {/* Meetings Layout: Left Meetings List / Right Minutes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold text-slate-700 px-1">Danh sách các kỳ họp ({meetings.length})</div>
          <div className="space-y-2">
            {meetings.map(m => {
              const isSelected = m.id === selectedMeeting?.id;
              const isFinalized = m.status === 'finalized';

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMeetingId(m.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-400 shadow-xs ring-1 ring-blue-300'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      {m.type === 'lesson_study' ? 'Nghiên cứu bài học' : 'Định kỳ'}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                        isFinalized ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isFinalized ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>{isFinalized ? 'Đã chốt' : 'Bản nháp'}</span>
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">{m.title}</h3>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{m.date}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Minutes Document */}
        <div className="lg:col-span-8 space-y-6">
          {selectedMeeting ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                      {selectedMeeting.type === 'lesson_study' ? 'Nghiên cứu bài học' : 'Sinh hoạt định kỳ'}
                    </span>
                    <span className="text-xs text-slate-500">Ngày: <strong>{selectedMeeting.date}</strong></span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-1">{selectedMeeting.title}</h2>
                </div>

                {isLeader && (
                  <button
                    onClick={handleLockMeeting}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                      selectedMeeting.status === 'finalized'
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                    }`}
                  >
                    {selectedMeeting.status === 'finalized' ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Mở khóa biên bản</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Chốt & Khóa biên bản</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Thông tin chung */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500">Địa điểm: </span>
                  <span className="font-semibold text-slate-800">{selectedMeeting.location}</span>
                </div>
                <div>
                  <span className="text-slate-500">Chủ trì: </span>
                  <span className="font-semibold text-slate-800">{selectedMeeting.chairPerson}</span>
                </div>
                <div>
                  <span className="text-slate-500">Thư ký: </span>
                  <span className="font-semibold text-slate-800">{selectedMeeting.secretary}</span>
                </div>
                <div>
                  <span className="text-slate-500">Có mặt: </span>
                  <span className="font-semibold text-slate-800">{selectedMeeting.attendees?.join(', ')}</span>
                </div>
              </div>

              {/* Nội dung họp */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  1. Nội dung sinh hoạt chuyên môn
                </h3>
                <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-slate-100 font-mono text-[11px]">
                  {selectedMeeting.content}
                </div>
              </div>

              {/* Ý kiến các thành viên */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  2. Ý kiến thảo luận của các thành viên ({selectedMeeting.memberOpinions?.length || 0})
                </h3>

                <div className="space-y-2">
                  {selectedMeeting.memberOpinions?.map((op, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="font-bold text-slate-800 mb-0.5">{op.author}:</div>
                      <div className="text-slate-700">{op.content}</div>
                    </div>
                  ))}
                </div>

                {/* Form thêm ý kiến */}
                {selectedMeeting.status !== 'finalized' && (
                  <form onSubmit={handleAddOpinion} className="flex gap-2 pt-2">
                    <input
                      type="text"
                      placeholder={`Nhập ý kiến phát biểu của ${activeMember.displayName}...`}
                      value={opinionText}
                      onChange={e => setOpinionText(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Ghi biên bản</span>
                    </button>
                  </form>
                )}
              </div>

              {/* Kết luận và giao việc */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 border-b border-slate-200 pb-1">
                  3. Kết luận & Phân công nhiệm vụ
                </h3>
                <div className="text-xs text-slate-800 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                  {selectedMeeting.conclusions}
                </div>

                {/* Nhiệm vụ có hạn */}
                {selectedMeeting.tasks?.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-slate-700">Các công việc được giao:</div>
                    <div className="space-y-1.5">
                      {selectedMeeting.tasks.map(t => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200 text-xs"
                        >
                          <div>
                            <span className="font-medium text-slate-900">{t.title}</span>
                            <span className="text-slate-500 ml-2">({t.assigneeName} • Hạn: {t.deadline})</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {t.status === 'completed' ? 'Hoàn thành' : 'Đang thực hiện'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
              Chưa có biên bản sinh hoạt chuyên môn nào.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
