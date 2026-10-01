import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
let pages:any[]=[];let ocrCalls=0;let destroyed=0;
mock.module('pdfjs-dist/legacy/build/pdf.mjs',{namedExports:{
 GlobalWorkerOptions:{workerSrc:''},OPS:{paintImageXObject:1,paintInlineImageXObject:2,paintImageXObjectRepeat:3},
 getDocument:()=>({promise:Promise.resolve({numPages:pages.length,getPage:async(n:number)=>({getTextContent:async()=>({items:pages[n-1].items}),getOperatorList:async()=>({fnArray:pages[n-1].ops || []})})}),destroy:async()=>{destroyed++;}})
}});
mock.module('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url',{defaultExport:'/test-worker.js'});
mock.module(new URL('../src/utils/ocrSource.ts',import.meta.url).href,{namedExports:{ocrSource:async()=>{ocrCalls++;return {text:'Nội dung OCR để rà soát',notes:['OCR cần đối chiếu'],grids:[],source:'OCR'};}}});
const {readLessonSource}=await import('../src/utils/lessonSource.ts');
const item=(str:string,y:number)=>({str,transform:[1,0,0,1,0,y],width:str.length*5});
test('PDF có chữ giữ các dòng mục và không gọi OCR; đóng tài nguyên PDF',async()=>{
 pages=[{items:[item('I. MỤC TIÊU',20),item('1. Kiến thức: Nhận biết tập hợp',10)]}];ocrCalls=0;destroyed=0;
 const result=await readLessonSource(new File(['test'],'a.pdf'));
 assert.match(result.text,/I\. MỤC TIÊU\n1\. Kiến thức/);assert.equal(ocrCalls,0);assert.equal(destroyed,1);
});
test('PDF lẫn trang có chữ và trang scan chuyển sang OCR',async()=>{
 pages=[{items:[item('Nội dung trang có văn bản dài hơn ba mươi ký tự',10)]},{items:[],ops:[1]}];ocrCalls=0;
 const result=await readLessonSource(new File(['test'],'mixed.pdf'));
 assert.equal(ocrCalls,1);assert.equal(result.text,'Nội dung OCR để rà soát');
});
test('Trang PDF trống không kích hoạt OCR',async()=>{
 pages=[{items:[item('Nội dung trang có văn bản dài hơn ba mươi ký tự',10)]},{items:[],ops:[]}];ocrCalls=0;
 await readLessonSource(new File(['test'],'blank-page.pdf'));assert.equal(ocrCalls,0);
});
test('Ảnh PNG được chuyển vào bộ OCR, không bị coi là Word',async()=>{
 ocrCalls=0;const result=await readLessonSource(new File(['test'],'photo.PNG',{type:'image/png'}));
 assert.equal(ocrCalls,1);assert.ok(result.notes.some(note=>note.includes('đối chiếu')));
});
