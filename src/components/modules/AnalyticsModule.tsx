import React, { useMemo, useState } from 'react';
import { ChartNoAxesCombined, Plus, Trash2, X, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ExamResultRecord } from '../../types';
import { useConfirm } from '../common/ConfirmDialog';
import { newId, todayISO } from '../../utils/ids';
import { exportToExcel } from '../../utils/excel';
import { computeStats, parseScores } from '../../utils/stats';

/** Phân tích kết quả kiểm tra (bản cũ chỉ là trang trống). */
export const AnalyticsModule: React.FC = () => {
  const { examResults, saveExamResult, deleteExamResult, classes, exams, config, activeMember, permissions } = useApp();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<{ className: string; examTitle: string; date: string; text: string } | null>(null);
  const [error, setError] = useState('');

  const sorted = useMemo(() => [...examResults].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))), [examResults]);
  const selected = examResults.find(r => r.id === selectedId) || sorted[0];
  const stats = useMemo(() => computeStats(selected?.scores || []), [selected]);

  // So sánh các lớp cùng bài kiểm tra
  const sameExam = useMemo(
    () => (selected ? examResults.filter(r => r.examTitle === selected.examTitle).map(r => ({ r, s: computeStats(r.scores || []) })) : []),
    [examResults, selected],
  );

  const parsed = form ? parseScores(form.text) : { scores: [], invalid: [] };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.className.trim() || !form.examTitle.trim()) return setError('Nhập lớp và tên bài kiểm tra.');
    if (parsed.invalid.length) return setError(`Có ${parsed.invalid.length} giá trị không hợp lệ (phải từ 0 đến 10): ${parsed.invalid.slice(0, 5).join(', ')}`);
    if (!parsed.scores.length) return setError('Chưa có điểm nào.');
    const cls = classes.find(c => c.name === form.className);
    const rec: ExamResultRecord = {
      id: newId('res'),
      className: form.className.trim(),
      examTitle: form.examTitle.trim(),
      date: form.date,
      grade: cls?.grade,
      scores: parsed.scores,
      teacherName: activeMember.displayName,
      academicYear: config.academicYear,
      createdAt: new Date().toISOString(),
    };
    if (await saveExamResult(rec)) {
      setForm(null);
      setSelectedId(rec.id);
    }
  };

  const exportExcel = () => {
    exportToExcel(
      [
        {
          name: 'TongHop',
          data: sorted.map(r => {
            const s = computeStats(r.scores || []);
            return {
              'Bài kiểm tra': r.examTitle || '',
              'Lớp': r.className,
              'Ngày': r.date || '',
              'Sĩ số có điểm': s.n,
              'Điểm TB': s.mean,
              'Trung vị': s.median,
              'Độ lệch chuẩn': s.std,
              'Thấp nhất': s.min,
              'Cao nhất': s.max,
              'Tỉ lệ ≥5 (%)': s.passRate,
              'Tỉ lệ ≥8 (%)': s.goodRate,
              'Tỉ lệ <3,5 (%)': s.weakRate,
            };
          }),
        },
      ],
      `Phan_tich_ket_qua_${config.academicYear}`,
    );
  };

  const maxBin = Math.max(1, ...stats.bins);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ChartNoAxesCombined className="w-5 h-5 text-blue-600" /> Phân tích kết quả kiểm tra
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Nhập điểm theo lớp → phổ điểm, điểm trung bình, tỉ lệ đạt và so sánh giữa các lớp</p>
        </div>
        <div className="flex gap-2">
          {sorted.length > 0 && (
            <button onClick={exportExcel} className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Xuất Excel
            </button>
          )}
          {permissions.canContribute && (
            <button
              onClick={() => { setError(''); setForm({ className: classes[0]?.name || '', examTitle: exams[0]?.title || '', date: todayISO(), text: '' }); }}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Nhập bảng điểm
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-2">
          {sorted.length === 0 && <div className="p-4 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">Chưa có bảng điểm. Bấm "Nhập bảng điểm" và dán cột điểm từ Excel.</div>}
          {sorted.map(r => {
            const s = computeStats(r.scores || []);
            return (
              <button key={r.id} onClick={() => setSelectedId(r.id)} className={`w-full text-left p-3 rounded-xl border text-xs ${r.id === selected?.id ? 'bg-blue-50/70 border-blue-400' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-900">Lớp {r.className}</span>
                  <span className="text-slate-500">{r.date}</span>
                </div>
                <div className="text-slate-600 line-clamp-1">{r.examTitle}</div>
                <div className="text-[11px] text-slate-500 mt-1">{s.n} HS • TB <strong className="text-blue-700">{s.mean.toFixed(2)}</strong> • ≥5: {s.passRate}%</div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-8 space-y-4">
          {selected ? (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{selected.examTitle} – Lớp {selected.className}</h2>
                    <p className="text-[11px] text-slate-500">{selected.date} • Người nhập: {selected.teacherName}</p>
                  </div>
                  {permissions.isLeader && (
                    <button
                      onClick={async () => {
                        if (await confirm({ title: 'Xóa bảng điểm?', message: `Bảng điểm lớp ${selected.className} sẽ bị xóa.`, confirmText: 'Xóa', danger: true })) {
                          await deleteExamResult(selected.id);
                          setSelectedId('');
                        }
                      }}
                      className="p-1.5 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50"
                      aria-label="Xóa bảng điểm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {[
                    ['Số HS', stats.n],
                    ['Điểm TB', stats.mean.toFixed(2)],
                    ['Trung vị', stats.median.toFixed(2)],
                    ['Độ lệch chuẩn', stats.std.toFixed(2)],
                    ['Thấp / Cao', `${stats.min} / ${stats.max}`],
                    ['Tỉ lệ ≥ 5', `${stats.passRate}%`],
                    ['Tỉ lệ ≥ 8', `${stats.goodRate}%`],
                    ['Tỉ lệ < 3,5', `${stats.weakRate}%`],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500">{label}</div>
                      <div className="text-base font-bold text-slate-900">{value}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-700 mb-2">Phổ điểm (số học sinh theo khoảng điểm)</div>
                  <div className="flex items-end gap-1 h-40 border-b border-l border-slate-300 px-1" role="img" aria-label="Biểu đồ phổ điểm">
                    {stats.bins.map((c, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                        <span className="text-[10px] text-slate-600 mb-0.5">{c || ''}</span>
                        <div
                          className={`w-full rounded-t ${i < 5 ? 'bg-rose-400' : i < 8 ? 'bg-blue-500' : 'bg-emerald-500'}`}
                          style={{ height: `${(c / maxBin) * 100}%`, minHeight: c ? 2 : 0 }}
                          title={`${i}–${i + 1}: ${c} HS`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1 px-1 mt-1">
                    {stats.bins.map((_, i) => (
                      <div key={i} className="flex-1 text-center text-[10px] text-slate-500">{i}–{i + 1}</div>
                    ))}
                  </div>
                </div>
              </div>

              {sameExam.length > 1 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="text-xs font-bold text-slate-700 mb-2">So sánh các lớp – {selected.examTitle}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr><th className="p-2">Lớp</th><th className="p-2">Số HS</th><th className="p-2">Điểm TB</th><th className="p-2">≥5</th><th className="p-2">≥8</th><th className="p-2">&lt;3,5</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...sameExam].sort((a, b) => b.s.mean - a.s.mean).map(({ r, s }) => (
                          <tr key={r.id} className={r.id === selected.id ? 'bg-blue-50/60 font-semibold' : ''}>
                            <td className="p-2">{r.className}</td><td className="p-2">{s.n}</td><td className="p-2">{s.mean.toFixed(2)}</td>
                            <td className="p-2">{s.passRate}%</td><td className="p-2">{s.goodRate}%</td><td className="p-2">{s.weakRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">Chọn một bảng điểm để xem phân tích.</div>
          )}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={submit} className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Nhập bảng điểm</h3>
              <button type="button" onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-700" aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="font-semibold text-slate-700">Lớp *
                <input list="analytics-classes" value={form.className} onChange={e => setForm({ ...form, className: e.target.value.toUpperCase() })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
                <datalist id="analytics-classes">{classes.map(c => <option key={c.id} value={c.name} />)}</datalist>
              </label>
              <label className="font-semibold text-slate-700">Ngày kiểm tra
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" />
              </label>
            </div>
            <label className="block font-semibold text-slate-700">Bài kiểm tra *
              <input list="analytics-exams" value={form.examTitle} onChange={e => setForm({ ...form, examTitle: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-normal" placeholder="VD: Giữa kỳ I – Toán 12" />
              <datalist id="analytics-exams">{[...new Set([...exams.map(x => x.title), ...examResults.map(r => r.examTitle || '')])].filter(Boolean).map(t => <option key={t} value={t} />)}</datalist>
            </label>
            <label className="block font-semibold text-slate-700">Danh sách điểm * <span className="font-normal text-slate-500">(dán cột điểm từ Excel; phân tách bằng xuống dòng/khoảng trắng; dùng được dấu phẩy thập phân)</span>
              <textarea rows={6} value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono resize-y" placeholder={'7,5\n8\n6,25\n...'} />
            </label>
            <div className="text-[11px] text-slate-600">
              Đọc được <strong>{parsed.scores.length}</strong> điểm hợp lệ
              {parsed.scores.length > 0 && <> • TB tạm tính <strong>{computeStats(parsed.scores).mean.toFixed(2)}</strong></>}
              {parsed.invalid.length > 0 && <span className="text-rose-700"> • {parsed.invalid.length} giá trị lỗi: {parsed.invalid.slice(0, 5).join(', ')}</span>}
            </div>
            {error && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{error}</div>}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setForm(null)} className="px-3.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="submit" className="px-4 py-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Lưu bảng điểm</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
