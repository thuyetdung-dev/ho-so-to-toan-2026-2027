import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Send,
  Copy,
  Trash2,
  Loader2,
  LogIn,
  User as UserIcon,
  AlertTriangle,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { MathText } from "../../utils/katex-renderer";
import { GeminiKeyPanel } from "../common/GeminiKeyPanel";
import { askAI, getStoredKey, serverAiAvailable } from "../../services/gemini";

type Task = "chat" | "solve" | "questions" | "lesson" | "observation" | "review" | "report" | "kpi";

const TASKS: Record<Task, { label: string; placeholder: string }> = {
  chat: {
    label: "Hỏi đáp chuyên môn",
    placeholder:
      "VD: Gợi ý cách dạy khái niệm giới hạn dãy số cho học sinh trung bình...",
  },
  solve: {
    label: "Giải toán chi tiết",
    placeholder: "VD: Tìm giá trị lớn nhất của $f(x)=x^3-3x+2$ trên $[0;2]$",
  },
  questions: {
    label: "Soạn câu hỏi định dạng 2025",
    placeholder: "VD: Soạn 4 câu Đúng/Sai về đạo hàm, khối 11, mức Thông hiểu",
  },
  lesson: {
    label: "Gợi ý giáo án CV 5512",
    placeholder: 'VD: Bài "Cấp số cộng" – Toán 11, 2 tiết, lớp học sinh khá',
  },
  observation: {
    label: "Tóm tắt ghi chép dự giờ",
    placeholder: "Dán ghi chép dự giờ thô vào đây để AI hệ thống hóa...",
  },
  review: {
    label: "Rà soát hồ sơ",
    placeholder: "VD: Rà soát các nguồn đã chọn, chỉ ra nội dung thiếu, deadline và minh chứng chưa đủ...",
  },
  report: {
    label: "Dự thảo báo cáo",
    placeholder: "VD: Từ các nguồn đã chọn, soạn dự thảo báo cáo tháng theo cấu trúc: kết quả, hạn chế, nhiệm vụ tiếp theo...",
  },
  kpi: {
    label: "Phân tích KPI",
    placeholder: "VD: Phân tích KPI từ minh chứng đã chọn, nêu chỉ số đủ/chưa đủ dữ liệu và việc cần bổ sung...",
  },
};

interface Msg {
  role: "user" | "model";
  text: string;
  task: Task;
  model?: string;
  sources?: { title: string; text: string }[];
}

/**
 * Trợ lý AI Toán học. Mỗi giáo viên dán khóa Gemini của mình (lưu trong trình duyệt) → gọi thẳng Google Gemini.
 * Nếu không có khóa riêng mà máy chủ của tổ đã cài GEMINI_API_KEY thì dùng máy chủ (cần đăng nhập).
 */
