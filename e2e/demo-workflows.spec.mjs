import {test,expect} from '@playwright/test';
async function demo(page){await page.addInitScript(()=>localStorage.setItem('to-toan-data-mode','demo'));}
test('Luồng giáo án: mở danh sách, lọc không có kết quả, khôi phục và phân trang',async({page})=>{
 await demo(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/lesson-plans');
 await expect(page.getByRole('navigation',{name:'Phân trang giáo án'})).toBeVisible();
 const search=page.getByPlaceholder(/Tìm theo tên bài/);
 await search.fill('E2E_NO_MATCH_217');
 await expect(page.getByText('Không có giáo án phù hợp bộ lọc.')).toBeVisible();
 await search.fill('');
 await expect(page.getByText('Không có giáo án phù hợp bộ lọc.')).toHaveCount(0);
 await page.reload();await expect(page.getByRole('navigation',{name:'Phân trang giáo án'})).toBeVisible();
 expect(errors).toEqual([]);
});
test('Luồng báo cáo và đóng sổ mở được trên trình duyệt',async({page})=>{
 await demo(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/reports');await expect(page.locator('body')).toContainText(/Báo cáo/);
 const tab=page.getByRole('button',{name:/Đóng.*sổ|Đóng.*cuốn/i});
 await expect(tab.first()).toBeVisible();await tab.first().click();await expect(page.getByText('Đóng cuốn Sổ chuyên môn',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Tạo bản xem trước',exact:true}).click();await expect(page.getByRole('heading',{name:'SỔ SINH HOẠT CHUYÊN MÔN',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});
test('API ảnh từ chối yêu cầu chưa đăng nhập',async({request})=>{
 for(const endpoint of ['cloudinary-sign','cloudinary-delete']){
  const response=await request.post(`/api/${endpoint}`,{data:{planId:'e2e-denied',imageId:'i'}});
  expect(response.status()).toBe(401);
 }
});
