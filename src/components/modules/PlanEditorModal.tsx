import React, { useState } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Save } from 'lucide-react';
import type { DepartmentPlan, PlanDistributionItem } from '../../types';
import { newId } from '../../utils/ids';

interface Props {
  initial: DepartmentPlan;
  isNew: boolean;
  weeksCount: number;
  onCancel: () => void;
  onSave: (plan: DepartmentPlan) => Promise<boolean>;
}

type Evaluation = DepartmentPlan['periodicEvaluations'][number];

const emptyItem = (order: number, week: number): PlanDistributionItem => ({
  id: newId('dist'),
  order,
  week,
  topicTitle: '',
  periods: 1,
  objectives: '',
  equipment: '',
  status: 'planned',
});

/** Soạn/sửa Kế hoạch dạy học của tổ (Phụ lục I CV 5512). Bản cũ không có chức năng này. */
export const PlanEditorModal: React.FC<Props> = ({ initial, isNew, weeksCount, onCancel, onSave }) => {
  const [title, setTitle] = useState(initial.title);
  const [generalSituation, setGeneralSituation] = useState(initial.generalSituation);
  const [items, setItems] = useState<PlanDistributionItem[]>(initial.distribution.length ? initial.distribution : [emptyItem(1, 1)]);
  const [evals, setEvals] = useState<Evaluation[]>(initial.periodicEvaluations || []);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateItem = (id: string, patch: Partial<PlanDistributionItem>) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));

  const move = (index: number, dir: -1 | 1) =>
    setItems(prev => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[j]] = [copy[j], copy[index]];
      return copy.map((it, i) => ({ ...it, order: i + 1 }));
    });

  const totalPeriods = items.reduce((s, i) => s + (Number(i.periods) || 0), 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = items.filter(i => i.topicTitle.trim());
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề kế hoạch.');
    if (cleaned.length === 0) return setError('Cần ít nhất một bài học trong phân phối chương trình.');
    const badWeek = cleaned.find(i => i.week < 1 || i.week > weeksCount);
    if (badWeek) return setError(`Bài "${badWeek.topicTitle}" có tuần ngoài khoảng 1–${weeksCount}.`);
    const badPeriods = cleaned.find(i => !(Number(i.periods) > 0));
    if (badPeriods) return setError(`Bài "${badPeriods.topicTitle}" phải có số tiết lớn hơn 0.`);
    setError('');
    setSaving(true);
    const ok = await onSave({
      ...initial,
      title: title.trim(),
      generalSituation: generalSituation.trim(),
      distribution: cleaned.map((it, i) => ({ ...it, order: i + 1, topicTitle: it.topicTitle.trim(), periods: Number(it.periods) })),
      periodicEvaluations: evals.filter(ev => ev.name.trim()),
      reasonForAdjustment: reason.trim() || initial.reasonForAdjustment,
    });
    setSaving(false);
    if (ok) onCancel();
  };

  const input = 'w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSave} className="bg-white rounded-2xl max-w-6xl w-full p-5 shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            {isNew ? `Tạo kế hoạch dạy học Khối ${initial.grade}` : `Chỉnh sửa kế hoạch – Khối ${initial.grade}`}
          </h3>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
          <label className="block font-semibold text-slate-700">
            Tiêu đề kế hoạch *
            <input value={title} onChange={e => setTitle(e.target.value)} className={`${input} mt-1 font-normal`} required maxLength={200} />
          </label>
          <label className="block font-semibold text-slate-700">
            I. Đặc điểm tình hình, cơ sở vật chất
            <textarea value={generalSituation} onChange={e => setGeneralSituation(e.target.value)} rows={3} className={`${input} mt-1 font-normal resize-y`} />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                II. Phân phối chương trình ({items.length} bài • {totalPeriods} tiết)
              </span>
              <button
                type="button"
                onClick={() => setItems(prev => [...prev, emptyItem(prev.length + 1, prev[prev.length - 1]?.week || 1)])}
                className="px-2.5 py-1 font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm bài
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full min-w-[860px] text-left">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-2 w-10">STT</th>
                    <th className="p-2 w-16">Tuần</th>
                    <th className="p-2 w-56">Bài học / Chủ đề</th>
                    <th className="p-2 w-16">Số tiết</th>
                    <th className="p-2">Yêu cầu cần đạt</th>
                    <th className="p-2 w-40">Thiết bị</th>
                    <th className="p-2 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => (
                    <tr key={it.id} className="align-top">
                      <td className="p-2 text-center font-semibold">{idx + 1}</td>
                      <td className="p-2">
                        <input type="number" min={1} max={weeksCount} value={it.week} onChange={e => updateItem(it.id, { week: Number(e.target.value) })} className={input} aria-label="Tuần" />
                      </td>
                      <td className="p-2">
                        <input value={it.topicTitle} onChange={e => updateItem(it.id, { topicTitle: e.target.value })} className={input} placeholder="Tên bài/chủ đề" aria-label="Bài học" />
                      </td>
                      <td className="p-2">
                        <input type="number" min={1} max={40} value={it.periods} onChange={e => updateItem(it.id, { periods: Number(e.target.value) })} className={input} aria-label="Số tiết" />
                      </td>
                      <td className="p-2">
                        <textarea rows={2} value={it.objectives} onChange={e => updateItem(it.id, { objectives: e.target.value })} className={`${input} resize-y`} aria-label="Yêu cầu cần đạt" />
                      </td>
                      <td className="p-2">
                        <input value={it.equipment || ''} onChange={e => updateItem(it.id, { equipment: e.target.value })} className={input} aria-label="Thiết bị" />
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => move(idx, -1)} className="p-1 text-slate-500 hover:bg-slate-100 rounded" aria-label="Lên"><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => move(idx, 1)} className="p-1 text-slate-500 hover:bg-slate-100 rounded" aria-label="Xuống"><ArrowDown className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => setItems(prev => prev.filter(x => x.id !== it.id))} className="p-1 text-rose-500 hover:bg-rose-50 rounded" aria-label="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">III. Kiểm tra, đánh giá định kỳ</span>
              <button
                type="button"
                onClick={() => setEvals(prev => [...prev, { name: '', duration: 90, week: 9, format: '12 TN + 4 Đúng/Sai + 6 Trả lời ngắn' }])}
                className="px-2.5 py-1 font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm bài kiểm tra
              </button>
            </div>
            {evals.map((ev, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] gap-2 items-center">
                <input value={ev.name} onChange={e => setEvals(p => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} placeholder="Tên (VD: Giữa kỳ I)" aria-label="Tên bài kiểm tra" />
                <input type="number" min={15} max={180} value={ev.duration} onChange={e => setEvals(p => p.map((x, j) => (j === i ? { ...x, duration: Number(e.target.value) } : x)))} className={input} aria-label="Thời gian (phút)" />
                <input type="number" min={1} max={weeksCount} value={ev.week} onChange={e => setEvals(p => p.map((x, j) => (j === i ? { ...x, week: Number(e.target.value) } : x)))} className={input} aria-label="Tuần" />
                <input value={ev.format} onChange={e => setEvals(p => p.map((x, j) => (j === i ? { ...x, format: e.target.value } : x)))} className={input} aria-label="Hình thức" />
                <button type="button" onClick={() => setEvals(p => p.filter((_, j) => j !== i))} className="p-1 text-rose-500 hover:bg-rose-50 rounded" aria-label="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>

          {!isNew && (
            <label className="block font-semibold text-slate-700">
              Lý do điều chỉnh (ghi vào hồ sơ)
              <input value={reason} onChange={e => setReason(e.target.value)} className={`${input} mt-1 font-normal`} placeholder="VD: Điều chỉnh theo góp ý của BGH ngày..." />
            </label>
          )}
        </div>

        {error && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">{error}</div>}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
          <button type="submit" disabled={saving} className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Đang lưu...' : 'Lưu kế hoạch (bản nháp)'}
          </button>
        </div>
      </form>
    </div>
  );
};
