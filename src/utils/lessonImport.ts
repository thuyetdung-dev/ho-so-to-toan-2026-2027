/**
 * Nhập Kế hoạch bài dạy từ tệp Word (.docx) hoặc PDF theo cấu trúc Phụ lục IV – CV 5512:
 *   I. MỤC TIÊU (1. Kiến thức, 2. Năng lực, 3. Phẩm chất)
 *   II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU
 *   III. TIẾN TRÌNH DẠY HỌC (Hoạt động 1..n, mỗi hoạt động a) Mục tiêu b) Nội dung c) Sản phẩm d) Tổ chức thực hiện)
 *
 * Phần đọc tệp (docx/pdf → văn bản) nằm ở extractTextFromFile; phần tách mục (parseLessonText)
 * là hàm thuần để kiểm thử được.
 */

export interface ImportedActivity {
  name: string;
  objectives: string;
  content: string;
  product: string;
  implementation: string;
}

export interface ImportedLesson {
  title?: string;
  topicTitle?: string;
  periodCount?: number;
  objectivesKnowledge: string;
  objectivesCompetence: string;
  objectivesQualities: string;
  equipment: string;
  activities: ImportedActivity[];
  /** Có nhận ra được cấu trúc CV 5512 hay không */
  recognized: boolean;
  /** Toàn bộ văn bản đã đọc (để dự phòng khi không nhận ra cấu trúc) */
  rawText: string;
}

type Section =
  | 'none'
  | 'knowledge'
  | 'competence'
  | 'qualities'
  | 'objectivesGeneral'
  | 'equipment'
  | 'process'
  | 'act_obj'
  | 'act_content'
  | 'act_product'
  | 'act_impl'
  | 'act_intro'
  | 'end';

// Bỏ ký hiệu gạch đầu dòng ở đầu dòng (-, +, •, *, ▪...)
const stripBullet = (s: string) => s.replace(/^[\s\-–—+•*▪◦●○·]+/, '').trim();

/** Phần chữ còn lại sau tiêu đề mục, ví dụ "1. Về kiến thức: Học sinh..." → "Học sinh..." */
function rest(line: string, re: RegExp): string {
  const m = line.match(re);
  if (!m) return '';
  return line.slice((m.index || 0) + m[0].length).replace(/^[\s:.\-–—]+/, '').trim();
}

const RE = {
  objectives: /^(I|1)\s*[.)]\s*MỤC\s*TIÊU\b/iu,
  // Tiêu đề không đánh số (Word tự đánh số) – chỉ nhận khi VIẾT HOA để tránh nhầm với "Mục tiêu:" trong hoạt động
  objectivesU: /^MỤC\s*TIÊU(\s*(BÀI\s*(DẠY|HỌC)|CẦN\s*ĐẠT))?\b/u,
  // Cần có số thứ tự ("1.") hoặc chữ "Về", hoặc dạng "Kiến thức:" – tránh nhận nhầm câu thường
  knowledge: /^(\d+\s*[.)]\s*(về\s+)?|về\s+)kiến\s+thức|^kiến\s+thức\s*:/iu,
  competence: /^(\d+\s*[.)]\s*(về\s+)?|về\s+)năng\s+lực|^năng\s+lực\s*:/iu,
  qualities: /^(\d+\s*[.)]\s*(về\s+)?|về\s+)phẩm\s+chất|^phẩm\s+chất\s*:/iu,
  equipment: /^(II|2)\s*[.)]\s*THIẾT\s*BỊ/iu,
  equipmentU: /^THIẾT\s*BỊ\s*DẠY\s*HỌC/u,
  process: /^(III|3)\s*[.)]\s*TIẾN\s*TRÌNH\b/iu,
  processU: /^TIẾN\s*TRÌNH\s*DẠY\s*HỌC/u,
  end: /^(IV|4)\s*[.)]\s*(ĐIỀU\s*CHỈNH|RÚT\s*KINH\s*NGHIỆM|PHỤ\s*LỤC|HỒ\s*SƠ)|^PHỤ\s*LỤC\b|^RÚT\s*KINH\s*NGHIỆM\b/iu,
  activity: /^(\d+\s*[.)]\s*)?HOẠT\s*ĐỘNG\s*\d+\b/iu,
  // a) b) c) d) có thể do Word tự đánh số (không có trong chữ) → khi đó cần dấu ":" hoặc hết dòng
  actObj: /^(?:a\s*[.)]\s*Mục\s*tiêu|Mục\s*tiêu\s*(?=:|$))/iu,
  actContent: /^(?:b\s*[.)]\s*Nội\s*dung|Nội\s*dung\s*(?=:|$))/iu,
  actProduct: /^(?:c\s*[.)]\s*Sản\s*phẩm|Sản\s*phẩm\s*(?=:|$))/iu,
  actImpl: /^(?:d\s*[.)]\s*Tổ\s*chức\s*(thực\s*hiện)?|Tổ\s*chức\s*thực\s*hiện\s*(?=:|$))/iu,
  title: /^(Tên\s*bài\s*(dạy|học)?\s*[:.]|(BÀI|Bài|TIẾT|Tiết)\s*\d+\s*[.:\-–])/u,
  chapter: /^(CHƯƠNG|Chương|CHỦ\s*ĐỀ|Chủ\s*đề)\s+[IVXLC\d]+/u,
  periods: /(Thời\s*(gian|lượng)(\s*thực\s*hiện)?|Số\s*tiết)\s*[:\-–]?\s*\(?\s*(\d{1,2})\s*tiết/iu,
};

