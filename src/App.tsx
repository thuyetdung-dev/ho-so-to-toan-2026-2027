import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { OverviewModule } from './components/modules/OverviewModule';
import { MembersModule } from './components/modules/MembersModule';
import { PlansModule } from './components/modules/PlansModule';
import { LessonPlansModule } from './components/modules/LessonPlansModule';
import { LessonStudyModule } from './components/modules/LessonStudyModule';
import { ObservationModule } from './components/modules/ObservationModule';
import { SpecialTopicsModule } from './components/modules/SpecialTopicsModule';
import { DocumentsModule } from './components/modules/DocumentsModule';
import { ReportsModule } from './components/modules/ReportsModule';
import { AiAssistantModule } from './components/modules/AiAssistantModule';
import { SettingsModule } from './components/modules/SettingsModule';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ShieldAlert,
  Send,
  Lock,
  Mail,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    notification,
    setNotification,
    currentUser,
    isUserAuthorized,
    isDemoMode,
    toggleDemoMode,
    submitAccessRequest,
    accessRequests,
    invitations,
  } = useApp();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Unauthorized Access Request Form State (Lỗi 23)
  const [requestName, setRequestName] = useState(currentUser?.displayName || '');
  const [requestReason, setRequestReason] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Check if current user has a pending request
  const myPendingRequest = currentUser?.email
    ? accessRequests.find(r => r.email.toLowerCase() === currentUser.email?.toLowerCase() && r.status === 'pending')
    : null;

  const handleSendAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.email) return;
    setIsSubmittingRequest(true);
    try {
      await submitAccessRequest(
        currentUser.email,
        requestName || currentUser.displayName || 'Giáo viên THPT',
        requestReason || 'Xin cấp quyền truy cập để sinh hoạt và gửi kế hoạch bài dạy tổ Toán'
      );
      setRequestReason('');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const renderModule = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewModule onNavigate={setActiveTab} />;
      case 'members':
        return <MembersModule />;
      case 'plans':
        return <PlansModule />;
      case 'lesson-plans':
        return <LessonPlansModule />;
      case 'lesson-study':
        return <LessonStudyModule />;
      case 'observations':
        return <ObservationModule />;
      case 'special-topics':
        return <SpecialTopicsModule />;
      case 'documents':
        return <DocumentsModule />;
      case 'reports':
        return <ReportsModule />;
      case 'ai-assistant':
        return <AiAssistantModule />;
      case 'settings':
        return <SettingsModule />;
      default:
        return <OverviewModule onNavigate={setActiveTab} />;
    }
  };

  // LỖI 23: Restriction screen for unauthorized signed-in users in Real Firestore Mode
  if (!isDemoMode && currentUser && !isUserAuthorized) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans antialiased">
        <Navbar onToggleSidebar={() => {}} isSidebarOpen={false} />

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6 text-center">
            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
              <Lock className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-900">
                Bạn chưa có quyền truy cập hệ thống Tổ Toán
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                Tài khoản Google <strong className="text-slate-900 font-mono">{currentUser.email}</strong> chưa nằm trong danh sách thành viên được phân quyền hoặc danh sách thư mời đã duyệt. Vui lòng liên hệ Tổ trưởng hoặc gửi yêu cầu cấp quyền dưới đây.
              </p>
            </div>

            {myPendingRequest ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  <span>Yêu cầu đang chờ Tổ trưởng xét duyệt</span>
                </div>
                <p className="text-xs text-amber-800">
                  Bạn đã gửi yêu cầu vào lúc: {new Date(myPendingRequest.requestedAt).toLocaleString('vi-VN')}.
                  Tổ trưởng hoặc Quản trị viên sẽ kích hoạt tài khoản của bạn ngay khi nhận được thông báo.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendAccessRequest} className="text-left space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Họ và tên của bạn</label>
                  <input
                    type="text"
                    value={requestName}
                    onChange={e => setRequestName(e.target.value)}
                    placeholder="Ví dụ: Thầy Nguyễn Văn A"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lý do / Lời nhắn gửi Tổ trưởng</label>
                  <textarea
                    rows={2}
                    value={requestReason}
                    onChange={e => setRequestReason(e.target.value)}
                    placeholder="Tôi là giáo viên Toán mới nhận nhiệm vụ dạy khối..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isSubmittingRequest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang gửi yêu cầu...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Gửi yêu cầu cấp quyền tới Tổ trưởng</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 text-[11px]">Hoặc trải nghiệm các chức năng trước:</span>
              <button
                onClick={toggleDemoMode}
                className="px-3.5 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Chuyển sang Chế độ Demo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Notification */}
      {notification && (
        <div
          id="system-notification-toast"
          className="fixed bottom-4 right-4 z-50 max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
          <div
            className={`p-3.5 rounded-xl shadow-lg border flex items-start gap-3 ${
              notification.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
            {notification.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}

            <div className="text-xs font-medium flex-1 leading-snug">{notification.message}</div>

            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Top Navigation */}
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />

      {/* Main Content Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Left Vertical Sidebar (Desktop + Mobile Drawer overlay) */}
        <Sidebar
          activeModule={activeTab}
          onSelectModule={setActiveTab}
          isOpen={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />

        {/* Center / Right Dynamic Workspace */}
        <main className="flex-1 min-w-0">{renderModule()}</main>
      </div>

      {/* Footer standard */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Sổ Sinh Hoạt Chuyên Môn Số – Tổ Toán – Tin học THPT (GDPT 2018 & CV 5512/BGDĐT-GDTrH)
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Hỗ trợ KaTeX & GeoGebra</span>
            <span>•</span>
            <span>Định dạng Đề thi 2025</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
