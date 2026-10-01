import React,{useEffect,useMemo,useRef,useState} from 'react';
import {FileUp,Loader2,X} from 'lucide-react';
import type {LessonPlan} from '../../types';
import {LESSON_SOURCE_ACCEPT,readLessonSource,type LessonSource} from '../../utils/lessonSource';
import {parseLessonText} from '../../utils/lessonImport';
import {createImportedLessonDraft} from '../../utils/importedLessonDraft';

export function LessonImportDialog({author,onClose,onPrepared}:{author:{id:string;displayName:string};onClose:()=>void;onPrepared:(plan:LessonPlan)=>void}) {
  const fileInput=useRef<HTMLInputElement>(null);
  const controller=useRef(new AbortController());
  const mounted=useRef(true);
  const [reading,setReading]=useState(false);
  const [progress,setProgress]=useState('');
  const [error,setError]=useState('');
  const [fileName,setFileName]=useState('');
  const [source,setSource]=useState<LessonSource|null>(null);
  const [sheet,setSheet]=useState(0);
  const [text,setText]=useState('');
  const [title,setTitle]=useState('');
  const [topic,setTopic]=useState('');
  const [grade,setGrade]=useState<10|11|12>(10);
  const [week,setWeek]=useState(1);
  const [periods,setPeriods]=useState(1);
  const [reviewed,setReviewed]=useState(false);
  const parsed=useMemo(()=>parseLessonText(text),[text]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current.abort();};},[]);
  const suggest=(raw:string,name:string)=>{
    const parsed=parseLessonText(raw);
    setText(raw);setTitle(parsed.title || name.replace(/\.[^.]+$/,''));
    const inferred=`${name}\n${raw}`.match(/(?:khối|lớp|toán)[\s_:\-]*(10|11|12)(?=[^0-9]|$)/iu);
    setGrade(inferred ? Number(inferred[1]) as 10|11|12 : 10);
    setTopic(parsed.topicTitle || '');setPeriods(parsed.periodCount || 1);setReviewed(false);
  };
  const read=async(files:File[])=>{
    if(reading)return;
    if(files.length!==1){setError('Chọn một tệp cho mỗi giáo án; có thể nhập tiếp tệp khác sau khi lưu.');return;}
    controller.current=new AbortController();
    setReading(true);setError('');setSource(null);setText('');setReviewed(false);
    const file=files[0];setFileName(file.name);
    try {
      const result=await readLessonSource(file,{signal:controller.current.signal,progress:message=>{if(mounted.current)setProgress(message);}});
      if(!mounted.current)return;
      setSource(result);setSheet(0);suggest(result.text,file.name);
      setProgress('Đã đọc tệp. Kiểm tra nội dung, công thức và thông tin bài dạy trước khi tiếp tục.');
    }catch(e){if(mounted.current){setError(e instanceof Error?e.message:'Không đọc được tệp.');setProgress('');}}
    finally{if(mounted.current)setReading(false);}
  };
  const prepare=()=>{
    if(!source || reading || !reviewed)return;
    try {
      const plan=createImportedLessonDraft({...source,text},source.sheets ? `${fileName} — ${source.sheets[sheet].name}`:fileName,author,{title,topicTitle:topic || title,grade,week,periodCount:periods});
      onPrepared(plan);
    }catch(e){setError(e instanceof Error?e.message:'Thông tin không hợp lệ.');}
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="lesson-import-title" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 print:hidden">
    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-5 space-y-4"
      onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void read(Array.from(e.dataTransfer.files));}}
      onPaste={e=>{if(e.clipboardData.files.length){e.preventDefault();void read(Array.from(e.clipboardData.files));}}}>
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <h2 id="lesson-import-title" className="font-bold text-lg text-slate-900">Nhập giáo án từ Word / PDF / Excel / ảnh</h2>
        <button onClick={onClose} aria-label="Đóng cửa sổ nhập giáo án" className="p-2 rounded hover:bg-slate-100"><X className="w-5 h-5"/></button>
      </div>
      <p className="text-sm text-slate-600">Chọn hoặc kéo thả một tệp, tối đa 15 MB. Word dùng .docx; ảnh và trang PDF scan được đọc bằng OCR tiếng Việt/Anh trên thiết bị. Có thể dán ảnh bằng Ctrl+V.</p>
      <input ref={fileInput} type="file" accept={LESSON_SOURCE_ACCEPT} disabled={reading} className="hidden" onChange={e=>{void read(Array.from(e.target.files || []));e.target.value='';}}/>
      <div className="flex gap-2 items-center flex-wrap">
        <button autoFocus disabled={reading} onClick={()=>fileInput.current?.click()} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex gap-2 items-center disabled:opacity-50">
          {reading?<Loader2 className="w-4 h-4 animate-spin"/>:<FileUp className="w-4 h-4"/>}{reading?'Đang đọc…':'Chọn tệp giáo án'}
        </button>
        {reading && <button onClick={()=>controller.current.abort()} className="px-3 py-2 border rounded-lg">Hủy đọc</button>}
        {fileName && <span className="text-sm text-slate-600 break-all">{fileName}</span>}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-blue-800">{progress}</p>
      {error && <p role="alert" className="text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg p-3">{error}</p>}
      {source && <>
        {!!source.sheets?.length && <label className="block text-sm font-medium">Trang tính dùng cho giáo án này
          <select value={sheet} onChange={e=>{const index=Number(e.target.value);setSheet(index);suggest(source.sheets![index].text,fileName);}} className="block w-full border rounded-lg p-2 mt-1">
            {source.sheets.map((s,index)=><option key={index} value={index}>{s.name}</option>)}
          </select>
        </label>}
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <label>Tên bài dạy<input value={title} onChange={e=>{setTitle(e.target.value);setReviewed(false);}} className="block w-full border rounded-lg p-2 mt-1"/></label>
          <label>Chủ đề<input value={topic} placeholder="Để trống sẽ lấy tên bài" onChange={e=>{setTopic(e.target.value);setReviewed(false);}} className="block w-full border rounded-lg p-2 mt-1"/></label>
          <div className="flex gap-3 sm:col-span-2">
            <label className="flex-1">Khối<select value={grade} onChange={e=>{setGrade(Number(e.target.value) as 10|11|12);setReviewed(false);}} className="block w-full border rounded-lg p-2 mt-1"><option value={10}>10</option><option value={11}>11</option><option value={12}>12</option></select></label>
            <label className="flex-1">Tuần<input type="number" min={1} max={52} value={week} onChange={e=>{setWeek(Number(e.target.value));setReviewed(false);}} className="block w-full border rounded-lg p-2 mt-1"/></label>
            <label className="flex-1">Số tiết<input type="number" min={1} max={100} value={periods} onChange={e=>{setPeriods(Number(e.target.value));setReviewed(false);}} className="block w-full border rounded-lg p-2 mt-1"/></label>
          </div>
        </div>
        <div className="text-sm bg-amber-50 text-amber-900 rounded-lg p-3 space-y-1">
          {source.notes.map((note,index)=><p key={index}>{note}</p>)}
          <p>{parsed.recognized ? `Đã nhận diện cấu trúc CV 5512, ${parsed.activities.length} hoạt động.`:'Chưa nhận ra cấu trúc CV 5512: nội dung sẽ đặt trong Hoạt động 1 để thầy/cô sắp xếp lại.'}</p>
          <p>Cần rà soát ký hiệu, số liệu và công thức khi dùng PDF/OCR. Tệp gốc vẫn do thầy/cô lưu giữ.</p>
        </div>
        <label className="block text-sm font-medium">Văn bản đọc được — có thể sửa trước khi tách mục
          <textarea value={text} onChange={e=>{setText(e.target.value);setReviewed(false);}} rows={10} className="block w-full border rounded-lg p-3 mt-1 font-mono text-xs"/>
        </label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)} className="mt-1"/>Tôi đã kiểm tra nội dung đọc được và thông tin bài dạy.</label>
      </>}
      <div className="border-t pt-3 flex justify-end gap-2 flex-wrap">
        <button onClick={onClose} className="px-3 py-2 border rounded-lg text-sm">Hủy</button>
        <button disabled={!source || reading || !reviewed || !text.trim() || !title.trim()} onClick={prepare} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40">Mở bản nháp để rà soát</button>
      </div>
      <p className="text-xs text-slate-500">Chưa ghi dữ liệu ở bước này. Kiểm tra bản xem trước trong trình soạn thảo rồi bấm “Lưu giáo án”. Giáo án mới là bản nháp của người nhập; không ghi đè hoặc tự phê duyệt giáo án đang chọn.</p>
    </div>
  </div>;
}
