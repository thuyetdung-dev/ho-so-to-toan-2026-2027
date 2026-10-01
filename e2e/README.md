# E2E Firebase/Vercel thật

Bộ này cố ý tách khỏi unit test để không dùng nhầm dữ liệu production.

## 1. Cài Playwright trên máy kiểm thử

```bash
npm i -D @playwright/test
npx playwright install chromium
```

## 2. Smoke trên URL Vercel thật

```bash
E2E_BASE_URL="https://TEN-DU-AN.vercel.app" npx playwright test e2e/production-smoke.spec.mjs
```

## 3. Kiểm thử sau đăng nhập Google

Tạo `storageState` bằng tài khoản kiểm thử riêng (không dùng tài khoản cá nhân chính):

```bash
E2E_BASE_URL="https://TEN-DU-AN.vercel.app" npx playwright codegen "$E2E_BASE_URL"
```

Sau khi đăng nhập, lưu browser state thành `e2e/.auth/production.json` (không commit file này), rồi chạy:

```bash
E2E_BASE_URL="https://TEN-DU-AN.vercel.app" \
E2E_AUTH_STATE="e2e/.auth/production.json" \
npx playwright test
```

## 4. Kiểm tra Firebase bắt buộc

- Firebase Authentication: domain Vercel nằm trong **Authorized domains**.
- Deploy rules: `firebase deploy --only firestore:rules,storage`.
- Chạy migration ảnh ở **Cài đặt → Dữ liệu & Sao lưu** với Tổ trưởng/Quản trị.
- Mở một giáo án có ảnh cũ và một giáo án ảnh mới; refresh cứng và xác nhận ảnh vẫn tải.
- Tải backup ZIP, phục hồi trên project staging trước; checksum phải đạt.

> Không đưa `e2e/.auth`, token, service-account JSON hay API key bí mật vào Git/ZIP chia sẻ.