export const AiAssistantModule: React.FC = () => {
  const {
    currentUser,
    loginWithGoogle,
    setNotification,
    isDemoMode,
    departmentPlans,
    teacherPlans,
    lessonPlans,
    meetings,
    observations,
    reportSnapshots,
    config,
  } = useApp();
  const [sourceEdits, setSourceEdits] = useState<Record<string, string>>({});
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const sourceOptions = useMemo(
    () => [
      ...departmentPlans
        .filter((p) => p.academicYear === config.academicYear)
        .map((p) => ({
          id: `plan-${p.id}`,
          title: p.title,
          text: [
            p.generalSituation,
            ...(p.tasks || []).map(
              (t) =>
                `${t.title} | ${t.assignee} | ${t.deadline || t.deadlineText || ""} | ${t.product} | ${t.evidence}`,
            ),
            ...(p.indicators || []).map(
              (t) => `${t.title}: ${t.actual}/${t.target} ${t.unit}`,
            ),
          ].join("\n"),
        })),
      ...teacherPlans
  .filter((p) => p.academicYear === config.academicYear)
  .map((p) => ({
    id: `teacher-plan-${p.id}`,
    title: `KH cá nhân: ${p.title}`,
    text: JSON.stringify({
      title: p.title,
      status: p.status,
      teacherId: p.teacherId,
      teacherName: p.teacherName,
      grade: p.grade,
      subject: p.subject,
      className: p.className,
      otherTasks: p.otherTasks,
      sections: p.sections,
      updatedAt: p.updatedAt,
    }),
  })),

...lessonPlans
  .map((p) => ({
    id: `lesson-${p.id}`,
    title: `Giáo án: ${p.title}`,
    text: JSON.stringify({
      title: p.title,
      topicTitle: p.topicTitle,
      status: p.status,
      teacherId: p.teacherId,
      teacherName: p.teacherName,
      grade: p.grade,
      week: p.week,
      classNames: p.classNames,
      taughtDate: p.taughtDate,
      teachingStatus: p.teachingStatus,
      updatedAt: p.updatedAt,
    }),
  })),
      ...meetings.map((p) => ({
        id: `meeting-${p.id}`,
        title: `Biên bản: ${p.title}`,
        text: JSON.stringify({
          date: p.date,
          title: p.title,
          status: p.status,
          content: p.content,
        }),
      })),
      ...observations.map((p) => ({
        id: `observation-${p.id}`,
        title: `Dự giờ: ${p.lessonName}`,
        text: JSON.stringify({
          date: p.date,
          lesson: p.lessonName,
          activities: p.activitiesObservations,
          evaluation: p.generalEvaluation,
          lessons: p.lessonsLearned,
        }),
      })),
      ...reportSnapshots
        .filter((p) => p.academicYear === config.academicYear)
        .map((p) => ({
          id: `report-${p.id}`,
          title: p.title,
          text: JSON.stringify({
            period: p.periodLabel,
            start: p.startDate,
            end: p.endDate,
            metrics: p.metrics,
            summary: p.executiveSummary,
            advantages: p.advantages,
            limitations: p.limitations,
            directions: p.futureDirections,
          }),
        })),
    ],
    [
      departmentPlans,
      teacherPlans,
      lessonPlans,
      meetings,
      observations,
      reportSnapshots,
      config.academicYear,
    ],
  );
  const chosenSources = sourceOptions
    .filter((s) => sourceIds.includes(s.id))
    .slice(0, 3)
    .map((s) => ({
      title: s.title.slice(0, 120),
      text: (sourceEdits[s.id] ?? s.text).slice(0, 1800),
    }));
  const [task, setTask] = useState<Task>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const [hasKey, setHasKey] = useState(() => !!getStoredKey());
  // Máy chủ của tổ có khóa chung không (dự phòng khi giáo viên chưa dán khóa riêng)
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  useEffect(() => {
    serverAiAvailable().then(setServerReady);
  }, []);
  const canUseServer = !hasKey && serverReady === true;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;
    if (!hasKey && !(canUseServer && currentUser)) {
      setError(
        canUseServer
          ? "Đăng nhập Google để dùng khóa chung của tổ, hoặc dán khóa Gemini của bạn ở trên."
          : 'Hãy dán khóa API Gemini ở ô phía trên rồi bấm "Dò".',
      );
      return;
    }
    setError("");
    const sources = chosenSources;
    request.current = new AbortController();
    const history = messages
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: "user", text: prompt, task }]);
    setInput("");
    setLoading(true);
    try {
      const r = await askAI(
        { task, prompt, history, sources },
        currentUser ? () => currentUser.getIdToken() : undefined,
        request.current.signal,
      );
      setMessages((prev) => [
        ...prev,
        { role: "model", text: r.text, task, model: r.model, sources },
      ]);
    } catch (err) {
      const msg =
        err instanceof Error &&
        (err.name === "AbortError" || err.name === "TimeoutError")
          ? "Đã hủy hoặc quá thời gian chờ AI. Yêu cầu được giữ lại để thử lại."
          : err instanceof Error
            ? err.message
            : String(err);
      setError(
        msg.includes("Failed to fetch")
          ? "Không kết nối được Google Gemini. Kiểm tra kết nối mạng rồi thử lại."
          : msg,
      );
      setMessages((prev) => prev.slice(0, -1));
      setInput(prompt);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotification({
        message: "Đã sao chép nội dung trả lời",
        type: "success",
      });
    } catch {
      setNotification({ message: "Không sao chép được", type: "error" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" /> Trợ lý AI Toán học
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Giải toán, soạn câu hỏi, gợi ý giáo án, rà soát hồ sơ, dự thảo báo cáo và phân tích KPI theo minh chứng. AI chỉ hỗ trợ; người dùng chịu trách nhiệm kiểm tra và phê duyệt nội dung.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            disabled={loading}
            onClick={() => setMessages([])}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg flex items-center gap-1.5 hover:bg-slate-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Cuộc trò chuyện mới
          </button>
        )}
      </div>

      <details className="bg-white border rounded-xl p-3 text-xs">
        <summary className="font-semibold cursor-pointer">
          Chọn nguồn cho AI ({chosenSources.length}/3)
        </summary>
        <p className="py-2">
          Phần trích dưới đây được gửi cùng yêu cầu và tối đa 8 tin nhắn gần
          nhất tới Gemini. Tối đa 3 hồ sơ, 1.800 ký tự mỗi nguồn. Rà soát và bỏ
          thông tin riêng trước khi gửi. AI chưa kiểm chứng tính đúng đắn của
          tài liệu.
        </p>
        {sourceOptions.map((source) => (
          <div key={source.id} className="py-1">
            <label>
              <input
                type="checkbox"
                disabled={
                  loading ||
                  (!sourceIds.includes(source.id) && chosenSources.length >= 3)
                }
                checked={sourceIds.includes(source.id)}
                onChange={(e) =>
                  setSourceIds((prev) =>
                    e.target.checked
                      ? [...prev, source.id]
                      : prev.filter((id) => id !== source.id),
                  )
                }
              />{" "}
              {source.title}
            </label>
            {sourceIds.includes(source.id) && (
              <textarea
                aria-label={`Phần trích gửi AI: ${source.title}`}
                disabled={loading}
                maxLength={1800}
                rows={5}
                value={sourceEdits[source.id] ?? source.text.slice(0, 1800)}
                onChange={(e) =>
                  setSourceEdits((prev) => ({
                    ...prev,
                    [source.id]: e.target.value,
                  }))
                }
                className="whitespace-pre-wrap bg-slate-50 p-2 w-full border rounded"
              />
            )}
          </div>
        ))}
        {!sourceOptions.length && (
          <p>Chưa có hồ sơ làm nguồn. Có thể dán đoạn trích vào yêu cầu.</p>
        )}
      </details>
      <GeminiKeyPanel onChange={setHasKey} />

      {!hasKey && serverReady === false && (
        <div
          className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2"
          data-testid="ai-need-key"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
          <div>
            Dán <strong>khóa API Google Gemini</strong> của thầy/cô vào ô phía
            trên rồi bấm <strong>Dò</strong> để bắt đầu. Khóa miễn phí, tạo
            trong 1 phút tại{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              aistudio.google.com
            </a>{" "}
            (đăng nhập Gmail → Get API key → Create API key → sao chép).
          </div>
        </div>
      )}

      {canUseServer && !currentUser ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <LogIn className="w-8 h-8 text-blue-600 mx-auto" />
          <p className="text-sm text-slate-700">
            Chưa có khóa riêng: đăng nhập Google để dùng khóa chung của tổ, hoặc
            dán khóa Gemini của bạn ở trên.
          </p>
          {isDemoMode && (
            <p className="text-xs text-slate-500">
              Bạn có thể đăng nhập mà vẫn ở chế độ dữ liệu mẫu.
            </p>
          )}
          <button
            onClick={() => loginWithGoogle({ keepDemo: isDemoMode })}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Đăng nhập Google
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col h-[70vh]">
          <div className="flex flex-wrap gap-1.5 p-3 border-b border-slate-100">
            {(Object.keys(TASKS) as Task[]).map((k) => (
              <button
                key={k}
                onClick={() => setTask(k)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${task === k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              >
                {TASKS[k].label}
              </button>
            ))}
          </div>

          <div
            className="flex-1 overflow-y-auto p-4 space-y-4"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div className="text-center text-xs text-slate-500 py-10 space-y-1">
                <Bot className="w-8 h-8 mx-auto text-slate-300" />
                <p>
                  Chọn loại việc ở trên rồi nhập yêu cầu. Công thức viết trong
                  $...$ sẽ được hiển thị đẹp.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}
              >
                {m.role === "model" && (
                  <Bot className="w-6 h-6 p-1 rounded-full bg-blue-100 text-blue-700 shrink-0" />
                )}
                <div
                  className={`max-w-[85%] rounded-xl p-3 text-sm ${m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-50 border border-slate-200 text-slate-800"}`}
                >
                  {m.role === "user" ? (
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  ) : (
                    <>
                      <p className="text-[11px] text-amber-800 mb-2">
                        Nội dung AI tạo — cần kiểm tra trước khi dùng.
                      </p>
                      {!!m.sources?.length && (
                        <details className="text-xs mb-2">
                          <summary>
                            Nguồn đã gửi:{" "}
                            {m.sources.map((s) => s.title).join("; ")}
                          </summary>
                          {m.sources.map((s, i) => (
                            <pre key={i} className="whitespace-pre-wrap">
                              [Nguồn {i + 1}: {s.title}]\n{s.text}
                            </pre>
                          ))}
                        </details>
                      )}
                      <MathText content={m.text} />
                      <div className="flex justify-between items-center mt-2 gap-2">
                        <span className="text-[10px] text-slate-400">
                          {m.model ? `Gemini: ${m.model}` : ""}
                        </span>
                        <button
                          onClick={() => copy(m.text)}
                          className="text-[11px] text-slate-500 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Sao chép
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {m.role === "user" && (
                  <UserIcon className="w-6 h-6 p-1 rounded-full bg-slate-200 text-slate-600 shrink-0" />
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> AI đang soạn câu
                trả lời...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <div className="mx-3 mb-2 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <form
            onSubmit={send}
            className="p-3 border-t border-slate-100 flex gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (
                    e.currentTarget.form as HTMLFormElement | null
                  )?.requestSubmit();
                }
              }}
              rows={2}
              maxLength={chosenSources.length ? 6000 : 12000}
              placeholder={TASKS[task].placeholder}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none"
              aria-label="Nội dung yêu cầu"
            />
            {loading && (
              <button
                type="button"
                onClick={() => request.current?.abort()}
                className="border rounded px-3"
              >
                Hủy
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 flex items-center gap-1.5 text-sm font-semibold"
            >
              <Send className="w-4 h-4" /> Gửi
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
