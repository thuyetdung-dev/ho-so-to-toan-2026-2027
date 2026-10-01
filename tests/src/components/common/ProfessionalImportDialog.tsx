import React, { useEffect, useRef, useState } from "react";
import type { ProfessionalTask, ProfessionalIndicator } from "../../types";
import type { ReadGridsResult } from "../../utils/planImport";
import { readProfessionalSource } from "../../utils/professionalSource";
import {
  parseProfessionalGrid,
  mergeTasks,
  type StructuredImport,
} from "../../utils/professional";
import { newId } from "../../utils/ids";
interface Entry {
  id: string;
  file: File;
  status: "reading" | "ready" | "error";
  result?: ReadGridsResult;
  error?: string;
  selected: number[];
  parsed?: StructuredImport[];
}
export function ProfessionalImportDialog({
  onClose,
  onApply,
  currentTasks = [],
}: {
  onClose: () => void;
  currentTasks?: ProfessionalTask[];
  onApply: (
    data: {
      text: string;
      tasks: ProfessionalTask[];
      indicators: ProfessionalIndicator[];
      fileName: string;
    },
    mode: "replace" | "append",
  ) => void;
}) {
  const [includeTableText, setIncludeTableText] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ocr, setOcr] = useState(false);
  const [progress, setProgress] = useState("");
  const [reading, setReading] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const controller = useRef(new AbortController());
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current.abort();
    };
  }, []);
  const add = async (files: File[]) => {
    if (reading) return;
    if (files.length + entries.length > 10) {
      setProgress("Tối đa 10 tệp mỗi lần nhập.");
      return;
    }
    controller.current = new AbortController();
    setReading(true);
    setReviewed(false);
    const added = files.map((file) => ({
      id: newId("import"),
      file,
      status: "reading" as const,
      selected: [],
    }));
    setEntries((prev) => [...prev, ...added]);
    for (const entry of added) {
      try {
        const result = await readProfessionalSource(entry.file, {
          ocr,
          signal: controller.current.signal,
          progress: (s) => mounted.current && setProgress(s),
        });
        if (!mounted.current) break;
        const parsed = result.grids.map((g, i) =>
          parseProfessionalGrid(g, entry.file.name, i),
        );
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? {
                  ...e,
                  result,
                  parsed,
                  status: "ready",
                  selected: parsed
                    .map((g, i) => (g.recognized ? i : -1))
                    .filter((i) => i >= 0),
                }
              : e,
          ),
        );
      } catch (error) {
        if (mounted.current)
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id
                ? {
                    ...e,
                    status: "error",
                    error:
                      error instanceof Error
                        ? error.message
                        : "Không đọc được tệp",
                  }
                : e,
            ),
          );
      }
    }
    if (mounted.current) {
      setReading(false);
      setProgress("Đã xử lý tệp; hãy rà soát bảng và dòng cảnh báo.");
    }
  };
  const selected = entries.flatMap((e) => e.selected.map((i) => e.parsed![i]));
  const merge = mergeTasks(
    [],
    selected.flatMap((s) => s.tasks),
  );
  const merged = mergeTasks(currentTasks, merge.tasks);
  const indicators = selected.flatMap((s) => s.indicators);
  const ready =
    entries.length > 0 &&
    entries.every((e) => e.status === "ready") &&
    !reading &&
    reviewed;
  const apply = (mode: "replace" | "append") => {
    if (!ready) return;
    onApply(
      {
        text: entries
          .filter(
            (e) =>
              includeTableText ||
              !["JSON", "Excel"].includes(e.result!.source) ||
              !e.selected.length,
          )
          .map(
            (e) =>
              e.result!.text ||
              e
                .result!.grids.map((g) =>
                  g.rows.map((r) => r.join(" | ")).join("\n"),
                )
                .join("\n\n"),
          )
          .join("\n\n"),
        tasks: merge.tasks,
        indicators,
        fileName: entries.map((e) => e.file.name).join(", "),
      },
      mode,
    );
  };
  const template = (json = false) => {
    const text = json
      ? JSON.stringify(
          {
            tasks: [
              {
                title: "Chuẩn bị kiểm tra giữa học kỳ I",
                category: "Kiểm tra định kỳ",
                assignee: "",
                deadline: "",
                product: "Ma trận, đặc tả và đề kiểm tra",
                evidence: "",
              },
            ],
            indicators: [
              {
                title: "Sinh hoạt nghiên cứu bài học",
                target: "",
                actual: "",
                unit: "buổi",
                evidence: "",
              },
            ],
          },
          null,
          2,
        )
      : "\uFEFFNội dung,Nhóm,Người thực hiện,Thời hạn,Sản phẩm,Minh chứng\nChuẩn bị kiểm tra giữa học kỳ I,Kiểm tra định kỳ,,,Ma trận và đặc tả,\n";
    const url = URL.createObjectURL(
      new Blob([text], {
        type: json ? "application/json" : "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = json
      ? "Mau_ke_hoach_co_cau_truc.json"
      : "Mau_cong_viec_chuyen_mon.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 print:hidden"
    >
      <div
        className="bg-white rounded-xl p-5 max-w-5xl w-full max-h-[92vh] overflow-y-auto space-y-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void add(Array.from(e.dataTransfer.files));
        }}
        onPaste={(e) => {
          if (reading) return;
          if (e.clipboardData.files.length) {
            e.preventDefault();
            void add(Array.from(e.clipboardData.files));
          }
        }}
      >
        <div className="flex justify-between">
          <h3 id="import-dialog-title" className="font-bold">
            Nhập tệp và kiểm tra trước khi lưu
          </h3>
          <button onClick={onClose} aria-label="Đóng cửa sổ nhập">
            ✕
          </button>
        </div>
        <p className="text-sm">
          Word, Excel, PDF, TXT/MD UTF-8, JSON hoặc ảnh. Kéo thả nhiều tệp;
          Ctrl+V để dán ảnh. Chọn bảng để tạo công việc/chỉ tiêu. Văn bản gốc có
          trong phần xem trước; tệp chưa đọc xong hoặc lỗi phải xử lý/bỏ khỏi
          danh sách trước khi áp dụng.
        </p>
        <label className="text-sm flex gap-2">
          <input
            type="checkbox"
            checked={ocr}
            disabled={reading}
            onChange={(e) => setOcr(e.target.checked)}
          />
          Bật OCR tiếng Việt/Anh cho ảnh/PDF scan (chạy trên thiết bị; cần rà
          soát kết quả)
        </label>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".docx,.xlsx,.xls,.csv,.ods,.pdf,.txt,.md,.json,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            void add(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
        <div className="flex gap-2 flex-wrap">
          <button
            disabled={reading}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-2 rounded bg-blue-700 text-white"
          >
            Chọn tệp
          </button>
          <button
            onClick={() => template()}
            className="border rounded px-3 py-2"
          >
            Tải mẫu CSV
          </button>
          <button
            onClick={() => template(true)}
            className="border rounded px-3 py-2"
          >
            Tải mẫu JSON
          </button>
          {reading && (
            <button
              onClick={() => controller.current.abort()}
              className="border rounded px-3 py-2"
            >
              Hủy đọc
            </button>
          )}
        </div>
        <p role="status" className="text-sm text-blue-800">
          {progress}
        </p>
        {entries.map((e) => (
          <section key={e.id} className="border rounded p-3 space-y-2">
            <div className="flex justify-between gap-2">
              <strong>
                {e.file.name} —{" "}
                {e.status === "ready"
                  ? "Đã đọc"
                  : e.status === "error"
                    ? "Lỗi"
                    : "Đang đọc"}
              </strong>
              <button
                disabled={reading}
                onClick={() => {
                  setEntries((prev) => prev.filter((x) => x.id !== e.id));
                  setReviewed(false);
                }}
                className="text-red-700"
              >
                Bỏ tệp
              </button>
            </div>
            {e.error && <p className="text-red-700">{e.error}</p>}
            {e.result && (
              <>
                <p className="text-xs">
                  {e.result.source} ·{" "}
                  {e.result.text.length.toLocaleString("vi-VN")} ký tự ·{" "}
                  {e.result.grids.length} bảng
                </p>
                {e.result.notes.map((n, i) => (
                  <p key={i} className="text-xs text-amber-800">
                    {n}
                  </p>
                ))}
                <details>
                  <summary>Xem văn bản đã đọc</summary>
                  <textarea
                    readOnly
                    value={e.result.text}
                    rows={8}
                    aria-label={`Văn bản ${e.file.name}`}
                    className="w-full border rounded p-2"
                  />
                </details>
                {e.result.grids.map((g, i) => {
                  const parsed = e.parsed![i];
                  return (
                    <details key={i} className="border rounded p-2">
                      <summary>
                        Bảng {i + 1} · {g.rows.length} dòng ·{" "}
                        {parsed.tasks.length} công việc ·{" "}
                        {parsed.indicators.length} chỉ tiêu
                      </summary>
                      <label className="flex gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={!parsed.recognized}
                          checked={e.selected.includes(i)}
                          onChange={(ev) => {
                            setReviewed(false);
                            setEntries((prev) =>
                              prev.map((x) =>
                                x.id === e.id
                                  ? {
                                      ...x,
                                      selected: ev.target.checked
                                        ? [...x.selected, i]
                                        : x.selected.filter((v) => v !== i),
                                    }
                                  : x,
                              ),
                            );
                          }}
                        />
                        Dùng bảng này{" "}
                        {parsed.recognized
                          ? ""
                          : "(chưa nhận ra cột; chỉ giữ văn bản)"}
                      </label>
                      <div className="overflow-x-auto max-h-64">
                        <table className="text-xs border-collapse w-full">
                          <tbody>
                            {g.rows.slice(0, 100).map((r, j) => (
                              <tr key={j}>
                                {r.map((c, k) => (
                                  <td
                                    className="border p-2 whitespace-pre-wrap"
                                    key={k}
                                  >
                                    {c}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {g.rows.length > 100 && (
                        <p>
                          Hiển thị 100 dòng đầu; dữ liệu nhận diện vẫn dùng toàn
                          bộ bảng.
                        </p>
                      )}
                      {parsed.issues.map((issue, j) => (
                        <p key={j} className="text-xs text-amber-800">
                          Dòng {issue.row}: {issue.reason}
                        </p>
                      ))}
                    </details>
                  );
                })}
              </>
            )}
          </section>
        ))}
        <p className="text-sm font-semibold">
          Đã chọn: {merge.tasks.length} công việc; {indicators.length} chỉ tiêu.
          Bỏ {merge.duplicates} dòng trùng giữa các tệp. Nối thêm sẽ bỏ thêm{" "}
          {merged.duplicates} công việc đã có.
        </p>
        <label className="text-sm flex gap-2">
          <input
            type="checkbox"
            checked={includeTableText}
            onChange={(e) => {
              setIncludeTableText(e.target.checked);
              setReviewed(false);
            }}
          />
          Kèm văn bản bảng Excel/JSON đã chọn vào nội dung (công việc/chỉ tiêu
          vẫn được tạo riêng)
        </label>
        <label className="text-sm flex gap-2">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          Tôi đã kiểm tra nội dung, bảng và các cảnh báo
        </label>
        <div className="flex gap-2 flex-wrap">
          <button
            disabled={!ready}
            onClick={() => apply("append")}
            className="bg-blue-700 text-white rounded px-3 py-2 disabled:opacity-40"
          >
            Nối vào bản nháp
          </button>
          <button
            disabled={!ready}
            onClick={() => {
              if (
                window.confirm(
                  "Thay nội dung, công việc và chỉ tiêu trong bản nháp?",
                )
              )
                apply("replace");
            }}
            className="border rounded px-3 py-2 disabled:opacity-40"
          >
            Thay thế bản nháp
          </button>
          <button onClick={onClose} className="border rounded px-3 py-2">
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
