# Nâng cấp hệ thống điều hành công việc – hồ sơ – minh chứng – KPI
Ngày: 03/10/2026

## Mục tiêu
Chuyển ứng dụng từ sổ hồ sơ chuyên môn điện tử sang hệ thống điều hành khép kín cho Tổ Toán:
Giao việc → thực hiện → nộp minh chứng → duyệt → KPI/tiến độ → báo cáo/audit.

## Hạng mục đã triển khai
1. Thêm phân hệ **Điều hành công việc** (`/operations`).
2. Thêm collection `workTasks` với người giao, người nhận, deadline, ưu tiên, trạng thái, minh chứng và phản hồi duyệt.
3. Tích hợp `workTasks` vào **Trung tâm công việc** ở Dashboard.
4. Tích hợp công việc được xác nhận hoàn thành vào nhóm **Nhiệm vụ chuyên môn** của Hồ sơ 360°.
5. KPI chuyển sang trọng số cấu hình trong `DepartmentConfig.kpiConfig`; giao diện Cài đặt kiểm tra tổng trọng số = 100.
6. Thêm Firestore Rules: lãnh đạo giao/duyệt/xóa; người được giao chỉ cập nhật tiến độ và minh chứng của chính mình.
7. `workTasks` tham gia sao lưu/phục hồi dữ liệu hệ thống.
8. Thêm deep-link `/operations` và cập nhật menu thành 14 phân hệ.

## Quy trình trạng thái công việc
- `pending`: Chưa thực hiện
- `in_progress`: Đang thực hiện
- `submitted`: Đã nộp minh chứng, chờ duyệt
- `returned`: Tổ trưởng yêu cầu bổ sung
- `completed`: Đã được xác nhận hoàn thành

## Kiểm tra kỹ thuật
`tsc --noEmit` chỉ còn 1 lỗi tồn tại sẵn trước nâng cấp tại `src/services/lessonPlanStore.ts:346` (`metadata` on `never`). Không phát hiện lỗi TypeScript mới từ phần điều hành/KPI.
Build Vite trong môi trường hiện tại chưa chạy được vì `node_modules` trong gói nguồn chỉ chứa native binding Windows (`@rolldown/binding-win32-x64-msvc`, `@typescript/typescript-win32-x64`), trong khi môi trường kiểm tra là Linux. Cần `npm install` lại dependencies trên máy triển khai rồi chạy `npm run build`.
