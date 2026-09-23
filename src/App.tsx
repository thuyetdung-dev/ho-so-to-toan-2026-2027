import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ConfirmProvider } from './components/common/ConfirmDialog';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Send,
  Lock,
  RefreshCw,
  Sparkles,
  LogIn,
  Loader2,
} from 'lucide-react';

// Tách mã theo phân hệ: trang đầu tải nhanh hơn (trước đây 1 tệp JS ~1,8 MB)
const OverviewModule = lazy(() => import('./components/modules/OverviewModule').then(m => ({ default: m.OverviewModule })));
const MembersModule = lazy(() => import('./components/modules/MembersModule').then(m => ({ default: m.MembersModule })));
const PlansModule = lazy(() => import('./components/modules/PlansModule').then(m => ({ default: m.PlansModule })));
const LessonPlansModule = lazy(() => import('./components/modules/LessonPlansModule').then(m => ({ default: m.LessonPlansModule })));
const LessonStudyModule = lazy(() => import('./components/modules/LessonStudyModule').then(m => ({ default: m.LessonStudyModule })));
const ObservationModule = lazy(() => import('./components/modules/ObservationModule').then(m => ({ default: m.ObservationModule })));
const SpecialTopicsModule = lazy(() => import('./components/modules/SpecialTopicsModule').then(m => ({ default: m.SpecialTopicsModule })));
const ExamCreatorModule = lazy(() => import('./components/modules/ExamCreatorModule').then(m => ({ default: m.ExamCreatorModule })));
const AnalyticsModule = lazy(() => import('./components/modules/AnalyticsModule').then(m => ({ default: m.AnalyticsModule })));
const DocumentsModule = lazy(() => import('./components/modules/DocumentsModule').then(m => ({ default: m.DocumentsModule })));
const ReportsModule = lazy(() => import('./components/modules/ReportsModule').then(m => ({ default: m.ReportsModule })));
const AiAssistantModule = lazy(() => import('./components/modules/AiAssistantModule').then(m => ({ default: m.AiAssistantModule })));
const SettingsModule = lazy(() => import('./components/modules/SettingsModule').then(m => ({ default: m.SettingsModule })));

const CenteredCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 flex items-center justify-center p-4">
    <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6 text-center">{children}</div>
  </div>
);

