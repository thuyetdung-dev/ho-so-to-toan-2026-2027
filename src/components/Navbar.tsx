import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import {
  School,
  ShieldCheck,
  User as UserIcon,
  Sparkles,
  Database,
  Menu,
  X,
  LogOut,
  LogIn,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, isSidebarOpen }) => {
  const {
    isDemoMode,
    toggleDemoMode,
    activeMember,
    allMembers,
    switchActiveRole,
    selectActiveMember,
    config,
    currentUser,
    loginWithGoogle,
    logout,
    notification,
    setNotification,
    isFirestoreConnected,
  } = useApp();

  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    admin: { label: 'Quản trị hệ thống', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    head: { label: 'Tổ trưởng chuyên môn', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    deputy: { label: 'Tổ phó chuyên môn', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
    teacher: { label: 'Giáo viên', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    principal: { label: 'Ban Giám Hiệu', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`px-4 py-2 text-sm flex items-center justify-between transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-b border-rose-200'
              : 'bg-blue-50 text-blue-800 border-b border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {notification.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span className="font-medium text-xs sm:text-sm">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-16">
        {/* Left: Mobile Menu Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            id="btn-toggle-sidebar"
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Chuyển đổi thanh điều hướng"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold shadow-xs">
              <School className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight line-clamp-1">
                  {config.departmentName || 'Tổ Toán THPT'}
                </span>
                <span className="hidden lg:inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {config.academicYear} • {config.currentTerm}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-1 hidden sm:block">
                {config.schoolName || 'Trường THPT'} • Chương trình GDPT 2018
              </p>
            </div>
          </div>
        </div>

        {/* Right: Mode Toggle, Role Switcher & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Demo Mode Toggle Badge */}
          <button
            onClick={toggleDemoMode}
            id="btn-toggle-demo"
            className={`px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-all border ${
              isDemoMode
                ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-xs ring-2 ring-amber-200/50'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            }`}
            title={isDemoMode ? 'Đang bật dữ liệu mẫu 6 GV & 30 câu hỏi' : 'Đang dùng dữ liệu thật Firestore'}
          >
            {isDemoMode ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>DỮ LIỆU MẪU</span>
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>DỮ LIỆU THẬT</span>
              </>
            )}
          </button>

          {/* Quick Role / Member Selector for testing all RBAC requirements */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              id="btn-role-menu"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline font-semibold">{activeMember.displayName}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${roleLabels[activeMember.role]?.color || 'bg-slate-200'}`}>
                {roleLabels[activeMember.role]?.label || activeMember.role}
              </span>
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">Chuyển vai trò thử nghiệm</p>
                  <p className="text-[11px] text-slate-500">Kiểm tra phân quyền Tổ trưởng, Giáo viên, BGH</p>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {allMembers.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        selectActiveMember(m.id);
                        setShowRoleMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        activeMember.id === m.id ? 'bg-blue-50/70 font-semibold text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-slate-800">{m.displayName}</div>
                        <div className="text-[10px] text-slate-400">{m.email}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${roleLabels[m.role]?.color}`}>
                        {roleLabels[m.role]?.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Firebase Google Auth button */}
          {currentUser ? (
            <button
              onClick={logout}
              id="btn-logout"
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
              title={`Đăng xuất (${currentUser.email})`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={loginWithGoogle}
              id="btn-login-google"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200"
              title="Đăng nhập tài khoản Google để đồng bộ Firestore"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
