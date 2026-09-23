import React, { useMemo, useState } from 'react';
import { FileCheck2, Plus, Search, Pencil, Trash2, X, CheckCircle, XCircle, Eye, EyeOff, Printer, Shuffle, Globe, Lock, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Exam, ExamTemplateStructure, Question } from '../../types';
import { MathText } from '../../utils/katex-renderer';
import { useConfirm } from '../common/ConfirmDialog';
import { newId } from '../../utils/ids';

const TYPE_LABEL: Record<string, string> = {
  mcq: 'Trắc nghiệm 4 phương án',
  true_false: 'Đúng/Sai (4 ý)',
  short_answer: 'Trả lời ngắn',
  essay: 'Tự luận',
};
const DIFF_LABEL: Record<string, string> = { NB: 'Nhận biết', TH: 'Thông hiểu', VD: 'Vận dụng', VDC: 'Vận dụng cao' };
const LETTERS = ['A', 'B', 'C', 'D'];
const TF_LETTERS = ['a', 'b', 'c', 'd'];

/** Cấu trúc đề mặc định theo định dạng thi tốt nghiệp THPT từ năm 2025 */
const DEFAULT_TEMPLATE: ExamTemplateStructure = {
  id: 'tmpl-default-2025',
  name: 'Định dạng 2025: 12 TN + 4 Đúng/Sai + 6 Trả lời ngắn (90 phút)',
  durationMinutes: 90,
  totalQuestions: 22,
  totalScore: 10,
  mcqCount: 12,
  mcqPoints: 3,
  trueFalseCount: 4,
  trueFalsePoints: 4,
  shortAnswerCount: 6,
  shortAnswerPoints: 3,
};

const emptyQuestion = (grade: 10 | 11 | 12): Question => ({
  id: '',
  content: '',
  type: 'mcq',
  difficulty: 'NB',
  grade,
  topic: '',
  options: ['', '', '', ''],
  answer: 'A',
  solution: '',
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const QuestionBody: React.FC<{ q: Question; showAnswer: boolean; index?: number }> = ({ q, showAnswer, index }) => (
  <div className="space-y-1.5">
    <div className="flex gap-1">
      {index !== undefined && <strong className="shrink-0">Câu {index}.</strong>}
      <MathText as="div" content={q.content} className="flex-1" />
    </div>
    {q.type === 'mcq' && q.options && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pl-4">
        {q.options.map((o, i) => (
          <div key={i} className={`flex gap-1 ${showAnswer && q.answer === LETTERS[i] ? 'text-emerald-700 font-semibold' : ''}`}>
            <strong>{LETTERS[i]}.</strong> <MathText as="span" content={o} />
          </div>
        ))}
      </div>
    )}
    {q.type === 'true_false' && q.options && (
      <div className="space-y-1 pl-4">
        {q.options.map((o, i) => (
          <div key={i} className="flex gap-1">
            <strong>{TF_LETTERS[i]})</strong> <MathText as="span" content={o} />
            {showAnswer && <span className="ml-auto font-bold text-emerald-700">{(q.answer || '')[i] || '?'}</span>}
          </div>
        ))}
      </div>
    )}
    {showAnswer && q.type !== 'mcq' && q.type !== 'true_false' && (
      <div className="pl-4 text-emerald-700 font-semibold">Đáp án: <MathText as="span" content={q.answer || '—'} /></div>
    )}
    {showAnswer && q.solution && (
      <div className="pl-4 text-slate-600 text-[11px]">
        <em>Lời giải:</em> <MathText as="span" content={q.solution} />
      </div>
    )}
  </div>
);

