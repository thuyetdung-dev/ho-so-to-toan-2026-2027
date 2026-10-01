import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertCompleteLessonBackup} from '../src/utils/backupValidation.ts';
const plan:any={id:'p1',contentState:'full',activities:[{content:'![Hình](img:h1)'}],images:{h1:'data:image/png;base64,AA'},versionHistory:[]};
test('Sao lưu giáo án đủ nội dung và hình được chấp nhận',()=>{
  assert.doesNotThrow(()=>assertCompleteLessonBackup(plan));
});
test('Sao lưu thiếu hình bị chặn ngay cả khi metadata imageIds đã bị loại',()=>{
  assert.throws(()=>assertCompleteLessonBackup({...plan,images:{}}),/thiếu hình/);
});
test('Sao lưu thiếu snapshot lịch sử bị chặn',()=>{
  assert.throws(()=>assertCompleteLessonBackup({...plan,versionHistory:[{hasSnapshot:true}]}),/thiếu nội dung phiên bản/);
});
test('Hình trong snapshot cũ cũng phải có trong sao lưu',()=>{
  assert.throws(()=>assertCompleteLessonBackup({...plan,versionHistory:[{dataSnapshot:{activities:[{content:'![Cũ](img:old)'}]}}]}),/old/);
});
test('Giáo án chỉ có tóm tắt không được coi là sao lưu đầy đủ',()=>{
  assert.throws(()=>assertCompleteLessonBackup({...plan,contentState:'light'}),/chưa có nội dung/);
});
