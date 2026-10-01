import {newId} from './ids';
import {MAX_IMAGE_BYTES} from '../services/lessonPlanStore';
import {extractTextFromFile, pdfItemsToText, type ExtractResult, type PdfTextItem} from './lessonImport';
export const LESSON_SOURCE_ACCEPT = '.docx,.doc,.pdf,.xlsx,.xls,.xlsm,.csv,.ods,.png,.jpg,.jpeg,.webp';
export const MAX_LESSON_SOURCE_BYTES = 15 * 1024 * 1024;
export interface LessonSource extends ExtractResult {originalImageId?:string; sheets?: Array<{name:string; text:string}>;}
const normalized = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').trim();

/** Giữ nhãn mục trên từng dòng; bảng hoạt động được chuyển sang bốn mục CV 5512. */
export function lessonRowsToText(rows: string[][]): string {
  const output:string[]=[];
  let columns: Record<string,number> | null = null;
  let activity=0;
  for (const row of rows) {
    const names=row.map(normalized);
    const candidate: Record<string,number>={};
    for (let i=0;i<names.length;i++) {
      const n=names[i];
      if (/^(ten )?hoat dong$/.test(n)) candidate.name=i;
      else if (/^(muc tieu|yeu cau can dat)$/.test(n)) candidate.objectives=i;
      else if (/^noi dung$/.test(n)) candidate.content=i;
      else if (/^san pham$/.test(n)) candidate.product=i;
      else if (/^(to chuc thuc hien|cach thuc thuc hien|thuc hien)$/.test(n)) candidate.implementation=i;
    }
    if (candidate.name !== undefined && Object.keys(candidate).length>=3) {
      columns=candidate; output.push('III. TIẾN TRÌNH DẠY HỌC'); continue;
    }
    if (columns && row[columns.name]?.trim()) {
      const name=row[columns.name].trim(); activity++;
      output.push(/^Hoạt\s*động\s*\d+/iu.test(name) ? name : `Hoạt động ${activity}: ${name}`);
      for (const [key,label] of [['objectives','a) Mục tiêu'],['content','b) Nội dung'],['product','c) Sản phẩm'],['implementation','d) Tổ chức thực hiện']]) {
        if(columns[key] !== undefined) output.push(`${label}: ${row[columns[key]] || ''}`);
      }
      continue;
    }
    const cells=row.map(c=>c.trim()).filter(Boolean);
    if (cells.length===2 && /^(ten bai( day| hoc)?|chu de|so tiet|thoi luong|kien thuc|nang luc|pham chat)\s*:?$/.test(normalized(cells[0]))) {
      output.push(`${cells[0].replace(/:$/,'')}: ${cells[1]}`);
    } else output.push(...cells);
  }
  return output.join('\n');
}
async function originalImage(file:File):Promise<string|null> {
  let bitmap:ImageBitmap|undefined;
  try {
    bitmap=await createImageBitmap(file);
    const scale=Math.min(1,2200/bitmap.width,3000/bitmap.height);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');if(!context)return null;
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for(const quality of [0.9,0.75,0.6,0.45]) {
      const data=canvas.toDataURL('image/jpeg',quality);
      if(data.startsWith('data:image/jpeg;') && data.length<=MAX_IMAGE_BYTES) return data;
    }
    return null;
  }catch{return null;}finally{bitmap?.close();}
}
const aborted=(signal?:AbortSignal)=>{if(signal?.aborted) throw new Error('Đã hủy đọc tệp.');};
export async function readLessonSource(file:File, options:{signal?:AbortSignal;progress?:(text:string)=>void}={}):Promise<LessonSource> {
  aborted(options.signal);
  if(file.size>MAX_LESSON_SOURCE_BYTES) throw new Error('Tệp quá lớn; tối đa 15 MB mỗi lần nhập.');
  const name=file.name.toLowerCase();
  if(name.endsWith('.doc')) throw new Error('Word .doc cần mở bằng Word và lưu thành .docx trước khi nhập.');
  let result:LessonSource;
  if(name.endsWith('.docx')) {
    options.progress?.('Đang đọc Word, công thức và hình…');
    result=await extractTextFromFile(file);
  } else if(/\.(xlsx|xls|xlsm|csv|ods)$/.test(name)) {
    options.progress?.('Đang đọc các trang tính Excel…');
    const XLSX=await import('@e965/xlsx');
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',sheetRows:10001});
    if(workbook.SheetNames.length>20) throw new Error('Tối đa 20 trang tính; hãy tách tệp Excel.');
    const sheets=workbook.SheetNames.map(sheetName=>{
      const sheet=workbook.Sheets[sheetName];
      const ref=sheet['!fullref'] || sheet['!ref'];
      if(ref) {
        const range=XLSX.utils.decode_range(String(ref));
        if(range.e.r-range.s.r+1>10000 || range.e.c-range.s.c+1>100) throw new Error(`Trang ${sheetName} vượt 10.000 dòng hoặc 100 cột; hãy tách dữ liệu.`);
      }
      const rows=XLSX.utils.sheet_to_json<string[]>(sheet,{header:1,defval:'',raw:false,blankrows:false});
      return {name:sheetName,text:lessonRowsToText(rows.map(row=>row.map(value=>String(value ?? ''))))};
    }).filter(sheet=>sheet.text.trim());
    result={text:sheets[0]?.text || '',images:{},sheets,notes:['Chọn một trang tính cho một giáo án. Excel chỉ đọc nội dung ô; hình và bố cục cần đối chiếu với tệp gốc.']};
  } else if(name.endsWith('.pdf')) {
    options.progress?.('Đang đọc PDF và kiểm tra các trang scan…');
    const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
    const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
    const pages:string[]=[];
    let scan=false;
    try {
      const pdf=await loading.promise;
      if(pdf.numPages>100) throw new Error('PDF tối đa 100 trang; hãy tách tệp.');
      for(let i=1;i<=pdf.numPages;i++) {
        aborted(options.signal);
        const page=await pdf.getPage(i);
        const content=await page.getTextContent();
        const text=pdfItemsToText(content.items as PdfTextItem[]);
        pages.push(text);
        if(text.trim().length<30) {
          const operators=await page.getOperatorList();
          if(operators.fnArray.some(op=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageXObjectRepeat].includes(op))) scan=true;
        }
      }
    } finally {await loading.destroy();}
    if(scan) {
      const {ocrSource}=await import('./ocrSource');
      const read=await ocrSource(file,options);
      result={text:read.text,images:{},notes:read.notes};
    } else result={text:pages.join('\n\n'),images:{},notes:['PDF đọc phần chữ; công thức, hình và bảng cần đối chiếu/nhập lại.']};
  } else if(/\.(png|jpe?g|webp)$/.test(name)) {
    const {ocrSource}=await import('./ocrSource');
    const read=await ocrSource(file,options);
    const image=await originalImage(file);
    const id=newId('sourceimg');
    result={text:read.text,images:image ? {[id]:image} : {},originalImageId:image ? id : undefined,
      notes:[...read.notes,image ? 'Kèm ảnh gốc đã nén trong hoạt động cuối để đối chiếu.' : 'Không kèm được ảnh gốc (định dạng/dung lượng). Giữ tệp gốc để đối chiếu và chèn ảnh trong trình soạn thảo nếu cần.']};
  } else throw new Error('Chọn Word .docx, PDF, Excel hoặc ảnh PNG/JPG/WebP.');
  aborted(options.signal);
  if(!result.text.trim()) throw new Error('Không đọc được nội dung. Hãy chọn tệp hoặc ảnh rõ hơn.');
  if(result.text.length>500000 || result.sheets?.some(sheet=>sheet.text.length>500000)) throw new Error('Nội dung quá dài; hãy tách tệp trước khi nhập.');
  return result;
}