export function parseLessonText(text: string): ImportedLesson {
  const rawLines = text
    .normalize('NFC')
    .replace(/\r/g, '')
    .split('\n')
    // Ký hiệu gạch đầu dòng của phông Symbol/Wingdings (vùng U+F000–F0FF) → "- "
    .map(l => l.replace(/^[\s\uF000-\uF0FF•▪◦●○·]+(?=\S)/u, m => (/[\uF000-\uF0FF•▪◦●○·]/u.test(m) ? '- ' : '')))
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Nối dòng bị ngắt giữa chừng (thường gặp khi đọc PDF): dòng bắt đầu bằng chữ thường
  // được nối vào dòng trước; dòng tiêu đề chương/bài viết hoa bị xuống dòng cũng được nối lại.
  const isLower = (ch: string) => ch !== ch.toUpperCase() && ch === ch.toLowerCase();
  const isAllUpper = (l: string) => /\p{L}/u.test(l) && l === l.toUpperCase();
  const isHeading = (l: string) =>
    Object.values(RE).some(re => re !== RE.periods && re.test(stripBullet(l)));
  const lines: string[] = [];
  for (const l of rawLines) {
    const prev = lines[lines.length - 1];
    if (prev && isLower(l[0]) && !/[.:;!?]$/.test(prev) && !isHeading(l)) {
      lines[lines.length - 1] = `${prev} ${l}`;
    } else if (prev && (RE.chapter.test(prev) || RE.title.test(prev)) && isAllUpper(l) && isAllUpper(prev) && !isHeading(l)) {
      lines[lines.length - 1] = `${prev} ${l}`;
    } else {
      lines.push(l);
    }
  }

  const out: ImportedLesson = {
    objectivesKnowledge: '',
    objectivesCompetence: '',
    objectivesQualities: '',
    equipment: '',
    activities: [],
    recognized: false,
    rawText: lines.join('\n'),
  };

  let section: Section = 'none';
  let current: ImportedActivity | null = null;
  const buf: Record<string, string[]> = { knowledge: [], competence: [], qualities: [], equipment: [], objectivesGeneral: [] };
  let seenProcess = false;
  let seenObjectives = false;

  const push = (key: keyof typeof buf, s: string) => {
    if (s) buf[key].push(s);
  };
  const pushAct = (field: keyof ImportedActivity, s: string) => {
    if (!current || !s) return;
    current[field] = current[field] ? `${current[field]}\n${s}` : s;
  };
  const newActivity = (name: string) => {
    current = { name, objectives: '', content: '', product: '', implementation: '' };
    out.activities.push(current);
  };

  for (const rawLine of lines) {
    const line = stripBullet(rawLine) || rawLine;
    if (section === 'end') break;

    // Thông tin chung trước phần Mục tiêu
    if (!seenObjectives && !seenProcess) {
      const pm = line.match(RE.periods);
      if (pm && !out.periodCount) out.periodCount = Number(pm[4]);
      if (!out.topicTitle && RE.chapter.test(line)) {
        out.topicTitle = line.replace(/[.\s]+$/, '');
        continue;
      }
      if (!out.title && RE.title.test(line)) {
        out.title = line.replace(/^Tên\s*bài\s*(dạy|học)?\s*[:.]\s*/iu, '').replace(/[.\s]+$/, '');
        continue;
      }
    }

    if (RE.end.test(line)) {
      section = 'end';
      continue;
    }
    if (RE.objectives.test(line) || RE.objectivesU.test(line)) {
      seenObjectives = true;
      section = 'objectivesGeneral';
      push('objectivesGeneral', rest(line, RE.objectives.test(line) ? RE.objectives : RE.objectivesU));
      continue;
    }
    if (RE.equipment.test(line) || RE.equipmentU.test(line)) {
      section = 'equipment';
      push('equipment', rest(line, /^(II|2)\s*[.)]\s*THIẾT\s*BỊ\s*DẠY\s*HỌC(\s*VÀ\s*HỌC\s*LIỆU)?|^THIẾT\s*BỊ\s*DẠY\s*HỌC(\s*VÀ\s*HỌC\s*LIỆU)?/iu));
      continue;
    }
    if (RE.process.test(line) || RE.processU.test(line)) {
      seenProcess = true;
      section = 'process';
      continue;
    }

    if (seenProcess) {
      if (RE.activity.test(line)) {
        newActivity(line.replace(/^\d+\s*[.)]\s*/, '').replace(/[.\s]+$/, ''));
        section = 'act_intro';
        continue;
      }
      if (!current) continue; // chữ giữa "III." và "Hoạt động 1" – bỏ qua
      if (RE.actObj.test(line)) {
        section = 'act_obj';
        pushAct('objectives', rest(line, RE.actObj));
        continue;
      }
      if (RE.actContent.test(line)) {
        section = 'act_content';
        pushAct('content', rest(line, RE.actContent));
        continue;
      }
      if (RE.actProduct.test(line)) {
        section = 'act_product';
        pushAct('product', rest(line, RE.actProduct));
        continue;
      }
      if (RE.actImpl.test(line)) {
        section = 'act_impl';
        pushAct('implementation', rest(line, RE.actImpl));
        continue;
      }
      const field: keyof ImportedActivity =
        section === 'act_obj' ? 'objectives' : section === 'act_product' ? 'product' : section === 'act_impl' ? 'implementation' : 'content';
      pushAct(field, rawLine);
      continue;
    }

    if (seenObjectives) {
      if (section !== 'equipment') {
        if (RE.knowledge.test(line) && section !== 'knowledge') {
          section = 'knowledge';
          push('knowledge', rest(line, RE.knowledge));
          continue;
        }
        if (RE.competence.test(line) && section !== 'competence') {
          section = 'competence';
          push('competence', rest(line, RE.competence));
          continue;
        }
        if (RE.qualities.test(line) && section !== 'qualities') {
          section = 'qualities';
          push('qualities', rest(line, RE.qualities));
          continue;
        }
      }
      if (section === 'knowledge' || section === 'competence' || section === 'qualities' || section === 'equipment' || section === 'objectivesGeneral') {
        push(section, rawLine);
      }
    }
  }

  out.objectivesKnowledge = [...buf.objectivesGeneral, ...buf.knowledge].join('\n').trim();
  out.objectivesCompetence = buf.competence.join('\n').trim();
  out.objectivesQualities = buf.qualities.join('\n').trim();
  out.equipment = buf.equipment.join('\n').trim();
  out.activities = out.activities.map(a => ({
    ...a,
    objectives: a.objectives.trim(),
    content: a.content.trim(),
    product: a.product.trim(),
    implementation: a.implementation.trim(),
  }));
  out.recognized = seenObjectives || seenProcess || out.activities.length > 0;
  return out;
}

