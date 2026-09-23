import React, { useMemo, useState } from 'react';
import { FolderOpen, Plus, Search, ExternalLink, Pencil, Trash2, X, Link2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { DocumentCategory, SharedDocument } from '../../types';
import { useConfirm } from '../common/ConfirmDialog';
import { newId, safeUrl } from '../../utils/ids';

const CATEGORIES: Record<DocumentCategory, { label: string; color: string }> = {
  van_ban: { label: 'Văn bản chỉ đạo', color: 'bg-rose-100 text-rose-800' },
  mau_bieu: { label: 'Mẫu biểu', color: 'bg-amber-100 text-amber-800' },
  bai_giang: { label: 'Bài giảng / Giáo án mẫu', color: 'bg-blue-100 text-blue-800' },
  de_kiem_tra: { label: 'Đề kiểm tra', color: 'bg-purple-100 text-purple-800' },
  hoc_lieu: { label: 'Học liệu số (GeoGebra...)', color: 'bg-emerald-100 text-emerald-800' },
  khac: { label: 'Khác', color: 'bg-slate-100 text-slate-700' },
};

const empty = (): SharedDocument => ({ id: '', title: '', url: '', category: 'hoc_lieu', description: '', grade: 0 });

/** Kho tài liệu dùng chung của tổ (bản cũ chỉ là trang trống hiển thị số lượng). */
export const DocumentsModule: React.FC = () => {
  const { documents, saveDocument, deleteDocument, activeMember, permissions, config } = useApp();
  const confirm = useConfirm();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<'all' | DocumentCategory>('all');
  const [grade, setGrade] = useState<'all' | 0 | 10 | 11 | 12>('all');
  const [draft, setDraft] = useState<SharedDocument | null>(null);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return documents
      .filter(d => category === 'all' || d.category === category)
      .filter(d => grade === 'all' || (d.grade ?? 0) === grade)
      .filter(d => !kw || `${d.title} ${d.description || ''} ${d.uploaderName || ''}`.toLowerCase().includes(kw))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [documents, keyword, category, grade]);

  const driveUrl = safeUrl(config.externalLinks?.sharedDocumentsDriveUrl);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const url = safeUrl(draft.url);
    if (!draft.title.trim()) return setError('Vui lòng nhập tên tài liệu.');
    if (!url) return setError('Liên kết phải là địa chỉ web hợp lệ, bắt đầu bằng http:// hoặc https://');
    setError('');
    const now = new Date().toISOString();
    const ok = await saveDocument({
      ...draft,
      id: draft.id || newId('doc'),
      title: draft.title.trim(),
      description: (draft.description || '').trim(),
      url,
      uploaderId: draft.uploaderId || activeMember.id,
      uploaderName: draft.uploaderName || activeMember.displayName,
      createdAt: draft.createdAt || now,
    });
    if (ok) setDraft(null);
  };

  const handleDelete = async (d: SharedDocument) => {
    if (await confirm({ title: 'Xóa tài liệu?', message: `"${d.title}" sẽ bị gỡ khỏi kho (tệp gốc trên Drive không bị ảnh hưởng).`, confirmText: 'Xóa', danger: true })) {
      await deleteDocument(d.id);
    }
  };

  const input = 'w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-normal';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" /> Tài liệu dùng chung
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Văn bản chỉ đạo, mẫu biểu, bài giảng, đề kiểm tra và học liệu số của tổ — lưu dưới dạng liên kết (Google Drive, OneDrive, GeoGebra...)</p>
        </div>
        <div className="flex gap-2">
          {driveUrl && (
            <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Thư mục Drive của tổ
            </a>
          )}
          {permissions.canContribute && (
            <button
              onClick={() => { setError(''); setDraft(empty()); }}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm tài liệu
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-xs">
        <div className="relative flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input type="search" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Tìm tên, mô tả, người đăng..." className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg" aria-label="Tìm tài liệu" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value as typeof category)} className="px-2 py-2 border border-slate-300 rounded-lg bg-white" aria-label="Loại tài liệu">
          <option value="all">Tất cả loại</option>
          {(Object.keys(CATEGORIES) as DocumentCategory[]).map(k => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
        </select>
        <select value={String(grade)} onChange={e => setGrade(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 0 | 10 | 11 | 12))} className="px-2 py-2 border border-slate-300 rounded-lg bg-white" aria-label="Khối">
          <option value="all">Mọi khối</option>
          <option value="0">Dùng chung</option>
          <option value="10">Khối 10</option>
          <option value="11">Khối 11</option>
          <option value="12">Khối 12</option>
        </select>
        <span className="text-slate-500">{filtered.length}/{documents.length} tài liệu</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
          {documents.length === 0 ? 'Kho tài liệu còn trống. Bấm "Thêm tài liệu" để chia sẻ liên kết đầu tiên.' : 'Không có tài liệu phù hợp bộ lọc.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(d => {
            const cat = CATEGORIES[(d.category as DocumentCategory) || 'khac'] || CATEGORIES.khac;
            const link = safeUrl(d.url);
            const canEdit = permissions.isLeader || d.uploaderId === activeMember.id;
            return (
              <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cat.color}`}>{cat.label}</span>
                  <span className="text-[10px] text-slate-500">{d.grade ? `Khối ${d.grade}` : 'Dùng chung'}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{d.title}</h3>
                {d.description && <p className="text-xs text-slate-600">{d.description}</p>}
                <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-slate-100 text-[11px] text-slate-500">
                  <span className="truncate">
                    {d.uploaderName || '—'} • {d.createdAt ? new Date(d.createdAt).toLocaleDateString('vi-VN') : ''}
                    {link && <span className="ml-1 text-slate-400">({new URL(link).hostname})</span>}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Mở
                      </a>
                    ) : (
                      <span className="italic">Liên kết không hợp lệ</span>
                    )}
                    {canEdit && (
                      <button onClick={() => { setError(''); setDraft({ ...d }); }} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" aria-label="Sửa tài liệu"><Pencil className="w-3.5 h-3.5" /></button>
                    )}
                    {permissions.isLeader && (
                      <button onClick={() => handleDelete(d)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" aria-label="Xóa tài liệu"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSave} className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{draft.id ? 'Sửa tài liệu' : 'Thêm tài liệu dùng chung'}</h2>
              <button type="button" onClick={() => setDraft(null)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <label className="block font-semibold text-slate-700">Tên tài liệu *
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className={`${input} mt-1`} required maxLength={200} />
            </label>
            <label className="block font-semibold text-slate-700">Liên kết *
              <div className="relative mt-1">
                <Link2 className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input type="url" value={draft.url || ''} onChange={e => setDraft({ ...draft, url: e.target.value })} className={`${input} pl-8`} placeholder="https://drive.google.com/..." required />
              </div>
              <span className="block mt-1 font-normal text-[11px] text-slate-500">Nhớ bật quyền "Bất kỳ ai có đường liên kết đều xem được" (hoặc chia sẻ cho email thành viên tổ) trên Drive.</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="font-semibold text-slate-700">Loại
                <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} className={`${input} mt-1`}>
                  {(Object.keys(CATEGORIES) as DocumentCategory[]).map(k => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
                </select>
              </label>
              <label className="font-semibold text-slate-700">Khối
                <select value={draft.grade ?? 0} onChange={e => setDraft({ ...draft, grade: Number(e.target.value) as 0 | 10 | 11 | 12 })} className={`${input} mt-1`}>
                  <option value={0}>Dùng chung</option><option value={10}>Khối 10</option><option value={11}>Khối 11</option><option value={12}>Khối 12</option>
                </select>
              </label>
            </div>
            <label className="block font-semibold text-slate-700">Mô tả ngắn
              <textarea rows={2} value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} className={`${input} mt-1 resize-y`} />
            </label>
            {error && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{error}</div>}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onClick={() => setDraft(null)} className="px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="submit" className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Lưu</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
