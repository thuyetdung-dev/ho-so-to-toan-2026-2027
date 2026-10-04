import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, ListChecks, X } from 'lucide-react';
import { formatDate, weekdayOf } from '../../report/schedule';
import { signature } from '../../report/tasks';
import type { Period, Task } from '../../report/types';

export type PickItem = { task: Task; checked: boolean; reason?: string };

function dateLabel(t: Task) {
  if (!t.date) return t.time || 'Chưa có ngày';
  const d = `${weekdayOf(t.date)}, ${formatDate(t.date).slice(0, 5)}`;
  return t.auto ? `${d} · tự xếp` : d;
}

/**
 * Sau khi đọc công văn, giáo viên tích những đầu việc mình thật sự làm trong tháng.
 * Câu bị bộ lọc loại vẫn hiện (thu gọn) để chọn lại nếu cần.
 */
export const DocumentTaskPicker: React.FC<{
  period: Period;
  items: PickItem[];
  annualFiles: string[];
  /** Tên đầu việc đã có trong tháng (để đánh dấu trùng) */
  existingTitles: string[];
  busy?: boolean;
  onConfirm: (tasks: Task[]) => void;
  onCancel: () => void;
}> = ({ period, items, annualFiles, existingTitles, busy, onConfirm, onCancel }) => {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map(x => [x.task.id, x.checked])),
  );
  const [showRemoved, setShowRemoved] = useState(false);
  const existing = useMemo(() => new Set(existingTitles.map(signature)), [existingTitles]);
  const kept = items.filter(x => !x.reason);
  const removed = items.filter(x => x.reason);
  const chosen = items.filter(x => checked[x.task.id]).map(x => x.task);
  const setAll = (list: PickItem[], v: boolean) =>
    setChecked(c => ({ ...c, ...Object.fromEntries(list.map(x => [x.task.id, v])) }));
  const onlyDated = () =>
    setChecked(c => ({ ...c, ...Object.fromEntries(kept.map(x => [x.task.id, Boolean(x.task.date && !x.task.auto)])) }));

  const row = (x: PickItem) => {
    const dup = existing.has(signature(x.task.work));
    const on = !!checked[x.task.id];
    return (
      <label key={x.task.id} className={`flex gap-3 items-start px-3 py-2.5 border-b last:border-b-0 cursor-pointer ${on ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}>
        <input type="checkbox" className="mt-1 w-4 h-4 accent-blue-600 shrink-0" checked={on}
          onChange={e => setChecked(c => ({ ...c, [x.task.id]: e.target.checked }))} />
        <span className="min-w-0 flex-1 flex flex-col sm:flex-row gap-0.5 sm:gap-3">
        <span className={`sm:w-36 shrink-0 text-[11px] font-semibold ${x.task.auto ? 'text-amber-700' : 'text-slate-700'}`}>{dateLabel(x.task)}</span>
        <span className="min-w-0 flex-1 text-xs text-slate-800 leading-relaxed">
          {x.task.work}
          <span className="block text-[10px] text-slate-500 mt-0.5">
            {x.task.target || 'Cấp trường'}
            {x.reason ? ` · Đã loại: ${x.reason}` : ''}
            {dup ? ' · Đã có trong tháng' : ''}
          </span>
        </span>
        </span>
      </label>
    );
  };

  return (
    <section className="border border-blue-200 rounded-xl bg-white overflow-hidden" aria-label="Chọn đầu việc">
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        <div className="text-sm font-bold text-blue-900 flex items-center gap-2"><ListChecks className="w-4 h-4" />Chọn đầu việc của tháng {period.month}/{period.year}</div>
        <div className="text-[11px] text-blue-800 mt-0.5">Đã chọn {chosen.length}/{items.length}. Chỉ những dòng được tích mới trở thành công việc của thầy/cô.</div>
      </div>

      {annualFiles.length > 0 && (
        <div className="m-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <div><b>{annualFiles.join(', ')}</b> là văn bản định hướng <b>cả năm học</b>. Các câu trong đó là yêu cầu chung nên chưa được tích sẵn; thầy/cô chỉ tích việc mình thực sự làm trong tháng {period.month}.</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 px-3 pt-3">
        <button type="button" onClick={() => setAll(kept, true)} className="px-2.5 py-1.5 text-[11px] font-semibold border rounded-lg hover:bg-slate-50">Chọn tất cả ({kept.length})</button>
        <button type="button" onClick={() => setAll(items, false)} className="px-2.5 py-1.5 text-[11px] font-semibold border rounded-lg hover:bg-slate-50">Bỏ chọn tất cả</button>
        <button type="button" onClick={onlyDated} className="px-2.5 py-1.5 text-[11px] font-semibold border rounded-lg hover:bg-slate-50" title="Chỉ giữ việc có ngày ghi rõ trong văn bản">Chỉ chọn việc có ngày cụ thể</button>
      </div>

      <div className="m-3 border rounded-lg max-h-[28rem] overflow-y-auto">
        {kept.length ? kept.map(row) : <div className="p-6 text-center text-xs text-slate-500">Không có đầu việc phù hợp.</div>}
      </div>

      {removed.length > 0 && (
        <div className="px-3 pb-2">
          <button type="button" onClick={() => setShowRemoved(v => !v)} className="text-[11px] font-semibold text-slate-600 hover:text-blue-700 flex items-center gap-1">
            {showRemoved ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {removed.length} câu đã tự loại (tiểu học/THCS, môn khác, việc của Sở, câu bị cắt)
          </button>
          {showRemoved && <div className="mt-2 border rounded-lg max-h-72 overflow-y-auto opacity-80">{removed.map(row)}</div>}
        </div>
      )}

      <div className="flex justify-end gap-2 px-3 py-3 border-t bg-slate-50">
        <button type="button" onClick={onCancel} disabled={busy} className="px-3 py-2 text-xs font-semibold border rounded-lg bg-white flex items-center gap-1 disabled:opacity-50"><X className="w-3.5 h-3.5" />Hủy</button>
        <button type="button" disabled={!chosen.length || busy} onClick={() => onConfirm(chosen)} className="px-3 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50">
          <Check className="w-3.5 h-3.5" />{busy ? 'Đang lưu...' : `Thêm ${chosen.length} đầu việc`}
        </button>
      </div>
    </section>
  );
};
