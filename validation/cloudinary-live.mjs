// Chỉ dùng giáo án nháp dành riêng cho kiểm thử. Không lưu token vào mã nguồn.
import assert from 'node:assert/strict';
const {E2E_BASE_URL:base,E2E_FIREBASE_TOKEN:token,E2E_PLAN_ID:planId,E2E_OTHER_FIREBASE_TOKEN:other}=process.env;
if(!base||!token||!planId) throw new Error('Cần E2E_BASE_URL, E2E_FIREBASE_TOKEN và E2E_PLAN_ID của giáo án nháp kiểm thử.');
const imageId=`live-${crypto.randomUUID()}`;
const post=(path,data,auth=token)=>fetch(`${base}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth}`},body:JSON.stringify(data)});
if(other){const denied=await post('cloudinary-sign',{planId,imageId},other);assert.equal(denied.status,403);console.log('PASS: giáo viên khác bị từ chối ký ảnh');}
const signature=await post('cloudinary-sign',{planId,imageId});assert.equal(signature.status,200);const signed=await signature.json();
const expected=`${signed.folder}/${signed.publicId}`;
try{
 const form=new FormData();
 form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test.png');
 for(const [key,value] of Object.entries({api_key:signed.apiKey,timestamp:signed.timestamp,signature:signed.signature,folder:signed.folder,public_id:signed.publicId,overwrite:false}))form.set(key,String(value));
 const response=await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,{method:'POST',body:form});assert.equal(response.status,200);const uploaded=await response.json();assert.equal(uploaded.public_id,expected);
 assert.equal((await fetch(uploaded.secure_url)).status,200);console.log('PASS: ký qua API ứng dụng, tải lên Cloudinary và tải lại ảnh');
 if(other){const denied=await post('cloudinary-delete',{publicId:expected,cleanupToken:signed.cleanupToken},other);assert.equal(denied.status,403);console.log('PASS: giáo viên khác không dùng được vé xóa');}
}finally{
 const cleanup=await post('cloudinary-delete',{publicId:expected,cleanupToken:signed.cleanupToken});assert.equal(cleanup.status,200);console.log('PASS: dọn ảnh thử qua API ứng dụng');
}
