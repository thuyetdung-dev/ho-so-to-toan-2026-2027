import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import * as realJose from 'jose';
let claims:any={sub:'uid-teacher',email:'teacher@school.test',email_verified:true};
mock.module('jose',{namedExports:{...realJose,createRemoteJWKSet:()=>async()=>{},jwtVerify:async(token:any,key:any,options:any)=>options.algorithms?.[0]==='RS256'?{payload:claims}:realJose.jwtVerify(token,key,options)}});
const {v2:cloudinary}=await import('cloudinary');
const originalDestroy=cloudinary.uploader.destroy;
let destroys=0;
cloudinary.uploader.destroy=(async()=>{destroys++;return {result:'ok'};}) as any;
const sign=(await import('../api/cloudinary-sign.ts')).default;
const del=(await import('../api/cloudinary-delete.ts')).default;
const {authorizeImagePlan}=await import('../server/lessonImageAccess.ts');
const docs=new Map<string,any>();
const savedFetch=globalThis.fetch;
function fields(record:any):any {return Object.fromEntries(Object.entries(record).map(([k,v])=>[k,typeof v==='string'?{stringValue:v}:typeof v==='number'?{integerValue:String(v)}:{booleanValue:v}]));}
globalThis.fetch=async(url:any)=>{
 const path=decodeURIComponent(String(url).split('/documents/')[1]||'');
 if(path==='offline')throw Error('offline');
 const data=docs.get(path);return new Response(JSON.stringify(data?{fields:fields(data)}:{}),{status:data?200:404});
};
process.env.CLOUDINARY_CLOUD_NAME='test-cloud';process.env.CLOUDINARY_API_KEY='test-key';process.env.CLOUDINARY_API_SECRET='test-secret-with-sufficient-length';
function seed(role='teacher') {docs.clear();destroys=0;claims={sub:'uid-teacher',email:'teacher@school.test',email_verified:true};docs.set('accessIndex/teacher@school.test',{role});docs.set('members/m1',{email:'teacher@school.test'});docs.set('members/m2',{email:'other@school.test'});}
async function call(handler:any,body:any,method='POST',token=true){const result:any={status:200};const res:any={setHeader(){},status(code:number){result.status=code;return this;},json(data:any){result.data=data;return this;}};await handler({method,headers:token?{authorization:'Bearer token'}:{},body},res);return result;}
test('API requires authenticated verified contributor; methods and IDs are validated',async()=>{
 seed();assert.equal((await call(sign,{},'GET')).status,405);assert.equal((await call(sign,{},'POST',false)).status,401);
 claims.email_verified=false;assert.equal((await call(sign,{planId:'p1',imageId:'i1'})).status,403);
 seed();assert.equal((await call(sign,{planId:'../p',imageId:'i1'})).status,400);
 seed('principal');docs.set('lessonPlans/p1',{status:'draft',teacherId:'m1'});assert.equal((await call(sign,{planId:'p1',imageId:'i1'})).status,403);
});
test('owner can sign draft/returned; other owner, submitted and approved plans are denied',async()=>{
 seed();for(const status of ['draft','returned']){docs.set('lessonPlans/p1',{status,teacherId:'m1'});assert.equal((await call(sign,{planId:'p1',imageId:'i1'})).status,200);}
 for(const status of ['submitted','approved']){docs.set('lessonPlans/p1',{status,teacherId:'m1'});assert.equal((await call(sign,{planId:'p1',imageId:'i1'})).status,403);}
 docs.set('lessonPlans/p1',{status:'draft',teacherId:'m2'});assert.equal((await call(sign,{planId:'p1',imageId:'i1'})).status,403);
});
test('existing image IDs cannot be re-signed to replace historical image objects',async()=>{
 seed();docs.set('lessonPlans/p1',{status:'draft',teacherId:'m1'});docs.set('lessonPlanImages/p1__i1',{provider:'cloudinary',publicId:'old'});
 assert.equal((await call(sign,{planId:'p1',imageId:'i1'})).status,409);
});
test('new plan validates teacher owner and returns immutable unique objects plus bounded cleanup ticket',async()=>{
 seed();assert.equal((await call(sign,{planId:'p1',imageId:'i1',teacherId:'m2'})).status,403);
 const a=await call(sign,{planId:'p1',imageId:'i1',teacherId:'m1'});const b=await call(sign,{planId:'p1',imageId:'i1',teacherId:'m1'});
 assert.equal(a.status,200);assert.equal(a.data.overwrite,false);assert.notEqual(a.data.publicId,b.data.publicId);assert.equal(typeof a.data.cleanupToken,'string');assert.equal(a.data.apiSecret,undefined);
 const publicId=`${a.data.folder}/${a.data.publicId}`;
 assert.equal((await call(del,{publicId,cleanupToken:a.data.cleanupToken})).status,200);assert.equal(destroys,1);
 assert.equal((await call(del,{publicId:publicId+'-other',cleanupToken:a.data.cleanupToken})).status,403);
});
test('cleanup cannot remove an image still in metadata, even with a valid ticket; another user and approved plan fail',async()=>{
 seed();docs.set('lessonPlans/p1',{status:'draft',teacherId:'m1'});
 const s=await call(sign,{planId:'p1',imageId:'i1'});const publicId=`${s.data.folder}/${s.data.publicId}`;
 docs.set('lessonPlanImages/p1__i1',{planId:'p1',imageId:'i1',provider:'cloudinary',publicId});
 assert.equal((await call(del,{publicId,cleanupToken:s.data.cleanupToken})).status,409);assert.equal(destroys,0);
 assert.equal((await call(del,{publicId})).status,403);
 docs.delete('lessonPlanImages/p1__i1');docs.set('lessonPlans/p1',{status:'approved',teacherId:'m1'});
 assert.equal((await call(del,{publicId,cleanupToken:s.data.cleanupToken})).status,403);
 docs.set('lessonPlans/p1',{status:'draft',teacherId:'m1'});claims.sub='uid-other';
 assert.equal((await call(del,{publicId,cleanupToken:s.data.cleanupToken})).status,403);
});
test('deletion prepares ticket while plan exists then cleans up only after database removal',async()=>{
 seed();docs.set('lessonPlans/p1',{status:'draft',teacherId:'m1'});
 const publicId='ho-so-to-toan/lesson-plans/p1/i1';docs.set('lessonPlanImages/p1__i1',{planId:'p1',imageId:'i1',provider:'cloudinary',publicId});
 const prepare=await call(del,{action:'prepare',planId:'p1',imageId:'i1',publicId,deletePlan:true});assert.equal(prepare.status,200);
 docs.delete('lessonPlanImages/p1__i1');docs.delete('lessonPlans/p1');assert.equal((await call(del,{publicId,cleanupToken:prepare.data.cleanupToken})).status,200);
});
test('restore bypass is admin-only and needs an active server-checked session',async()=>{
 seed('admin');docs.set('lessonPlans/p1',{status:'approved',teacherId:'m2'});
 const actor:any={uid:'uid-teacher',email:'teacher@school.test',token:'token',role:'admin'};
 await assert.rejects(authorizeImagePlan(actor,'p1',{restoreSession:'rs1'}));
 docs.set('restoreSessions/uid-teacher',{status:'active',sessionId:'rs1',expiresAt:new Date(Date.now()+100000).toISOString()});
 await authorizeImagePlan(actor,'p1',{restoreSession:'rs1'});
 await assert.rejects(authorizeImagePlan({...actor,role:'teacher'},'p1',{restoreSession:'rs1'}));
});
test.after(()=>{globalThis.fetch=savedFetch;cloudinary.uploader.destroy=originalDestroy;});
