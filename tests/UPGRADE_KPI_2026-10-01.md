# NÂNG CẤP QUẢN TRỊ KPI – 01/10/2026

## 1. Dashboard quản trị + Trung tâm công việc + cảnh báo deadline
- Dashboard tự tổng hợp hồ sơ chờ duyệt của tổ, KHGD giáo viên và kế hoạch bài dạy.
- Giáo viên thấy hồ sơ bị trả lại cần chỉnh sửa.
- Tổng hợp nhiệm vụ SHCM và công việc chuyên môn chưa hoàn thành.
- Phân loại: quá hạn, hôm nay, trong 7 ngày, bình thường.
- Nhấn một công việc để đi thẳng đến phân hệ xử lý.

## 2. Hồ sơ 360° + KPI có minh chứng
- Phân hệ mới: `12. Hồ sơ 360° & KPI`.
- Deep-link: `/teachers/:teacherId`.
- Tổng hợp phân công, KHGD, giáo án, dự giờ, nhiệm vụ SHCM, bồi dưỡng, audit gần đây.
- KPI 100 điểm mặc định: KHGD 25; kế hoạch bài dạy 30; dự giờ 20; nhiệm vụ SHCM 15; bồi dưỡng 10.
- Mỗi nhóm KPI có thể mở để xem danh sách minh chứng cấu thành.
- KPI là chỉ báo quản trị có minh chứng, không phải kết luận độc lập về chất lượng giáo viên.

## 3. Deep-link + phiên bản/Audit
- Mỗi phân hệ có đường dẫn riêng: `/members`, `/plans`, `/lesson-plans`, `/lesson-study`, ...
- Phân hệ mới `13. Lịch sử & Audit`.
- Deep-link hồ sơ audit: `/audit/:targetId`.
- Timeline hiển thị người thao tác, thời điểm, hành động và chi tiết.
- Nếu kế hoạch/giáo án có `versionHistory`, lịch sử phiên bản hiển thị cạnh timeline audit.
- Nút sao chép liên kết để gửi trực tiếp hồ sơ cần kiểm tra.

## Kiểm tra
- `git diff --check`: đạt.
- Kiểm tra parser TypeScript trên các file thay đổi: không phát hiện lỗi cú pháp.
- Chưa xác minh được full `npm run build/test` trong môi trường đóng gói hiện tại vì ZIP không kèm `node_modules` và quá trình tải dependency bị timeout. Khi triển khai: chạy `npm install`, `npm run lint`, `npm test`, `npm run build`.