export interface PdfTextItem {
  str?: string;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
}

/**
 * Ghép các mảnh chữ của một trang PDF thành các dòng theo tọa độ.
 * Nhiều PDF tiếng Việt vẽ chữ có dấu (ư, ờ, ế...) bằng một phông dự phòng, chồng lên chỗ trống
 * của dòng chữ chính → nếu ghép theo thứ tự xuất hiện sẽ ra "Tr ng ... ườ". Ở đây: gom theo dòng (y),
 * sắp theo x, và thay khoảng trắng bị chồng bởi mảnh chữ khác.
 */
export function pdfItemsToText(items: PdfTextItem[]): string {
  type Piece = { s: string; x: number; y: number; w: number };
  const pieces: Piece[] = items
    .filter(it => typeof it.str === 'string' && it.str.length > 0 && Array.isArray(it.transform))
    .map(it => ({ s: it.str as string, x: it.transform![4], y: it.transform![5], w: it.width || 0 }));
  // Gom dòng theo y (sai số 2pt)
  const lines: Piece[][] = [];
  for (const pc of pieces) {
    const line = lines.find(l => Math.abs(l[0].y - pc.y) <= 2);
    if (line) line.push(pc);
    else lines.push([pc]);
  }
  lines.sort((a, b) => b[0].y - a[0].y);
  return lines
    .map(line => {
      const sorted = [...line].sort((a, b) => a.x - b.x);
      // Bỏ khoảng trắng bị một mảnh chữ khác vẽ chồng lên cùng vị trí
      const kept = sorted.filter(
        pc => !(pc.s.trim() === '' && sorted.some(o => o !== pc && o.s.trim() !== '' && Math.abs(o.x - pc.x) < 1)),
      );
      let text = '';
      let end = -Infinity;
      for (const pc of kept) {
        if (text && pc.x - end > 2 && !text.endsWith(' ') && !pc.s.startsWith(' ')) text += ' ';
        text += pc.s;
        end = Math.max(end, pc.x + pc.w);
      }
      return text;
    })
    .join('\n');
}

