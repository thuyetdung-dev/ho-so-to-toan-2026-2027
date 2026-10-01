import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lessonRowsToText,readLessonSource,MAX_LESSON_SOURCE_BYTES} from '../src/utils/lessonSource.ts';
import {parseLessonText} from '../src/utils/lessonImport.ts';
import {createImportedLessonDraft} from '../src/utils/importedLessonDraft.ts';
const metadata={title:'Bài 1',topicTitle:'Tập hợp',grade:10 as const,week:1,periodCount:2};
const author={id:'gv1',displayName:'Thầy A'};
test('Excel ghép nhãn mục và nhận bảng hoạt động viết hoa',()=>{
 const text=lessonRowsToText([
  ['Tên bài','Bài 1: Tập hợp'],['I. MỤC TIÊU'],['Kiến thức','Nhận biết tập hợp'],['Năng lực','Giải quyết vấn đề'],['Phẩm chất','Chăm chỉ'],
  ['II. THIẾT BỊ DẠY HỌC'],['Bảng'],['TÊN HOẠT ĐỘNG','MỤC TIÊU','NỘI DUNG','SẢN PHẨM','TỔ CHỨC THỰC HIỆN'],
  ['Mở đầu','Tạo hứng thú','Câu hỏi 1','Câu trả lời','HS thảo luận'],['Luyện tập','Vận dụng','Bài tập','Bài giải','Làm nhóm']
 ]);
 const parsed=parseLessonText(text);
 assert.equal(parsed.recognized,true);
 assert.equal(parsed.activities.length,2);
 assert.match(parsed.activities[0].name,/Mở đầu/);
 assert.match(parsed.activities[1].content,/Bài tập/);
 assert.match(parsed.objectivesKnowledge,/Nhận biết tập hợp/);
});
test('Tệp Excel thực tế đọc được nhiều trang riêng biệt, không trộn giáo án',async()=>{
 const XLSX=await import('@e965/xlsx');
 const book=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Tên bài','Bài 1: Tập hợp'],['Nội dung','Trang thứ nhất']]),'Khối 10');
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Tên bài','Bài 2: Hàm số'],['Nội dung','Trang thứ hai']]),'Khối 11');
 const bytes=XLSX.write(book,{type:'array',bookType:'xlsx'});
 const read=await readLessonSource(new File([bytes],'gia_oan.xlsx'));
 assert.equal(read.sheets?.length,2);
 assert.match(read.text,/Trang thứ nhất/);
 assert.doesNotMatch(read.text,/Trang thứ hai/);
 assert.match(read.sheets![1].text,/Trang thứ hai/);
});
test('CSV tiếng Việt đọc được qua bộ nhập Excel',async()=>{
 const read=await readLessonSource(new File(['\uFEFFTên bài,Nội dung\nBài 1,Tập hợp và phần tử\n'],'giao_an.csv'));
 assert.match(read.text,/Tập hợp và phần tử/);
});
test('Tệp quá lớn, định dạng không hỗ trợ và tác vụ đã hủy bị chặn',async()=>{
 await assert.rejects(readLessonSource({name:'a.docx',size:MAX_LESSON_SOURCE_BYTES+1} as File),/15 MB/);
 await assert.rejects(readLessonSource(new File(['x'],'a.doc')),/lưu thành .docx/);
 await assert.rejects(readLessonSource(new File(['x'],'a.exe')),/Chọn Word/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(readLessonSource(new File(['x'],'a.xlsx'),{signal:controller.signal}),/hủy đọc/);
});
test('Tệp Excel rỗng không tạo giáo án',async()=>{
 const XLSX=await import('@e965/xlsx');const book=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([]),'Rỗng');
 await assert.rejects(readLessonSource(new File([XLSX.write(book,{type:'array',bookType:'xlsx'})],'empty.xlsx')),/Không đọc được/);
});
test('Nhập tạo mã mới và nháp của người nhập, giữ hình/công thức, không thay tác giả',()=>{
 const text='I. MỤC TIÊU\n1. Kiến thức: Biết $x^2$.\nII. THIẾT BỊ DẠY HỌC\nBảng\nIII. TIẾN TRÌNH DẠY HỌC\nHoạt động 1: Mở đầu\na) Mục tiêu: Biết\nb) Nội dung: ![H](img:h1) $x^2$\nc) Sản phẩm: Bài giải\nd) Tổ chức thực hiện: Nhóm';
 const source={text,images:{h1:'data:image/png;base64,AA'},notes:[]};
 const plan=createImportedLessonDraft(source,'a.docx',author,metadata);
 const other=createImportedLessonDraft(source,'a.docx',author,metadata);
 assert.notEqual(plan.id,other.id);assert.equal(plan.teacherId,'gv1');assert.equal(plan.status,'draft');
 assert.equal(plan.images?.h1,source.images.h1);assert.match(plan.activities[0].content,/img:h1/);
 assert.equal(plan.contentState,'full');assert.equal(plan.sourceFileName,'a.docx');
});
test('Văn bản không đúng 5512 được giữ trong hoạt động đầu, không bỏ nội dung',()=>{
 const text='Nội dung tự do và công thức $x^2$';
 const plan=createImportedLessonDraft({text,images:{},notes:[]},'anh.png',author,metadata);
 assert.equal(plan.activities[0].content,text);assert.equal(plan.status,'draft');
});
test('Bản nháp nhập chặn thông tin không hợp lệ trước khi chuẩn bị lưu',()=>{
 const source={text:'Nội dung',images:{},notes:[]};
 assert.throws(()=>createImportedLessonDraft(source,'a.pdf',author,{...metadata,week:0}),/không hợp lệ/);
 assert.throws(()=>createImportedLessonDraft(source,'a.pdf',author,{...metadata,title:' '}),/tên bài/);
});
test('Luồng nhập Word thực tế chuyển công thức Equation sang LaTeX',async()=>{
 const {DOMParser}=await import('@xmldom/xmldom');
 const fs=await import('node:fs');const previous=(globalThis as any).DOMParser;
 (globalThis as any).DOMParser=DOMParser;
 try {
  const bytes=fs.readFileSync(new URL('./fixtures/giao_an_cong_thuc.docx',import.meta.url));
  const read=await readLessonSource(new File([bytes],'giao_an.docx'));
  assert.match(read.text,/\$\\frac\{1\}\{2\}\+x\^\{2\}\$/);
  assert.ok(read.notes.some(note=>note.includes('4 công thức')));
 }finally{if(previous)(globalThis as any).DOMParser=previous;else delete (globalThis as any).DOMParser;}
});
test('Ảnh gốc từ OCR có tham chiếu trong nội dung để không bị loại khi lưu',()=>{
 const plan=createImportedLessonDraft({text:'Chữ đọc từ ảnh',images:{original:'data:image/jpeg;base64,AA'},originalImageId:'original',notes:[]},'photo.jpg',author,metadata);
 assert.match(plan.activities[0].content,/!\[Ảnh gốc\]\(img:original\)/);
 assert.ok(plan.images?.original);
});
