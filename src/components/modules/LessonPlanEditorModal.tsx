import React, { useMemo, useRef, useState } from 'react';
import {
  X, Save, Plus, Trash2, Eye, Pencil, FileUp, Loader2, CheckCircle2, AlertTriangle, Link2,
  Sigma, LineChart, ImagePlus, Shapes, Maximize2, Minimize2, Stethoscope,
} from 'lucide-react';
import type { LessonPlan, LessonPlanActivity, SchoolClass } from '../../types';
import { MathText } from '../../utils/katex-renderer';
import { newId, safeUrl } from '../../utils/ids';
import { extractTextFromFile, parseLessonText } from '../../utils/lessonImport';
import { useConfirm } from '../common/ConfirmDialog';
import { MathFormulaToolbar } from '../common/MathFormulaToolbar';
import { MathGraph } from '../common/MathGraph';
import { compressImageInBrowser } from '../../utils/docxReader';
import { FormulaDoctor, countFormulaIssues } from '../common/FormulaDoctor';

interface Props {
  plan: LessonPlan;
  classes: SchoolClass[];
  onCancel: () => void;
  onSave: (plan: LessonPlan) => Promise<boolean>;
}

type PlanField = 'objectivesKnowledge' | 'objectivesCompetence' | 'objectivesQualities' | 'equipment';
type ActField = 'objectives' | 'content' | 'product' | 'implementation';
type Target = { kind: 'plan'; key: PlanField; label: string } | { kind: 'act'; actId: string; key: ActField; label: string };

/** Firestore giới hạn 1 MB / tài liệu – chừa khoảng trống cho lịch sử phiên bản, góp ý */
const MAX_PLAN_CHARS = 900_000;