/** Đọc văn bản từ tệp .docx (mammoth) hoặc .pdf (pdf.js). Thư viện được tải khi cần. */
export interface ExtractResult {
  text: string;
  images: Record<string, string>;
  /** Ghi chú cho người dùng (số công thức, hình đã nhập, phần không chuyển được) */
  notes: string[];
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith('.docx')) {
    const { readDocx, compressImageInBrowser } = await import('./docxReader');
    try {
      // Bản 2.4: hình lưu riêng từng bản ghi → cho phép tổng dung lượng hình lớn (tối đa 60 hình)
      const r = await readDocx(buffer, { processImage: compressImageInBrowser, imageBudget: 40_000_000, maxImages: 60 });
      const notes: string[] = [];
      if (r.equations) notes.push(`${r.equations} công thức Word đã chuyển sang LaTeX`);
      if (r.imageCount) notes.push(`${r.imageCount} hình vẽ đã nhập`);
      if (r.mathTypeObjects) notes.push(`${r.mathTypeObjects} công thức MathType không chuyển được (đã đánh dấu để gõ lại)`);
      if (r.skippedImages) notes.push(`${r.skippedImages} hình không nhập được (WMF/EMF hoặc quá dung lượng)`);
      return { text: r.text, images: r.images, notes };
    } catch (err) {
      // Dự phòng: đọc chữ thuần bằng mammoth nếu bộ đọc chi tiết gặp lỗi
      console.warn('readDocx failed, fallback to mammoth', err);
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return { text: result.value, images: {}, notes: ['Chỉ đọc được chữ thuần (không kèm công thức, hình vẽ)'] };
    }
  }

  if (name.endsWith('.pdf')) {
    // Bản "legacy" của pdf.js chạy được cả trên trình duyệt cũ (bản thường cần Chrome rất mới)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      pages.push(pdfItemsToText(content.items as PdfTextItem[]));
    }
    await task.destroy();
    return { text: pages.join('\n'), images: {}, notes: ['PDF chỉ đọc được chữ; công thức và hình vẽ trong PDF cần nhập lại'] };
  }

  if (name.endsWith('.doc')) {
    throw new Error('Tệp .doc (Word 97-2003) không đọc được. Hãy mở bằng Word và "Lưu thành" .docx rồi nhập lại.');
  }
  throw new Error('Chỉ hỗ trợ tệp Word (.docx) hoặc PDF (.pdf).');
}
