import { test, expect } from '@playwright/test';

// Cần E2E_AUTH_STATE là storageState được tạo sau khi đăng nhập Google bằng tài khoản kiểm thử.
test.skip(!process.env.E2E_AUTH_STATE, 'Thiếu E2E_AUTH_STATE – chỉ chạy smoke công khai.');

test('Tài khoản thật truy cập Dashboard, 360°, Audit và trang dữ liệu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/overview', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toContainText(/Trung tâm công việc|Tổng quan/i);

  await page.goto('/teachers', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toContainText(/360|KPI/i);

  await page.goto('/audit', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toContainText(/Audit|Lịch sử/i);

  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toContainText(/Cài đặt/i);
  expect(errors).toEqual([]);
});
