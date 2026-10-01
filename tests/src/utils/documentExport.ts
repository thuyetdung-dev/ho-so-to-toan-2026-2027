import type { DocumentModel } from "./documentModel";
export interface ExportOptions {
  location: string;
  date: string;
  author: string;
  landscape: boolean;
}
export async function createWord(
  model: DocumentModel,
  options: ExportOptions,
): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    PageOrientation,
    Footer,
    PageNumber,
  } = await import("docx");
  const paragraph = (text: string, bold = false, center = false) =>
    new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      keepNext: bold && !center,
      spacing: { after: 120, line: 300 },
      children: [
        new TextRun({ text, bold, font: "Times New Roman", size: 24 }),
      ],
    });
  const children: any[] = [
    paragraph(model.school, true, true),
    paragraph(model.department, true, true),
    new Paragraph({
      style: "Title",
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: model.title,
          bold: true,
          font: "Times New Roman",
          size: 32,
          color: "000000",
        }),
      ],
    }),
    paragraph(model.subtitle, false, true),
    paragraph(model.status),
  ];
  for (const section of model.sections) {
    if (!section.text && !section.rows?.length) continue;
    children.push(paragraph(section.title, true));
    if (section.text)
      children.push(
        ...section.text.split(/\r?\n/).map((line) => paragraph(line)),
      );
    if (section.headers && section.rows?.length) {
      const rows = [section.headers, ...section.rows];
      const count = section.headers.length;
      const total = options.landscape ? 14338 : 9638;
      const weights =
        count === 7
          ? [5, 23, 14, 13, 21, 14, 10]
          : Array(count).fill(100 / count);
      const widths = weights.map((w) => Math.floor((total * w) / 100));
      widths[count - 1] += total - widths.reduce((a, b) => a + b, 0);
      children.push(
        new Table({
          width: { size: total, type: WidthType.DXA },
          columnWidths: widths,
          rows: rows.map(
            (row, i) =>
              new TableRow({
                tableHeader: i === 0,
            cantSplit: true,
                children: row.map(
                  (cell, j) =>
                    new TableCell({
                      width: { size: widths[j], type: WidthType.DXA },
                      margins: { top: 80, bottom: 80, left: 100, right: 100 },
                      children: String(cell)
                        .split("\n")
                        .map(
                          (t) =>
                            new Paragraph({
                              spacing: { after: 40, line: 260 },
                              children: [
                                new TextRun({
                                  text: t,
                                  bold: i === 0,
                                  font: "Times New Roman",
                                  size: 22,
                                }),
                              ],
                            }),
                        ),
                      borders: Object.fromEntries(
                        ["top", "bottom", "left", "right"].map((k) => [
                          k,
                          {
                            style: BorderStyle.SINGLE,
                            size: 4,
                            color: "D9D9D9",
                          },
                        ]),
                      ),
                    }),
                ),
              }),
          ),
        }),
      );
      children.push(paragraph(""));
    }
  }
  const date = options.date ? options.date.split("-") : [];
  const signature = [
    `${options.location ? `${options.location}, ` : ""}${date.length === 3 ? `ngày ${date[2]} tháng ${date[1]} năm ${date[0]}` : "Ngày ký: chưa khai báo"}`,
    "NGƯỜI LẬP",
    "(Ký, ghi rõ họ tên)",
    "",
    "",
    options.author || "Chưa khai báo người lập",
  ];
  children.push(
    ...signature.map(
      (text, i) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          keepNext: i < signature.length - 1,
          keepLines: true,
          spacing: { after: 80, line: 240 },
          children: [
            new TextRun({
              text,
              bold: i === 1 || i === signature.length - 1,
              font: "Times New Roman",
              size: 24,
            }),
          ],
        }),
    ),
  );

  const doc = new Document({
    creator: options.author,
    title: model.title,
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24, color: "000000" },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
              orientation: options.landscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
            margin: { top: 1134, bottom: 1134, left: 1417, right: 850 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 20,
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}
export async function printElement(element: HTMLElement, title: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1100px;height:1000px";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write("<!doctype html><html><head></head><body></body></html>");
    doc.close();
    doc.title = title;
    document
      .querySelectorAll('style,link[rel="stylesheet"]')
      .forEach((n) => doc.head.appendChild(n.cloneNode(true)));
    doc.body.appendChild(element.cloneNode(true));
    await Promise.all(
      Array.from(doc.querySelectorAll("link")).map(
        (l) =>
          new Promise<void>((r) => {
            l.onload = () => r();
            l.onerror = () => r();
            setTimeout(r, 3000);
          }),
      ),
    );
    await doc.fonts.ready;
    frame.contentWindow!.addEventListener("afterprint", () => frame.remove(), {
      once: true,
    });
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 60000);
  } catch (e) {
    frame.remove();
    throw e;
  }
}