const hasRich = (s: string) => /\$|!\[|\[\[|\\begin\{/.test(s);

/**
 * Soạn nội dung Kế hoạch bài dạy theo Phụ lục IV CV 5512, kèm bộ công cụ toán học:
 * chèn công thức LaTeX, vẽ đồ thị hàm số (mathviz), chèn hình vẽ/ảnh, nhúng GeoGebra,
 * nhập từ Word (giữ công thức Equation + hình) hoặc PDF.
 */
export const LessonPlanEditorModal: React.FC<Props> = ({ plan, classes, onCancel, onSave }) => {
  const [draft, setDraft] = useState<LessonPlan>(plan);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importInfo, setImportInfo] = useState<{ ok: boolean; text: string } | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [showTools, setShowTools] = useState(true);
  const [graphDialog, setGraphDialog] = useState<string | null>(null);
  const [ggbDialog, setGgbDialog] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const issues = useMemo(() => countFormulaIssues(draft), [draft]);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const lastEl = useRef<HTMLTextAreaElement | null>(null);
  const confirm = useConfirm();

  const set = <K extends keyof LessonPlan>(key: K, value: LessonPlan[K]) => setDraft(d => ({ ...d, [key]: value }));
  const setAct = (id: string, patch: Partial<LessonPlanActivity>) =>
    setDraft(d => ({ ...d, activities: d.activities.map(a => (a.id === id ? { ...a, ...patch } : a)) }));

  const gradeClasses = classes.filter(c => c.grade === draft.grade);

  const valueOf = (t: Target): string =>
    t.kind === 'plan' ? draft[t.key] || '' : draft.activities.find(a => a.id === t.actId)?.[t.key] || '';

  /** Chèn đoạn văn bản vào vị trí con trỏ của ô đang soạn */
  const insertText = (snippet: string) => {
    if (!target) {
      setError('Hãy bấm vào một ô nội dung (mục tiêu, nội dung, sản phẩm...) trước khi chèn.');
      return;
    }
    setError('');
    const cur = valueOf(target);
    const el = lastEl.current;
    const start = el && el.value === cur ? el.selectionStart ?? cur.length : cur.length;
    const end = el && el.value === cur ? el.selectionEnd ?? start : start;
    // Tránh dính "$$" khi chèn công thức ngay sau/trước một công thức khác
    let snip = snippet;
    if (snip.startsWith('$') && cur.slice(0, start).endsWith('$')) snip = ` ${snip}`;
    if (snip.endsWith('$') && cur.slice(end).startsWith('$')) snip = `${snip} `;
    const next = cur.slice(0, start) + snip + cur.slice(end);
    if (target.kind === 'plan') set(target.key, next);
    else setAct(target.actId, { [target.key]: next });
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const pos = start + snip.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const focusProps = (t: Target) => ({
    onFocus: (e: React.FocusEvent<HTMLTextAreaElement>) => {
      lastEl.current = e.currentTarget;
      setTarget(t);
    },
  });
  const isTarget = (t: Target) =>
    !!target && target.kind === t.kind && target.key === t.key && (t.kind === 'plan' || (target.kind === 'act' && target.actId === t.actId));

  /** Ô soạn thảo có xem nhanh công thức/hình ngay bên dưới khi đang được chọn */
  const renderField = ({ t, rows, value, onChange, mono = true }: { t: Target; rows: number; value: string; onChange: (v: string) => void; mono?: boolean }): React.ReactElement =>
    preview ? (
      <MathText content={value || '(trống)'} images={draft.images} className="mt-1 p-2 bg-white rounded border border-slate-200 font-normal" />
    ) : (
      <>
        <textarea
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          {...focusProps(t)}
          className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white font-normal resize-y mt-1 ${mono ? 'font-mono' : ''} ${
            isTarget(t) ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-300'
          }`}
        />
        {isTarget(t) && hasRich(value) && (
          <div className="mt-1 p-2 rounded border border-dashed border-blue-200 bg-blue-50/40 font-normal">
            <div className="text-[10px] text-blue-600 mb-1">Xem nhanh:</div>
            <MathText content={value} images={draft.images} />
          </div>
        )}
      </>
    );

  // ---------- Nhập Word/PDF ----------
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setImportInfo({ ok: false, text: 'Tệp quá lớn (tối đa 15 MB).' });
      return;
    }
    setImporting(true);
    setImportInfo(null);
    try {
      const { text, images, notes } = await extractTextFromFile(file);
      if (!text.trim()) {
        setImportInfo({ ok: false, text: 'Không đọc được chữ trong tệp. Nếu là PDF scan (ảnh chụp), hãy dùng bản Word hoặc PDF xuất trực tiếp từ Word.' });
        return;
      }
      const parsed = parseLessonText(text);
      const hasContent =
        !!(draft.objectivesKnowledge || draft.objectivesCompetence || draft.objectivesQualities || draft.equipment) ||
        draft.activities.some(a => a.content || a.product || a.implementation || a.objectives);

      if (!parsed.recognized) {
        const ok = await confirm({
          title: 'Không nhận ra cấu trúc CV 5512',
          message:
            'Tệp không có các mục "I. MỤC TIÊU", "II. THIẾT BỊ...", "III. TIẾN TRÌNH DẠY HỌC", "Hoạt động 1...". Đưa toàn bộ nội dung vào ô "Nội dung" của hoạt động đầu tiên để bạn tự sắp xếp?',
          confirmText: 'Đưa vào',
        });
        if (!ok) return;
        setDraft(d => ({
          ...d,
          sourceFileName: file.name,
          images: { ...(d.images || {}), ...images },
          activities: d.activities.length
            ? d.activities.map((a, i) => (i === 0 ? { ...a, content: parsed.rawText } : a))
            : [{ id: newId('activity'), name: 'Hoạt động 1', objectives: '', content: parsed.rawText, product: '', implementation: '' }],
        }));
        setImportInfo({ ok: false, text: `Đã đưa toàn bộ nội dung "${file.name}" vào Hoạt động 1 › Nội dung. ${notes.join('; ')}.` });
        return;
      }

      if (hasContent) {
        const ok = await confirm({
          title: 'Ghi đè nội dung đang soạn?',
          message: `Nội dung đọc từ "${file.name}" sẽ thay thế Mục tiêu, Thiết bị và các Hoạt động hiện có trong giáo án này.`,
          confirmText: 'Ghi đè',
          danger: true,
        });
        if (!ok) return;
      }

      setDraft(d => ({
        ...d,
        title: d.title.trim() ? d.title : parsed.title || d.title,
        topicTitle: d.topicTitle.trim() ? d.topicTitle : parsed.topicTitle || d.topicTitle,
        periodCount: parsed.periodCount || d.periodCount,
        objectivesKnowledge: parsed.objectivesKnowledge || d.objectivesKnowledge,
        objectivesCompetence: parsed.objectivesCompetence || d.objectivesCompetence,
        objectivesQualities: parsed.objectivesQualities || d.objectivesQualities,
        equipment: parsed.equipment || d.equipment,
        activities: parsed.activities.length ? parsed.activities.map(a => ({ ...a, id: newId('activity') })) : d.activities,
        images: { ...(d.images || {}), ...images },
        sourceFileName: file.name,
      }));
      const filled = [parsed.objectivesKnowledge && 'kiến thức', parsed.objectivesCompetence && 'năng lực', parsed.objectivesQualities && 'phẩm chất'].filter(Boolean);
      setImportInfo({
        ok: true,
        text:
          `Đã nhập từ "${file.name}": ${filled.length ? `mục tiêu (${filled.join(', ')}), ` : ''}${parsed.equipment ? 'thiết bị, ' : ''}${parsed.activities.length} hoạt động` +
          (notes.length ? `; ${notes.join('; ')}` : '') +
          '. Bấm "Xem trước" để kiểm tra công thức và hình.',
      });
    } catch (err) {
      setImportInfo({ ok: false, text: `Không đọc được tệp: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setImporting(false);
    }
  };

  // ---------- Chèn ảnh ----------
  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp|bmp)$/.test(file.type)) {
      setError('Chỉ chèn được ảnh PNG, JPG, GIF, WEBP.');
      return;
    }
    const url = await compressImageInBrowser(new Uint8Array(await file.arrayBuffer()), file.type);
    if (!url) {
      setError('Không đọc được ảnh.');
      return;
    }
    if (JSON.stringify(draft).length + url.length > MAX_PLAN_CHARS) {
      setError('Giáo án đã gần đạt giới hạn dung lượng (khoảng 900 KB). Hãy dùng ảnh nhỏ hơn hoặc để ảnh trên Drive và dán liên kết.');
      return;
    }
    const id = newId('img').replace(/-/g, '_');
    setDraft(d => ({ ...d, images: { ...(d.images || {}), [id]: url } }));
    insertText(`\n![${file.name.replace(/\.[^.]+$/, '')}](img:${id})\n`);
  };

  // ---------- Lưu ----------
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.topicTitle.trim()) return setError('Cần nhập tên bài dạy và chủ đề.');
    if (draft.activities.some(a => !a.name.trim())) return setError('Mỗi hoạt động cần có tên.');
    if (draft.sourceFileUrl && !safeUrl(draft.sourceFileUrl)) return setError('Liên kết tệp gốc phải bắt đầu bằng http:// hoặc https://');
    // Bỏ ảnh không còn được dùng trong nội dung
    const allText = [draft.objectivesKnowledge, draft.objectivesCompetence, draft.objectivesQualities, draft.equipment, ...draft.activities.flatMap(a => [a.objectives, a.content, a.product, a.implementation])].join('\n');
    const used = Object.fromEntries(Object.entries(draft.images || {}).filter(([id]) => allText.includes(`img:${id})`)));
    const toSave: LessonPlan = {
      ...draft,
      title: draft.title.trim(),
      topicTitle: draft.topicTitle.trim(),
      sourceFileUrl: safeUrl(draft.sourceFileUrl) || undefined,
      images: Object.keys(used).length ? used : undefined,
    };
    const size = JSON.stringify(toSave).length;
    if (size > MAX_PLAN_CHARS) {
      return setError(`Giáo án quá lớn (${Math.round(size / 1024)} KB, tối đa ~${Math.round(MAX_PLAN_CHARS / 1024)} KB) do có nhiều hình. Hãy xóa bớt hình hoặc để ảnh trên Drive rồi dán liên kết.`);
    }
    setError('');
    setSaving(true);
    const ok = await onSave(toSave);
    setSaving(false);
    if (ok) onCancel();
  };

  const input = 'w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-normal';
  const toolBtn = 'px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-lg flex items-center gap-1 hover:bg-blue-50 hover:border-blue-300';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={handleSave}
        className={`bg-white shadow-2xl border border-slate-200 flex flex-col gap-3 p-5 ${maximized ? 'fixed inset-0 rounded-none max-h-none' : 'rounded-2xl max-w-5xl w-full max-h-[94vh]'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2 flex-wrap">
          <h3 className="text-base font-bold text-slate-900">Soạn kế hoạch bài dạy</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleImportFile} />
            <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleImage} />
            <button
              type="button"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 disabled:opacity-60"
              title="Nhập nội dung giáo án từ tệp Word (.docx) hoặc PDF"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
              {importing ? 'Đang đọc tệp...' : 'Nhập từ Word/PDF'}
            </button>
            <button type="button" onClick={() => setShowTools(v => !v)} className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg flex items-center gap-1 hover:bg-slate-50">
              <Sigma className="w-3.5 h-3.5" /> {showTools ? 'Ẩn công cụ toán' : 'Công cụ toán'}
            </button>
            <button type="button" onClick={() => setPreview(p => !p)} className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg flex items-center gap-1 hover:bg-slate-50">
              {preview ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {preview ? 'Soạn thảo' : 'Xem trước'}
            </button>
            <button
              type="button"
              onClick={() => setDoctorOpen(true)}
              className={`px-2.5 py-1 text-xs font-semibold border rounded-lg flex items-center gap-1 ${issues.errors ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border-slate-200 hover:bg-slate-50'}`}
              title="Tự tìm và sửa công thức bị lỗi"
            >
              <Stethoscope className="w-3.5 h-3.5" /> Sửa lỗi công thức
              {issues.errors + issues.suggestions > 0 && (
                <span className={`ml-0.5 px-1.5 rounded-full text-[10px] text-white ${issues.errors ? 'bg-rose-600' : 'bg-amber-500'}`}>{issues.errors + issues.suggestions}</span>
              )}
            </button>
            <button type="button" onClick={() => setMaximized(v => !v)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" title={maximized ? 'Thu nhỏ' : 'Toàn màn hình'} aria-label={maximized ? 'Thu nhỏ' : 'Toàn màn hình'}>
              {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700" aria-label="Đóng">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showTools && !preview && (
          <div className="space-y-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`px-2 py-0.5 rounded ${target ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}>
                {target ? <>Chèn vào: <strong>{target.label}</strong></> : 'Bấm vào một ô nội dung để chọn nơi chèn'}
              </span>
              <button type="button" className={toolBtn} onClick={() => setGraphDialog('y = x^3 - 3x; x = -3..3; y = -4..4')}>
                <LineChart className="w-3.5 h-3.5 text-blue-600" /> Vẽ đồ thị hàm số
              </button>
              <button type="button" className={toolBtn} onClick={() => (target ? imageRef.current?.click() : insertText(''))}>
                <ImagePlus className="w-3.5 h-3.5 text-emerald-600" /> Chèn hình vẽ/ảnh
              </button>
              <button type="button" className={toolBtn} onClick={() => setGgbDialog('')}>
                <Shapes className="w-3.5 h-3.5 text-purple-600" /> Nhúng GeoGebra
              </button>
              <button type="button" className={toolBtn} onClick={() => insertText('$$\\begin{cases} x + y = 3 \\\\ x - y = 1 \\end{cases}$$')}>
                Hệ phương trình
              </button>
              <button type="button" className={toolBtn} onClick={() => insertText('$$\\begin{array}{c|ccccc} x & -\\infty & & 0 & & +\\infty \\\\ \\hline y\' & & - & 0 & + & \\\\ \\end{array}$$')}>
                Bảng xét dấu
              </button>
            </div>
            <MathFormulaToolbar onInsert={insertText} compact />
          </div>
        )}

        <p className="text-[11px] text-slate-500 shrink-0">
          Công thức gõ trong <code className="bg-slate-100 px-1 rounded">$...$</code> (vd <code className="bg-slate-100 px-1 rounded">{'$\\int_0^1 x^2\\,dx$'}</code>), riêng dòng dùng{' '}
          <code className="bg-slate-100 px-1 rounded">$$...$$</code>. Đồ thị: <code className="bg-slate-100 px-1 rounded">{'[[do-thi: y = x^2 - 2x; x = -2..4]]'}</code>. Nhập từ Word giữ được công thức Equation và hình ảnh.
        </p>
        {importInfo && (
          <div className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 shrink-0 ${importInfo.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
            {importInfo.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />}
            <span className="flex-1">{importInfo.text}</span>
            <button type="button" onClick={() => setImportInfo(null)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng thông báo"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {issues.errors + issues.suggestions > 0 && (
          <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 shrink-0 ${issues.errors ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
            <Stethoscope className="w-4 h-4 shrink-0" />
            <span className="flex-1">
              {issues.errors > 0 && <>Phát hiện <b>{issues.errors}</b> công thức bị lỗi (hiện chữ đỏ hoặc sai hình thức). </>}
              {issues.suggestions > 0 && <>Có <b>{issues.suggestions}</b> chỗ nghi mất số mũ/chỉ số dưới (vd b3 → b³, S0 → S₀). </>}
              Phần mềm có thể tự sửa — bạn chỉ cần xem lại và bấm đồng ý.
            </span>
            <button type="button" onClick={() => setDoctorOpen(true)} className="px-3 py-1 font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shrink-0">
              Kiểm tra &amp; tự sửa
            </button>
          </div>
        )}

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

          <label className="block font-semibold text-slate-700">
            Liên kết tệp giáo án gốc (Google Drive, OneDrive... – tùy chọn)
            <div className="relative mt-1">
              <Link2 className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input type="url" value={draft.sourceFileUrl || ''} onChange={e => set('sourceFileUrl', e.target.value)} placeholder="https://drive.google.com/..." className={`${input} pl-8`} />
            </div>
            {draft.sourceFileName && <span className="block mt-1 font-normal text-[11px] text-slate-500">Nội dung đã nhập từ tệp: {draft.sourceFileName}</span>}
          </label>

          <div className="space-y-2">
            <h4 className="font-bold text-blue-900 uppercase tracking-wide">I. Mục tiêu</h4>
            {([
              ['objectivesKnowledge', '1. Về kiến thức'],
              ['objectivesCompetence', '2. Về năng lực'],
              ['objectivesQualities', '3. Về phẩm chất'],
            ] as const).map(([key, label]) => (
              <div key={key} className="block font-semibold text-slate-700">
                {label}
                {renderField({ t: { kind: 'plan', key, label: `Mục tiêu › ${label}` }, rows: 3, value: draft[key], onChange: v => set(key, v) })}
              </div>
            ))}
          </div>

          <div className="block font-semibold text-slate-700">
            <span className="font-bold text-blue-900 uppercase tracking-wide">II. Thiết bị dạy học và học liệu</span>
            {renderField({ t: { kind: 'plan', key: 'equipment', label: 'Thiết bị dạy học' }, rows: 2, value: draft.equipment, onChange: v => set('equipment', v), mono: false })}
          </div>

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
                  <div key={key} className="block font-semibold text-slate-700">
                    {label}
                    {renderField({
                      t: { kind: 'act', actId: act.id, key, label: `${act.name.slice(0, 30)} › ${label.slice(0, 14)}` },
                      rows: key === 'implementation' ? 5 : 2,
                      value: act[key],
                      onChange: v => setAct(act.id, { [key]: v }),
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {error && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 shrink-0">{error}</div>}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
          <button type="button" onClick={onCancel} className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
          <button type="submit" disabled={saving} className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Đang lưu...' : 'Lưu giáo án'}
          </button>
        </div>

        {graphDialog !== null && (
          <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-3 text-xs max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><LineChart className="w-4 h-4 text-blue-600" /> Vẽ đồ thị hàm số</h4>
                <button type="button" onClick={() => setGraphDialog(null)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng"><X className="w-4 h-4" /></button>
              </div>
              <textarea rows={2} value={graphDialog} onChange={e => setGraphDialog(e.target.value)} className={`${input} font-mono`} aria-label="Mô tả đồ thị" />
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div>Ngăn cách bằng dấu <b>;</b> — nhiều hàm: <code>y = x^2; y = 2x + 1</code> • khung nhìn: <code>x = -3..3; y = -2..5</code></div>
                <div>Điểm: <code>A(1;-2)</code> • đường thẳng đứng (tiệm cận): <code>x = 1</code> • hàm: sin cos tan sqrt abs ln log exp, pi; |x| là trị tuyệt đối; <code>(2x+1)/(x-1)</code></div>
              </div>
              <div className="flex justify-center bg-slate-50 rounded-lg p-2">
                <MathGraph spec={graphDialog} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setGraphDialog(null)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
                <button
                  type="button"
                  onClick={() => {
                    insertText(`\n[[do-thi: ${graphDialog.replace(/\]\]/g, '')}]]\n`);
                    setGraphDialog(null);
                  }}
                  className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Chèn đồ thị
                </button>
              </div>
            </div>
          </div>
        )}

        {ggbDialog !== null && (
          <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3 text-xs">
              <h4 className="text-sm font-bold text-slate-900">Nhúng hình GeoGebra</h4>
              <input value={ggbDialog} onChange={e => setGgbDialog(e.target.value)} placeholder="https://www.geogebra.org/m/abcd1234" className={input} aria-label="Liên kết GeoGebra" />
              <p className="text-[11px] text-slate-500">Mở hình trên geogebra.org → Chia sẻ → sao chép liên kết dạng geogebra.org/m/...</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setGgbDialog(null)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
                <button
                  type="button"
                  onClick={() => {
                    const u = safeUrl(ggbDialog);
                    if (!u || !/geogebra\.org/.test(u)) {
                      setError('Liên kết phải là trang geogebra.org');
                      setGgbDialog(null);
                      return;
                    }
                    insertText(`\n[[geogebra: ${u}]]\n`);
                    setGgbDialog(null);
                  }}
                  className="px-4 py-1.5 font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  Chèn
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
      {doctorOpen && (
        <FormulaDoctor
          plan={draft}
          applyLabel="Đưa vào giáo án"
          onClose={() => setDoctorOpen(false)}
          onApply={p => {
            setDraft(p);
            return true;
          }}
        />
      )}
    </div>
  );
};
