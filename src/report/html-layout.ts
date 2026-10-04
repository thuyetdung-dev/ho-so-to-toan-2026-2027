import { CELL_SEP, ROW_MARK } from "./pdf-layout";

/**
 * Chuyển HTML (từ file Word qua mammoth) thành chữ theo dòng; mỗi hàng bảng thành một dòng
 * "§ROW§ ô1 ¦ ô2 ¦ …" giống cách đọc bảng trong PDF. Cần DOMParser (trình duyệt hoặc jsdom).
 */
export function htmlToLayout(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const out: string[] = [];
  const text = (el: Element) => (el.textContent || "").replace(/\s+/g, " ").trim();
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === "table") {
        for (const tr of Array.from(child.querySelectorAll("tr"))) {
          // bảng lồng nhau: chỉ lấy ô trực tiếp của hàng
          const cells = Array.from(tr.children).filter((c) => /^(td|th)$/i.test(c.tagName));
          const values = cells.map(
            (c) => Array.from(c.querySelectorAll("p, li")).map(text).filter(Boolean).join(" ") || text(c),
          );
          if (values.some(Boolean)) out.push(ROW_MARK + " " + values.join(CELL_SEP));
        }
        out.push("");
      } else if (tag === "ul" || tag === "ol") {
        for (const li of Array.from(child.children)) out.push("- " + text(li));
      } else if (/^(p|h[1-6])$/.test(tag)) {
        const t = text(child);
        if (t) out.push(t);
      } else walk(child);
    }
  };
  walk(doc.body);
  return out.join("\n");
}
