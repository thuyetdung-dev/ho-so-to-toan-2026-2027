import React, { useState } from 'react';
import { HardDrive, Loader2, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatBytes } from '../../services/lessonPlanStore';
import { useConfirm } from './ConfirmDialog';

/** Gói miễn phí Firestore (Spark): 1 GiB dữ liệu lưu trữ */
const FREE_QUOTA = 1024 * 1024 * 1024;

/** Đồng hồ dung lượng + công cụ chuyển giáo án kiểu cũ sang cách lưu mới (bản 2.4) */
export const StoragePanel: React.FC = () => {
  const { storageEstimate, legacyLessonPlanCount, migrateLessonPlanStorage, permissions, isDemoMode } = useApp();
  const confirm = useConfirm();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ done: number; failed: number } | null>(null);

  const pct = Math.min(100, (storageEstimate.total / FREE_QUOTA) * 100);
  const bar = pct > 80 ? 'bg-rose-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500';
  const parts = [
    { label: 'Giáo án (chữ, công thức)', value: storageEstimate.lessonPlans, color: 'bg-blue-500' },
    { label: 'Hình trong giáo án', value: storageEstimate.images, color: 'bg-violet-500' },
    { label: 'Lịch sử phiên bản', value: storageEstimate.versions, color: 'bg-amber-500' },
    { label: 'Hồ sơ khác', value: storageEstimate.other, color: 'bg-slate-400' },
  ];
  const sum = parts.reduce((a, p) => a + p.value, 0) || 1;
  const perPlan = storageEstimate.planCount ? (storageEstimate.lessonPlans + storageEstimate.images + storageEstimate.versions) / storageEstimate.planCount : 0;
  const yearsLeft = perPlan > 0 ? (FREE_QUOTA - storageEstimate.total) / (perPlan * 400) : Infinity;

  const runMigration = async () => {
    const ok = await confirm({
      title: 'Chuyển giáo án sang cách lưu mới?',
      message: `${legacyLessonPlanCount} giáo án sẽ được tách phần nội dung, hình và lịch sử phiên bản ra lưu riêng. Nội dung giáo án không thay đổi. Nên tải tệp sao lưu JSON trước khi chuyển. Không đóng trang trong lúc chuyển.`,
      confirmText: 'Bắt đầu chuyển',
    });
    if (!ok) return;
    setResult(null);
    setProgress({ done: 0, total: legacyLessonPlanCount });
    const r = await migrateLessonPlanStorage((done, total) => setProgress({ done, total }));
    setProgress(null);
    setResult(r);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4" data-testid="storage-panel">
      <div>
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-600" />
          <span>Dung lượng lưu trữ</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Ước tính theo dữ liệu hiện có{isDemoMode ? ' (đang xem dữ liệu mẫu)' : ''}. Gói miễn phí của Firebase cho 1 GB.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="font-semibold text-slate-800">
            Đã dùng khoảng {formatBytes(storageEstimate.total)} / 1 GB
          </span>
          <span className="text-slate-500">{pct < 0.1 ? '< 0,1' : pct.toFixed(1).replace('.', ',')}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${bar}`} style={{ width: `${Math.max(pct, 0.5)}%` }} />
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden mt-2">
          {parts.map(p => (
            <div key={p.label} className={p.color} style={{ width: `${(p.value / sum) * 100}%` }} title={`${p.label}: ${formatBytes(p.value)}`} />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {parts.map(p => (
            <div key={p.label} className="text-[11px] text-slate-600 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${p.color}`} />
              <span>
                {p.label}: <strong>{formatBytes(p.value)}</strong>
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 pt-1">
          {storageEstimate.planCount} giáo án{perPlan > 0 && `, trung bình ${formatBytes(perPlan)}/giáo án`}
          {Number.isFinite(yearsLeft) && yearsLeft > 0 && ` – với khoảng 400 giáo án/năm, còn đủ cho khoảng ${yearsLeft >= 20 ? 'hơn 20' : Math.floor(yearsLeft)} năm học.`}
        </p>
      </div>

      {!isDemoMode && legacyLessonPlanCount > 0 && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900 space-y-2">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Có <strong>{legacyLessonPlanCount}</strong> giáo án còn lưu theo cách cũ (cả nội dung và hình trong một bản ghi) – mỗi lần mở phần mềm, máy của mọi
              giáo viên đều phải tải các giáo án này. Chuyển sang cách lưu mới để phần mềm mở nhanh và tiết kiệm dung lượng.
            </span>
          </div>
          {permissions.isAdminOrHead ? (
            <button
              type="button"
              onClick={runMigration}
              disabled={!!progress}
              className="px-3 py-1.5 font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-60"
            >
              {progress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {progress ? `Đang chuyển ${progress.done}/${progress.total}...` : 'Tối ưu lưu trữ giáo án'}
            </button>
          ) : (
            <p className="italic">Tổ trưởng hoặc Quản trị viên thực hiện việc chuyển này.</p>
          )}
        </div>
      )}
      {result && (
        <div className={`p-2.5 rounded-lg border text-xs flex gap-2 ${result.failed ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Đã chuyển {result.done} giáo án{result.failed ? `; ${result.failed} giáo án lỗi – bấm lại để thử lần nữa` : ''}.
        </div>
      )}
    </div>
  );
};
