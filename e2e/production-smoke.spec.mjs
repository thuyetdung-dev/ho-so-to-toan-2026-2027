import { test, expect } from '@playwright/test';

test('Vercel phục vụ SPA và deep-link', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/overview', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toContainText(/Tổ Toán|Sinh hoạt Chuyên môn|Đăng nhập/i);
  expect(errors).toEqual([]);

  const response = await page.goto('/audit/demo-target', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator('body')).toContainText(/Tổ Toán|Đăng nhập|Nhật ký|Audit/i);
});

test('API AI không rò khóa và phản hồi endpoint', async ({ request }) => {
  const res = await request.get('/api/ai');
  expect([200, 401, 403, 404]).toContain(res.status());
  const text = await res.text();
  expect(text).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
});
