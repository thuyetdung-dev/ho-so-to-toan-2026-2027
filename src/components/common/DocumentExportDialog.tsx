import React, { useRef, useState } from "react";
import type { DocumentModel } from "../../utils/documentModel";
import { useApp } from "../../context/AppContext";
export function DocumentExportDialog({
  model,
  onClose,
}: {
  model: DocumentModel;
  onClose: () => void;
}) {
  const { setNotification } = useApp();
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [author, setAuthor] = useState(model.author || "");
  const [landscape, setLandscape] = useState(
    model.sections.some((s) => (s.headers?.length || 0) > 5),
  );
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const run = async (word: boolean) => {
    setBusy(true);
    try {
      const exporter = await import("../../utils/documentExport");
      if (word) {
        const blob = await exporter.createWord(model, {
          location,
          date,
          author,
          landscape,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${model.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 100) || "Ho_so"}.docx`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (ref.current)
        await exporter.printElement(ref.current, model.title);
    } catch (e) {
      setNotification({
        message: `Không xuất được tài liệu: ${e instanceof Error ? e.message : String(e)}`,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 p-3 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
    >
      <div className="max-w-6xl mx-auto bg-white rounded-xl p-5 space-y-3">
        <div className="flex justify-between">
          <h3 id="export-title" className="font-bold">
            Mẫu xuất Word / PDF
          </h3>
          <button disabled={busy} onClick={onClose} aria-label="Đóng mẫu xuất">
            ✕
          </button>
        </div>
        <p className="text-xs">
          Mẫu hành chính A4, Times New Roman. Rà soát tên trường, người lập và
          ngày ký trước khi dùng; chưa nhập thì tài liệu ghi rõ chưa khai báo.
          Tùy chỉnh ở đây chỉ áp dụng cho bản xuất.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <label>
            Địa danh{" "}
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="border rounded p-1"
            />
          </label>
          <label>
            Ngày ký{" "}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Người lập{" "}
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="border rounded p-1"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={landscape}
              onChange={(e) => setLandscape(e.target.checked)}
            />{" "}
            A4 ngang cho bảng rộng
          </label>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => run(true)}
            className="bg-blue-700 text-white px-4 py-2 rounded"
          >
            {busy ? "Đang xuất…" : "Tải Word (.docx)"}
          </button>
          <button
            disabled={busy}
            onClick={() => run(false)}
            className="border px-4 py-2 rounded"
          >
            In / Lưu PDF
          </button>
        </div>
        <div
          ref={ref}
          className={`professional-document ${landscape ? "landscape" : ""} border p-6 text-black bg-white`}
        >
          <style>{`.professional-document{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.4}.professional-document h1{font-size:16pt;text-align:center;font-weight:bold;margin:18pt 0 6pt}.professional-document h2{font-size:13pt;font-weight:bold;margin:14pt 0 6pt}.professional-document table{border-collapse:collapse;width:100%;font-size:11pt;table-layout:fixed}.professional-document th,.professional-document td{border:1px solid #d9d9d9;padding:6pt;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}.professional-document thead{display:table-header-group}.professional-document tr{break-inside:avoid}.professional-document th{font-weight:bold}.professional-document .signature{margin-top:24pt;text-align:center;break-inside:avoid}.professional-document p{margin:6pt 0;white-space:pre-wrap}@media print{@page{size:A4 ${landscape ? "landscape" : "portrait"};margin:20mm 15mm 20mm 25mm}body{margin:0}.professional-document{border:0!important;padding:0!important}.professional-document h2{break-after:avoid}}`}</style>
          <header className="text-center">
            <p>
              <strong>{model.school}</strong>
            </p>
            <p>
              <strong>{model.department}</strong>
            </p>
            <h1>{model.title}</h1>
            <p>{model.subtitle}</p>
          </header>
          <p>{model.status}</p>
          {model.sections
            .filter((s) => s.text || s.rows?.length)
            .map((s, i) => (
              <section key={i}>
                <h2>{s.title}</h2>
                {s.text && <p>{s.text}</p>}
                {s.headers && s.rows && s.rows.length > 0 && (
                  <table>
                    {s.headers.length === 7 && (
                      <colgroup>
                        {[5, 23, 14, 13, 21, 14, 10].map((w, c) => (
                          <col key={c} style={{ width: `${w}%` }} />
                        ))}
                      </colgroup>
                    )}
                    <thead>
                      <tr>
                        {s.headers.map((h, j) => (
                          <th key={j}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.rows.map((row, j) => (
                        <tr key={j}>
                          {row.map((cell, k) => (
                            <td key={k}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ))}
          <div className="signature">
            <p>
              {location && `${location}, `}
              {date
                ? `ngày ${date.split("-")[2]} tháng ${date.split("-")[1]} năm ${date.split("-")[0]}`
                : "Ngày ký: chưa khai báo"}
            </p>
            <p>
              <strong>NGƯỜI LẬP</strong>
            </p>
            <p>(Ký, ghi rõ họ tên)</p>
            <p style={{ marginTop: "48pt" }}>
              <strong>{author || "Chưa khai báo người lập"}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
