import { describe, expect, it } from "./helpers/vitest-shim.ts";
import { parseTimePhrase, scheduleTasks, sortByDate, timeLabel, toISO, weekdayOf } from "../src/report/schedule";
import type { Task } from "../src/report/types";

const sep = { month: "09", year: "2026" };
const iso = (t: string, o = {}) => {
  const d = parseTimePhrase(t, sep, o).date;
  return d ? toISO(d) : undefined;
};
const task = (time: string, work = "Việc " + time): Task => ({
  id: work,
  time,
  work,
  source: "x",
  status: "Chưa làm",
});

describe("đọc cụm thời gian thành ngày cụ thể", () => {
  it("thứ trong tuần đúng lịch", () => {
    expect(weekdayOf("2026-09-01")).toBe("Thứ Ba");
    expect(weekdayOf("2026-09-20")).toBe("Chủ nhật");
  });
  it('"Trước ngày X" giữ nguyên mốc hạn chính thức', () => {
    expect(iso("Trước 20/09/2026")).toBe("2026-09-20");
    expect(iso("Trước 20/09/2026", { workSaturday: true })).toBe("2026-09-20");
    expect(iso("trước ngày 25/9")).toBe("2026-09-25");
    expect(iso("trước ngày 12 tháng 9 năm 2026")).toBe("2026-09-12");
  });
  it("đến / chậm nhất / vào ngày giữ đúng ngày, đọc cả giờ", () => {
    expect(iso("Đến 19/09/2026")).toBe("2026-09-19");
    expect(iso("chậm nhất ngày 28/9/2026")).toBe("2026-09-28");
    expect(parseTimePhrase("Vào ngày 30/9/2026, 14g00", sep)).toEqual({
      date: new Date(2026, 8, 30),
      clock: "14g00",
    });
    expect(parseTimePhrase("15/09, 8 giờ 30", sep).clock).toBe("08g30");
    expect(parseTimePhrase("Tuần 2 học kỳ", sep).clock).toBeUndefined();
  });
  it("ngày trích dẫn văn bản (quá xa tháng báo cáo) không phải hạn", () => {
    expect(iso("Ngày 24/6/2023")).toBeUndefined();
    expect(iso("05/10/2026")).toBe("2026-10-05"); // hạn sang đầu tháng sau vẫn nhận
  });
  it("tuần, đầu/giữa/cuối tháng", () => {
    expect(iso("Tuần 2")).toBe("2026-09-11"); // tuần 7–13/9 → thứ Sáu 11/9
    expect(iso("Tuần 1")).toBe("2026-09-04");
    expect(iso("Cuối tháng")).toBe("2026-09-30");
    expect(iso("Đầu tháng")).toBe("2026-09-01");
    expect(iso("Giữa tháng")).toBe("2026-09-15");
    expect(iso("Trong tháng")).toBeUndefined();
  });
});

describe("xếp lịch cả danh sách", () => {
  const list = [
    task("Trong tháng", "A"),
    task("Trước 19/09/2026", "B"),
    task("Trong tháng", "C"),
    task("Trong tháng", "D"),
    task("Trước 25/09/2026", "E"),
    task("Trong tháng", "F"),
  ];
  const out = scheduleTasks(list, sep);
  const by = (w: string) => out.find((t) => t.work === w)!;

  it("mọi đầu việc đều có ngày cụ thể; ngày tự xếp là ngày làm việc", () => {
    for (const t of out) {
      expect(t.date).toMatch(/^2026-09-\d\d$/);
      if (t.auto) expect(["Thứ Bảy", "Chủ nhật"]).not.toContain(weekdayOf(t.date!));
    }
  });
  it("việc không ghi ngày nằm giữa hai mốc trước và sau nó, được đánh dấu tự xếp", () => {
    expect(by("B").date).toBe("2026-09-19");
    expect(by("B").auto).toBe(false);
    expect(by("A").date! < by("B").date!).toBe(true);
    expect(by("C").date! >= by("B").date! && by("D").date! <= by("E").date!).toBe(true);
    expect(by("C").date! <= by("D").date!).toBe(true);
    expect(by("F").date! >= by("E").date!).toBe(true);
    expect([by("A"), by("C"), by("D"), by("F")].every((t) => t.auto)).toBe(true);
  });
  it("không đổi ngày người dùng đã chọn", () => {
    const again = scheduleTasks([{ ...task("Trong tháng", "X"), date: "2026-09-07" }], sep);
    expect(again[0].date).toBe("2026-09-07");
  });
  it("nhãn thời gian đầy đủ và sắp xếp theo ngày", () => {
    expect(timeLabel({ time: "", date: "2026-09-30", clock: "14g00" })).toBe("Thứ Tư, 30/09/2026 · 14g00");
    const sorted = sortByDate(out).map((t) => t.date);
    expect([...sorted].sort()).toEqual(sorted);
  });
});

describe("ngày ban hành văn bản", async () => {
  const { detectIssueDate } = await import("../src/report/schedule");
  it("đọc được hai kiểu ghi ngày ban hành", () => {
    expect(detectIssueDate("TP. Hồ Chí Minh, ngày 17 tháng 9 năm 2026\nKẾ HOẠCH")).toBe("2026-09-17");
    expect(detectIssueDate("(Theo Kế hoạch số 447/KH-PĐL ngày 17/09/2026 của Trường)")).toBe("2026-09-17");
    expect(detectIssueDate("Không có ngày")).toBeUndefined();
  });
  it("việc tự xếp không rơi vào trước ngày ban hành", () => {
    const out = scheduleTasks(
      [task("Trong tháng", "A"), task("Trong tháng", "B"), task("Trước 25/09/2026", "C")],
      sep,
      {
        notBefore: "2026-09-17",
      },
    );
    expect(out.filter((t) => t.auto).every((t) => t.date! >= "2026-09-17" && t.date! <= "2026-09-24")).toBe(
      true,
    );
  });
});
