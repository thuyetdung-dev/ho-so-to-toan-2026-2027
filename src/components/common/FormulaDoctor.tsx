import React, { useMemo, useState } from 'react';
import { Stethoscope, X, Wand2, Check, SkipForward, Pencil, Bot, Loader2, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
import type { LessonPlan } from '../../types';
import { MathText } from '../../utils/katex-renderer';
import { FormulaIssue, applyIssue, latexError, scanText } from '../../utils/latexDoctor';
import { useApp } from '../../context/AppContext';
import { askAI as askGemini } from '../../services/gemini';

type FieldRef =
  | { kind: 'plan'; key: 'objectivesKnowledge' | 'objectivesCompetence' | 'objectivesQualities' | 'equipment'; label: string }
  | { kind: 'act'; actId: string; key: 'objectives' | 'content' | 'product' | 'implementation'; label: string };

interface Found {
  id: string;
  field: FieldRef;
  issue: FormulaIssue;
}

export function planFields(plan: LessonPlan): FieldRef[] {
  const fields: FieldRef[] = [
    { kind: 'plan', key: 'objectivesKnowledge', label: 'Mục tiêu › Kiến thức' },
    { kind: 'plan', key: 'objectivesCompetence', label: 'Mục tiêu › Năng lực' },
    { kind: 'plan', key: 'objectivesQualities', label: 'Mục tiêu › Phẩm chất' },
    { kind: 'plan', key: 'equipment', label: 'Thiết bị dạy học' },
  ];
  (plan.activities || []).forEach(a => {
    ([
      ['objectives', 'Mục tiêu'],
      ['content', 'Nội dung'],
      ['product', 'Sản phẩm'],
      ['implementation', 'Tổ chức thực hiện'],
    ] as const).forEach(([key, l]) => fields.push({ kind: 'act', actId: a.id, key, label: `${a.name} › ${l}` }));
  });
  return fields;
}

const getText = (p: LessonPlan, f: FieldRef) =>
  f.kind === 'plan' ? p[f.key] || '' : p.activities.find(a => a.id === f.actId)?.[f.key] || '';
const setText = (p: LessonPlan, f: FieldRef, v: string): LessonPlan =>
  f.kind === 'plan' ? { ...p, [f.key]: v } : { ...p, activities: p.activities.map(a => (a.id === f.actId ? { ...a, [f.key]: v } : a)) };

/** Đếm nhanh số công thức lỗi trong giáo án (không tính gợi ý) */
export function countFormulaErrors(plan: LessonPlan): number {
  return planFields(plan).reduce((n, f) => n + scanText(getText(plan, f), false).length, 0);
}

/** Đếm lỗi và gợi ý (chỉ số mũ/chỉ số dưới bị mất...) */
export function countFormulaIssues(plan: LessonPlan): { errors: number; suggestions: number } {
  let errors = 0;
  let suggestions = 0;
  planFields(plan).forEach(f =>
    scanText(getText(plan, f), true).forEach(i => (i.kind === 'suggestion' ? suggestions++ : errors++)),
  );
  return { errors, suggestions };
}

interface Props {
  plan: LessonPlan;
  onClose: () => void;
  /** Lưu giáo án đã sửa. Trả về true nếu lưu thành công. */
  onApply: (plan: LessonPlan) => Promise<boolean> | boolean;
  applyLabel?: string;
}

/**
 * "Sửa lỗi công thức": quét toàn bộ giáo án, liệt kê công thức lỗi và cách sửa,
 * cho phép sửa tất cả bằng một nút, sửa từng cái, sửa tay có xem trước, hoặc nhờ AI.
 */
export const FormulaDoctor: React.FC<Props> = ({ plan, onClose, onApply, applyLabel = 'Lưu các sửa đổi' }) => {
  const { currentUser } = useApp();
  const [work, setWork] = useState<LessonPlan>(plan);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState('');
  const [fixedCount, setFixedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const found: Found[] = useMemo(() => {
    const list: Found[] = [];
    planFields(work).forEach(f => {
      const text = getText(work, f);
      scanText(text, true).forEach((issue, i) => {
        const id = `${f.kind}:${f.kind === 'act' ? f.actId : ''}:${f.key}:${issue.raw}:${i}`;
        list.push({ id, field: f, issue });
      });
    });
    return list;
  }, [work]);

  const visible = found.filter(x => !skipped.has(skipKey(x)) && (showSuggestions || x.issue.kind !== 'suggestion'));
  const errors = found.filter(x => x.issue.kind !== 'suggestion' && !skipped.has(skipKey(x)));
  const suggestions = found.filter(x => x.issue.kind === 'suggestion' && !skipped.has(skipKey(x)));

  function skipKey(x: Found) {
    return `${x.field.kind}:${x.field.kind === 'act' ? x.field.actId : ''}:${x.field.key}:${x.issue.raw}`;
  }

  const latexFor = (x: Found) => overrides[x.id] ?? x.issue.fixedLatex;

  const applyOne = (x: Found, latex?: string | null) => {
    const l = latex ?? latexFor(x);
    if (l === null || l === undefined) return;
    setWork(w => setText(w, x.field, applyIssue(getText(w, x.field), x.issue, l)));
    setFixedCount(n => n + 1);
    setEditing(null);
  };

  /** Áp dụng nhiều sửa: theo từng ô, từ cuối về đầu để vị trí không lệch */
  const applyMany = (items: Found[]) => {
    let w = work;
    let n = 0;
    const byField = new Map<string, Found[]>();
    items.forEach(x => {
      const k = `${x.field.kind}:${x.field.kind === 'act' ? x.field.actId : ''}:${x.field.key}`;
      byField.set(k, [...(byField.get(k) || []), x]);
    });
    byField.forEach(list => {
      const f = list[0].field;
      let text = getText(w, f);
      [...list]
        .sort((a, b) => b.issue.start - a.issue.start)
        .forEach(x => {
          const l = latexFor(x);
          if (l === null || l === undefined) return;
          text = applyIssue(text, x.issue, l);
          n++;
        });
      w = setText(w, f, text);
    });
    setWork(w);
    setFixedCount(c => c + n);
  };

  const askAI = async (x: Found) => {
    setAiBusy(x.id);
    setAiError('');
    try {
      const text = getText(work, x.field);
      const context = text.slice(Math.max(0, x.issue.start - 150), Math.min(text.length, x.issue.end + 150)).replace(x.issue.raw, '[CÔNG THỨC]');
      const data = await askGemini(
        { task: 'latex', prompt: `Công thức lỗi:\n${x.issue.latex}\n\nCâu văn xung quanh:\n${context}` },
        currentUser ? () => currentUser.getIdToken() : undefined,
      );
      const latex = String(data.text || '')
        .replace(/^```(?:latex)?\s*|\s*```$/g, '')
        .replace(/^\$+|\$+$/g, '')
        .replace(/^\\\(|\\\)$/g, '')
        .trim();
      if (!latex || latexError(latex, x.issue.open === '$$')) throw new Error('AI trả về công thức vẫn còn lỗi. Hãy thử sửa tay.');
      setOverrides(o => ({ ...o, [x.id]: latex }));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiBusy(null);
    }
  };

  const save = async () => {
    setSaving(true);
    const ok = await onApply(work);
    setSaving(false);
    if (ok) onClose();
  };

  const editErr = editing ? latexError(editText) : null;
  const changed = fixedCount > 0;

  return (
    <div className="fixed inset-0 z-[65] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col gap-3 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-rose-600" /> Kiểm tra & sửa lỗi công thức
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-1 rounded-lg font-semibold ${errors.length ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
            {errors.length ? `${errors.length} công thức lỗi` : 'Không còn công thức lỗi'}
          </span>
          <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold">{suggestions.length} gợi ý nghi sai</span>
          {fixedCount > 0 && <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-800 font-semibold">Đã sửa {fixedCount} chỗ (chưa lưu)</span>}
          <label className="flex items-center gap-1 text-slate-600 ml-auto">
            <input type="checkbox" checked={showSuggestions} onChange={e => setShowSuggestions(e.target.checked)} /> Hiện gợi ý
          </label>
          <button
            disabled={!errors.some(x => latexFor(x) !== null)}
            onClick={() => applyMany(errors.filter(x => latexFor(x) !== null))}
            className="px-3 py-1.5 font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-1 disabled:opacity-40"
          >
            <Wand2 className="w-3.5 h-3.5" /> Tự sửa tất cả lỗi
          </button>
          <button
            disabled={!suggestions.length}
            onClick={() => applyMany(suggestions)}
            className="px-3 py-1.5 font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-40"
          >
            <Lightbulb className="w-3.5 h-3.5" /> Áp dụng mọi gợi ý
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          Phần mềm kiểm tra từng công thức; công thức lỗi được thử sửa tự động (cân bằng ngoặc, bỏ lệnh thừa...). "Gợi ý" là chỗ công thức vẫn hiển thị nhưng nghi bị mất số mũ/chỉ số khi chép từ Word
          (vd <i>S0</i> → <i>S₀</i>, <i>x2</i> → <i>x²</i>) – thầy cô xem hình "Sau khi sửa" rồi bấm Áp dụng hoặc Bỏ qua.
        </p>
        {aiError && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{aiError}</div>}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {visible.length === 0 && (
            <div className="p-8 text-center text-emerald-700 font-semibold flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8" /> Tất cả công thức trong giáo án đã hiển thị đúng.
            </div>
          )}
          {visible.map(x => {
            const latex = latexFor(x);
            const isErr = x.issue.kind !== 'suggestion';
            return (
              <div key={x.id} className={`p-3 rounded-xl border ${isErr ? 'border-rose-200 bg-rose-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    {isErr ? <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> : <Lightbulb className="w-3.5 h-3.5 text-amber-600" />}
                    {x.field.label}
                  </div>
                  <span className={isErr ? 'text-rose-700' : 'text-amber-800'}>{x.issue.message}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <div>
                    <div className="text-[10px] text-slate-500 mb-0.5">Trước (mã gốc)</div>
                    <code className="block p-2 bg-white border border-slate-200 rounded font-mono text-[11px] break-all text-rose-800">{x.issue.raw}</code>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 mb-0.5">Sau khi sửa</div>
                    <div className="p-2 bg-white border border-emerald-200 rounded min-h-[2.2rem]">
                      {x.issue.kind === 'delimiter' ? (
                        <span className="text-slate-500 italic">(bỏ dấu $ thừa)</span>
                      ) : latex !== null && latex !== undefined ? (
                        <MathText content={`${x.issue.open}${latex}${x.issue.close}`} />
                      ) : (
                        <span className="text-slate-500 italic">Chưa tự sửa được – hãy sửa tay hoặc nhờ AI</span>
                      )}
                    </div>
                  </div>
                </div>
                {x.issue.steps.length > 0 && latex === x.issue.fixedLatex && (
                  <div className="text-[10px] text-slate-500 mt-1">Đã làm: {x.issue.steps.join(' • ')}</div>
                )}
                {overrides[x.id] && <div className="text-[10px] text-purple-700 mt-1">Bản sửa do AI đề xuất – kiểm tra kỹ trước khi áp dụng.</div>}

                {editing === x.id ? (
                  <div className="mt-2 space-y-1">
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-[11px]" aria-label="Sửa công thức" />
                    <div className="p-2 bg-white border border-slate-200 rounded">
                      {editErr ? <span className="text-rose-700">Còn lỗi: {editErr}</span> : <MathText content={`${x.issue.open || '$'}${editText}${x.issue.close || '$'}`} />}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditing(null)} className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded">Hủy</button>
                      <button disabled={!!editErr} onClick={() => applyOne(x, editText)} className="px-2.5 py-1 font-semibold bg-blue-600 text-white rounded disabled:opacity-40">
                        Dùng bản sửa tay
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 justify-end mt-2">
                    <button onClick={() => setSkipped(s => new Set(s).add(skipKey(x)))} className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded flex items-center gap-1">
                      <SkipForward className="w-3.5 h-3.5" /> Bỏ qua
                    </button>
                    {x.issue.kind !== 'delimiter' && (
                      <button
                        onClick={() => {
                          setEditing(x.id);
                          setEditText(latex ?? x.issue.latex);
                        }}
                        className="px-2.5 py-1 text-blue-700 border border-blue-200 hover:bg-blue-50 rounded flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Sửa tay
                      </button>
                    )}
                    {x.issue.kind === 'error' && (
                      <button
                        disabled={aiBusy === x.id}
                        onClick={() => askAI(x)}
                        className="px-2.5 py-1 text-purple-700 border border-purple-200 hover:bg-purple-50 rounded flex items-center gap-1 disabled:opacity-50"
                        title="Nhờ Trợ lý AI sửa công thức theo ngữ cảnh"
                      >
                        {aiBusy === x.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />} Nhờ AI sửa
                      </button>
                    )}
                    <button
                      disabled={latex === null || latex === undefined}
                      onClick={() => applyOne(x)}
                      className="px-2.5 py-1 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1 disabled:opacity-40"
                    >
                      <Check className="w-3.5 h-3.5" /> Áp dụng
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Đóng</button>
          <button disabled={!changed || saving} onClick={save} className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40">
            {saving ? 'Đang lưu...' : applyLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
