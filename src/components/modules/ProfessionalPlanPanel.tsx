import React, { useRef, useState } from 'react';
import { useApp, planSnapshot } from '../../context/AppContext';
import { FileUp, Loader2, X } from 'lucide-react';
import { useConfirm } from '../common/ConfirmDialog';
import type { DepartmentPlan } from '../../types';

export const ProfessionalPlanPanel: React.FC = () => {
  const { departmentPlans, config, activeMember, permissions, saveDepartmentPlan, setNotification } = useApp();
  const plan = departmentPlans.find(p => p.planKind === 'professional' && p.academicYear === config.academicYear);
  const [draft, setDraft] = useState<DepartmentPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ fileName: string; text: string; notes: string[] } | null>(null);
  const [sourceName, setSourceName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const canEdit = permissions.isLeader && (!plan || ['draft', 'returned'].includes(plan.status));
  const makeDraft = (): DepartmentPlan => plan || {
    id: `professional-${config.academicYear.replace(/[^0-9]/g, '')}`,
    planKind: 'professional', academicYear: config.academicYear,
    title: `Kế hoạch chuyên môn tổ Toán – Năm học ${config.academicYear}`,
    status: 'draft', version: 1, distribution: [], periodicEvaluations: [],
    generalSituation: 'I. CĂN CỨ XÂY DỰNG KẾ HOẠCH\n\nII. ĐẶC ĐIỂM TÌNH HÌNH\n\nIII. MỤC TIÊU VÀ CHỈ TIÊU\n\nIV. NHIỆM VỤ VÀ GIẢI PHÁP\n\nV. KẾ HOẠCH HOẠT ĐỘNG THEO THÁNG\n\nVI. PHÂN CÔNG VÀ TỔ CHỨC THỰC HIỆN\n\nVII. KIỂM TRA, ĐÁNH GIÁ VÀ ĐIỀU CHỈNH',
    createdBy: activeMember.displayName, createdById: activeMember.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    comments: [], versionHistory: [],
  };
  const begin = () => { setDraft(makeDraft()); setSourceName(''); };
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !permissions.isLeader || busy || importing) return;
    if (file.size > 15 * 1024 * 1024) {
      setNotification({message: 'Tệp quá lớn. Giới hạn 15 MB.', type: 'error'}); return;
    }
    setImporting(true);
    try {
      const { readPlanGrids } = await import('../../utils/planImport');
      const result = await readPlanGrids(file);
      // Word/PDF đã có văn bản theo thứ tự tài liệu; Excel cần chuyển các bảng thành chữ.
      const text = result.text.trim() || result.grids.map(grid => [
        grid.context || '',
        ...grid.rows.filter(row => row.some(cell => cell.trim())).map(row => row.join(' | ')),
      ].filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
      if (!text.trim()) throw new Error(file.name.toLowerCase().endsWith('.pdf')
        ? 'PDF không có lớp chữ. PDF scan cần chuyển bằng OCR hoặc dùng Word/Excel.'
        : 'Không tìm thấy nội dung trong tệp.');
      const notes = [...result.notes, 'Nhập dưới dạng văn bản; bảng được biểu diễn thành dòng chữ. Hình ảnh và định dạng trang không được giữ.'];
      setPreview({fileName: file.name, text, notes});
    } catch (error) {
      setNotification({message: `Không đọc được tệp: ${error instanceof Error ? error.message : String(error)}`, type: 'error'});
    } finally { setImporting(false); }
  };
  const applyImport = async (mode: 'replace' | 'append') => {
    if (!preview || !permissions.isLeader) return;
    if (plan && ['submitted', 'approved'].includes(plan.status)) {
      if (!await confirm({title: 'Mở bản nháp điều chỉnh?', message: 'Khi Lưu, kế hoạch chuyển sang bản nháp và cần trình duyệt lại. Phiên bản hiện tại được giữ trong lịch sử. Hủy chưa thay đổi dữ liệu đã lưu.', confirmText: 'Mở bản nháp'})) return;
    }
    const base = draft || makeDraft();
    setDraft({...base, status: 'draft', approvedBy: undefined,
      generalSituation: mode === 'append' ? [base.generalSituation.trim(), preview.text].filter(Boolean).join('\n\n') : preview.text});
    setSourceName(preview.fileName);
    setPreview(null);
  };
  const persist = async (next: DepartmentPlan, summary: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const updated = { ...next, updatedAt: now, version: plan ? (plan.version || 1) + 1 : 1 };
      return await saveDepartmentPlan({ ...updated, versionHistory: [...(plan?.versionHistory || []), ...(sourceName && plan ? [{version: plan.version, updatedAt: now, updatedBy: activeMember.displayName, changeSummary: 'Phiên bản trước khi nhập tệp', status: plan.status, dataSnapshot: planSnapshot(plan)}] : []), {
        version: updated.version, updatedAt: now, updatedBy: activeMember.displayName,
        changeSummary: summary, status: updated.status, dataSnapshot: planSnapshot(updated),
      }] });
    } finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !draft.title.trim() || !draft.generalSituation.trim()) {
      setNotification({ message: 'Hãy nhập tên và nội dung kế hoạch.', type: 'error' }); return;
    }
    if (!permissions.isLeader) return;
    if (await persist(draft, sourceName ? `Nhập kế hoạch chuyên môn từ ${sourceName}` : 'Lưu kế hoạch chuyên môn của tổ')) { setDraft(null); setSourceName(''); }
  };
  const review = async (status: 'approved' | 'returned') => {
    if (!plan || !permissions.canApproveDeptPlan || plan.status !== 'submitted' || plan.createdBy === activeMember.displayName) return;
    const note = window.prompt(status === 'approved' ? 'Ý kiến phê duyệt (có thể bỏ trống):' : 'Lý do trả lại:');
    if (note === null) return;
    if (status === 'returned' && !note.trim()) { setNotification({message: 'Hãy nhập lý do trả lại.', type: 'error'}); return; }
    await persist({ ...plan, status, ...(status === 'approved' ? { approvedBy: activeMember.displayName } : {}),
      comments: [...(plan.comments || []), { id: `review-${Date.now()}`, authorId: activeMember.id, authorName: activeMember.displayName,
        content: note.trim() || 'Đồng ý phê duyệt', type: status === 'approved' ? 'approval_note' : 'return_reason', createdAt: new Date().toISOString() }],
    }, status === 'approved' ? 'Phê duyệt kế hoạch chuyên môn' : 'Trả lại kế hoạch chuyên môn');
  };
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <h2 className="text-lg font-bold text-slate-900">Kế hoạch chuyên môn tổ Toán</h2>
      <div className="flex flex-wrap gap-2 text-xs">
        {permissions.isLeader && <>
          <input ref={fileRef} type="file" accept=".docx,.xlsx,.xls,.xlsm,.ods,.csv,.pdf" className="hidden" onChange={handleImport} />
          <button disabled={busy || importing} onClick={() => fileRef.current?.click()} className="px-3 py-2 border border-emerald-200 bg-white text-emerald-700 rounded-lg flex items-center gap-2 disabled:opacity-50">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {importing ? 'Đang đọc tệp…' : 'Nhập tệp Word / Excel / PDF'}
          </button>
        </>}
        {canEdit && <button disabled={busy} onClick={begin} className="px-3 py-2 bg-blue-600 text-white rounded-lg">{plan ? 'Sửa kế hoạch' : 'Thêm kế hoạch chuyên môn'}</button>}
        {plan && <button onClick={() => window.print()} className="px-3 py-2 border rounded-lg">In / Xuất PDF</button>}
        {plan && canEdit && !draft && <button disabled={busy} onClick={() => persist({ ...plan, status: 'submitted' }, 'Trình duyệt kế hoạch chuyên môn')} className="px-3 py-2 bg-amber-500 text-white rounded-lg">Trình duyệt</button>}
        {plan?.status === 'submitted' && plan.createdBy !== activeMember.displayName && permissions.canApproveDeptPlan && <>
          <button disabled={busy} onClick={() => review('approved')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg">Phê duyệt</button>
          <button disabled={busy} onClick={() => review('returned')} className="px-3 py-2 border rounded-lg">Trả lại</button>
        </>}
      </div>
    </div>
    {preview && <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="professional-import-title">
      <div className="bg-white rounded-xl p-5 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex justify-between items-center gap-3"><h3 id="professional-import-title" className="font-bold">Xem trước: {preview.fileName}</h3><button onClick={() => setPreview(null)} aria-label="Đóng xem trước"><X className="w-5 h-5" /></button></div>
        <p className="text-xs text-slate-600">{preview.text.length.toLocaleString('vi-VN')} ký tự. Chưa lưu vào hồ sơ.</p>
        {preview.notes.map((note, i) => <p key={i} className="text-xs text-amber-800">{note}</p>)}
        <textarea readOnly value={preview.text} rows={18} className="w-full border rounded-lg p-3 text-sm" aria-label="Nội dung tệp đã đọc" />
        <div className="flex flex-wrap gap-2 text-xs">
          <button onClick={() => applyImport('replace')} className="px-3 py-2 bg-blue-600 text-white rounded-lg">Dùng nội dung tệp / Thay thế bản nháp</button>
          {(draft || plan) && <button onClick={() => applyImport('append')} className="px-3 py-2 border rounded-lg">Nối thêm vào cuối</button>}
          <button onClick={() => setPreview(null)} className="px-3 py-2 border rounded-lg">Hủy</button>
        </div>
      </div>
    </div>}
    {draft && <form onSubmit={save} className="p-4 bg-white border rounded-xl space-y-3 print:hidden">
      {sourceName && <p className="text-xs text-emerald-700">Đã đọc từ {sourceName}. Rà soát nội dung rồi bấm Lưu; Hủy sẽ không ghi dữ liệu.</p>}
      <label className="block text-sm font-semibold">Tên kế hoạch<input required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="block w-full border rounded-lg p-2 mt-1" /></label>
      <label className="block text-sm font-semibold">Nội dung kế hoạch<textarea required rows={22} value={draft.generalSituation} onChange={e => setDraft({ ...draft, generalSituation: e.target.value })} className="block w-full border rounded-lg p-3 mt-1 text-sm font-normal" /></label>
      <p className="text-xs text-slate-500">Nhập hoặc dán nội dung kế hoạch chung của tổ, bao gồm chỉ tiêu, nhiệm vụ, lịch hoạt động và phân công.</p>
      <div className="flex gap-2"><button disabled={busy} type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg">{busy ? 'Đang lưu…' : 'Lưu kế hoạch'}</button><button disabled={busy} type="button" onClick={() => { setDraft(null); setSourceName(''); }} className="px-3 py-2 border rounded-lg">Hủy</button></div>
    </form>}
    {plan ? <article className="bg-white border rounded-xl p-6 space-y-4">
      <header className="text-center space-y-1"><p className="uppercase">{config.schoolName}</p><p className="font-bold uppercase">{config.departmentName}</p><h3 className="text-lg font-bold pt-3">{plan.title}</h3><p className="text-sm">Năm học {plan.academicYear}</p></header>
      <p className="text-xs text-slate-500 print:hidden">{({draft:'Bản nháp',submitted:'Chờ duyệt',approved:'Đã duyệt',returned:'Trả lại để điều chỉnh'})[plan.status]} · Phiên bản {plan.version}{plan.approvedBy && plan.status === 'approved' ? ` · Người duyệt: ${plan.approvedBy}` : ''}</p>
      <div className="whitespace-pre-wrap text-sm leading-7">{plan.generalSituation}</div>
      {!!plan.comments?.length && <div className="border-t pt-3 text-sm"><h4 className="font-semibold">Ý kiến phê duyệt và điều chỉnh</h4>{plan.comments.map(c => <p key={c.id}>{c.authorName}: {c.content}</p>)}</div>}
      <details className="print:hidden"><summary className="cursor-pointer text-xs font-semibold">Lịch sử phiên bản ({plan.versionHistory?.length || 0})</summary>{plan.versionHistory?.map((v,i) => <div key={i} className="mt-2 border rounded-lg p-3 text-xs"><p>v{v.version} · {v.updatedBy} · {v.updatedAt} · {v.changeSummary}</p><details><summary>Xem nội dung phiên bản</summary><div className="whitespace-pre-wrap mt-2">{String(v.dataSnapshot?.generalSituation || '')}</div></details></div>)}</details>
    </article> : <div className="bg-white border border-dashed rounded-xl p-8 text-center text-slate-500">Chưa có kế hoạch chuyên môn chung của tổ cho năm học {config.academicYear}.{canEdit && ' Bấm “Thêm kế hoạch chuyên môn” để nhập nội dung.'}</div>}
  </section>;
};
