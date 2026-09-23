import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Eye, Pencil } from 'lucide-react';
import type { LessonPlan, LessonPlanActivity, SchoolClass } from '../../types';
import { MathText } from '../../utils/katex-renderer';
import { newId } from '../../utils/ids';

interface Props {
  plan: LessonPlan;
  classes: SchoolClass[];
  onCancel: () => void;
  onSave: (plan: LessonPlan) => Promise<boolean>;
}

/**
 * Soạn nội dung Kế hoạch bài dạy theo Phụ lục IV CV 5512.
 * Bản cũ cho tạo giáo án nhưng KHÔNG có chỗ nhập mục tiêu, thiết bị, nội dung 4 hoạt động.
 */
export const LessonPlanEditorModal: React.FC<Props> = ({ plan, classes, onCancel, onSave }) => {
  const [draft, setDraft] = useState<LessonPlan>(plan);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof LessonPlan>(key: K, value: LessonPlan[K]) => setDraft(d => ({ ...d, [key]: value }));
  const setAct = (id: string, patch: Partial<LessonPlanActivity>) =>
    setDraft(d => ({ ...d, activities: d.activities.map(a => (a.id === id ? { ...a, ...patch } : a)) }));

  const gradeClasses = classes.filter(c => c.grade === draft.grade);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.topicTitle.trim()) return setError('Cần nhập tên bài dạy và chủ đề.');
    if (draft.activities.some(a => !a.name.trim())) return setError('Mỗi hoạt động cần có tên.');
    setError('');
    setSaving(true);
    const ok = await onSave({ ...draft, title: draft.title.trim(), topicTitle: draft.topicTitle.trim() });
    setSaving(false);
    if (ok) onCancel();
  };

  const input = 'w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-normal';
  const area = `${input} resize-y font-mono`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSave} className="bg-white rounded-2xl max-w-5xl w-full p-5 shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <h3 className="text-base font-bold text-slate-900">Soạn kế hoạch bài dạy</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreview(p => !p)}
              className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg flex items-center gap-1 hover:bg-slate-50"
            >
              {preview ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {preview ? 'Soạn thảo' : 'Xem trước công thức'}
            </button>
            <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700" aria-label="Đóng">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Gõ công thức toán trong dấu <code className="bg-slate-100 px-1 rounded">$...$</code> (ví dụ <code className="bg-slate-100 px-1 rounded">{'$\\int_0^1 x^2\\,dx$'}</code>). Bấm "Xem trước" để kiểm tra hiển thị.
        </p>

        <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="font-semibold text-slate-700 sm:col-span-2">
              Tên bài dạy *
              <input value={draft.title} onChange={e => set('title', e.target.value)} className={`${input} mt-1`} required maxLength={200} />
            </label>
            <label className="font-semibold text-slate-700">
              Chủ đề / Chương *
              <input value={draft.topicTitle} onChange={e => set('topicTitle', e.target.value)} className={`${input} mt-1`} required />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="font-semibold text-slate-700">
                Khối
                <select value={draft.grade} onChange={e => set('grade', Number(e.target.value) as 10 | 11 | 12)} className={`${input} mt-1`}>
                  <option value={10}>10</option>
                  <option value={11}>11</option>
                  <option value={12}>12</option>
                </select>
              </label>
              <label className="font-semibold text-slate-700">
                Tuần
                <input type="number" min={1} max={52} value={draft.week} onChange={e => set('week', Math.max(1, Number(e.target.value)))} className={`${input} mt-1`} />
              </label>
              <label className="font-semibold text-slate-700">
                Số tiết
                <input type="number" min={1} max={20} value={draft.periodCount} onChange={e => set('periodCount', Math.max(1, Number(e.target.value)))} className={`${input} mt-1`} />
              </label>
            </div>
          </div>

          {gradeClasses.length > 0 && (
            <fieldset className="space-y-1">
              <legend className="font-semibold text-slate-700">Dạy cho các lớp</legend>
              <div className="flex flex-wrap gap-2">
                {gradeClasses.map(c => {
                  const checked = draft.classNames.includes(c.name);
                  return (
                    <label key={c.id} className={`px-2 py-1 rounded border cursor-pointer ${checked ? 'bg-blue-50 border-blue-300 text-blue-800' : 'border-slate-200'}`}>
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={checked}
                        onChange={() => set('classNames', checked ? draft.classNames.filter(n => n !== c.name) : [...draft.classNames, c.name])}
                      />
                      {c.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="space-y-2">
            <h4 className="font-bold text-blue-900 uppercase tracking-wide">I. Mục tiêu</h4>
            {([
              ['objectivesKnowledge', '1. Về kiến thức'],
              ['objectivesCompetence', '2. Về năng lực'],
              ['objectivesQualities', '3. Về phẩm chất'],
            ] as const).map(([key, label]) => (
              <label key={key} className="block font-semibold text-slate-700">
                {label}
                {preview ? (
                  <MathText content={draft[key] || '(trống)'} className="mt-1 p-2 bg-slate-50 rounded border border-slate-200 font-normal" />
                ) : (
                  <textarea rows={2} value={draft[key]} onChange={e => set(key, e.target.value)} className={`${area} mt-1`} />
                )}
              </label>
            ))}
          </div>

          <label className="block font-semibold text-slate-700">
            <span className="font-bold text-blue-900 uppercase tracking-wide">II. Thiết bị dạy học và học liệu</span>
            <textarea rows={2} value={draft.equipment} onChange={e => set('equipment', e.target.value)} className={`${input} mt-1 resize-y`} />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-blue-900 uppercase tracking-wide">III. Tiến trình dạy học</h4>
              <button
                type="button"
                onClick={() =>
                  set('activities', [
                    ...draft.activities,
                    { id: newId('activity'), name: `Hoạt động ${draft.activities.length + 1}`, objectives: '', content: '', product: '', implementation: '' },
                  ])
                }
                className="px-2.5 py-1 font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm hoạt động
              </button>
            </div>
            {draft.activities.map((act, idx) => (
              <div key={act.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <input value={act.name} onChange={e => setAct(act.id, { name: e.target.value })} className={`${input} font-bold`} aria-label={`Tên hoạt động ${idx + 1}`} />
                  {draft.activities.length > 1 && (
                    <button type="button" onClick={() => set('activities', draft.activities.filter(a => a.id !== act.id))} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" aria-label="Xóa hoạt động">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {([
                  ['objectives', 'a) Mục tiêu'],
                  ['content', 'b) Nội dung'],
                  ['product', 'c) Sản phẩm'],
                  ['implementation', 'd) Tổ chức thực hiện (Chuyển giao – Thực hiện – Báo cáo – Kết luận)'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block font-semibold text-slate-700">
                    {label}
                    {preview && key !== 'implementation' ? (
                      <MathText content={act[key] || '(trống)'} className="mt-1 p-2 bg-white rounded border border-slate-200 font-normal" />
                    ) : (
                      <textarea rows={key === 'implementation' ? 4 : 2} value={act[key]} onChange={e => setAct(act.id, { [key]: e.target.value })} className={`${area} mt-1`} />
                    )}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        {error && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">{error}</div>}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
          <button type="submit" disabled={saving} className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Đang lưu...' : 'Lưu giáo án'}
          </button>
        </div>
      </form>
    </div>
  );
};
