import React, { useMemo, useState } from "react";
import type { ProfessionalTask, ProfessionalIndicator } from "../../types";
import { newId } from "../../utils/ids";
import { taskStats } from "../../utils/professional";
const statuses = {
  pending: "Chưa làm",
  in_progress: "Đang làm",
  completed: "Hoàn thành",
};
export function StructuredProfessionalEditor({
  tasks = [],
  indicators = [],
  onChange,
}: {
  tasks?: ProfessionalTask[];
  indicators?: ProfessionalIndicator[];
  onChange?: (
    tasks: ProfessionalTask[],
    indicators: ProfessionalIndicator[],
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);
  const stats = useMemo(() => taskStats(tasks), [tasks]);
  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (status === "all" || t.status === status) &&
          (category === "all" || t.category === category) &&
          [t.title, t.assignee, t.product]
            .join(" ")
            .toLocaleLowerCase("vi")
            .includes(query.toLocaleLowerCase("vi")),
      ),
    [tasks, status, category, query],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages - 1);
  const editable = !!onChange;
  const update = (id: string, key: keyof ProfessionalTask, value: string) =>
    onChange?.(
      tasks.map((t) => (t.id === id ? { ...t, [key]: value } : t)),
      indicators,
    );
  const evidence = (text: string) =>
    /^https?:\/\//i.test(text) ? (
      <a
        href={text}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-700 underline break-all"
      >
        {text}
      </a>
    ) : (
      text
    );
  return (
    <section className="space-y-3 border-t pt-4">
      <h4 className="font-bold">Công việc và chỉ tiêu có cấu trúc</h4>
      <p className="text-sm">
        {stats.total} công việc · {stats.completed} hoàn thành · {stats.overdue}{" "}
        quá hạn · {stats.missingEvidence} hoàn thành chưa có minh chứng
      </p>
      <div className="flex flex-wrap gap-2 print:hidden">
        <input
          aria-label="Tìm công việc"
          placeholder="Tìm nội dung, người phụ trách…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          className="border rounded p-2"
        />
        <select
          aria-label="Lọc trạng thái công việc"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          className="border rounded p-2"
        >
          <option value="all">Mọi trạng thái</option>
          {Object.entries(statuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc nhóm công việc"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(0);
          }}
          className="border rounded p-2"
        >
          <option value="all">Mọi nhóm</option>
          {[...new Set(tasks.map((t) => t.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {editable && (
          <button
            type="button"
            onClick={() =>
              onChange(
                [
                  ...tasks,
                  {
                    id: newId("task"),
                    title: "",
                    category: "Công việc chung",
                    assignee: "",
                    deadline: "",
                    product: "",
                    evidence: "",
                    status: "pending",
                  },
                ],
                indicators,
              )
            }
            className="border rounded px-3"
          >
            Thêm công việc
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {[
                "Nội dung / nhóm",
                "Người phụ trách",
                "Thời hạn",
                "Sản phẩm",
                "Minh chứng",
                "Trạng thái",
                ...(editable ? ["Thao tác"] : []),
              ].map((h) => (
                <th className="border p-2 bg-slate-50" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(currentPage * 25, (currentPage + 1) * 25)
              .map((t) => (
                <tr
                  key={t.id}
                  className={
                    t.deadline &&
                    t.deadline <
                      new Date().toLocaleDateString("en-CA", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      }) &&
                    t.status !== "completed"
                      ? "bg-amber-50"
                      : ""
                  }
                >
                  <td className="border p-2 min-w-48">
                    {editable ? (
                      <>
                        <textarea
                          aria-label="Nội dung công việc"
                          value={t.title}
                          onChange={(e) =>
                            update(t.id, "title", e.target.value)
                          }
                          className="w-full border rounded p-1"
                        />
                        <input
                          aria-label="Nhóm công việc"
                          value={t.category}
                          onChange={(e) =>
                            update(t.id, "category", e.target.value)
                          }
                          className="w-full border rounded p-1"
                        />
                      </>
                    ) : (
                      <>
                        {t.title}
                        <p className="text-slate-500">{t.category}</p>
                      </>
                    )}
                    {t.source && (
                      <p className="text-slate-500">
                        Nguồn: {t.source.fileName}, bảng {t.source.table}, dòng{" "}
                        {t.source.row}
                      </p>
                    )}
                  </td>
                  {(
                    ["assignee", "deadline", "product", "evidence"] as const
                  ).map((k) => (
                    <td key={k} className="border p-2 min-w-32">
                      {editable ? (
                        <input
                          aria-label={
                            {
                              assignee: "Người phụ trách",
                              deadline: "Thời hạn",
                              product: "Sản phẩm",
                              evidence: "Minh chứng",
                            }[k]
                          }
                          type={k === "deadline" ? "date" : "text"}
                          value={t[k]}
                          onChange={(e) => update(t.id, k, e.target.value)}
                          className="w-full border rounded p-1"
                        />
                      ) : k === "evidence" ? (
                        evidence(t[k])
                      ) : (
                        t[k]
                      )}
                      {k === "deadline" && t.deadlineText && !t.deadline && (
                        <p className="text-amber-800">
                          Cần xác định ngày: {t.deadlineText}
                        </p>
                      )}
                    </td>
                  ))}
                  <td className="border p-2">
                    {editable ? (
                      <select
                        aria-label="Trạng thái công việc"
                        value={t.status}
                        onChange={(e) => update(t.id, "status", e.target.value)}
                      >
                        {Object.entries(statuses).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      statuses[t.status]
                    )}
                  </td>
                  {editable && (
                    <td className="border p-2">
                      <button
                        type="button"
                        onClick={() =>
                          onChange(
                            tasks.filter((x) => x.id !== t.id),
                            indicators,
                          )
                        }
                        className="text-red-700"
                      >
                        Xóa
                      </button>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <p className="text-sm text-slate-500">Chưa có công việc phù hợp.</p>
      )}
      <div className="flex gap-3 text-xs print:hidden">
        <button
          type="button"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          Trang trước
        </button>
        <span>
          Trang {currentPage + 1}/{pages} · {filtered.length} công việc
        </span>
        <button
          type="button"
          disabled={currentPage + 1 >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          Trang sau
        </button>
      </div>
      <h5 className="font-semibold">Chỉ tiêu và kết quả</h5>
      {editable && (
        <button
          type="button"
          onClick={() =>
            onChange(tasks, [
              ...indicators,
              {
                id: newId("indicator"),
                title: "",
                target: "",
                actual: "",
                unit: "",
                evidence: "",
              },
            ])
          }
          className="border rounded px-3 py-2 text-xs"
        >
          Thêm chỉ tiêu
        </button>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {[
                "Nội dung",
                "Chỉ tiêu",
                "Thực hiện",
                "Đơn vị",
                "Minh chứng",
                ...(editable ? ["Thao tác"] : []),
              ].map((h) => (
                <th key={h} className="border p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indicators.map((i) => (
              <tr key={i.id}>
                {(
                  ["title", "target", "actual", "unit", "evidence"] as const
                ).map((k) => (
                  <td className="border p-2" key={k}>
                    {editable ? (
                      <input
                        aria-label={`Chỉ tiêu ${k}`}
                        value={i[k]}
                        onChange={(e) =>
                          onChange(
                            tasks,
                            indicators.map((x) =>
                              x.id === i.id ? { ...x, [k]: e.target.value } : x,
                            ),
                          )
                        }
                        className="border rounded p-1 w-full"
                      />
                    ) : k === "evidence" ? (
                      evidence(i[k])
                    ) : (
                      i[k]
                    )}
                  </td>
                ))}
                {editable && (
                  <td className="border p-2">
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          tasks,
                          indicators.filter((x) => x.id !== i.id),
                        )
                      }
                      className="text-red-700"
                    >
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
