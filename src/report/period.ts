import type { Period } from "./types";

export const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

export function currentPeriod(now = new Date()): Period {
  return { month: String(now.getMonth() + 1).padStart(2, "0"), year: String(now.getFullYear()) };
}

/** Danh sách năm cho ô chọn: 2 năm trước → 1 năm sau, luôn chứa năm đang chọn. */
export function yearOptions(selected: string, now = new Date()): string[] {
  const y = now.getFullYear();
  const list = [y - 2, y - 1, y, y + 1].map(String);
  if (!list.includes(selected)) list.push(selected);
  return list.sort();
}

export function nextPeriod({ month, year }: Period): Period {
  const m = Number(month);
  return m === 12
    ? { month: "01", year: String(Number(year) + 1) }
    : { month: String(m + 1).padStart(2, "0"), year };
}

export function periodKey({ month, year }: Period) {
  return `${year}-${month}`;
}

export function periodLabel({ month, year }: Period) {
  return `${month}/${year}`;
}
