import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyDepartmentProgress} from '../src/utils/departmentProgress.ts';
test('Tiến độ hiển thị riêng, không sửa nội dung hoặc trạng thái đã phê duyệt',()=>{
 const original:any={id:'p',status:'approved',distribution:[{id:'r',status:'planned',title:'Tiết 1'}]};
 const before=JSON.stringify(original);
 const records:any=[{id:'p__r',planId:'p',itemId:'r',itemIndex:0,status:'completed',dateTaught:'2026-10-01'}];
 const [shown]=applyDepartmentProgress([original],records);
 assert.equal(shown.status,'approved');
 assert.equal(shown.distribution[0].status,'completed');
 assert.equal(shown.distribution[0].dateTaught,'2026-10-01');
 assert.equal(JSON.stringify(original),before);
});
test('Tiến độ chỉ ghép vào đúng kế hoạch và đúng dòng',()=>{
 const plans:any=[{id:'p1',distribution:[{id:'r',status:'planned'}]},{id:'p2',distribution:[{id:'r',status:'planned'}]}];
 const shown=applyDepartmentProgress(plans,[{planId:'p1',itemId:'r',status:'delayed',dateTaught:''} as any]);
 assert.equal(shown[0].distribution[0].status,'delayed');
 assert.equal(shown[1].distribution[0].status,'planned');
 assert.equal(shown[0].distribution[0].dateTaught,undefined);
});
