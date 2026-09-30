import React, { useState } from 'react';
import { useApp, planSnapshot } from '../../context/AppContext';
import type { DepartmentPlan } from '../../types';

export const ProfessionalPlanPanel: React.FC = () => {
  const { departmentPlans, config, activeMember, permissions, saveDepartmentPlan, setNotification } = useApp();
  const plan = departmentPlans.find(p => p.planKind === 'professional' && p.academicYear === config.academicYear);
  const [draft, setDraft] = useState<DepartmentPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = permissions.isLeader && (!plan || ['draft', 'returned'].includes(plan.status));
  const begin = () => setDraft(plan || {
    id: `professional-${config.academicYear.replace(/[^0-9]/g, '')}`,
    planKind: 'professional', academicYear: config.academicYear,
    title: `Kế hoạch chuyên môn tổ Toán – Năm học ${config.academicYear}`,
    status: 'draft', version: 1, distribution: [], periodicEvaluations: [],
    generalSituation: 'I. CĂN CỨ XÂY DỰNG KẾ HOẠCH\n\nII. ĐẶC ĐIỂM TÌNH HÌNH\n\nIII. MỤC TIÊU VÀ CHỈ TIÊU\n\nIV. NHIỆM VỤ VÀ GIẢI PHÁP\n\nV. KẾ HOẠCH HOẠT ĐỘNG THEO THÁNG\n\nVI. PHÂN CÔNG VÀ TỔ CHỨC THỰC HIỆN\n\nVII. KIỂM TRA, ĐÁNH GIÁ VÀ ĐIỀU CHỈNH',
    createdBy: activeMember.displayName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    comments: [], versionHistory: [],
  });
  const persist = async (next: DepartmentPlan, summary: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const updated = { ...next, updatedAt: now, version: plan ? (plan.version || 1) + 1 : 1 };
      return await saveDepartmentPlan({ ...updated, versionHistory: [...(plan?.versionHistory || []), {
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
    if (await persist(draft, 'Lưu kế hoạch chuyên môn của tổ')) setDraft(null);
  };
  const review = async (status: 'approved' | 'returned') => {
    if (!plan || !permissions.canApproveDeptPlan || plan.status !== 'submitted') return;
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
        {canEdit && <button disabled={busy} onClick={begin} className="px-3 py-2 bg-blue-600 text-white rounded-lg">{plan ? 'Sửa kế hoạch' : 'Thêm kế hoạch chuyên môn'}</button>}
        {plan && <button onClick={() => window.print()} className="px-3 py-2 border rounded-lg">In / Xuất PDF</button>}
        {plan && canEdit && !draft && <button disabled={busy} onClick={() => persist({ ...plan, status: 'submitted' }, 'Trình duyệt kế hoạch chuyên môn')} className="px-3 py-2 bg-amber-500 text-white rounded-lg">Trình duyệt</button>}
        {plan?.status === 'submitted' && permissions.canApproveDeptPlan && <>
          <button disabled={busy} onClick={() => review('approved')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg">Phê duyệt</button>
          <button disabled={busy} onClick={() => review('returned')} className="px-3 py-2 border rounded-lg">Trả lại</button>
        </>}
      </div>
    </div>
    {draft && <form onSubmit={save} className="p-4 bg-white border rounded-xl space-y-3 print:hidden">
      <label className="block text-sm font-semibold">Tên kế hoạch<input required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className="block w-full border rounded-lg p-2 mt-1" /></label>
      <label className="block text-sm font-semibold">Nội dung kế hoạch<textarea required rows={22} value={draft.generalSituation} onChange={e => setDraft({ ...draft, generalSituation: e.target.value })} className="block w-full border rounded-lg p-3 mt-1 text-sm font-normal" /></label>
      <p className="text-xs text-slate-500">Nhập hoặc dán nội dung kế hoạch chung của tổ, bao gồm chỉ tiêu, nhiệm vụ, lịch hoạt động và phân công.</p>
      <div className="flex gap-2"><button disabled={busy} type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg">{busy ? 'Đang lưu…' : 'Lưu kế hoạch'}</button><button disabled={busy} type="button" onClick={() => setDraft(null)} className="px-3 py-2 border rounded-lg">Hủy</button></div>
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
