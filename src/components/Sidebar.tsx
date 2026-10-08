import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { safeUrl } from '../utils/ids';
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
  ExternalLink,
  Library,
  HardDrive,
  History,
  ClipboardList,
  Home,
  MoreHorizontal,
  ChevronDown,
  UserRound,
} from 'lucide-react';

export const MODULE_IDS = [
  'overview',
  'members',
  'operations',
  'plans',
  'lesson-plans',
  'lesson-study',
  'observations',
  'special-topics',
  'documents',
  'reports',
  'ai-assistant',
  'settings',
  'teacher-360',
  'audit-trail',
] as const;

export type ActiveModule = (typeof MODULE_IDS)[number];

/** Phân hệ quản trị, không hiện với giáo viên */
export const TEACHER_HIDDEN: readonly ActiveModule[] = ['settings', 'audit-trail'];
/** Mục chính của giáo viên (cũng là thanh nút trên điện thoại) */
const TEACHER_MAIN: { id: ActiveModule; label: string; short: string; desc: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Trang của tôi', short: 'Trang chủ', desc: 'Hôm nay cần làm gì', icon: Home },
  { id: 'operations', label: 'Việc của tôi', short: 'Việc', desc: 'Việc được giao, nộp minh chứng', icon: ClipboardList },
  { id: 'lesson-plans', label: 'Giáo án của tôi', short: 'Giáo án', desc: 'Soạn, nộp, xem nhận xét', icon: FileText },
  { id: 'observations', label: 'Dự giờ', short: 'Dự giờ', desc: 'Phiếu dự và phản hồi', icon: Eye },
  { id: 'lesson-study', label: 'Sinh hoạt chuyên môn', short: 'Họp tổ', desc: 'Biên bản, góp ý, nhiệm vụ', icon: Presentation },
  { id: 'reports', label: 'Báo cáo tháng', short: 'Báo cáo', desc: 'Đọc công văn, nộp báo cáo', icon: Printer },
];
const TEACHER_MORE: { id: ActiveModule; label: string; desc: string; icon: React.ElementType }[] = [
  { id: 'plans', label: 'Kế hoạch tổ & cá nhân', desc: 'Kế hoạch giáo dục của tôi', icon: CalendarDays },
  { id: 'members', label: 'Phân công chuyên môn', desc: 'Của tôi và cả tổ (chỉ xem)', icon: Users },
  { id: 'special-topics', label: 'Chuyên đề & Sáng kiến', desc: 'HSG, BDTX, GeoGebra & STEM', icon: Award },
  { id: 'documents', label: 'Tài liệu dùng chung', desc: 'Văn bản, mẫu biểu, bài giảng', icon: FolderOpen },
  { id: 'ai-assistant', label: 'Trợ lý AI Toán học', desc: 'Soạn đề, giải toán', icon: Bot },
  { id: 'teacher-360', label: 'Hồ sơ của tôi', desc: 'Minh chứng & định mức học kỳ', icon: UserRound },
];

const ROLE_TEXT: Record<string, string> = {
  admin: 'Quản trị', head: 'Tổ trưởng', deputy: 'Tổ phó', teacher: 'Giáo viên', principal: 'Ban giám hiệu',
};

