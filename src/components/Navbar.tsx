import React, { useEffect, useRef, useState } from 'react';
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
  hideMenu?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, isSidebarOpen, hideMenu = false }) => {
  const {
    isDemoMode,
    toggleDemoMode,
    activeMember,
    allMembers,
    selectActiveMember,
    canSimulateRoles,
    config,
    currentUser,
    loginWithGoogle,
    logout,
    isFirestoreConnected,
    isLoading,
  } = useApp();

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi bấm ra ngoài
  useEffect(() => {
    if (!showRoleMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowRoleMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showRoleMenu]);

  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    admin: { label: 'Quản trị hệ thống', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    head: { label: 'Tổ trưởng chuyên môn', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    deputy: { label: 'Tổ phó chuyên môn', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
    teacher: { label: 'Giáo viên', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    principal: { label: 'Ban Giám Hiệu', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-16">
        {/* Left: Mobile Menu Toggle & Brand */}
        <div className="flex items-center gap-3">
          {!hideMenu && <button
            onClick={onToggleSidebar}
            id="btn-toggle-sidebar"
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Chuyển đổi thanh điều hướng"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>}

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
            title={isDemoMode ? 'Đang dùng dữ liệu mẫu (thay đổi không được lưu vĩnh viễn). Bấm để chuyển sang dữ liệu thật.' : 'Đang dùng dữ liệu thật trên Firestore. Bấm để chuyển sang dữ liệu mẫu.'}
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

          {!isDemoMode && !isFirestoreConnected && (
            <span className="hidden sm:inline-flex px-2 py-1 text-[11px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200" title="Mất mạng: thay đổi sẽ đồng bộ khi có mạng">
              Ngoại tuyến
            </span>
          )}

          {/* Chế độ demo: cho phép đổi vai để thử phân quyền. Chế độ thật: chỉ hiện danh tính. */}
          {(isDemoMode || currentUser) && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => canSimulateRoles && setShowRoleMenu(!showRoleMenu)}
              id="btn-role-menu"
              aria-haspopup={canSimulateRoles ? 'menu' : undefined}
              aria-expanded={showRoleMenu}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg transition-colors border border-slate-200 ${canSimulateRoles ? 'hover:bg-slate-200' : 'cursor-default'}`}
              title={canSimulateRoles ? 'Đổi vai trò thử nghiệm' : currentUser?.email || ''}
            >
              {canSimulateRoles ? <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> : <UserIcon className="w-3.5 h-3.5 text-blue-600" />}
              <span className="hidden md:inline font-semibold max-w-40 truncate">{activeMember.displayName}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${roleLabels[activeMember.role]?.color || 'bg-slate-200'}`}>
                {roleLabels[activeMember.role]?.label || activeMember.role}
              </span>
            </button>

            {showRoleMenu && canSimulateRoles && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50" role="menu">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">Chuyển vai trò thử nghiệm (chỉ ở chế độ demo)</p>
                  <p className="text-[11px] text-slate-500">Kiểm tra phân quyền Tổ trưởng, Giáo viên, BGH</p>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {allMembers.map(m => (
                    <button
                      key={m.id}
                      role="menuitem"
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
          )}

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
              onClick={() => loginWithGoogle()}
              disabled={isLoading}
              id="btn-login-google"
              className="inline-flex disabled:opacity-50 items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200"
              title="Đăng nhập tài khoản Google để đồng bộ Firestore"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đăng nhập Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
