# Nâng cấp 2.16.0 – Storage, Backup/Restore, Hồ sơ kỳ/năm, E2E và AI

Ngày: 01/10/2026

## 1. Firebase Storage cho ảnh giáo án
- Ảnh mới được upload vào `lessonPlanImages/{planId}/{imageId}` trên Firebase Storage.
- Firestore `lessonPlanImages` chỉ lưu metadata: `planId`, `imageId`, `storagePath`, `contentType`, `bytes`, `createdAt`, `storageVersion`.
- Lưu giáo án dùng quy trình hai pha: upload ảnh → commit Firestore → dọn ảnh không còn dùng; nếu commit thất bại, app cố gắng rollback ảnh vừa upload.
- Dữ liệu cũ có trường base64 `data` vẫn đọc được. Cài đặt có công cụ migration idempotent sang Storage.
- Có `storage.rules`, emulator Storage port 9199 và cấu hình deploy trong `firebase.json`.

### Thứ tự triển khai bắt buộc
1. Backup dữ liệu hiện tại.
2. Deploy `firestore.rules` + `storage.rules`.
3. Deploy mã 2.16.0.
4. Kiểm tra tạo/sửa/xem một giáo án có ảnh.
5. Chạy migration base64 bằng tài khoản Quản trị/BGH.
6. Backup ZIP v3 sau migration và kiểm tra phục hồi trên QA.

## 2. Backup/Restore chuẩn hóa
- Backup mặc định là ZIP schema v3.
- `manifest.json` mô tả phiên bản, thời điểm, năm học, số ảnh và checksum SHA-256.
- `data.json` chứa dữ liệu hệ thống; ảnh được tách thành file nhị phân.
- Restore kiểm tra checksum dữ liệu và từng ảnh trước khi dựng lại backup.
- Vẫn tương thích file backup `.json` cũ.

## 3. Gói hồ sơ cuối kỳ/năm
Từ màn Báo cáo có thể xuất ZIP theo đúng khoảng thời gian đang chọn, gồm:
- báo cáo tổng hợp;
- thành viên và phân công;
- kế hoạch tổ và kế hoạch giáo viên;
- danh mục + hồ sơ đầy đủ từng giáo án;
- ảnh giáo án tách file trong ZIP;
- SHCM/NCBH, dự giờ, chuyên đề, bồi dưỡng, sáng kiến;
- các báo cáo đã chốt;
- `MUC_LUC.html`, README và manifest.

## 4. E2E trên Firebase/Vercel thật
Đã bổ sung `playwright.config.mjs`, `e2e/production-smoke.spec.mjs`, `e2e/authenticated.spec.mjs` và `e2e/README.md`.

Bộ test được thiết kế để chạy trên URL deployment thật qua `E2E_BASE_URL`; luồng có đăng nhập dùng `E2E_AUTH_STATE` của tài khoản QA riêng. Không lưu credential trong repository.

**Trạng thái xác minh trong môi trường tạo bản nâng cấp:** chưa thể chạy E2E production vì gói mã nguồn không chứa URL Vercel/Firebase production và không có phiên đăng nhập QA. Đây là điều kiện bên ngoài mã nguồn; không được coi là test đã pass cho tới khi chạy suite trên deployment của trường.

## 5. AI nâng cao – triển khai sau phần dữ liệu
Bổ sung 3 tác vụ:
- **Rà soát hồ sơ:** tìm mục thiếu, điểm không nhất quán, deadline/minh chứng thiếu và dẫn nguồn.
- **Dự thảo báo cáo:** chỉ dùng số liệu/minh chứng đã cung cấp, đánh dấu phần thiếu dữ kiện.
- **Phân tích KPI:** giải thích chỉ số và minh chứng, gợi ý việc cần bổ sung; không tự xếp hạng giáo viên hoặc đưa quyết định nhân sự.

Nguồn AI được mở rộng thêm kế hoạch cá nhân và metadata giáo án. Tối đa 3 nguồn/lần, người dùng có thể rà soát phần trích trước khi gửi.

## 6. Kiểm tra kỹ thuật tại đây
- Đã kiểm tra cú pháp TypeScript/TSX bằng TypeScript transpiler với các file thay đổi.
- Không thể xác nhận `npm ci && npm test && npm run build` đầy đủ trong runtime này vì tải dependency bị timeout và ZIP ban đầu không chứa `node_modules`.
- Vì vậy bản này không tuyên bố “production E2E passed”; cần chạy checklist ở trên trên deployment QA/production của trường.
