import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDeadline,
  parseProfessionalGrid,
  mergeTasks,
  taskStats,
} from "../src/utils/professional.ts";
import { readProfessionalSource } from "../src/utils/professionalSource.ts";
import { asyncCache } from "../src/utils/asyncCache.ts";
import { createWord } from "../src/utils/documentExport.ts";
import { planDocument, reportDocument } from "../src/utils/documentModel.ts";
import JSZip from "jszip";
test("ngày Việt Nam hợp lệ; giữ thời hạn tháng/range mơ hồ để rà soát", () => {
  assert.equal(parseDeadline("ngày 12 tháng 9 năm 2026"), "2026-09-12");
  assert.equal(parseDeadline("31/02/2026"), "");
  assert.equal(parseDeadline("Tháng 10"), "");
  assert.equal(parseDeadline("01/09/2026 - 30/09/2026"), "");
});
test("cột đúng: tách đầu việc, không đưa căn cứ pháp lý thành nhiệm vụ; giữ nguồn và ngày chữ", () => {
  const r = parseProfessionalGrid(
    {
      context: "",
      rows: [
        ["Nội dung", "Người thực hiện", "Thời hạn", "Sản phẩm"],
        ["Công văn số 5512", "", "", ""],
        ["Soạn đề", "Đặng An", "Tháng 10", "Ma trận"],
        ["Soạn đề", "Đặng An", "Tháng 11", "Ma trận"],
        ["Soạn đề", "Đặng An", "Tháng 10", "Ma trận"],
        ["", "", "", "Sản phẩm thiếu tên"],
      ],
    },
    "PPCT.xlsx",
    2,
  );
  assert.equal(r.tasks.length, 2);
  assert.equal(r.tasks[0].deadline, "");
  assert.equal(r.tasks[0].source?.row, 3);
  assert.equal(r.tasks[0].source?.table, 3);
  assert.equal(r.issues.length, 6);
  assert.equal(mergeTasks(r.tasks, r.tasks).duplicates, 2);
});
test("JSON whitelist không nhập trạng thái duyệt/quyền và UTF-8 BOM", async () => {
  const f = new File(
    [
      "\uFEFF" +
        JSON.stringify({
          tasks: [
            {
              title: "Họp tổ",
              assignee: "A",
              deadline: "2026-10-01",
              status: "approved",
              createdById: "admin",
            },
          ],
          indicators: [
            { title: "Chuyên đề", target: 2, actual: 1, unit: "buổi" },
          ],
        }),
    ],
    "x.json",
  );
  const r = await readProfessionalSource(f, { ocr: false });
  const task = parseProfessionalGrid(r.grids[0], f.name, 0).tasks[0];
  assert.equal(task.status, "pending");
  assert.equal(task.deadline, "2026-10-01");
  assert.equal(
    parseProfessionalGrid(r.grids[1], f.name, 1).indicators[0].target,
    "2",
  );
  await assert.rejects(
    readProfessionalSource(new File([new Uint8Array([255])], "bad.txt"), {
      ocr: false,
    }),
    /UTF-8/,
  );
  await assert.rejects(
    readProfessionalSource(new File(["{}"], "empty.json"), { ocr: false }),
    /chưa có/,
  );
});
test("cảnh báo quá hạn chỉ cho việc chưa hoàn thành và thiếu minh chứng", () => {
  const t = parseProfessionalGrid(
    {
      context: "",
      rows: [
        ["Nội dung", "Người thực hiện", "Thời hạn"],
        ["A", "B", "01/09/2026"],
        ["C", "B", "01/09/2026"],
      ],
    },
    "a",
    0,
  ).tasks;
  t[1].status = "completed";
  assert.deepEqual(taskStats(t, "2026-09-30"), {
    total: 2,
    completed: 1,
    overdue: 1,
    missingEvidence: 1,
  });
});
test("cache gộp tải đồng thời, retry lỗi và xóa khi chuyển người dùng", async () => {
  const cache = asyncCache<number>(2);
  let reads = 0;
  const load = async () => ++reads;
  assert.deepEqual(
    await Promise.all([cache.get("a", load), cache.get("a", load)]),
    [1, 1],
  );
  await cache.get("b", load);
  await cache.get("c", load);
  assert.equal(cache.size, 2);
  await cache.get("a", load);
  assert.equal(reads, 4);
  await assert.rejects(
    cache.get("err", async () => {
      throw Error("offline");
    }),
  );
  assert.equal(await cache.get("err", load), 5);
  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(await cache.get("err", load), 6);
});
test("Word chứa toàn bộ công việc qua trang UI thứ hai; bảng/chữ có thoát XML, trạng thái và số liệu đóng băng", async () => {
  const tasks = Array.from({ length: 28 }, (_, i) => ({
    id: String(i),
    title: `Công việc ${i + 1} & <kiểm tra>`,
    category: "Định kỳ",
    assignee: "Nguyễn An",
    deadline: "2026-10-01",
    product: "Đề",
    evidence: "https://example.org/evidence",
    status: "pending" as const,
  }));
  const model = planDocument(
    {
      title: "Kế hoạch tổ",
      generalSituation: "Nội dung kế hoạch",
      academicYear: "2026-2027",
      version: 2,
      status: "draft",
      createdBy: "Nguyễn An",
      tasks,
      indicators: [],
    } as any,
    { schoolName: "Trường mẫu", departmentName: "Tổ Toán" },
  );
  const blob = await createWord(model, {
    location: "Huế",
    date: "2026-09-30",
    author: "Nguyễn An",
    landscape: true,
  });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /Công việc 28 &amp; &lt;kiểm tra&gt;/);
  assert.match(xml, /w:tblHeader/);
  assert.match(xml, /w:orient="landscape"/);
  const report = reportDocument(
    {
      title: "Báo cáo",
      academicYear: "2026-2027",
      isLocked: true,
      metrics: {
        meetingsCount: 7,
        membersCount: 4,
        lessonStudyCount: 2,
        observationsCount: 3,
      },
      executiveSummary: "",
      advantages: "",
      limitations: "",
      futureDirections: "",
      finalizedBy: "",
    },
    { schoolName: "", departmentName: "" },
  );
  assert.equal(report.status, "Báo cáo đã chốt");
  assert.deepEqual(
    report.sections[0].rows?.find((r) => r[0] === "Cuộc họp đã chốt"),
    ["Cuộc họp đã chốt", "7"],
  );
});
