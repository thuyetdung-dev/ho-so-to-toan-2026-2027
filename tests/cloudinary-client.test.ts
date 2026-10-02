import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
mock.module('../src/firebase.ts',{namedExports:{auth:{currentUser:{getIdToken:async()=> 'token'}}}});
const {uploadLessonImage,prepareLessonImageCleanup,deleteLessonImageMeta}=await import('../src/services/lessonImageStorage.ts');
const originalFetch=globalThis.fetch;
const originalWindow=(globalThis as any).window;
(globalThis as any).window={};
const requests:any[]=[];
globalThis.fetch=async(url:any,init:any)=>{
 requests.push({url:String(url),body:init?.body});
 if(url==='/api/cloudinary-sign')return new Response(JSON.stringify({timestamp:1,signature:'sig',cloudName:'test-cloud',apiKey:'key',folder:'ho-so-to-toan/lesson-plans/p1',publicId:'i1--uuid',overwrite:false,cleanupToken:'cleanup-ticket'}));
 if(String(url).includes('api.cloudinary.com'))return new Response(JSON.stringify({public_id:'ho-so-to-toan/lesson-plans/p1/i1--uuid',secure_url:'https://res.cloudinary.com/test-cloud/image/upload/v1/ho-so-to-toan/lesson-plans/p1/i1--uuid.png',bytes:1,format:'png'}));
 if(url==='/api/cloudinary-delete')return new Response(JSON.stringify(JSON.parse(init.body).action==='prepare'?{cleanupToken:'prepared-ticket'}:{ok:true}));
 throw Error('Unexpected request');
};
test('browser upload selects Cloudinary v2, signs new-plan owner and restore session, and never overwrites',async()=>{
 const meta=await uploadLessonImage({} as any,'p1','i1','data:image/png;base64,AA==','uid',{teacherId:'m1',restoreSession:'rs1'});
 assert.equal(meta.provider,'cloudinary');assert.equal(meta.storageVersion,2);assert.equal(meta.storagePath,undefined);assert.equal(meta.cleanupToken,'cleanup-ticket');
 const body=JSON.parse(requests[0].body);assert.equal(body.teacherId,'m1');assert.equal(body.restoreSession,'rs1');
 assert.equal(requests[1].body.get('overwrite'),'false');
});
test('cleanup prepares scoped permission before deletion then carries ticket to delete endpoint',async()=>{
 requests.length=0;
 const meta:any={planId:'p1',imageId:'i1',provider:'cloudinary',publicId:'ho-so-to-toan/lesson-plans/p1/i1',bytes:1,createdAt:''};
 const prepared=await prepareLessonImageCleanup(meta,true);assert.equal(prepared.cleanupToken,'prepared-ticket');
 const body=JSON.parse(requests[0].body);assert.equal(body.action,'prepare');assert.equal(body.planId,'p1');assert.equal(body.deletePlan,true);
 await deleteLessonImageMeta({} as any,prepared);assert.equal(JSON.parse(requests[1].body).cleanupToken,'prepared-ticket');
});
test.after(()=>{globalThis.fetch=originalFetch;if(originalWindow===undefined)delete (globalThis as any).window;else (globalThis as any).window=originalWindow;});
