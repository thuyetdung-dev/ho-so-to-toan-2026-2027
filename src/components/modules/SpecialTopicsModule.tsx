import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SpecialTopic, SkknTopic } from '../../types';
import {
  GraduationCap,
  Plus,
  Search,
  BookOpen,
  Award,
  Download,
  ExternalLink,
  FileText,
  Filter,
} from 'lucide-react';

export const SpecialTopicsModule: React.FC = () => {
  const {
    activeMember,
    specialTopics,
    saveSpecialTopic,
    skknTopics,
    saveSkknTopic,
    allMembers,
    setNotification,
  } = useApp();

  const isLeader = activeMember.role === 'head' || activeMember.role === 'deputy' || activeMember.role === 'admin';

  const [activeTab, setActiveTab] = useState<'topics' | 'skkn'>('topics');
  const [filterType, setFilterType] = useState<'all' | 'hsg' | 'tot_nghiep' | 'phu_dao'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGrade, setNewGrade] = useState<10 | 11 | 12>(12);
  const [newType, setNewType] = useState<'hsg' | 'tot_nghiep' | 'phu_dao'>('tot_nghiep');
  const [newTarget, setNewTarget] = useState('Học sinh lớp 12');
  const [newPeriods, setNewPeriods] = useState(15);
  const [newDescription, setNewDescription] = useState('');

  const filteredTopics = specialTopics.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      return t.title.toLowerCase().includes(kw) || (t.authorName || t.reporterName || '').toLowerCase().includes(kw);
    }
    return true;
  });

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const topic: SpecialTopic = {
      id: `topic-${Date.now()}`,
      title: newTitle.trim(),
      grade: newGrade,
      type: newType,
      authorId: activeMember.id,
      authorName: activeMember.displayName,
      targetStudents: newTarget,
      totalPeriods: Number(newPeriods),
      description: newDescription,
      attachmentsCount: 1,
      createdAt: new Date().toISOString(),
    };

    await saveSpecialTopic(topic);
    setShowAddModal(false);
    setNewTitle('');
    setNotification({ message: 'Đã thêm chuyên đề bồi dưỡng thành công', type: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            <span>Chuyên đề bồi dưỡng & Sáng kiến kinh nghiệm (SKKN)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý kế hoạch bồi dưỡng HSG, ôn thi Tốt nghiệp THPT 2025, phụ đạo và đề tài nghiên cứu sư phạm
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('topics')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'topics' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chuyên đề bồi dưỡng ({specialTopics.length})
          </button>
          <button
            onClick={() => setActiveTab('skkn')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'skkn' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đề tài SKKN ({skknTopics.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Special Topics */}
      {activeTab === 'topics' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Phân loại:</span>
              {(['all', 'hsg', 'tot_nghiep', 'phu_dao'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                    filterType === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t === 'all' && 'Tất cả'}
                  {t === 'hsg' && 'Bồi dưỡng HSG'}
                  {t === 'tot_nghiep' && 'Ôn Tốt nghiệp 2025'}
                  {t === 'phu_dao' && 'Phụ đạo học sinh'}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              id="btn-add-special-topic"
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo chuyên đề mới</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTopics.map(topic => (
              <div key={topic.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      topic.type === 'hsg'
                        ? 'bg-purple-100 text-purple-800'
                        : topic.type === 'tot_nghiep'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {topic.type === 'hsg' && 'Bồi dưỡng HSG'}
                    {topic.type === 'tot_nghiep' && 'Ôn Tốt nghiệp 2025'}
                    {topic.type === 'phu_dao' && 'Phụ đạo học sinh'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">{topic.totalPeriods} tiết</span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2">{topic.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{topic.description}</p>
                </div>

                <div className="text-xs text-slate-600 border-t border-slate-100 pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Đối tượng:</span>
                    <span className="font-semibold text-slate-800">{topic.targetStudents}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phụ trách:</span>
                    <span className="font-semibold text-slate-800">{topic.authorName}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">Tài liệu: {topic.attachmentsCount} file</span>
                  <button
                    onClick={() =>
                      setNotification({ message: 'Đã tải bộ tài liệu và phiếu bài tập chuyên đề', type: 'info' })
                    }
                    className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded border border-blue-200 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Tải học liệu</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: SKKN Topics */}
      {activeTab === 'skkn' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skknTopics.map(skkn => (
              <div key={skkn.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-800">
                    Năm học {skkn.academicYear}
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-800">
                    {skkn.evaluationLevel}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug">{skkn.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {skkn.abstract}
                </p>

                <div className="text-xs text-slate-600 space-y-1">
                  <div>
                    <span className="text-slate-500">Tác giả: </span>
                    <strong className="text-slate-800">{skkn.authorName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Phạm vi áp dụng: </span>
                    <strong className="text-slate-800">{skkn.scope}</strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() =>
                      setNotification({ message: 'Đã tải toàn văn báo cáo Sáng kiến kinh nghiệm', type: 'info' })
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 border border-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải toàn văn SKKN</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create Special Topic */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-3">Tạo chuyên đề bồi dưỡng mới</h2>
            <form onSubmit={handleCreateTopic} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên chuyên đề</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Kỹ thuật giải nhanh bài toán hình học Oxyz bằng vectơ..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phân loại</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="tot_nghiep">Ôn Tốt nghiệp THPT 2025</option>
                    <option value="hsg">Bồi dưỡng HSG</option>
                    <option value="phu_dao">Phụ đạo học sinh</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khối</label>
                  <select
                    value={newGrade}
                    onChange={e => setNewGrade(Number(e.target.value) as any)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={10}>Khối 10</option>
                    <option value={11}>Khối 11</option>
                    <option value={12}>Khối 12</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đối tượng học sinh</label>
                  <input
                    type="text"
                    value={newTarget}
                    onChange={e => setNewTarget(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thời lượng (tiết)</label>
                  <input
                    type="number"
                    value={newPeriods}
                    onChange={e => setNewPeriods(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tóm tắt nội dung và mục tiêu</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Mục tiêu kiến thức, năng lực đạt được..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Lưu chuyên đề
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