/** Thanh nút cuối màn hình điện thoại cho giáo viên */
export const TeacherBottomNav: React.FC<{ activeModule: ActiveModule; onSelectModule: (m: ActiveModule) => void; onOpenMenu: () => void }> = ({ activeModule, onSelectModule, onOpenMenu }) => {
  const items = TEACHER_MAIN.filter(i => i.id !== 'observations' && i.id !== 'lesson-study');
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 grid grid-cols-5 print:hidden pb-[env(safe-area-inset-bottom)]" aria-label="Điều hướng nhanh">
      {items.map(i => {
        const Icon = i.icon;
        const on = activeModule === i.id;
        return (
          <button key={i.id} onClick={() => onSelectModule(i.id)} className={`py-2 flex flex-col items-center gap-0.5 text-[10px] font-semibold ${on ? 'text-blue-700' : 'text-slate-500'}`} aria-current={on ? 'page' : undefined}>
            <Icon className="w-5 h-5" />{i.short}
          </button>
        );
      })}
      <button onClick={onOpenMenu} className="py-2 flex flex-col items-center gap-0.5 text-[10px] font-semibold text-slate-500"><MoreHorizontal className="w-5 h-5" />Thêm</button>
    </nav>
  );
};

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
  const teacherView = !permissions.isLeader && activeMember.role !== 'principal';
  const [showMore, setShowMore] = useState(() => TEACHER_MORE.some(i => i.id === activeModule));

  // Badges: chỉ hiện số việc cần xử lý với người có quyền xử lý
  const pendingLessonPlans = permissions.isLeader ? lessonPlans.filter(p => p.status === 'submitted').length : 0;
  const pendingDeptPlans = permissions.canApproveDeptPlan ? departmentPlans.filter(p => p.status === 'submitted').length : 0;
  const pendingRequests = permissions.isLeader ? accessRequests.filter(r => r.status === 'pending').length : 0;

  // Công việc tổ đã chuyển sang công cụ ngoài. Địa chỉ do Tổ trưởng đặt trong Cài đặt → Liên kết ngoài.
  const externalItems = [
    {
      key: 'exams',
      label: 'Ngân hàng câu hỏi & Đề kiểm tra',
      desc: 'Thực hiện trên trang chuyên dụng',
      icon: Library,
      url: safeUrl(config.externalLinks?.examAndQuestionBankUrl),
    },
    {
      key: 'drive',
      label: 'Kho tài liệu của tổ',
      desc: 'Thư mục Google Drive',
      icon: HardDrive,
      url: safeUrl(config.externalLinks?.sharedDocumentsDriveUrl),
    },
  ];

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
      id: 'operations' as ActiveModule,
      label: '3. Điều hành công việc',
      desc: 'Giao việc, deadline, minh chứng, duyệt',
      icon: ClipboardList,
      badge: null,
    },
    {
      id: 'plans' as ActiveModule,
      label: '4. Kế hoạch của tổ & GV',
      desc: 'Phụ lục I, III CV 5512',
      icon: CalendarDays,
      badge: pendingDeptPlans > 0 ? `${pendingDeptPlans}` : null,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'lesson-plans' as ActiveModule,
      label: '5. Kế hoạch bài dạy',
      desc: 'Giáo án 4 hoạt động CV 5512',
      icon: FileText,
      badge: pendingLessonPlans > 0 ? `${pendingLessonPlans}` : null,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'lesson-study' as ActiveModule,
      label: '6. Sinh hoạt chuyên môn và Nghiên cứu bài học',
      desc: 'Chu trình 4 bước & biên bản họp',
      icon: Presentation,
      badge: null,
    },
    {
      id: 'observations' as ActiveModule,
      label: '7. Dự giờ & Rút KN',
      desc: 'Phiếu dự giờ tiêu chí 5512',
      icon: Eye,
      badge: null,
    },
    {
      id: 'special-topics' as ActiveModule,
      label: '8. Chuyên đề & Sáng kiến',
      desc: 'HSG, BDTX, GeoGebra & STEM',
      icon: Award,
      badge: null,
    },
    {
      id: 'documents' as ActiveModule,
      label: '9. Tài liệu dùng chung',
      desc: 'Văn bản, mẫu biểu, bài giảng',
      icon: FolderOpen,
      badge: null,
    },
    {
      id: 'reports' as ActiveModule,
      label: '10. Báo cáo & In',
      desc: 'Đọc công văn, báo cáo tháng, học kỳ',
      icon: Printer,
      badge: null,
    },
    {
      id: 'ai-assistant' as ActiveModule,
      label: '11. Trợ lý AI Toán học',
      desc: 'Soạn đề, giải toán, tóm tắt dự giờ',
      icon: Bot,
      badge: 'Gemini',
      badgeColor: 'bg-linear-to-r from-blue-600 to-indigo-600',
    },
    {
      id: 'settings' as ActiveModule,
      label: '12. Cài đặt & Lưu trữ',
      desc: 'Sao lưu JSON, phân quyền, nhật ký',
      icon: Settings,
      badge: null,
    },
    {
      id: 'teacher-360' as ActiveModule,
      label: '13. Hồ sơ 360° & KPI',
      desc: 'Minh chứng, tiến độ từng giáo viên',
      icon: Users,
      badge: null,
    },
    {
      id: 'audit-trail' as ActiveModule,
      label: '14. Lịch sử & Audit',
      desc: 'Phiên bản, dấu vết và deep-link',
      icon: History,
      badge: null,
    },
  ];

  const renderItem = (item: { id: ActiveModule; label: string; desc: string; icon: React.ElementType; badge: string | null; badgeColor?: string }) => {
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
  };

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
        {(config.schoolLeaders || []).some(l => l.name.trim()) && (
          <div className="p-3 border-b border-slate-200" data-testid="school-leaders">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">Ban giám hiệu</div>
            <ul className="mt-1 space-y-1.5 px-2">
              {(config.schoolLeaders || []).filter(l => l.name.trim()).map(l => (
                <li key={l.id} className="text-xs leading-tight">
                  <div className="font-semibold text-slate-800">{l.name}</div>
                  <div className="text-[10px] text-slate-500">{l.title}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="p-3 border-b border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
            {teacherView ? 'Công việc của tôi' : 'Phân hệ Quản lý Chuyên môn'}
          </div>
        </div>

        <nav className="p-2 space-y-1 flex-1">
          {teacherView ? (
            <>
              {TEACHER_MAIN.map(item => renderItem({ ...item, badge: null }))}
              <button
                type="button"
                onClick={() => setShowMore(v => !v)}
                className="w-full text-left px-3 py-2 mt-2 rounded-lg flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-200/70"
                aria-expanded={showMore}
              >
                Xem thêm <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
              </button>
              {showMore && TEACHER_MORE.map(item => renderItem({ ...item, badge: null }))}
            </>
          ) : navItems.map(item => {
            return renderItem(item);
          })}

          {/* Liên kết ngoài: mở trang khác ở tab mới, không đồng bộ dữ liệu */}
          {(!teacherView || externalItems.some(i => i.url)) && (
          <div className="pt-3 mt-2 border-t border-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
              Liên kết ngoài
            </div>
            <div className="space-y-1 mt-1">
              {externalItems.map(item => {
                const Icon = item.icon;
                const common = 'w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between text-xs font-medium transition-all group';

                if (!item.url) {
                  if (teacherView) return null;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        onSelectModule('settings');
                        onCloseMobile();
                      }}
                      title="Chưa cấu hình địa chỉ. Bấm để mở Cài đặt → Liên kết ngoài."
                      className={`${common} text-slate-400 hover:bg-slate-200/70`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="truncate">
                          <div className="leading-snug truncate">{item.label}</div>
                          <div className="text-[10px] leading-tight truncate italic">Chưa cấu hình địa chỉ</div>
                        </div>
                      </div>
                    </button>
                  );
                }

                return (
                  <a
                    key={item.key}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onCloseMobile}
                    className={`${common} text-slate-700 hover:bg-slate-200/70 hover:text-slate-900`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-blue-600" />
                      <div className="truncate">
                        <div className="leading-snug truncate">{item.label}</div>
                        <div className="text-[10px] leading-tight truncate text-slate-400">{item.desc}</div>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-400 ml-2" />
                  </a>
                );
              })}
            </div>
          </div>
          )}
        </nav>

        {/* Footer info in sidebar */}
        <div className="p-3 border-t border-slate-200 text-[11px] text-slate-500 bg-slate-100/60">
          <div className="flex items-center justify-between">
            <span>Tiết chuẩn gợi ý (THPT):</span>
            <span className="font-semibold text-slate-700">{config.standardPeriods || 17} tiết/tuần</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span>Vai trò đang duyệt:</span>
            <span className="font-semibold text-blue-700">{ROLE_TEXT[activeMember.role] || activeMember.role}{activeMember.isSecretary && activeMember.role !== 'principal' ? ' · Thư ký' : ''}</span>
          </div>
        </div>
      </aside>
    </>
  );
};
