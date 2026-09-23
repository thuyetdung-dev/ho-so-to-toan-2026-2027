import React from 'react';
import { useApp } from '../../context/AppContext';
import { ActiveModule } from '../Sidebar';
import {
  Calendar,
  FileText,
  Eye,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  PlusCircle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

interface OverviewModuleProps {
  onNavigate: (module: ActiveModule) => void;
}

export const OverviewModule: React.FC<OverviewModuleProps> = ({ onNavigate }) => {
  const {
    activeMember,
    isDemoMode,
    config,
    allMembers,
    classes,
    departmentPlans,
    lessonPlans,
    meetings,
    observations,
    questions,
    exams,
    permissions,
  } = useApp();

  // Metrics
  const myLessonPlans = lessonPlans.filter(p => p.teacherId === activeMember.id);
  const pendingLessonPlans = lessonPlans.filter(p => p.status === 'submitted');
  const myObservations = observations.filter(o => o.observerId === activeMember.id || o.teacherId === activeMember.id);
  const approvedQuestionsCount = questions.filter(q => q.status === 'approved').length;
  const pendingQuestionsCount = questions.filter(q => q.status === 'pending').length;

  // Bản cũ lấy 2 phần tử đầu mảng (không phải cuộc họp sắp tới). Nay: sắp tới trước, nếu không có thì gần nhất.
  const today = new Date().toISOString().slice(0, 10);
  const futureMeetings = meetings.filter(m => (m.date || '') >= today).sort((a, b) => a.date.localeCompare(b.date));
  const upcomingMeetings = (futureMeetings.length
    ? futureMeetings
    : [...meetings].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  ).slice(0, 2);

  // Question distribution by grade
  const qGrade10 = questions.filter(q => q.grade === 10).length;
  const qGrade11 = questions.filter(q => q.grade === 11).length;
  const qGrade12 = questions.filter(q => q.grade === 12).length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              Chào mừng, {activeMember.displayName}
            </h1>
            {isDemoMode && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 border border-amber-300">
                Chế độ trải nghiệm
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Bàn làm việc điện tử • {config.departmentName} • Năm học {config.academicYear} ({config.currentTerm})
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('lesson-plans')}
            id="btn-quick-new-lesson-plan"
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Nộp KH bài dạy</span>
          </button>
          <button
            onClick={() => onNavigate('observations')}
            id="btn-quick-obs"
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors flex items-center gap-1.5 border border-slate-200"
          >
            <Eye className="w-3.5 h-3.5 text-slate-600" />
            <span>Đăng ký dự giờ</span>
          </button>
          {permissions.isLeader && (
            <button
              onClick={() => onNavigate('lesson-study')}
              id="btn-quick-meeting"
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors flex items-center gap-1.5 border border-slate-200"
            >
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Tạo biên bản họp</span>
            </button>
          )}
        </div>
      </div>

      {/* Role-Specific Work Queue / Reminders */}
      {permissions.isLeader && pendingLessonPlans.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900">
                Có {pendingLessonPlans.length} kế hoạch bài dạy đang chờ Tổ trưởng phê duyệt
              </p>
              <p className="text-[11px] text-amber-700">
                Các thầy cô đã gửi giáo án tuần mới cần được rà soát nội dung và mục tiêu theo CV 5512.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('lesson-plans')}
            className="px-3 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
          >
            Xem và duyệt ngay &rarr;
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => onNavigate('members')}
          className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Giáo viên trong tổ</span>
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              {allMembers.length}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900">{allMembers.length} giáo viên</div>
          <div className="text-[11px] text-slate-500 mt-1">Phụ trách {classes.length} lớp (Toán 10, 11, 12)</div>
        </div>

        <div
          onClick={() => onNavigate('lesson-plans')}
          className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Kế hoạch bài dạy</span>
            <FileText className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{lessonPlans.length} giáo án</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {pendingLessonPlans.length > 0 ? `${pendingLessonPlans.length} chờ duyệt` : '100% đã được phê duyệt'}
          </div>
        </div>


        <div
          onClick={() => onNavigate('observations')}
          className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Phiếu dự giờ rút KN</span>
            <Eye className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{observations.length} lượt dự giờ</div>
          <div className="text-[11px] text-slate-500 mt-1">Đạt chỉ tiêu kế hoạch tháng</div>
        </div>
      </div>

      {/* Main Content Split: Recent Activities & Question Bank Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Schedule & Curriculum Progress */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sinh hoạt chuyên môn sắp tới */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800">Lịch sinh hoạt chuyên môn & Nghiên cứu bài học</h2>
              </div>
              <button
                onClick={() => onNavigate('lesson-study')}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
              >
                Xem tất cả &rarr;
              </button>
            </div>

            {upcomingMeetings.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Chưa có lịch họp sắp tới</p>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map(m => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800">
                          {m.type === 'lesson_study' ? 'Nghiên cứu bài học' : 'Định kỳ'}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 line-clamp-1">{m.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                        <span>Ngày: {m.date}</span>
                        <span>•</span>
                        <span>Địa điểm: {m.location}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          m.status === 'finalized'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {m.status === 'finalized' ? 'Đã chốt biên bản' : 'Đang soạn thảo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phân phối chương trình & Bài dạy tuần này */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-800">Kế hoạch dạy học theo CV 5512 (Tuần này)</h2>
              </div>
              <button
                onClick={() => onNavigate('plans')}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Chi tiết &rarr;
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2.5">Khối</th>
                    <th className="p-2.5">Chủ đề / Tên bài học</th>
                    <th className="p-2.5">Số tiết</th>
                    <th className="p-2.5">Thiết bị & Đồ dùng</th>
                    <th className="p-2.5">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-blue-700">Khối 12</td>
                    <td className="p-2.5 font-medium text-slate-800">Đường tiệm cận của đồ thị hàm số</td>
                    <td className="p-2.5">4 tiết</td>
                    <td className="p-2.5 text-slate-500">GeoGebra minh họa đồ thị</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                        Đúng tiến độ
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-cyan-700">Khối 11</td>
                    <td className="p-2.5 font-medium text-slate-800">Hàm số lượng giác và đồ thị</td>
                    <td className="p-2.5">4 tiết</td>
                    <td className="p-2.5 text-slate-500">Máy chiếu, thước vẽ parabol</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                        Đúng tiến độ
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-emerald-700">Khối 10</td>
                    <td className="p-2.5 font-medium text-slate-800">Bất phương trình bậc nhất hai ẩn</td>
                    <td className="p-2.5">3 tiết</td>
                    <td className="p-2.5 text-slate-500">Phiếu học tập nhóm</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                        Đúng tiến độ
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: Question Bank Stats & Quick Help */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
              <span>Cấu trúc Ngân hàng câu hỏi</span>
              <span className="text-[11px] text-slate-400 font-normal">GDPT 2018</span>
            </h2>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600">Khối 12 (Trọng tâm tốt nghiệp)</span>
                  <span className="font-bold text-blue-700">{qGrade12} câu</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${Math.min(100, (qGrade12 / (questions.length || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600">Khối 11</span>
                  <span className="font-bold text-cyan-700">{qGrade11} câu</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-600 rounded-full"
                    style={{ width: `${Math.min(100, (qGrade11 / (questions.length || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600">Khối 10</span>
                  <span className="font-bold text-emerald-700">{qGrade10} câu</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${Math.min(100, (qGrade10 / (questions.length || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium mb-2">Định dạng đề mới 2025:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <div className="font-bold text-slate-700">Đúng / Sai</div>
                  <div className="text-[11px] text-slate-500">4 câu / 4.0đ</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <div className="font-bold text-slate-700">Trả lời ngắn</div>
                  <div className="text-[11px] text-slate-500">6 câu / 3.0đ</div>
                </div>
              </div>
            </div>
          </div>

          {/* Guidelines box */}
          <div className="bg-linear-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
              Lưu ý quy định chuyên môn
            </h3>
            <ul className="text-xs text-blue-800 space-y-2 list-disc list-inside">
              <li>Mọi công thức Toán sử dụng chuẩn KaTeX: inline <code>$...$</code> hoặc block <code>$$...$$</code>.</li>
              <li>Chế độ trải nghiệm hoàn toàn cách ly với cơ sở dữ liệu thật trên Cloud Firestore.</li>
              <li>Các đề kiểm tra chưa công bố chỉ tác giả và tổ trưởng có quyền xem.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
