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
  X,
  Pencil,
  Trash2,
  Printer,
} from 'lucide-react';
import { useConfirm } from '../common/ConfirmDialog';
import { newId, todayISO } from '../../utils/ids';

export const LessonStudyModule: React.FC = () => {
  const {
    activeMember,
    meetings,
    saveMeeting,
    deleteMeeting,
    allMembers,
    config,
    setNotification,
    permissions,
  } = useApp();
  const confirm = useConfirm();

  const isLeader = permissions.isLeader;

  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [absenteesText, setAbsenteesText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDeadline, setTaskDeadline] = useState(todayISO());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    type: 'regular' as Meeting['type'],
    date: new Date().toISOString().split('T')[0],
    location: 'Phòng họp tổ chuyên môn',
    chairPerson: activeMember.displayName,
    secretary: '',
    content: '',
    conclusions: '',
  });
  const [opinionText, setOpinionText] = useState('');
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(2);

  const sortedMeetings = [...meetings].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId) || sortedMeetings[0];
  const activeMembers = allMembers.filter(m => m.status === 'active');

  const openCreate = () => {
    setEditingId(null);
    setNewMeeting({
      title: '',
      type: 'regular',
      date: todayISO(),
      location: 'Phòng họp tổ chuyên môn',
      chairPerson: activeMember.displayName,
      secretary: '',
      content: '',
      conclusions: '',
    });
    setAttendees(activeMembers.map(m => m.displayName));
    setAbsenteesText('');
    setShowAddModal(true);
  };

  const openEdit = (m: Meeting) => {
    setEditingId(m.id);
    setNewMeeting({
      title: m.title,
      type: m.type,
      date: m.date,
      location: m.location,
      chairPerson: m.chairPerson,
      secretary: m.secretary,
      content: m.content,
      conclusions: m.conclusions,
    });
    setAttendees(m.attendees || []);
    setAbsenteesText((m.absentees || []).map(a => `${a.name}${a.reason ? ` - ${a.reason}` : ''}`).join('\n'));
    setShowAddModal(true);
  };

  const handleDeleteMeeting = async () => {
    if (!selectedMeeting) return;
    const ok = await confirm({
      title: 'Xóa biên bản họp?',
      message: `Biên bản "${selectedMeeting.title}" sẽ bị xóa vĩnh viễn.`,
      confirmText: 'Xóa biên bản',
      danger: true,
    });
    if (ok) {
      await deleteMeeting(selectedMeeting.id);
      setSelectedMeetingId('');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting || !taskTitle.trim()) return;
    const task: MeetingTask = {
      id: newId('task'),
      title: taskTitle.trim(),
      assigneeName: taskAssignee || activeMember.displayName,
      deadline: taskDeadline,
      status: 'pending',
    };
    if (await saveMeeting({ ...selectedMeeting, tasks: [...(selectedMeeting.tasks || []), task] }, { silent: true })) {
      setTaskTitle('');
      setNotification({ message: 'Đã giao nhiệm vụ', type: 'success' });
    }
  };

  const cycleTaskStatus = async (taskId: string) => {
    if (!selectedMeeting) return;
    const next: Record<MeetingTask['status'], MeetingTask['status']> = { pending: 'in_progress', in_progress: 'completed', completed: 'pending' };
    await saveMeeting(
      { ...selectedMeeting, tasks: selectedMeeting.tasks.map(t => (t.id === taskId ? { ...t, status: next[t.status] } : t)) },
      { silent: true },
    );
  };

  const handleLockMeeting = async () => {
    if (!selectedMeeting) return;
    const isLocked = selectedMeeting.status === 'finalized';
    const updated: Meeting = {
      ...selectedMeeting,
      status: isLocked ? 'draft' : 'finalized',
      lockedAt: isLocked ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!isLocked) {
      const ok = await confirm({
        title: 'Chốt và khóa biên bản?',
        message: 'Sau khi chốt, thành viên không thể thêm ý kiến. Chỉ Tổ trưởng/Tổ phó mới mở khóa được.',
        confirmText: 'Chốt biên bản',
      });
      if (!ok) return;
    }
    if (await saveMeeting(updated, { silent: true })) {
      setNotification({
        message: isLocked ? 'Đã mở khóa biên bản sinh hoạt' : 'Đã chốt và khóa biên bản sinh hoạt chuyên môn',
        type: 'info',
      });
    }
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

    if (await saveMeeting(updated, { silent: true })) {
      setOpinionText('');
      setNotification({ message: 'Đã lưu ý kiến phát biểu vào biên bản', type: 'success' });
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeeting.title.trim() || !newMeeting.date || !newMeeting.location.trim()) return;

    const existing = editingId ? meetings.find(m => m.id === editingId) : undefined;
    const absentees = absenteesText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => {
        const [name, ...rest] = l.split(' - ');
        return { name: name.trim(), reason: rest.join(' - ').trim() };
      });
    const meeting: Meeting = {
      ...(existing || {}),
      id: existing?.id || newId('meeting'),
      title: newMeeting.title.trim(),
      type: newMeeting.type,
      date: newMeeting.date,
      location: newMeeting.location.trim(),
      isOnline: false,
      chairPerson: newMeeting.chairPerson.trim() || activeMember.displayName,
      secretary: newMeeting.secretary.trim(),
      attendees,
      absentees,
      content: newMeeting.content.trim(),
      memberOpinions: existing?.memberOpinions || [],
      conclusions: newMeeting.conclusions.trim(),
      tasks: existing?.tasks || [],
      status: existing?.status || 'draft',
      updatedAt: new Date().toISOString(),
    };

    if (!(await saveMeeting(meeting))) return;
    setSelectedMeetingId(meeting.id);
    setShowAddModal(false);
    setEditingId(null);
    setNewMeeting({
      title: '',
      type: 'regular',
      date: new Date().toISOString().split('T')[0],
      location: 'Phòng họp tổ chuyên môn',
      chairPerson: activeMember.displayName,
      secretary: '',
      content: '',
      conclusions: '',
    });
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
            onClick={openCreate}
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
            {sortedMeetings.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">Chưa có buổi họp nào.</div>
            )}
            {sortedMeetings.map(m => {
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

                <div className="flex flex-wrap gap-2 print:hidden">
                <button onClick={() => window.print()} className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 border border-slate-200">
                  <Printer className="w-3.5 h-3.5" /> In
                </button>
                {isLeader && selectedMeeting.status !== 'finalized' && (
                  <button onClick={() => openEdit(selectedMeeting)} className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg flex items-center gap-1">
                    <Pencil className="w-3.5 h-3.5" /> Sửa
                  </button>
                )}
                {permissions.isAdminOrHead && (
                  <button onClick={handleDeleteMeeting} className="px-2.5 py-1.5 text-xs text-rose-700 border border-rose-200 hover:bg-rose-50 rounded-lg" aria-label="Xóa biên bản">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
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
                  <span className="font-semibold text-slate-800">{selectedMeeting.attendees?.join(', ') || '—'}</span>
                </div>
                {selectedMeeting.absentees?.length > 0 && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-500">Vắng: </span>
                    <span className="font-semibold text-slate-800">
                      {selectedMeeting.absentees.map(a => `${a.name}${a.reason ? ` (${a.reason})` : ''}`).join(', ')}
                    </span>
                  </div>
                )}
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
                {(selectedMeeting.tasks?.length > 0 || isLeader) && (
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
                          <button
                            type="button"
                            disabled={!(isLeader || (t.assigneeName === activeMember.displayName && selectedMeeting.status !== 'finalized'))}
                            onClick={() => cycleTaskStatus(t.id)}
                            title="Bấm để đổi trạng thái"
                            className={`px-2 py-0.5 rounded text-[10px] font-bold disabled:cursor-default ${
                              t.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.status === 'completed' ? 'Hoàn thành' : t.status === 'in_progress' ? 'Đang thực hiện' : 'Chưa bắt đầu'}
                          </button>
                        </div>
                      ))}
                    </div>
                    {isLeader && (
                      <form onSubmit={handleAddTask} className="grid grid-cols-1 sm:grid-cols-[2fr_1.2fr_1fr_auto] gap-2 pt-1 print:hidden">
                        <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Nội dung nhiệm vụ..." className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg" aria-label="Nhiệm vụ" />
                        <select value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)} className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white" aria-label="Người thực hiện">
                          <option value="">— Người thực hiện —</option>
                          {activeMembers.map(m => (
                            <option key={m.id} value={m.displayName}>{m.displayName}</option>
                          ))}
                        </select>
                        <input type="date" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg" aria-label="Hạn" />
                        <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Giao việc</button>
                      </form>
                    )}
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

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{editingId ? 'Sửa biên bản họp' : 'Tạo cuộc họp mới'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Biên bản sẽ được lưu vào Firestore ở trạng thái bản nháp.</p>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Đóng">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="sm:col-span-2 font-semibold text-slate-700">
                Tên cuộc họp <span className="text-rose-600">*</span>
                <input required value={newMeeting.title} onChange={e => setNewMeeting(v => ({ ...v, title: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" placeholder="Ví dụ: Sinh hoạt chuyên môn tháng 9/2026" />
              </label>
              <label className="font-semibold text-slate-700">
                Loại cuộc họp
                <select value={newMeeting.type} onChange={e => setNewMeeting(v => ({ ...v, type: e.target.value as Meeting['type'] }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-normal">
                  <option value="regular">Sinh hoạt định kỳ</option>
                  <option value="extraordinary">Họp đột xuất</option>
                  <option value="lesson_study">Nghiên cứu bài học</option>
                </select>
              </label>
              <label className="font-semibold text-slate-700">
                Ngày họp <span className="text-rose-600">*</span>
                <input required type="date" value={newMeeting.date} onChange={e => setNewMeeting(v => ({ ...v, date: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
              <label className="sm:col-span-2 font-semibold text-slate-700">
                Địa điểm <span className="text-rose-600">*</span>
                <input required value={newMeeting.location} onChange={e => setNewMeeting(v => ({ ...v, location: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
              <label className="font-semibold text-slate-700">
                Chủ trì
                <input value={newMeeting.chairPerson} onChange={e => setNewMeeting(v => ({ ...v, chairPerson: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
              <label className="font-semibold text-slate-700">
                Thư ký
                <input value={newMeeting.secretary} onChange={e => setNewMeeting(v => ({ ...v, secretary: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" placeholder="Họ tên thư ký" />
              </label>
              <fieldset className="sm:col-span-2">
                <legend className="font-semibold text-slate-700 mb-1">Thành viên có mặt</legend>
                <div className="flex flex-wrap gap-1.5">
                  {activeMembers.map(m => {
                    const on = attendees.includes(m.displayName);
                    return (
                      <label key={m.id} className={`px-2 py-1 rounded border cursor-pointer ${on ? 'bg-blue-50 border-blue-300 text-blue-800' : 'border-slate-200 text-slate-500'}`}>
                        <input
                          type="checkbox"
                          className="mr-1"
                          checked={on}
                          onChange={() => setAttendees(p => (on ? p.filter(n => n !== m.displayName) : [...p, m.displayName]))}
                        />
                        {m.displayName}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="sm:col-span-2 font-semibold text-slate-700">
                Vắng mặt (mỗi dòng: Họ tên - Lý do)
                <textarea rows={2} value={absenteesText} onChange={e => setAbsenteesText(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg resize-y font-normal" />
              </label>
              <label className="sm:col-span-2 font-semibold text-slate-700">
                Nội dung
                <textarea rows={5} value={newMeeting.content} onChange={e => setNewMeeting(v => ({ ...v, content: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg resize-y font-normal" placeholder="Các nội dung cần thảo luận..." />
              </label>
              <label className="sm:col-span-2 font-semibold text-slate-700">
                Kết luận
                <textarea rows={3} value={newMeeting.conclusions} onChange={e => setNewMeeting(v => ({ ...v, conclusions: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg resize-y font-normal" />
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5"><Plus className="w-4 h-4" /> {editingId ? 'Lưu thay đổi' : 'Tạo và lưu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
