import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SpecialTopic, SkknTopic } from '../../types';
import { GraduationCap, Plus, Search, ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { useConfirm } from '../common/ConfirmDialog';
import { newId, safeUrl } from '../../utils/ids';

type TopicType = NonNullable<SpecialTopic['type']>;

const TYPE_LABEL: Record<TopicType, string> = {
  hsg: 'Bồi dưỡng HSG',
  tot_nghiep: 'Ôn thi Tốt nghiệp THPT',
  phu_dao: 'Phụ đạo học sinh',
};
const TYPE_COLOR: Record<TopicType, string> = {
  hsg: 'bg-purple-100 text-purple-800',
  tot_nghiep: 'bg-blue-100 text-blue-800',
  phu_dao: 'bg-amber-100 text-amber-800',
};

const emptyTopic = (): SpecialTopic => ({
  id: '',
  title: '',
  grade: 12,
  type: 'tot_nghiep',
  targetStudents: '',
  totalPeriods: 12,
  description: '',
  materialsUrl: '',
});

const emptySkkn = (year: string): SkknTopic => ({
  id: '',
  title: '',
  academicYear: year,
  evaluationLevel: 'Đang thực hiện',
  abstract: '',
  authorId: '',
  authorName: '',
  scope: 'Tổ chuyên môn',
  fileUrl: '',
  createdAt: '',
});

export const SpecialTopicsModule: React.FC = () => {
  const {
    activeMember,
    specialTopics,
    saveSpecialTopic,
    deleteSpecialTopic,
    skknTopics,
    saveSkknTopic,
    deleteSkknTopic,
    config,
    permissions,
  } = useApp();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<'topics' | 'skkn'>('topics');
  const [filterType, setFilterType] = useState<'all' | TopicType>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [topicDraft, setTopicDraft] = useState<SpecialTopic | null>(null);
  const [skknDraft, setSkknDraft] = useState<SkknTopic | null>(null);
  const [error, setError] = useState('');

  const kw = searchKeyword.trim().toLowerCase();
  const filteredTopics = specialTopics
    .filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (kw) return `${t.title} ${t.authorName || t.reporterName || ''} ${t.description || ''}`.toLowerCase().includes(kw);
      return true;
    })
    .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
  const filteredSkkn = skknTopics
    .filter(s => !kw || `${s.title} ${s.authorName} ${s.abstract}`.toLowerCase().includes(kw))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const canModify = (authorId?: string) => permissions.isLeader || (!!authorId && authorId === activeMember.id);

  const submitTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicDraft) return;
    if (!topicDraft.title.trim()) return setError('Vui lòng nhập tên chuyên đề.');
    if (topicDraft.materialsUrl && !safeUrl(topicDraft.materialsUrl)) return setError('Liên kết học liệu phải bắt đầu bằng http:// hoặc https://');
    setError('');
    const now = new Date().toISOString();
    const topic: SpecialTopic = {
      ...topicDraft,
      id: topicDraft.id || newId('topic'),
      title: topicDraft.title.trim(),
      authorId: topicDraft.authorId || activeMember.id,
      authorName: topicDraft.authorName || activeMember.displayName,
      totalPeriods: Number(topicDraft.totalPeriods) || 0,
      materialsUrl: safeUrl(topicDraft.materialsUrl) || undefined,
      createdAt: topicDraft.createdAt || now,
    };
    if (await saveSpecialTopic(topic)) setTopicDraft(null);
  };

  const submitSkkn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skknDraft) return;
    if (!skknDraft.title.trim()) return setError('Vui lòng nhập tên đề tài.');
    if (skknDraft.fileUrl && !safeUrl(skknDraft.fileUrl)) return setError('Liên kết toàn văn phải bắt đầu bằng http:// hoặc https://');
    setError('');
    const skkn: SkknTopic = {
      ...skknDraft,
      id: skknDraft.id || newId('skkn'),
      title: skknDraft.title.trim(),
      authorId: skknDraft.authorId || activeMember.id,
      authorName: skknDraft.authorName || activeMember.displayName,
      fileUrl: safeUrl(skknDraft.fileUrl) || undefined,
      createdAt: skknDraft.createdAt || new Date().toISOString(),
    };
    if (await saveSkknTopic(skkn)) setSkknDraft(null);
  };

  const removeTopic = async (t: SpecialTopic) => {
    if (await confirm({ title: 'Xóa chuyên đề?', message: `"${t.title}" sẽ bị xóa vĩnh viễn.`, confirmText: 'Xóa', danger: true })) {
      await deleteSpecialTopic(t.id);
    }
  };
  const removeSkkn = async (s: SkknTopic) => {
    if (await confirm({ title: 'Xóa đề tài SKKN?', message: `"${s.title}" sẽ bị xóa vĩnh viễn.`, confirmText: 'Xóa', danger: true })) {
      await deleteSkknTopic(s.id);
    }
  };

  const input = 'w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-normal';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            <span>Chuyên đề bồi dưỡng & Sáng kiến kinh nghiệm (SKKN)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Kế hoạch bồi dưỡng HSG, ôn thi Tốt nghiệp THPT, phụ đạo và đề tài nghiên cứu sư phạm</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          {([
            ['topics', `Chuyên đề (${specialTopics.length})`],
            ['skkn', `Đề tài SKKN (${skknTopics.length})`],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setActiveTab(k)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${activeTab === k ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="search"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="Tìm theo tên, tác giả..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              aria-label="Tìm kiếm"
            />
          </div>
          {activeTab === 'topics' &&
            (['all', 'hsg', 'tot_nghiep', 'phu_dao'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md ${filterType === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {t === 'all' ? 'Tất cả' : TYPE_LABEL[t]}
              </button>
            ))}
        </div>
        {permissions.canContribute && (
          <button
            onClick={() => {
              setError('');
              if (activeTab === 'topics') setTopicDraft(emptyTopic());
              else setSkknDraft(emptySkkn(config.academicYear));
            }}
            id="btn-add-special-topic"
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{activeTab === 'topics' ? 'Tạo chuyên đề mới' : 'Đăng ký đề tài SKKN'}</span>
          </button>
        )}
      </div>

      {activeTab === 'topics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTopics.length === 0 && <p className="text-xs text-slate-500 col-span-full text-center py-8">Chưa có chuyên đề phù hợp.</p>}
          {filteredTopics.map(topic => {
            const link = safeUrl(topic.materialsUrl);
            return (
              <div key={topic.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${topic.type ? TYPE_COLOR[topic.type] : 'bg-slate-100 text-slate-700'}`}>
                    {topic.type ? TYPE_LABEL[topic.type] : 'Chuyên đề tổ'}
                  </span>
                  {topic.totalPeriods ? <span className="text-xs text-slate-500 font-bold">{topic.totalPeriods} tiết</span> : null}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900">{topic.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-3">{topic.description || topic.materialsSummary}</p>
                </div>
                <div className="text-xs text-slate-600 border-t border-slate-100 pt-2 space-y-1">
                  {topic.grade && <div className="flex justify-between"><span>Khối:</span><span className="font-semibold text-slate-800">{topic.grade}</span></div>}
                  {topic.targetStudents && <div className="flex justify-between gap-2"><span>Đối tượng:</span><span className="font-semibold text-slate-800 text-right">{topic.targetStudents}</span></div>}
                  <div className="flex justify-between"><span>Phụ trách:</span><span className="font-semibold text-slate-800">{topic.authorName || topic.reporterName}</span></div>
                  {topic.results && <div className="flex justify-between gap-2"><span>Kết quả:</span><span className="font-semibold text-emerald-700 text-right">{topic.results}</span></div>}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs gap-2">
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 font-semibold text-blue-600 hover:bg-blue-50 rounded border border-blue-200 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Mở học liệu
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Chưa đính kèm liên kết học liệu</span>
                  )}
                  {canModify(topic.authorId) && (
                    <div className="flex gap-1">
                      <button onClick={() => { setError(''); setTopicDraft({ ...topic }); }} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" aria-label="Sửa chuyên đề"><Pencil className="w-3.5 h-3.5" /></button>
                      {permissions.isLeader && (
                        <button onClick={() => removeTopic(topic)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" aria-label="Xóa chuyên đề"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'skkn' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSkkn.length === 0 && <p className="text-xs text-slate-500 col-span-full text-center py-8">Chưa có đề tài SKKN.</p>}
          {filteredSkkn.map(skkn => {
            const link = safeUrl(skkn.fileUrl);
            return (
              <div key={skkn.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-800">Năm học {skkn.academicYear}</span>
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-800">{skkn.evaluationLevel}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">{skkn.title}</h3>
                {skkn.abstract && <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{skkn.abstract}</p>}
                <div className="text-xs text-slate-600 space-y-1">
                  <div><span className="text-slate-500">Tác giả: </span><strong className="text-slate-800">{skkn.authorName}</strong></div>
                  <div><span className="text-slate-500">Phạm vi áp dụng: </span><strong className="text-slate-800">{skkn.scope}</strong></div>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 border border-slate-200">
                      <ExternalLink className="w-3.5 h-3.5" /> Mở toàn văn
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Chưa có liên kết toàn văn</span>
                  )}
                  {canModify(skkn.authorId) && (
                    <div className="flex gap-1">
                      <button onClick={() => { setError(''); setSkknDraft({ ...skkn }); }} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" aria-label="Sửa đề tài"><Pencil className="w-3.5 h-3.5" /></button>
                      {permissions.isLeader && (
                        <button onClick={() => removeSkkn(skkn)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" aria-label="Xóa đề tài"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {topicDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={submitTopic} className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-3 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{topicDraft.id ? 'Sửa chuyên đề' : 'Tạo chuyên đề bồi dưỡng'}</h2>
              <button type="button" onClick={() => setTopicDraft(null)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <label className="block font-semibold text-slate-700">Tên chuyên đề *
              <input value={topicDraft.title} onChange={e => setTopicDraft({ ...topicDraft, title: e.target.value })} className={`${input} mt-1`} required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="font-semibold text-slate-700">Phân loại
                <select value={topicDraft.type} onChange={e => setTopicDraft({ ...topicDraft, type: e.target.value as TopicType })} className={`${input} mt-1`}>
                  {(Object.keys(TYPE_LABEL) as TopicType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="font-semibold text-slate-700">Khối
                <select value={topicDraft.grade} onChange={e => setTopicDraft({ ...topicDraft, grade: Number(e.target.value) as 10 | 11 | 12 })} className={`${input} mt-1`}>
                  <option value={10}>Khối 10</option><option value={11}>Khối 11</option><option value={12}>Khối 12</option>
                </select>
              </label>
              <label className="font-semibold text-slate-700">Đối tượng học sinh
                <input value={topicDraft.targetStudents || ''} onChange={e => setTopicDraft({ ...topicDraft, targetStudents: e.target.value })} className={`${input} mt-1`} />
              </label>
              <label className="font-semibold text-slate-700">Thời lượng (tiết)
                <input type="number" min={1} max={200} value={topicDraft.totalPeriods || ''} onChange={e => setTopicDraft({ ...topicDraft, totalPeriods: Number(e.target.value) })} className={`${input} mt-1`} />
              </label>
            </div>
            <label className="block font-semibold text-slate-700">Tóm tắt nội dung và mục tiêu
              <textarea rows={3} value={topicDraft.description || ''} onChange={e => setTopicDraft({ ...topicDraft, description: e.target.value })} className={`${input} mt-1 resize-y`} />
            </label>
            <label className="block font-semibold text-slate-700">Liên kết học liệu (Google Drive, OneDrive...)
              <input type="url" value={topicDraft.materialsUrl || ''} onChange={e => setTopicDraft({ ...topicDraft, materialsUrl: e.target.value })} className={`${input} mt-1`} placeholder="https://drive.google.com/..." />
            </label>
            <label className="block font-semibold text-slate-700">Kết quả đạt được (nếu có)
              <input value={topicDraft.results || ''} onChange={e => setTopicDraft({ ...topicDraft, results: e.target.value })} className={`${input} mt-1`} />
            </label>
            {error && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{error}</div>}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onClick={() => setTopicDraft(null)} className="px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="submit" className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Lưu chuyên đề</button>
            </div>
          </form>
        </div>
      )}

      {skknDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={submitSkkn} className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-3 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{skknDraft.id ? 'Sửa đề tài SKKN' : 'Đăng ký đề tài SKKN'}</h2>
              <button type="button" onClick={() => setSkknDraft(null)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <label className="block font-semibold text-slate-700">Tên đề tài *
              <textarea rows={2} value={skknDraft.title} onChange={e => setSkknDraft({ ...skknDraft, title: e.target.value })} className={`${input} mt-1 resize-y`} required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="font-semibold text-slate-700">Năm học
                <input value={skknDraft.academicYear} onChange={e => setSkknDraft({ ...skknDraft, academicYear: e.target.value })} className={`${input} mt-1`} />
              </label>
              <label className="font-semibold text-slate-700">Cấp đánh giá / Trạng thái
                <input list="skkn-levels" value={skknDraft.evaluationLevel} onChange={e => setSkknDraft({ ...skknDraft, evaluationLevel: e.target.value })} className={`${input} mt-1`} />
                <datalist id="skkn-levels">
                  <option value="Đang thực hiện" /><option value="Cấp Tổ" /><option value="Cấp Trường" /><option value="Cấp Ngành" /><option value="Cấp Tỉnh" />
                </datalist>
              </label>
            </div>
            <label className="block font-semibold text-slate-700">Phạm vi áp dụng
              <input value={skknDraft.scope} onChange={e => setSkknDraft({ ...skknDraft, scope: e.target.value })} className={`${input} mt-1`} />
            </label>
            <label className="block font-semibold text-slate-700">Tóm tắt
              <textarea rows={3} value={skknDraft.abstract} onChange={e => setSkknDraft({ ...skknDraft, abstract: e.target.value })} className={`${input} mt-1 resize-y`} />
            </label>
            <label className="block font-semibold text-slate-700">Liên kết toàn văn
              <input type="url" value={skknDraft.fileUrl || ''} onChange={e => setSkknDraft({ ...skknDraft, fileUrl: e.target.value })} className={`${input} mt-1`} placeholder="https://drive.google.com/..." />
            </label>
            {error && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{error}</div>}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onClick={() => setSkknDraft(null)} className="px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="submit" className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Lưu đề tài</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
