import { describe, expect, it } from "./helpers/vitest-shim.ts";
import { layoutPages, type PdfItem } from "../src/report/pdf-layout";

const item = (str: string, x: number, y: number, h = 13, w = str.length * 6): PdfItem => ({
  str,
  x,
  y,
  w,
  h,
});

describe("chú thích cuối trang và số trang trong PDF", () => {
  it("bỏ số chú thích nhỏ dính vào chữ và phần chú thích cuối trang", () => {
    const page1: PdfItem[] = [
      item("Chỉ đạo tổ, nhóm bộ môn nghiên cứu tài liệu do Bộ GDĐT tổ chức", 60, 700),
      item("1", 440, 705, 8, 4), // số chú thích đặt cao, cỡ nhỏ
      item(". Xây dựng ma trận, thiết kế đề kiểm", 446, 700),
      item("1 Công văn số 3899/BGDĐT-GDTrH ngày 03/8/2026 của Bộ GDĐT.", 60, 80, 9),
      item("12", 300, 40),
    ];
    const page2: PdfItem[] = [item("tra định kỳ phù hợp với yêu cầu cần đạt.", 60, 760), item("13", 300, 40)];
    const text = layoutPages([page1, page2]);
    expect(text).toContain("do Bộ GDĐT tổ chức");
    expect(text).not.toMatch(/tổ chức\s*1\b/);
    expect(text).not.toContain("3899");
    expect(text).not.toMatch(/^\s*1[23]\s*$/m);
  });

  it("giữ bảng chữ nhỏ ở cuối trang (không phải chú thích)", () => {
    const page: PdfItem[] = [
      item("Lịch kiểm tra giữa kỳ của tổ như sau:", 60, 700),
      item("Khối 12: kiểm tra ngày 20/10", 60, 120, 9),
    ];
    expect(layoutPages([page])).toContain("Khối 12: kiểm tra ngày 20/10");
  });
});
