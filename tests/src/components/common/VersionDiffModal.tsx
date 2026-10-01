import React, { useMemo, useState } from 'react';
import { GitCompare, X, ChevronRight, Plus, Minus, PencilLine, Info } from 'lucide-react';
import type { PlanVersionRecord } from '../../types';
import { diffSnapshots, isDetailedSnapshot } from '../../utils/diff';

interface Props {
  title: string;
  history: PlanVersionRecord[];
  /** Ảnh chụp nội dung hiện tại (luôn có thể so sánh) */
  current: unknown;
  onClose: () => void;
}

interface Option {
  key: string;
  label: string;
  data: unknown;
}

export const VersionDiffModal: React.FC<Props> = ({ title, history, current, onClose }) => {
  const options: Option[] = useMemo(() => {
    const list: Option[] = history
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => isDetailedSnapshot(h.dataSnapshot))
      .map(({ h, i }) => ({
        key: `h${i}`,
        label: `v${h.version} – ${h.changeSummary || h.summary || h.status} (${new Date(h.updatedAt).toLocaleDateString('vi-VN')})`,
        data: h.dataSnapshot,
      }));
    list.push({ key: 'current', label: 'Nội dung hiện tại', data: current });
    return list;
  }, [history, current]);

  const [keyA, setKeyA] = useState(options.length > 1 ? options[options.length - 2].key : 'current');
  const [keyB, setKeyB] = useState('current');

  const a = options.find(o => o.key === keyA)?.data;
  const b = options.find(o => o.key === keyB)?.data;
  const entries = useMemo(() => diffSnapshots(a, b), [a, b]);
  const legacyCount = history.filter(h => !isDetailedSnapshot(h.dataSnapshot)).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-indigo-700">
            <GitCompare className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">So sánh phiên bản – {title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Đóng">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <label className="flex-1 font-semibold text-slate-700">
            Phiên bản gốc (A)
            <select value={keyA} onChange={e => setKeyA(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-normal">
              {options.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>
          <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block mt-4" />
          <label className="flex-1 font-semibold text-slate-700">
            Phiên bản đối chiếu (B)
            <select value={keyB} onChange={e => setKeyB(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-normal">
              {options.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        {legacyCount > 0 && (
          <div className="flex items-start gap-2 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{legacyCount} mốc lịch sử cũ chỉ lưu bản tóm tắt nên không so sánh chi tiết được. Từ nay mỗi lần trình/duyệt đều lưu ảnh chụp đầy đủ.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 text-xs">
          {keyA === keyB ? (
            <p className="text-slate-500 text-center py-6">Hãy chọn hai phiên bản khác nhau.</p>
          ) : entries.length === 0 ? (
            <p className="text-emerald-700 text-center py-6 font-semibold">Hai phiên bản giống hệt nhau về nội dung.</p>
          ) : (
            <>
              <p className="text-slate-600">
                Có <strong>{entries.length}</strong> điểm khác biệt:{' '}
                <span className="text-emerald-700">{entries.filter(e => e.kind === 'added').length} thêm</span>,{' '}
                <span className="text-rose-700">{entries.filter(e => e.kind === 'removed').length} bớt</span>,{' '}
                <span className="text-amber-700">{entries.filter(e => e.kind === 'changed').length} sửa</span>.
              </p>
              {entries.map(e => (
                <div
                  key={e.path + e.kind}
                  className={`p-3 rounded-lg border ${
                    e.kind === 'added' ? 'bg-emerald-50 border-emerald-200' : e.kind === 'removed' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50/60 border-amber-200'
                  }`}
                >
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    {e.kind === 'added' && <Plus className="w-3.5 h-3.5 text-emerald-600" />}
                    {e.kind === 'removed' && <Minus className="w-3.5 h-3.5 text-rose-600" />}
                    {e.kind === 'changed' && <PencilLine className="w-3.5 h-3.5 text-amber-600" />}
                    {e.label}
                  </div>
                  {e.before !== undefined && (
                    <div className="mt-1 text-rose-800 whitespace-pre-wrap break-words">
                      <span className="font-mono text-[10px] mr-1">A:</span>
                      <span className={e.kind === 'changed' ? 'line-through decoration-rose-400' : ''}>{e.before}</span>
                    </div>
                  )}
                  {e.after !== undefined && (
                    <div className="mt-1 text-emerald-800 whitespace-pre-wrap break-words">
                      <span className="font-mono text-[10px] mr-1">B:</span>
                      {e.after}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
