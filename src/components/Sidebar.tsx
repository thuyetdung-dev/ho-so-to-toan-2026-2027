import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  Presentation,
  Eye,
  Award,
  FolderOpen,
  Printer,
  Bot,
  Settings,
} from 'lucide-react';

export const MODULE_IDS = [
  'overview',
  'members',
  'plans',
  'lesson-plans',
  'lesson-study',
  'observations',
  'special-topics',
  'documents',
  'reports',
  'ai-assistant',
  'settings',
] as const;

export type ActiveModule = (typeof MODULE_IDS)[number];

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (mod: ActiveModule) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  isOpen,
  onCloseMobile,
}) => {
  const {
    activeMember,
    config,
    lessonPlans,
    departmentPlans,
    accessRequests,
    permissions,
  } = useApp();

  // Badges: chỉ hiện số việc cần xử lý với người có quyền xử lý
  const pendingLessonPlans = permissions.isLeader ? lessonPlans.filter(p => p.status === 'submitted').length : 0;
  const pendingDeptPlans = permissions.canApproveDeptPlan ? departmentPlans.filter(p => p.status === 'submitted').length : 0;
  const pendingRequests = permissions.isLeader ? accessRequests.filter(r => r.status === 'pending').length : 0;

  const navItems = [
    {
      id: 'overview' as ActiveModule,
      label: '1. Tổng quan',
      desc: 'Bàn làm việc & chỉ số chính',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'members' as ActiveModule,
      label: '2. Thành viên & Phân công',
      desc: 'Hồ sơ GV & thời khóa biểu 5512',
      icon: Users,
      badge: pendingRequests > 0 ? `${pendingRequests}` : null,
      badgeColor: 'bg-rose-500',
    },
    {
      id: 'plans' as ActiveModule,
      label: '3. Kế hoạch của tổ & GV',
      desc: 'Phụ lục I, III CV 5512',
      icon: CalendarDays,
      badge: pendingDeptPlans > 0 ? `${pendingDeptPlans}` : null,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'lesson-plans' as ActiveModule,
      label: '4. Kế hoạch bài dạy',
      desc: 'Giáo án 4 hoạt động CV 5512',
      icon: FileText,
      badge: pendingLessonPlans > 0 ? `${pendingLessonPlans}` : null,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'lesson-study' as ActiveModule,
      label: '5. Nghiên cứu bài học',
      desc: 'Chu trình 4 bước & biên bản họp',
      icon: Presentation,
      badge: null,
    },
    {
      id: 'observations' as ActiveModule,
      label: '6. Dự giờ & Rút KN',
      desc: 'Phiếu dự giờ tiêu chí 5512',
      icon: Eye,
      badge: null,
    },
    {
      id: 'special-topics' as ActiveModule,
      label: '7. Chuyên đề & Sáng kiến',
      desc: 'HSG, BDTX, GeoGebra & STEM',
      icon: Award,
      badge: null,
    },
    {
      id: 'documents' as ActiveModule,
      label: '8. Tài liệu dùng chung',
      desc: 'Văn bản, mẫu biểu, bài giảng',
      icon: FolderOpen,
      badge: null,
    },
    {
      id: 'reports' as ActiveModule,
      label: '9. Báo cáo & In',
      desc: 'Báo cáo tháng, học kỳ, xuất Excel',
      icon: Printer,
      badge: null,
    },
    {
      id: 'ai-assistant' as ActiveModule,
      label: '10. Trợ lý AI Toán học',
      desc: 'Soạn đề, giải toán, tóm tắt dự giờ',
      icon: Bot,
      badge: 'Gemini',
      badgeColor: 'bg-linear-to-r from-blue-600 to-indigo-600',
    },
    {
      id: 'settings' as ActiveModule,
      label: '11. Cài đặt & Lưu trữ',
      desc: 'Sao lưu JSON, phân quyền, nhật ký',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed md:sticky top-16 left-0 z-40 print:hidden h-[calc(100vh-4rem)] w-64 lg:w-72 bg-slate-50 border-r border-slate-200 overflow-y-auto flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-3 border-b border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
            Phân hệ Quản lý Chuyên môn
          </div>
        </div>

        <nav className="p-2 space-y-1 flex-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;

            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onSelectModule(item.id);
                  onCloseMobile();
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'
                    }`}
                  />
                  <div className="truncate">
                    <div className="leading-snug truncate">{item.label}</div>
                    <div
                      className={`text-[10px] leading-tight truncate ${
                        isActive ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {item.desc}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold ml-2 shrink-0 ${
                      item.badgeColor || 'bg-slate-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info in sidebar */}
        <div className="p-3 border-t border-slate-200 text-[11px] text-slate-500 bg-slate-100/60">
          <div className="flex items-center justify-between">
            <span>Tiết chuẩn gợi ý (THPT):</span>
            <span className="font-semibold text-slate-700">{config.standardPeriods || 17} tiết/tuần</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span>Vai trò đang duyệt:</span>
            <span className="font-semibold text-blue-700">{activeMember.role.toUpperCase()}</span>
          </div>
        </div>
      </aside>
    </>
  );
};
