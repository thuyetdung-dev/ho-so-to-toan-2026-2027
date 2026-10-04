import type { ReportModel } from "./report-model";

/** Tạo file Word (.docx) từ mô hình báo cáo. */
export async function buildDocx(model: ReportModel): Promise<Blob> {
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
    HeadingLevel,
    PageBreak,
    ShadingType,
    BorderStyle,
    TableLayoutType,
  } = await import("docx");

  const FONT = "Times New Roman";
  // Khổ A4 (11906 dxa) trừ lề trái 3 cm và lề phải 2 cm → vùng chữ ≈ 9071 dxa
  const CONTENT = 11906 - 1701 - 1134;
  const dxa = (percent: number) => Math.round((CONTENT * percent) / 100);
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = {
    top: none,
    bottom: none,
    left: none,
    right: none,
    insideHorizontal: none,
    insideVertical: none,
  };

  const centered = (
    text: string,
    opts: {
      bold?: boolean;
      italics?: boolean;
      size?: number;
      before?: number;
      after?: number;
      underline?: boolean;
    } = {},
  ) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: opts.before ?? 0, after: opts.after ?? 0 },
      children: [
        new TextRun({
          text,
          bold: opts.bold,
          italics: opts.italics,
          size: opts.size,
          underline: opts.underline ? {} : undefined,
        }),
      ],
    });

  const cell = (text: string, width: number, header = false) =>
    new TableCell({
      width: { size: dxa(width), type: WidthType.DXA },
      shading: header ? { fill: "D9EAF4", type: ShadingType.CLEAR, color: "auto" } : undefined,
      children: [
        new Paragraph({
          alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text, bold: header, size: 24 })],
        }),
      ],
    });

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

  if (model.template === "admin") {
    const { left, right, dateLine } = model.letterhead;
    // Cỡ chữ 11–12 pt để tên trường và quốc hiệu nằm gọn trên một dòng
    const col = (lines: string[], boldFrom: number, sizes: (i: number) => number) =>
      lines.map((l, i) =>
        centered(l, { bold: i >= boldFrom, size: sizes(i), underline: i === lines.length - 1 }),
      );
    const tight = { left: 0, right: 0, top: 0, bottom: 0 };
    children.push(
      new Table({
        width: { size: CONTENT, type: WidthType.DXA },
        columnWidths: [dxa(43), dxa(57)],
        layout: TableLayoutType.FIXED,
        borders: noBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: dxa(43), type: WidthType.DXA },
                borders: noBorders,
                margins: tight,
                children: col(left, left.length - 2, () => 23),
              }),
              new TableCell({
                width: { size: dxa(57), type: WidthType.DXA },
                borders: noBorders,
                margins: tight,
                children: col(right, 0, (i) => (i === 0 ? 23 : 25)),
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 200, after: 300 },
        children: [new TextRun({ text: dateLine, italics: true })],
      }),
      centered(model.title[0], { bold: true, size: 30 }),
      centered(model.title[1], { bold: true, size: 26, after: 300 }),
    );
  } else {
    const [title, sub, teacher, school] = model.cover;
    children.push(
      centered(title, { bold: true, size: 38, before: 2400, after: 220 }),
      centered(sub, { bold: true, size: 32 }),
      centered(teacher, { bold: true, size: 26, before: 400 }),
      centered(school, { size: 25 }),
      new Paragraph({ children: [new PageBreak()] }),
    );
  }

  for (const b of model.blocks) {
    if (b.kind === "heading")
      children.push(
        new Paragraph({
          text: b.text,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        }),
      );
    else if (b.kind === "para")
      children.push(new Paragraph({ children: [new TextRun({ text: b.text, italics: b.italic })] }));
    else if (b.kind === "bullets")
      b.items.forEach((t) => children.push(new Paragraph({ text: t, bullet: { level: 0 } })));
    else if (b.kind === "checklist") b.items.forEach((t) => children.push(new Paragraph("☐ " + t)));
    else
      children.push(
        new Table({
          width: { size: CONTENT, type: WidthType.DXA },
          columnWidths: b.widths.map(dxa),
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({ tableHeader: true, children: b.head.map((h, i) => cell(h, b.widths[i], true)) }),
            ...b.rows.map((r) => new TableRow({ children: r.map((v, i) => cell(v, b.widths[i])) })),
          ],
        }),
      );
  }

  const sig = model.signature;
  const sigCell = (s: { title: string; note?: string; name: string } | undefined) =>
    new TableCell({
      width: { size: dxa(50), type: WidthType.DXA },
      borders: noBorders,
      children: s
        ? [
            centered(s.title, { bold: true }),
            centered(s.note || "", { italics: true }),
            centered("", { before: 900 }),
            centered(s.name, { bold: true }),
          ]
        : [new Paragraph("")],
    });
  children.push(
    new Paragraph({ spacing: { before: 400 }, children: [] }),
    new Table({
      width: { size: CONTENT, type: WidthType.DXA },
      columnWidths: [dxa(50), dxa(50)],
      layout: TableLayoutType.FIXED,
      borders: noBorders,
      rows: [new TableRow({ children: [sigCell(sig.left), sigCell(sig.right)] })],
    }),
  );

  const doc = new Document({
    creator: "Báo cáo tự động – Tổ Toán",
    styles: {
      default: {
        document: { run: { font: FONT, size: 26 }, paragraph: { spacing: { after: 80, line: 300 } } },
      },
      paragraphStyles: [
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { font: FONT, bold: true, size: 26, color: "000000" },
        },
      ],
    },
    sections: [
      { properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 } } }, children },
    ],
  });
  return Packer.toBlob(doc);
}