const Toast: React.FC = () => {
  const { notification, setNotification } = useApp();
  if (!notification) return null;
  return (
    <div id="system-notification-toast" className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] sm:max-w-md print:hidden" role="status" aria-live="polite">
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
        <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-700 p-0.5 rounded" aria-label="Đóng thông báo">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const MainLayout: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    authStatus,
    isDemoMode,
    toggleDemoMode,
    submitAccessRequest,
    accessRequests,
    loginWithGoogle,
    isLoading,
  } = useApp();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Trước đây ô "Họ tên" luôn trống vì được khởi tạo khi chưa có currentUser
  useEffect(() => {
    if (currentUser?.displayName) setRequestName(prev => prev || currentUser.displayName || '');
  }, [currentUser]);

  const myPendingRequest = currentUser?.email
    ? accessRequests.find(r => r.email.toLowerCase() === currentUser.email?.toLowerCase() && r.status === 'pending')
    : null;
  const myRejectedRequest = currentUser?.email
    ? accessRequests.find(r => r.email.toLowerCase() === currentUser.email?.toLowerCase() && r.status === 'rejected')
    : null;

  const handleSendAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.email) return;
    setIsSubmittingRequest(true);
    try {
      await submitAccessRequest(
        currentUser.email,
        requestName || currentUser.displayName || 'Giáo viên THPT',
        requestReason || 'Xin cấp quyền truy cập để sinh hoạt và gửi kế hoạch bài dạy tổ Toán',
      );
      setRequestReason('');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const renderModule = () => {
    switch (activeTab) {
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
      case 'exams':
        return <ExamCreatorModule />;
      case 'analytics':
        return <AnalyticsModule />;
      case 'documents':
        return <DocumentsModule />;
      case 'reports':
        return <ReportsModule />;
      case 'ai-assistant':
        return <AiAssistantModule />;
      case 'settings':
        return <SettingsModule />;
      case 'overview':
      default:
        return <OverviewModule onNavigate={setActiveTab} />;
    }
  };

  const demoButton = (
    <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
      <span className="text-slate-500 text-[11px]">Hoặc trải nghiệm các chức năng trước:</span>
      <button
        onClick={toggleDemoMode}
        className="px-3.5 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-1.5"
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        <span>Chuyển sang Chế độ Demo</span>
      </button>
    </div>
  );

  // ----- Các màn hình chặn ở chế độ dữ liệu thật -----
  if (!isDemoMode && authStatus !== 'authorized') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans antialiased">
        <Toast />
        <Navbar onToggleSidebar={() => {}} isSidebarOpen={false} hideMenu />
        {authStatus === 'checking' && (
          <CenteredCard>
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm text-slate-600">Đang kiểm tra phiên đăng nhập và quyền truy cập...</p>
          </CenteredCard>
        )}

        {authStatus === 'signed_out' && (
          <CenteredCard>
            <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center mx-auto border border-blue-200">
              <LogIn className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-900">Đăng nhập để dùng dữ liệu chính thức</h1>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                Dữ liệu thật của tổ chỉ hiển thị với thành viên đã được Tổ trưởng mời hoặc phê duyệt. Hãy đăng nhập bằng tài khoản Google của bạn.
              </p>
            </div>
            <button
              onClick={() => loginWithGoogle()}
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>Đăng nhập bằng Google</span>
            </button>
            {demoButton}
          </CenteredCard>
        )}

        {authStatus === 'unauthorized' && currentUser && (
          <CenteredCard>
            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-900">Bạn chưa có quyền truy cập hệ thống Tổ Toán</h1>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                Tài khoản <strong className="text-slate-900 font-mono">{currentUser.email}</strong> chưa có trong danh sách thành viên hoặc thư mời. Vui lòng liên hệ Tổ trưởng hoặc gửi yêu cầu cấp quyền dưới đây.
              </p>
            </div>

            {myPendingRequest ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  <span>Yêu cầu đang chờ Tổ trưởng xét duyệt</span>
                </div>
                <p className="text-xs text-amber-800">
                  Đã gửi lúc {new Date(myPendingRequest.requestedAt).toLocaleString('vi-VN')}. Khi được duyệt, hãy tải lại trang.
                </p>
                <button onClick={() => window.location.reload()} className="text-xs font-semibold text-amber-900 underline">
                  Tải lại trang
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendAccessRequest} className="text-left space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                {myRejectedRequest && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">
                    Yêu cầu trước của bạn đã bị từ chối. Bạn có thể gửi lại kèm thông tin rõ hơn.
                  </div>
                )}
                <label className="block font-semibold text-slate-700">
                  Họ và tên của bạn
                  <input
                    type="text"
                    value={requestName}
                    onChange={e => setRequestName(e.target.value)}
                    placeholder="Ví dụ: Thầy Nguyễn Văn A"
                    maxLength={100}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-normal"
                    required
                  />
                </label>
                <label className="block font-semibold text-slate-700">
                  Lý do / Lời nhắn gửi Tổ trưởng
                  <textarea
                    rows={2}
                    value={requestReason}
                    onChange={e => setRequestReason(e.target.value)}
                    placeholder="Tôi là giáo viên Toán mới nhận nhiệm vụ dạy khối..."
                    maxLength={1000}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white resize-none font-normal"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingRequest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isSubmittingRequest ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu cấp quyền tới Tổ trưởng'}</span>
                </button>
              </form>
            )}
            {demoButton}
          </CenteredCard>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      <Toast />
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />

      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6 print:p-0 print:max-w-none">
        <Sidebar
          activeModule={activeTab}
          onSelectModule={setActiveTab}
          isOpen={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 min-w-0">
          <ErrorBoundary key={activeTab}>
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Đang tải phân hệ...
                </div>
              }
            >
              {renderModule()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white py-4 mt-auto print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>Sổ Sinh Hoạt Chuyên Môn Số – Tổ Toán THPT (GDPT 2018 & CV 5512/BGDĐT-GDTrH)</div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Hỗ trợ KaTeX & GeoGebra</span>
            <span>•</span>
            <span>Định dạng đề thi từ 2025</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <ConfirmProvider>
        <MainLayout />
      </ConfirmProvider>
    </AppProvider>
  );
}
