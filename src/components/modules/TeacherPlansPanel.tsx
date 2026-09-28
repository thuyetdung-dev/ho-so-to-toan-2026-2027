import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useConfirm } from '../common/ConfirmDialog';
import { newId } from '../../utils/ids';
import { importTeacherPlanFile } from '../../utils/teacherPlanImport';
import { departmentHead } from '../../utils/leaders';
import {
  DEFAULT_HK1_WEEKS,
  emptyAssessmentLine,
  emptyCoreLine,
  emptyExperienceLine,
  emptySection,
  emptyTopicLine,
  linePeriods,
  withSections,
  workload,
} from '../../utils/teacherPlanSections';
import type { TeacherPlan, TeacherPlanSection } from '../../types';
import {
  Plus,
  Edit3,
  Send,
  Check,
  RotateCcw,
  Trash2,
  X,
  FileCheck,
  Printer,
  Upload,
  Loader2,
  AlertTriangle,
  MessageSquare,
  User as UserIcon,
  Layers,
} from 'lucide-react';

const STATUS_BADGE: Record<TeacherPlan['status'], { label: string; cls: string }> = {
  draft: { label: 'Bản nháp', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  submitted: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: '✓ Đã duyệt', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  returned: { label: 'Trả lại để điều chỉnh', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
};

const GRADES = [10, 11, 12] as const;

/** Khai báo cột cho bảng dùng chung: chỉ khác nhau ở tiêu đề và bề rộng */
interface Col {
  key: string;
  label: string;
  width?: string;
  /** Ô nhập nhiều dòng cho các cột nội dung dài */
  area?: boolean;
  numeric?: boolean;
}

const CORE_COLS: Col[] = [
  { key: 'week', label: 'Tuần', width: 'w-24' },
  { key: 'periods', label: 'Tiết PPCT', width: 'w-20' },
  { key: 'content', label: 'Nội dung dạy học', width: 'min-w-56', area: true },
  { key: 'requirements', label: 'Yêu cầu cần đạt trọng tâm', width: 'min-w-64', area: true },
  { key: 'digitalAi', label: 'Thiết bị và định hướng năng lực số, AI', width: 'min-w-56', area: true },
];

const TOPIC_COLS: Col[] = [
  { key: 'week', label: 'Tuần', width: 'w-24' },
  { key: 'periods', label: 'Tiết', width: 'w-20' },
  { key: 'content', label: 'Nội dung chuyên đề', width: 'min-w-56', area: true },
  { key: 'requirements', label: 'Yêu cầu cần đạt và sản phẩm gợi ý', width: 'min-w-64', area: true },
];

const EXPERIENCE_COLS: Col[] = [
  { key: 'week', label: 'Tuần', width: 'w-24' },
  { key: 'periods', label: 'TT tiết', width: 'w-20' },
  { key: 'content', label: 'Chủ đề / Bài học', width: 'min-w-56', area: true },
  { key: 'requirements', label: 'Yêu cầu cần đạt', width: 'min-w-56', area: true },
  { key: 'digitalAi', label: 'Tích hợp năng lực số, giáo dục AI', width: 'min-w-48', area: true },
  { key: 'venue', label: 'Quy mô / Địa điểm', width: 'w-36', area: true },
];

const ASSESSMENT_COLS: Col[] = [
  { key: 'name', label: 'Bài kiểm tra, đánh giá', width: 'w-40' },
  { key: 'duration', label: 'Thời gian (1)', width: 'w-24' },
  { key: 'timing', label: 'Thời điểm (2)', width: 'w-28' },
  { key: 'requirements', label: 'Yêu cầu cần đạt (3)', width: 'min-w-64', area: true },
  { key: 'form', label: 'Hình thức (4)', width: 'w-32' },
];

type AnyLine = { id: string; order: number };

/** Đọc một ô của dòng theo tên cột, không phụ thuộc kiểu cụ thể của từng bảng */
const cell = (row: AnyLine, key: string) => String((row as unknown as Record<string, unknown>)[key] ?? '');

/** Danh sách nhiều dòng văn bản: hiển thị thành gạch đầu dòng */
const Bullets: React.FC<{ text?: string }> = ({ text }) => {
  const items = (text || '')
    .split('\n')
    .map(l => l.replace(/^\s*[-–•*]\s*/, '').trim())
    .filter(Boolean);
  if (!items.length) return <p className="text-xs italic text-slate-400">Chưa nhập</p>;
  return (
    <ul className="list-disc pl-5 space-y-0.5 text-xs text-slate-700">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
};

/** Bảng chỉ đọc dùng chung cho mọi bảng của kế hoạch */
const ReadTable: React.FC<{ cols: Col[]; rows: AnyLine[]; sttLabel?: string }> = ({ cols, rows, sttLabel = 'STT' }) => (
  <div className="overflow-x-auto border border-slate-200 rounded-lg">
    <table className="w-full text-left text-[11px]">
      <thead className="bg-slate-100 text-slate-700 font-semibold">
        <tr>
          <th className="p-2 w-10">{sttLabel}</th>
          {cols.map(c => (
            <th key={c.key} className={`p-2 ${c.width || ''}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {rows.map((r, i) => (
          <tr key={r.id} className="align-top">
            <td className="p-2 text-slate-500">{i + 1}</td>
            {cols.map(c => (
              <td key={c.key} className="p-2 text-slate-700 whitespace-pre-wrap">
                {cell(r, c.key)}
              </td>
            ))}
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={cols.length + 1} className="p-3 text-center text-slate-400 italic">
              Chưa có dòng nào
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

/**
 * Kế hoạch giảng dạy của giáo viên – theo đúng cấu trúc bản Word tổ Toán đang dùng:
 *   1. Thông tin cá nhân
 *   2. Kế hoạch dạy học: mỗi khối là một phần gồm I. Căn cứ · II. Phân phối cốt lõi ·
 *      III. Chuyên đề lựa chọn · IV. Tổng hợp thời lượng · Kiểm tra đánh giá · V. Tổ chức thực hiện
 */
export const TeacherPlansPanel: React.FC = () => {
  const {
    teacherPlans,
    saveTeacherPlan,
    deleteTeacherPlan,
    allMembers,
    activeMember,
    config,
    permissions,
    isMe,
    setNotification,
  } = useApp();
  const confirm = useConfirm();
  const head = departmentHead(allMembers);

  const isLeader = permissions.isLeader;
  const [gradeFilter, setGradeFilter] = useState<'all' | 10 | 11 | 12>('all');
  const [onlyMine, setOnlyMine] = useState(!isLeader);
  const [editing, setEditing] = useState<{ plan: TeacherPlan; isNew: boolean } | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [reviewing, setReviewing] = useState<{ plan: TeacherPlan; action: 'approve' | 'return' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [importing, setImporting] = useState(false);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectableTeachers = useMemo(
    () => (isLeader ? allMembers.filter(m => m.role !== 'principal') : allMembers.filter(m => isMe(m.id))),
    [isLeader, allMembers, isMe],
  );

  const visiblePlans = useMemo(
    () =>
      teacherPlans
        .filter(p => p.academicYear === config.academicYear)
        .filter(p => (gradeFilter === 'all' ? true : p.grade === gradeFilter))
        .filter(p => (onlyMine ? isMe(p.teacherId) : true))
        .sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'vi') || a.grade - b.grade),
    [teacherPlans, config.academicYear, gradeFilter, onlyMine, isMe],
  );

  const canEdit = (p: TeacherPlan) => isLeader || (isMe(p.teacherId) && (p.status === 'draft' || p.status === 'returned'));
  const canSubmit = (p: TeacherPlan) => isMe(p.teacherId) && (p.status === 'draft' || p.status === 'returned');
  const canReview = (p: TeacherPlan) => isLeader && p.status === 'submitted';

  const closeEditor = () => {
    setEditing(null);
    setImportNotes([]);
    setActiveSection(0);
  };

  const blankPlan = (grade: 10 | 11 | 12, owner: { id: string; displayName: string }): TeacherPlan => ({
    id: newId('tplan'),
    teacherId: owner.id,
    teacherName: owner.displayName,
    grade,
    academicYear: config.academicYear,
    title: `Kế hoạch giảng dạy – ${owner.displayName} – Năm học ${config.academicYear}`,
    status: 'draft',
    version: 1,
    subject: 'Toán',
    className: '',
    otherTasks: '',
    sections: [emptySection(1, 'core', grade)],
    comments: [],
    updatedAt: new Date().toISOString(),
  });

  const ownerOrWarn = () => {
    const owner = selectableTeachers.find(m => isMe(m.id)) || selectableTeachers[0];
    if (!owner) {
      setNotification({ message: 'Chưa có hồ sơ giáo viên nào để lập kế hoạch. Vào mục Thành viên & Phân công để thêm.', type: 'error' });
      return null;
    }
    return owner;
  };

  const openNew = () => {
    const owner = ownerOrWarn();
    if (!owner) return;
    setImportNotes([]);
    setActiveSection(0);
    setEditing({ isNew: true, plan: blankPlan(gradeFilter === 'all' ? 10 : gradeFilter, owner) });
  };

  const openEdit = (p: TeacherPlan) => {
    const migrated = withSections(p);
    const changed = !p.sections?.length && !!migrated.sections?.length;
    setImportNotes(
      changed
        ? ['Kế hoạch này lập bằng bản cũ. Phần mềm đã chuyển nội dung sang cấu trúc mới: thiết bị và địa điểm của bản cũ được gộp vào cột "Thiết bị và định hướng năng lực số, AI". Thầy/cô xem lại rồi bấm Lưu.']
        : [],
    );
    setActiveSection(0);
    setEditing({ isNew: false, plan: migrated });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setNotification({ message: 'Tệp lớn hơn 25 MB, hãy tách nhỏ hoặc lưu lại gọn hơn.', type: 'error' });
      return;
    }
    const owner = ownerOrWarn();
    if (!owner) return;

    setImporting(true);
    try {
      const grade = gradeFilter === 'all' ? 10 : gradeFilter;
      const r = await importTeacherPlanFile(file, { grade, weeksCount: config.weeksCount || 35 });
      const notes = [...r.notes];
      if (!r.recognized) {
        notes.unshift('Không đọc được bảng phân phối chương trình nào trong tệp. Thầy/cô nhập tay hoặc kiểm tra lại định dạng bảng.');
      }
      const base = blankPlan(r.grade || grade, owner);
      const section = emptySection(1, 'core', r.grade || grade);
      section.coreLines = r.distribution.map((l, i) => ({
        id: newId('cl'),
        order: i + 1,
        week: l.timing || '',
        periods: '',
        periodCount: Number(l.periods) || 0,
        content: l.lesson || '',
        requirements: '',
        digitalAi: [l.equipment, l.location].filter(Boolean).join(' · '),
      }));
      section.topicLines = r.specialTopics.map((l, i) => ({
        id: newId('tl'),
        order: i + 1,
        week: l.timing || '',
        periods: '',
        periodCount: Number(l.periods) || 0,
        content: l.lesson || '',
        requirements: '',
      }));
      setImportNotes(notes);
      setActiveSection(0);
      setEditing({
        isNew: true,
        plan: {
          ...base,
          title: r.title?.slice(0, 200) || base.title,
          subject: r.subject || base.subject,
          className: r.className || '',
          otherTasks: r.otherTasks,
          sections: [section],
        },
      });
      setNotification({ message: `Đã đọc tệp ${r.source}. Kiểm tra lại nội dung rồi bấm Lưu.`, type: 'info' });
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Không đọc được tệp này.', type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const p = editing.plan;
    if (!p.title.trim()) {
      setNotification({ message: 'Kế hoạch phải có tiêu đề.', type: 'error' });
      return;
    }
    const sections = (p.sections || []).map((s, si) => ({
      ...s,
      order: si + 1,
      coreLines: (s.coreLines || []).filter(l => l.content.trim()).map((l, i) => ({ ...l, order: i + 1 })),
      topicLines: (s.topicLines || []).filter(l => l.content.trim()).map((l, i) => ({ ...l, order: i + 1 })),
      experienceLines: (s.experienceLines || []).filter(l => l.content.trim()).map((l, i) => ({ ...l, order: i + 1 })),
      assessments: (s.assessments || []).filter(l => l.name.trim()).map((l, i) => ({ ...l, order: i + 1 })),
    }));
    const hasContent = sections.some(s => s.coreLines.length || s.experienceLines.length || s.basis.trim());
    if (!hasContent && !p.otherTasks?.trim()) {
      setNotification({ message: 'Hãy nhập ít nhất một dòng phân phối chương trình, hoặc điền nhiệm vụ kiêm nhiệm.', type: 'error' });
      return;
    }
    await saveTeacherPlan({ ...p, sections, distribution: [], specialTopics: [] });
    closeEditor();
  };

  const handleSubmit = async (p: TeacherPlan) => {
    const ok = await confirm({
      title: 'Nộp kế hoạch cho tổ trưởng?',
      message: `"${p.title}" sẽ chuyển sang trạng thái Chờ duyệt. Sau khi nộp, thầy/cô chỉ sửa lại được khi tổ trưởng trả lại.`,
      confirmText: 'Nộp kế hoạch',
    });
    if (!ok) return;
    await saveTeacherPlan({ ...p, status: 'submitted', version: (p.version || 1) + 1 });
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewing) return;
    const { plan, action } = reviewing;
    if (action === 'return' && !reviewNote.trim()) {
      setNotification({ message: 'Hãy ghi lý do trả lại để giáo viên biết cần điều chỉnh gì.', type: 'error' });
      return;
    }
    const comment = reviewNote.trim()
      ? [
          ...(plan.comments || []),
          {
            id: newId('cmt'),
            authorId: activeMember.id,
            authorName: activeMember.displayName,
            content: reviewNote.trim(),
            type: action === 'approve' ? ('approval_note' as const) : ('return_reason' as const),
            createdAt: new Date().toISOString(),
          },
        ]
      : plan.comments || [];
    await saveTeacherPlan({ ...plan, status: action === 'approve' ? 'approved' : 'returned', comments: comment });
    setReviewing(null);
    setReviewNote('');
  };

  const handleDelete = async (p: TeacherPlan) => {
    const ok = await confirm({
      title: 'Xóa kế hoạch giảng dạy?',
      message: `"${p.title}" của ${p.teacherName} sẽ bị xóa vĩnh viễn.`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (ok) await deleteTeacherPlan(p.id);
  };

  // ---------- Sửa nội dung ----------

  const setField = (patch: Partial<TeacherPlan>) =>
    setEditing(cur => (cur ? { ...cur, plan: { ...cur.plan, ...patch } } : cur));

  const mapSections = (fn: (s: TeacherPlanSection, i: number) => TeacherPlanSection) =>
    setEditing(cur => (cur ? { ...cur, plan: { ...cur.plan, sections: (cur.plan.sections || []).map(fn) } } : cur));

  const setSection = (idx: number, patch: Partial<TeacherPlanSection>) =>
    mapSections((s, i) => (i === idx ? { ...s, ...patch } : s));

  type LineKey = 'coreLines' | 'topicLines' | 'experienceLines' | 'assessments';
  const blankOf = (key: LineKey, order: number) =>
    key === 'coreLines'
      ? emptyCoreLine(order)
      : key === 'topicLines'
        ? emptyTopicLine(order)
        : key === 'experienceLines'
          ? emptyExperienceLine(order)
          : emptyAssessmentLine(order);

  const setLine = (sIdx: number, key: LineKey, idx: number, patch: Record<string, unknown>) =>
    mapSections((s, i) =>
      i === sIdx ? { ...s, [key]: (s[key] as unknown as AnyLine[]).map((l, j) => (j === idx ? { ...l, ...patch } : l)) } : s,
    );
  const addLine = (sIdx: number, key: LineKey) =>
    mapSections((s, i) =>
      i === sIdx ? { ...s, [key]: [...(s[key] as unknown as AnyLine[]), blankOf(key, (s[key] as unknown as AnyLine[]).length + 1)] } : s,
    );
  const removeLine = (sIdx: number, key: LineKey, idx: number) =>
    mapSections((s, i) => (i === sIdx ? { ...s, [key]: (s[key] as unknown as AnyLine[]).filter((_, j) => j !== idx) } : s));

  const addSection = (kind: 'core' | 'experience') =>
    setEditing(cur => {
      if (!cur) return cur;
      const list = cur.plan.sections || [];
      const next = [...list, emptySection(list.length + 1, kind, cur.plan.grade)];
      setActiveSection(next.length - 1);
      return { ...cur, plan: { ...cur.plan, sections: next } };
    });

  const removeSection = (idx: number) =>
    setEditing(cur => {
      if (!cur) return cur;
      const next = (cur.plan.sections || []).filter((_, i) => i !== idx);
      setActiveSection(a => Math.max(0, Math.min(a, next.length - 1)));
      return { ...cur, plan: { ...cur.plan, sections: next.length ? next : [emptySection(1, 'core', cur.plan.grade)] } };
    });

  /** Bảng nhập liệu dùng chung */
  const EditTable: React.FC<{ sIdx: number; keyName: LineKey; cols: Col[] }> = ({ sIdx, keyName, cols }) => {
    const rows = ((editing?.plan.sections?.[sIdx]?.[keyName] as unknown as AnyLine[]) || []);
    const total = keyName === 'assessments' ? 0 : rows.reduce((n, r) => n + linePeriods(r as never), 0);
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-100 text-slate-700 font-semibold">
              <tr>
                <th className="p-1.5 w-8">STT</th>
                {cols.map(c => (
                  <th key={c.key} className={`p-1.5 ${c.width || ''}`}>
                    {c.label}
                  </th>
                ))}
                <th className="p-1.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={r.id} className="align-top">
                  <td className="p-1.5 text-slate-400 text-center">{i + 1}</td>
                  {cols.map(c => (
                    <td key={c.key} className="p-1">
                      {c.area ? (
                        <textarea
                          rows={2}
                          value={cell(r, c.key)}
                          onChange={e => setLine(sIdx, keyName, i, { [c.key]: e.target.value })}
                          aria-label={`${c.label} dòng ${i + 1}`}
                          className="w-full px-2 py-1 border border-slate-300 rounded resize-y"
                        />
                      ) : (
                        <input
                          value={cell(r, c.key)}
                          onChange={e => setLine(sIdx, keyName, i, { [c.key]: e.target.value })}
                          aria-label={`${c.label} dòng ${i + 1}`}
                          className="w-full px-2 py-1 border border-slate-300 rounded"
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeLine(sIdx, keyName, i)}
                      aria-label={`Xóa dòng ${i + 1}`}
                      className="text-rose-500 hover:bg-rose-50 rounded p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={cols.length + 2} className="p-3 text-center text-slate-400 italic">
                    Chưa có dòng nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => addLine(sIdx, keyName)}
            className="px-2.5 py-1 font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            + Thêm dòng
          </button>
          {keyName !== 'assessments' && (
            <span className="text-slate-500">
              Tổng: <strong>{total}</strong> tiết
            </span>
          )}
        </div>
      </div>
    );
  };

  /** IV. Tổng hợp thời lượng – phần mềm tự cộng */
  const WorkloadTable: React.FC<{ section: TeacherPlanSection }> = ({ section }) => (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-left text-[11px]">
        <thead className="bg-slate-100 text-slate-700 font-semibold">
          <tr>
            <th className="p-2">Nội dung</th>
            <th className="p-2 w-24 text-center">Học kỳ I</th>
            <th className="p-2 w-24 text-center">Học kỳ II</th>
            <th className="p-2 w-24 text-center">Cả năm</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {workload(section).map(r => (
            <tr key={r.label}>
              <td className="p-2 text-slate-700">{r.label}</td>
              <td className="p-2 text-center">{r.hk1}</td>
              <td className="p-2 text-center">{r.hk2}</td>
              <td className="p-2 text-center font-semibold">{r.year}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const sectionsOf = (p: TeacherPlan) => p.sections || [];

  return (
    <div className="space-y-4" data-testid="teacher-plans-panel">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <span>Kế hoạch giảng dạy của giáo viên</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Thông tin cá nhân · Căn cứ xây dựng · Phân phối cốt lõi · Chuyên đề lựa chọn · Tổng hợp thời lượng ·
            Kiểm tra đánh giá · Tổ chức thực hiện
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openNew} className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm kế hoạch cá nhân</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".docx,.pdf,.xlsx,.xls,.csv,.txt" onChange={handleImportFile} className="hidden" aria-hidden="true" tabIndex={-1} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Đọc kế hoạch giảng dạy đã soạn sẵn trong Word, Excel hoặc PDF"
            className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-blue-700 rounded-lg border border-blue-200 flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{importing ? 'Đang đọc tệp...' : 'Nhập từ Word / Excel / PDF'}</span>
          </button>
          <button onClick={() => window.print()} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-xs">
            <Printer className="w-3.5 h-3.5" />
            <span>In / Xuất PDF</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs print:hidden">
        <span className="font-semibold text-slate-600">Khối:</span>
        <div className="flex gap-1">
          {(['all', ...GRADES] as const).map(g => (
            <button key={g} onClick={() => setGradeFilter(g)} className={`px-2.5 py-1 rounded-lg font-medium border ${gradeFilter === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}>
              {g === 'all' ? 'Tất cả' : `Khối ${g}`}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
          <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
          Chỉ kế hoạch của tôi
        </label>
        <span className="text-slate-400">{visiblePlans.length} kế hoạch</span>
      </div>

      {visiblePlans.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">Chưa có kế hoạch giảng dạy nào cho năm học {config.academicYear}</p>
          <p className="text-xs text-slate-400 mt-1">Bấm "Thêm kế hoạch cá nhân", hoặc nhập từ tệp Word đã soạn sẵn.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePlans.map(p => {
            const badge = STATUS_BADGE[p.status];
            const view = withSections(p);
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 break-inside-avoid">
                {/* Đầu trang */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 text-xs text-slate-600 leading-relaxed text-center">
                    <div className="font-semibold text-slate-900 uppercase">{config.schoolName}</div>
                    <div className="font-semibold text-slate-900 uppercase">{config.departmentName}</div>
                  </div>
                  <div className="text-center text-[11px] text-slate-700 shrink-0">
                    <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="font-semibold">Độc lập - Tự do - Hạnh phúc</div>
                  </div>
                </div>

                <div className="text-center space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-900 uppercase">Kế hoạch giảng dạy</h3>
                  <div className="text-xs italic text-slate-500">(Năm học {p.academicYear})</div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>{badge.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">v{p.version || 1}</span>
                    {p.updatedAt && <span className="text-[10px] text-slate-400">cập nhật {new Date(p.updatedAt).toLocaleDateString('vi-VN')}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 justify-end print:hidden">
                  {canEdit(p) && (
                    <button onClick={() => openEdit(p)} className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-50 text-blue-700 rounded-lg border border-blue-200 flex items-center gap-1">
                      <Edit3 className="w-3 h-3" /> Sửa
                    </button>
                  )}
                  {canSubmit(p) && (
                    <button onClick={() => handleSubmit(p)} className="px-2.5 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1">
                      <Send className="w-3 h-3" /> Nộp
                    </button>
                  )}
                  {canReview(p) && (
                    <>
                      <button onClick={() => { setReviewing({ plan: p, action: 'approve' }); setReviewNote(''); }} className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1">
                        <Check className="w-3 h-3" /> Duyệt
                      </button>
                      <button onClick={() => { setReviewing({ plan: p, action: 'return' }); setReviewNote(''); }} className="px-2.5 py-1 text-xs font-semibold bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg border border-rose-200 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> Trả lại
                      </button>
                    </>
                  )}
                  {isLeader && (
                    <button onClick={() => handleDelete(p)} className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 rounded-lg border border-rose-200 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Xóa
                    </button>
                  )}
                </div>

                {/* 1. Thông tin cá nhân */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900">1. Thông tin cá nhân</h4>
                  <ul className="text-xs text-slate-700 space-y-0.5 pl-1">
                    <li>- Họ và tên giáo viên: <strong className="text-slate-900">{p.teacherName}</strong></li>
                    <li>- Lớp được phân công giảng dạy: {p.className?.trim() || <span className="italic text-slate-400">chưa nhập</span>}</li>
                    <li>- Nhiệm vụ khác được phân công kiêm nhiệm: {p.otherTasks?.trim() || <span className="italic text-slate-400">không có</span>}</li>
                  </ul>
                </div>

                {/* 2. Kế hoạch dạy học */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900">2. Kế hoạch dạy học</h4>
                  {sectionsOf(view).map(s => (
                    <div key={s.id} className="space-y-3 border-l-2 border-blue-100 pl-3">
                      <div className="text-xs font-bold text-blue-800 uppercase">{s.title}</div>

                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-slate-800">I. Căn cứ và nguyên tắc xây dựng</div>
                        <Bullets text={s.basis} />
                      </div>

                      {s.kind === 'core' ? (
                        <>
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-slate-800">II. Phân phối phần nội dung cốt lõi</div>
                            <ReadTable cols={CORE_COLS} rows={s.coreLines as unknown as AnyLine[]} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-slate-800">III. Phân phối chuyên đề học tập lựa chọn</div>
                            <ReadTable cols={TOPIC_COLS} rows={s.topicLines as unknown as AnyLine[]} />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-slate-800">II. Phân phối chương trình</div>
                          <ReadTable cols={EXPERIENCE_COLS} rows={s.experienceLines as unknown as AnyLine[]} />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-slate-800">IV. Tổng hợp thời lượng</div>
                        <WorkloadTable section={s} />
                        <p className="text-[10px] italic text-slate-400">
                          Phần mềm tự cộng từ các bảng trên; học kỳ I tính đến hết tuần {s.hk1Weeks || DEFAULT_HK1_WEEKS}.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-slate-800">Kiểm tra, đánh giá định kỳ</div>
                        <ReadTable cols={ASSESSMENT_COLS} rows={s.assessments as unknown as AnyLine[]} sttLabel="TT" />
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-slate-800">V. Tổ chức thực hiện</div>
                        <Bullets text={s.implementation} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ý kiến của tổ trưởng */}
                {!!p.comments?.length && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Ý kiến của tổ trưởng
                    </div>
                    {p.comments.map(c => (
                      <div key={c.id} className={`text-[11px] rounded-lg border p-2 ${c.type === 'return_reason' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                        <span className="font-semibold">{c.authorName}:</span> {c.content}
                      </div>
                    ))}
                  </div>
                )}

                {/* Ký duyệt */}
                <div className="grid grid-cols-2 gap-4 pt-4 mt-2 border-t border-slate-200 text-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800">TỔ TRƯỞNG CHUYÊN MÔN DUYỆT</div>
                    <div className="h-12" />
                    <div className="font-semibold text-slate-800">{head?.displayName || ''}</div>
                  </div>
                  <div>
                    <div className="text-[11px] italic text-slate-500">… ngày … tháng … năm ……</div>
                    <div className="font-bold text-slate-800">GIÁO VIÊN</div>
                    <div className="text-[11px] italic text-slate-500">(Ghi rõ họ tên, ký tên)</div>
                    <div className="h-8" />
                    <div className="font-semibold text-slate-800">{p.teacherName}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- Màn hình chỉnh sửa ---------- */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto print:hidden">
          <form onSubmit={handleSave} className="bg-white rounded-xl shadow-lg w-full max-w-7xl my-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl z-10">
              <h3 className="text-sm font-bold text-slate-900">
                {editing.isNew ? 'Lập kế hoạch giảng dạy' : 'Sửa kế hoạch giảng dạy'}
              </h3>
              <button type="button" onClick={closeEditor} aria-label="Đóng" className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {!!importNotes.length && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-amber-900 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Cần kiểm tra lại
                  </div>
                  <ul className="list-disc pl-5 text-amber-800 space-y-0.5">
                    {importNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 1. Thông tin cá nhân */}
              <fieldset className="space-y-2 border border-slate-200 rounded-lg p-3">
                <legend className="px-1 font-bold text-slate-800">1. Thông tin cá nhân</legend>
                <div className="grid md:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="font-semibold text-slate-600 flex items-center gap-1">
                      <UserIcon className="w-3 h-3" /> Giáo viên
                    </span>
                    <select
                      value={editing.plan.teacherId}
                      onChange={e => {
                        const m = selectableTeachers.find(t => t.id === e.target.value);
                        if (m) setField({ teacherId: m.id, teacherName: m.displayName });
                      }}
                      disabled={!isLeader}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg disabled:bg-slate-100"
                    >
                      {selectableTeachers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-slate-600">Khối chính (để lọc danh sách)</span>
                    <select
                      value={editing.plan.grade}
                      onChange={e => setField({ grade: Number(e.target.value) as 10 | 11 | 12 })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                    >
                      {GRADES.map(g => (
                        <option key={g} value={g}>
                          Khối {g}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="font-semibold text-slate-600">Tiêu đề</span>
                    <input value={editing.plan.title} onChange={e => setField({ title: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg" />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-slate-600">Lớp được phân công giảng dạy</span>
                    <input value={editing.plan.className || ''} onChange={e => setField({ className: e.target.value })} placeholder="10C7, 10C11, 11B14" className="w-full px-2 py-1.5 border border-slate-300 rounded-lg" />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold text-slate-600">Nhiệm vụ khác được phân công kiêm nhiệm</span>
                    <input value={editing.plan.otherTasks || ''} onChange={e => setField({ otherTasks: e.target.value })} placeholder="GVCN lớp 11B14" className="w-full px-2 py-1.5 border border-slate-300 rounded-lg" />
                  </label>
                </div>
              </fieldset>

              {/* 2. Kế hoạch dạy học */}
              <fieldset className="space-y-3 border border-slate-200 rounded-lg p-3">
                <legend className="px-1 font-bold text-slate-800">2. Kế hoạch dạy học</legend>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(editing.plan.sections || []).map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSection(i)}
                      className={`px-2.5 py-1 rounded-lg font-semibold border ${activeSection === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                    >
                      {s.title || `Phần ${i + 1}`}
                    </button>
                  ))}
                  <button type="button" onClick={() => addSection('core')} className="px-2.5 py-1 rounded-lg font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Thêm khối
                  </button>
                  <button type="button" onClick={() => addSection('experience')} className="px-2.5 py-1 rounded-lg font-semibold text-violet-700 border border-violet-200 hover:bg-violet-50 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Thêm hoạt động trải nghiệm
                  </button>
                </div>

                {(editing.plan.sections || []).map((s, sIdx) =>
                  sIdx !== activeSection ? null : (
                    <div key={s.id} className="space-y-3">
                      <div className="grid md:grid-cols-3 gap-3">
                        <label className="space-y-1 md:col-span-2">
                          <span className="font-semibold text-slate-600">Tên phần</span>
                          <input value={s.title} onChange={e => setSection(sIdx, { title: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg" />
                        </label>
                        <label className="space-y-1">
                          <span className="font-semibold text-slate-600">Học kỳ I kết thúc ở tuần</span>
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={s.hk1Weeks || DEFAULT_HK1_WEEKS}
                            onChange={e => setSection(sIdx, { hk1Weeks: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                          />
                        </label>
                      </div>

                      <label className="space-y-1 block">
                        <span className="font-semibold text-slate-600">I. Căn cứ và nguyên tắc xây dựng (mỗi dòng một căn cứ)</span>
                        <textarea rows={4} value={s.basis} onChange={e => setSection(sIdx, { basis: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg" />
                      </label>

                      {s.kind === 'core' ? (
                        <>
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-600">II. Phân phối phần nội dung cốt lõi</div>
                            <EditTable sIdx={sIdx} keyName="coreLines" cols={CORE_COLS} />
                          </div>
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-600">III. Phân phối chuyên đề học tập lựa chọn</div>
                            <EditTable sIdx={sIdx} keyName="topicLines" cols={TOPIC_COLS} />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-600">II. Phân phối chương trình hoạt động trải nghiệm, hướng nghiệp</div>
                          <EditTable sIdx={sIdx} keyName="experienceLines" cols={EXPERIENCE_COLS} />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="font-semibold text-slate-600">IV. Tổng hợp thời lượng (phần mềm tự cộng)</div>
                        <WorkloadTable section={s} />
                      </div>

                      <div className="space-y-1">
                        <div className="font-semibold text-slate-600">Kiểm tra, đánh giá định kỳ</div>
                        <EditTable sIdx={sIdx} keyName="assessments" cols={ASSESSMENT_COLS} />
                      </div>

                      <label className="space-y-1 block">
                        <span className="font-semibold text-slate-600">V. Tổ chức thực hiện (mỗi dòng một ý)</span>
                        <textarea rows={4} value={s.implementation} onChange={e => setSection(sIdx, { implementation: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg" />
                      </label>

                      {(editing.plan.sections || []).length > 1 && (
                        <button type="button" onClick={() => removeSection(sIdx)} className="px-2.5 py-1 font-semibold text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> Xóa phần "{s.title}"
                        </button>
                      )}
                    </div>
                  ),
                )}
              </fieldset>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 sticky bottom-0 bg-white rounded-b-xl">
              <button type="button" onClick={closeEditor} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
                Hủy
              </button>
              <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                Lưu kế hoạch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- Duyệt / trả lại ---------- */}
      {reviewing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 print:hidden">
          <form onSubmit={handleReview} className="bg-white rounded-xl shadow-lg w-full max-w-lg">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                {reviewing.action === 'approve' ? 'Duyệt kế hoạch' : 'Trả lại để điều chỉnh'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{reviewing.plan.title}</p>
            </div>
            <div className="p-4">
              <label className="space-y-1 block text-xs">
                <span className="font-semibold text-slate-600">
                  {reviewing.action === 'approve' ? 'Ý kiến khi duyệt (không bắt buộc)' : 'Lý do trả lại (bắt buộc)'}
                </span>
                <textarea rows={4} value={reviewNote} onChange={e => setReviewNote(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg" />
              </label>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
              <button type="button" onClick={() => setReviewing(null)} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
                Hủy
              </button>
              <button
                type="submit"
                className={`px-3 py-1.5 text-xs font-semibold text-white rounded-lg ${reviewing.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {reviewing.action === 'approve' ? 'Duyệt' : 'Trả lại'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