export const ExamCreatorModule: React.FC = () => {
  const { questions, saveQuestion, deleteQuestion, exams, saveExam, deleteExam, config, activeMember, permissions, currentUser } = useApp();
  const confirm = useConfirm();

  const [tab, setTab] = useState<'bank' | 'exams'>('bank');
  // Bộ lọc ngân hàng
  const [fGrade, setFGrade] = useState<'all' | 10 | 11 | 12>('all');
  const [fType, setFType] = useState<string>('all');
  const [fDiff, setFDiff] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');
  const [kw, setKw] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);
  const [draft, setDraft] = useState<Question | null>(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');

  // Đề
  const [examDraft, setExamDraft] = useState<{ title: string; grade: 10 | 11 | 12; templateId: string } | null>(null);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [showKey, setShowKey] = useState(false);

  const templates = config.examTemplates && config.examTemplates.length ? config.examTemplates : [DEFAULT_TEMPLATE];
  const topicOptions = useMemo(() => {
    const set = new Set<string>();
    (config.curriculumTopics || []).forEach(t => (t.name || t.title) && set.add((t.name || t.title) as string));
    questions.forEach(q => q.topic && set.add(q.topic));
    return [...set].sort();
  }, [config.curriculumTopics, questions]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return questions
      .filter(q => fGrade === 'all' || q.grade === fGrade)
      .filter(q => fType === 'all' || q.type === fType)
      .filter(q => fDiff === 'all' || q.difficulty === fDiff)
      .filter(q => fStatus === 'all' || (q.status || 'approved') === fStatus)
      .filter(q => !k || `${q.content} ${q.topic || ''} ${q.authorName || ''}`.toLowerCase().includes(k));
  }, [questions, fGrade, fType, fDiff, fStatus, kw]);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    questions.forEach(q => (byType[q.type] = (byType[q.type] || 0) + 1));
    return byType;
  }, [questions]);

  // ---------- Câu hỏi ----------
  const openNew = () => {
    setError('');
    setPreview(false);
    setDraft(emptyQuestion(fGrade === 'all' ? 12 : fGrade));
  };

  const changeType = (type: string) => {
    if (!draft) return;
    const needsOptions = type === 'mcq' || type === 'true_false';
    setDraft({
      ...draft,
      type,
      options: needsOptions ? (draft.options && draft.options.length === 4 ? draft.options : ['', '', '', '']) : undefined,
      answer: type === 'mcq' ? 'A' : type === 'true_false' ? 'ĐĐĐĐ' : '',
    });
  };

  const saveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.content.trim()) return setError('Nhập nội dung câu hỏi.');
    if ((draft.type === 'mcq' || draft.type === 'true_false') && draft.options?.some(o => !o.trim())) {
      return setError('Nhập đủ 4 phương án / 4 mệnh đề.');
    }
    if (draft.type === 'mcq' && !LETTERS.includes(draft.answer || '')) return setError('Chọn đáp án đúng.');
    if (draft.type === 'true_false' && !/^[ĐS]{4}$/.test(draft.answer || '')) return setError('Chọn Đúng/Sai cho cả 4 ý.');
    if (draft.type === 'short_answer') {
      const a = (draft.answer || '').trim().replace(',', '.');
      if (!a) return setError('Nhập đáp án.');
      if (!/^-?\d+(\.\d+)?$/.test(a) || (draft.answer || '').trim().length > 4) {
        return setError('Đáp án trả lời ngắn phải là một số, tối đa 4 ký tự (kể cả dấu trừ và dấu phẩy) theo định dạng thi.');
      }
    }
    setError('');
    const now = new Date().toISOString();
    const isNew = !draft.id;
    const ok = await saveQuestion({
      ...draft,
      id: draft.id || newId('q'),
      content: draft.content.trim(),
      answer: (draft.answer || '').trim(),
      topic: (draft.topic || '').trim(),
      authorId: draft.authorId || activeMember.id,
      authorName: draft.authorName || activeMember.displayName,
      // Câu mới của giáo viên chờ tổ trưởng duyệt; tổ trưởng thêm thì duyệt luôn
      status: isNew ? (permissions.isLeader ? 'approved' : 'pending') : permissions.isLeader ? draft.status || 'approved' : 'pending',
      createdAt: draft.createdAt || now,
    });
    if (ok) setDraft(null);
  };

  const setStatus = (q: Question, status: 'approved' | 'rejected') => saveQuestion({ ...q, status });

  const removeQuestion = async (q: Question) => {
    const usedIn = exams.filter(e => e.questionIds?.includes(q.id)).length;
    if (
      await confirm({
        title: 'Xóa câu hỏi?',
        message: usedIn ? `Câu hỏi đang được dùng trong ${usedIn} đề. Đề đó sẽ thiếu câu này.` : 'Câu hỏi sẽ bị xóa khỏi ngân hàng.',
        confirmText: 'Xóa',
        danger: true,
      })
    ) {
      await deleteQuestion(q.id);
    }
  };

  // ---------- Đề ----------
  const pickQuestions = (grade: 10 | 11 | 12, tmpl: ExamTemplateStructure) => {
    const pool = questions.filter(q => q.grade === grade && (q.status || 'approved') === 'approved');
    const take = (type: string, n: number) => {
      // Sắp theo mức độ tăng dần sau khi trộn để đề đi từ dễ đến khó
      const order = ['NB', 'TH', 'VD', 'VDC'];
      return shuffle(pool.filter(q => q.type === type))
        .slice(0, n)
        .sort((a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty));
    };
    const mcq = take('mcq', tmpl.mcqCount);
    const tf = take('true_false', tmpl.trueFalseCount);
    const sa = take('short_answer', tmpl.shortAnswerCount);
    const missing: string[] = [];
    if (mcq.length < tmpl.mcqCount) missing.push(`thiếu ${tmpl.mcqCount - mcq.length} câu trắc nghiệm`);
    if (tf.length < tmpl.trueFalseCount) missing.push(`thiếu ${tmpl.trueFalseCount - tf.length} câu Đúng/Sai`);
    if (sa.length < tmpl.shortAnswerCount) missing.push(`thiếu ${tmpl.shortAnswerCount - sa.length} câu trả lời ngắn`);
    return { ids: [...mcq, ...tf, ...sa].map(q => q.id), missing };
  };

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examDraft) return;
    const tmpl = templates.find(t => t.id === examDraft.templateId) || templates[0];
    const { ids, missing } = pickQuestions(examDraft.grade, tmpl);
    if (ids.length === 0) {
      setError(`Ngân hàng chưa có câu hỏi đã duyệt nào của khối ${examDraft.grade}.`);
      return;
    }
    if (missing.length) {
      const ok = await confirm({
        title: 'Ngân hàng chưa đủ câu hỏi',
        message: `Khối ${examDraft.grade}: ${missing.join(', ')}. Vẫn tạo đề với ${ids.length} câu hiện có?`,
        confirmText: 'Vẫn tạo',
      });
      if (!ok) return;
    }
    const now = new Date().toISOString();
    const exam: Exam = {
      id: newId('exam'),
      title: examDraft.title.trim() || `Đề kiểm tra Toán ${examDraft.grade}`,
      status: 'draft',
      isPublished: false,
      grade: examDraft.grade,
      durationMinutes: tmpl.durationMinutes,
      templateName: tmpl.name,
      templateId: tmpl.id,
      questionIds: ids,
      authorId: activeMember.id,
      authorName: activeMember.displayName,
      authorUid: currentUser?.uid,
      academicYear: config.academicYear,
      createdAt: now,
    };
    if (await saveExam(exam)) {
      setExamDraft(null);
      setError('');
      setSelectedExamId(exam.id);
    }
  };

  const selectedExam = exams.find(x => x.id === selectedExamId) || exams[0];
  const examQuestions = (selectedExam?.questionIds || []).map(id => questions.find(q => q.id === id)).filter(Boolean) as Question[];
  const canManageExam = (x?: Exam) => !!x && (permissions.isLeader || x.authorId === activeMember.id);

  const reshuffle = async () => {
    if (!selectedExam) return;
    const tmpl = templates.find(t => t.id === selectedExam.templateId) || templates[0];
    const { ids } = pickQuestions((selectedExam.grade || 12) as 10 | 11 | 12, tmpl);
    await saveExam({ ...selectedExam, questionIds: ids });
  };

  const removeFromExam = async (qid: string) => {
    if (!selectedExam) return;
    await saveExam({ ...selectedExam, questionIds: (selectedExam.questionIds || []).filter(id => id !== qid) });
  };

  const sections = [
    { type: 'mcq', title: 'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn', note: 'Thí sinh trả lời từ câu 1 đến câu {n}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.' },
    { type: 'true_false', title: 'PHẦN II. Câu trắc nghiệm đúng sai', note: 'Thí sinh trả lời từ câu 1 đến câu {n}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.' },
    { type: 'short_answer', title: 'PHẦN III. Câu trắc nghiệm trả lời ngắn', note: 'Thí sinh trả lời từ câu 1 đến câu {n}.' },
    { type: 'essay', title: 'PHẦN IV. Tự luận', note: '' },
  ];

  const input = 'w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-normal text-xs';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-600" /> Ngân hàng câu hỏi & Đề kiểm tra
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {questions.length} câu hỏi ({stats.mcq || 0} TN, {stats.true_false || 0} Đ/S, {stats.short_answer || 0} TL ngắn) • {exams.length} đề
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          {([
            ['bank', 'Ngân hàng câu hỏi'],
            ['exams', 'Đề kiểm tra'],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${tab === k ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'bank' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-xs">
            <div className="relative flex-1 min-w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input type="search" value={kw} onChange={e => setKw(e.target.value)} placeholder="Tìm nội dung, chủ đề, tác giả..." className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg" aria-label="Tìm câu hỏi" />
            </div>
            <select value={String(fGrade)} onChange={e => setFGrade(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 10 | 11 | 12))} className="px-2 py-2 border border-slate-300 rounded-lg bg-white" aria-label="Khối">
              <option value="all">Mọi khối</option><option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option>
            </select>
            <select value={fType} onChange={e => setFType(e.target.value)} className="px-2 py-2 border border-slate-300 rounded-lg bg-white" aria-label="Dạng câu">
              <option value="all">Mọi dạng</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={fDiff} onChange={e => setFDiff(e.target.value)} className="px-2 py-2 border border-slate-300 rounded-lg bg-white" aria-label="Mức độ">
              <option value="all">Mọi mức độ</option>
              {Object.entries(DIFF_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="px-2 py-2 border border-slate-300 rounded-lg bg-white" aria-label="Trạng thái">
              <option value="all">Mọi trạng thái</option><option value="approved">Đã duyệt</option><option value="pending">Chờ duyệt</option><option value="rejected">Không duyệt</option>
            </select>
            <button onClick={() => setShowAnswers(v => !v)} className="px-2.5 py-2 border border-slate-300 rounded-lg flex items-center gap-1 hover:bg-slate-50">
              {showAnswers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
            </button>
            {permissions.canContribute && (
              <button onClick={openNew} className="px-3 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Thêm câu hỏi
              </button>
            )}
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">Không có câu hỏi phù hợp.</div>}
            {filtered.map(q => {
              const st = q.status || 'approved';
              const canEdit = permissions.isLeader || (q.authorId === activeMember.id && st !== 'approved');
              return (
                <div key={q.id} className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">Khối {q.grade}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">{TYPE_LABEL[q.type] || q.type}</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px]">{DIFF_LABEL[q.difficulty] || q.difficulty}</span>
                    {q.topic && <span className="text-[10px] text-slate-500">{q.topic}</span>}
                    <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold ${st === 'approved' ? 'bg-emerald-100 text-emerald-800' : st === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                      {st === 'approved' ? 'Đã duyệt' : st === 'pending' ? 'Chờ duyệt' : 'Không duyệt'}
                    </span>
                  </div>
                  <QuestionBody q={q} showAnswer={showAnswers} />
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <span>{q.authorName || '—'}</span>
                    <div className="flex items-center gap-1">
                      {permissions.isLeader && st !== 'approved' && (
                        <button onClick={() => setStatus(q, 'approved')} className="px-2 py-1 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Duyệt</button>
                      )}
                      {permissions.isLeader && st === 'pending' && (
                        <button onClick={() => setStatus(q, 'rejected')} className="px-2 py-1 text-rose-700 border border-rose-200 rounded hover:bg-rose-50 flex items-center gap-1"><XCircle className="w-3 h-3" /> Không duyệt</button>
                      )}
                      {canEdit && (
                        <button onClick={() => { setError(''); setPreview(false); setDraft({ ...q, options: q.options ? [...q.options] : q.options }); }} className="p-1.5 hover:bg-slate-100 rounded" aria-label="Sửa câu hỏi"><Pencil className="w-3.5 h-3.5" /></button>
                      )}
                      {permissions.isLeader && (
                        <button onClick={() => removeQuestion(q)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" aria-label="Xóa câu hỏi"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'exams' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3 print:hidden">
            {permissions.canContribute && (
              <button
                onClick={() => { setError(''); setExamDraft({ title: '', grade: 12, templateId: templates[0].id }); }}
                className="w-full px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Tạo đề từ ngân hàng
              </button>
            )}
            {exams.length === 0 && <div className="p-4 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">Chưa có đề kiểm tra.</div>}
            {[...exams].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).map(x => (
              <button
                key={x.id}
                onClick={() => setSelectedExamId(x.id)}
                className={`w-full text-left p-3 rounded-xl border text-xs ${x.id === selectedExam?.id ? 'bg-blue-50/70 border-blue-400' : 'bg-white border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 line-clamp-1">{x.title}</span>
                  {x.isPublished ? <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Khối {x.grade} • {(x.questionIds || []).length} câu • {x.durationMinutes} phút • {x.authorName}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 print:col-span-12">
            {selectedExam ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 text-sm print:border-none print:shadow-none print:p-0">
                <div className="flex flex-wrap items-center justify-end gap-2 print:hidden text-xs">
                  <button onClick={() => setShowKey(v => !v)} className="px-2.5 py-1.5 border border-slate-200 rounded-lg flex items-center gap-1 hover:bg-slate-50">
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {showKey ? 'Ẩn đáp án' : 'Xem đáp án'}
                  </button>
                  <button onClick={() => window.print()} className="px-2.5 py-1.5 border border-slate-200 rounded-lg flex items-center gap-1 hover:bg-slate-50">
                    <Printer className="w-3.5 h-3.5" /> In đề
                  </button>
                  {canManageExam(selectedExam) && !selectedExam.isPublished && (
                    <button onClick={reshuffle} className="px-2.5 py-1.5 border border-slate-200 rounded-lg flex items-center gap-1 hover:bg-slate-50">
                      <Shuffle className="w-3.5 h-3.5" /> Chọn lại câu hỏi
                    </button>
                  )}
                  {permissions.isLeader && (
                    <button
                      onClick={() => saveExam({ ...selectedExam, isPublished: !selectedExam.isPublished, status: selectedExam.isPublished ? 'draft' : 'published' })}
                      className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold ${selectedExam.isPublished ? 'bg-amber-100 text-amber-800' : 'bg-emerald-600 text-white'}`}
                    >
                      {selectedExam.isPublished ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                      {selectedExam.isPublished ? 'Thu hồi công bố' : 'Công bố cho cả tổ'}
                    </button>
                  )}
                  {canManageExam(selectedExam) && (
                    <button
                      onClick={async () => {
                        if (await confirm({ title: 'Xóa đề?', message: `"${selectedExam.title}" sẽ bị xóa.`, confirmText: 'Xóa', danger: true })) {
                          await deleteExam(selectedExam.id);
                          setSelectedExamId('');
                        }
                      }}
                      className="p-1.5 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50"
                      aria-label="Xóa đề"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 text-center text-xs border-b border-slate-300 pb-3">
                  <div>
                    <div className="font-semibold uppercase">{config.schoolName}</div>
                    <div className="font-bold uppercase">{config.departmentName}</div>
                    <div className="italic mt-1">(Đề gồm {examQuestions.length} câu)</div>
                  </div>
                  <div>
                    <div className="font-bold uppercase">{selectedExam.title}</div>
                    <div>Năm học {String(selectedExam.academicYear || config.academicYear)}</div>
                    <div>Môn: TOÁN – Khối {selectedExam.grade}</div>
                    <div className="italic">Thời gian làm bài: {selectedExam.durationMinutes} phút</div>
                  </div>
                </div>

                {examQuestions.length < (selectedExam.questionIds || []).length && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center gap-1.5 print:hidden">
                    <AlertTriangle className="w-3.5 h-3.5" /> {(selectedExam.questionIds || []).length - examQuestions.length} câu trong đề đã bị xóa khỏi ngân hàng.
                  </div>
                )}

                {sections.map(sec => {
                  const qs = examQuestions.filter(q => q.type === sec.type);
                  if (!qs.length) return null;
                  return (
                    <div key={sec.type} className="space-y-3">
                      <div>
                        <div className="font-bold">{sec.title}</div>
                        {sec.note && <div className="text-xs italic">{sec.note.replace('{n}', String(qs.length))}</div>}
                      </div>
                      {qs.map((q, i) => (
                        <div key={q.id} className="group relative text-sm">
                          <QuestionBody q={q} showAnswer={showKey} index={i + 1} />
                          {canManageExam(selectedExam) && !selectedExam.isPublished && (
                            <button onClick={() => removeFromExam(q.id)} className="absolute top-0 right-0 p-1 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 print:hidden" aria-label="Bỏ câu khỏi đề">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div className="text-center text-xs font-bold pt-4">------------- HẾT -------------</div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">Chọn hoặc tạo một đề kiểm tra.</div>
            )}
          </div>
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
          <form onSubmit={saveDraft} className="bg-white rounded-2xl max-w-3xl w-full p-5 shadow-2xl border border-slate-200 max-h-[94vh] overflow-y-auto space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{draft.id ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPreview(v => !v)} className="px-2.5 py-1 border border-slate-200 rounded-lg flex items-center gap-1 hover:bg-slate-50">
                  <Eye className="w-3.5 h-3.5" /> {preview ? 'Soạn thảo' : 'Xem trước'}
                </button>
                <button type="button" onClick={() => setDraft(null)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng"><X className="w-5 h-5" /></button>
              </div>
            </div>
            {preview ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                <QuestionBody q={draft} showAnswer />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label className="font-semibold text-slate-700">Khối
                    <select value={draft.grade} onChange={e => setDraft({ ...draft, grade: Number(e.target.value) as 10 | 11 | 12 })} className={`${input} mt-1`}>
                      <option value={10}>10</option><option value={11}>11</option><option value={12}>12</option>
                    </select>
                  </label>
                  <label className="font-semibold text-slate-700">Dạng câu
                    <select value={draft.type} onChange={e => changeType(e.target.value)} className={`${input} mt-1`}>
                      {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <label className="font-semibold text-slate-700">Mức độ
                    <select value={draft.difficulty} onChange={e => setDraft({ ...draft, difficulty: e.target.value })} className={`${input} mt-1`}>
                      {Object.entries(DIFF_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <label className="font-semibold text-slate-700">Chủ đề
                    <input list="question-topics" value={draft.topic || ''} onChange={e => setDraft({ ...draft, topic: e.target.value })} className={`${input} mt-1`} />
                    <datalist id="question-topics">{topicOptions.map(t => <option key={t} value={t} />)}</datalist>
                  </label>
                </div>
                <label className="block font-semibold text-slate-700">Nội dung câu hỏi * <span className="font-normal text-slate-500">(công thức đặt trong $...$)</span>
                  <textarea rows={3} value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} className={`${input} mt-1 font-mono resize-y`} required />
                </label>
                {(draft.type === 'mcq' || draft.type === 'true_false') && (
                  <div className="space-y-2">
                    {(draft.options || ['', '', '', '']).map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <strong className="w-5">{draft.type === 'mcq' ? `${LETTERS[i]}.` : `${TF_LETTERS[i]})`}</strong>
                        <input
                          value={o}
                          onChange={e => setDraft({ ...draft, options: (draft.options || ['', '', '', '']).map((x, j) => (j === i ? e.target.value : x)) })}
                          className={`${input} font-mono`}
                          aria-label={`Phương án ${i + 1}`}
                        />
                        {draft.type === 'mcq' ? (
                          <label className="flex items-center gap-1 shrink-0">
                            <input type="radio" name="mcq-answer" checked={draft.answer === LETTERS[i]} onChange={() => setDraft({ ...draft, answer: LETTERS[i] })} /> Đúng
                          </label>
                        ) : (
                          <select
                            value={(draft.answer || 'ĐĐĐĐ')[i] || 'Đ'}
                            onChange={e => {
                              const arr = (draft.answer || 'ĐĐĐĐ').padEnd(4, 'Đ').split('');
                              arr[i] = e.target.value;
                              setDraft({ ...draft, answer: arr.join('') });
                            }}
                            className="px-2 py-2 border border-slate-300 rounded-lg bg-white shrink-0"
                            aria-label={`Ý ${TF_LETTERS[i]} đúng hay sai`}
                          >
                            <option value="Đ">Đúng</option>
                            <option value="S">Sai</option>
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(draft.type === 'short_answer' || draft.type === 'essay') && (
                  <label className="block font-semibold text-slate-700">Đáp án *
                    <input value={draft.answer || ''} onChange={e => setDraft({ ...draft, answer: e.target.value })} className={`${input} mt-1 font-mono`} placeholder={draft.type === 'short_answer' ? 'VD: 1800 hoặc -0,5' : ''} />
                  </label>
                )}
                <label className="block font-semibold text-slate-700">Lời giải / Hướng dẫn chấm
                  <textarea rows={3} value={draft.solution || ''} onChange={e => setDraft({ ...draft, solution: e.target.value })} className={`${input} mt-1 font-mono resize-y`} />
                </label>
              </>
            )}
            {!permissions.isLeader && <p className="text-[11px] text-amber-700">Câu hỏi của bạn sẽ ở trạng thái "Chờ duyệt" cho đến khi Tổ trưởng/Tổ phó duyệt.</p>}
            {error && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{error}</div>}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setDraft(null)} className="px-3.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="submit" className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Lưu câu hỏi</button>
            </div>
          </form>
        </div>
      )}

      {examDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={createExam} className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Tạo đề từ ngân hàng câu hỏi</h3>
              <button type="button" onClick={() => setExamDraft(null)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <label className="block font-semibold text-slate-700">Tên đề
              <input value={examDraft.title} onChange={e => setExamDraft({ ...examDraft, title: e.target.value })} className={`${input} mt-1`} placeholder="VD: Kiểm tra giữa kỳ I – Toán 12" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="font-semibold text-slate-700">Khối
                <select value={examDraft.grade} onChange={e => setExamDraft({ ...examDraft, grade: Number(e.target.value) as 10 | 11 | 12 })} className={`${input} mt-1`}>
                  <option value={10}>10</option><option value={11}>11</option><option value={12}>12</option>
                </select>
              </label>
              <label className="font-semibold text-slate-700">Cấu trúc đề
                <select value={examDraft.templateId} onChange={e => setExamDraft({ ...examDraft, templateId: e.target.value })} className={`${input} mt-1`}>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Hệ thống chọn ngẫu nhiên các câu <strong>đã duyệt</strong> của khối đã chọn theo số lượng từng phần, sắp xếp từ dễ đến khó. Có thể "Chọn lại câu hỏi" hoặc bỏ từng câu sau khi tạo.
            </p>
            {error && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{error}</div>}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setExamDraft(null)} className="px-3.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="submit" className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Tạo đề</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
