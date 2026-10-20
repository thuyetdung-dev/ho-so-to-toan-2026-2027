# Nâng cấp V2.24.0 – Nhắc việc hằng tuần

## Có gì mới
Mục **3. Điều hành công việc / Việc của tôi** có thêm khung **Nhắc việc hằng tuần**:

- **Trong tuần này**: nhắc việc của tổ dành cho mình và hạn các công việc mình được giao trong tuần (thứ Hai – Chủ nhật).
- **Mốc sắp tới (3 tuần)**: các mốc ngày quan trọng (kiểm tra tập trung, hạn nộp, đăng ký thi…).
- **Lịch của tôi (.ics)**: tải file lịch gồm nhắc việc dành cho mình + hạn công việc chưa hoàn thành + mốc lịch năm học. Nhập vào Google Lịch để điện thoại tự báo.
- **Lịch chung của tổ** (tổ trưởng, tổ phó): file lịch các nhắc việc áp dụng cho cả tổ, gửi cho giáo viên.
- **Google Lịch** ở từng dòng: thêm riêng một nhắc việc vào Google Lịch (có lặp hằng tuần).
- Tổ trưởng/Quản trị: thêm, sửa, tắt/bật, xóa nhắc việc; chọn lặp mỗi tuần hoặc 2 tuần/lần, giờ, báo trước, đối tượng (cả tổ / lãnh đạo tổ / giáo viên được chọn).
- Nút **Nạp mốc mẫu theo kế hoạch tổ 2026 – 2027**: 4 nhắc việc lặp lại (nhắc sinh hoạt tổ đang TẮT, cần chỉnh thứ/giờ theo lịch trường rồi bật) và 12 mốc ngày theo kế hoạch tổ.

## Lưu trữ
Nhắc việc lưu trong cấu hình tổ (`departments/{id}.weeklyReminders`). **Không cần sửa hay triển khai lại Firestore Rules.** Chỉ Tổ trưởng/Quản trị sửa được (theo quyền sửa cấu hình hiện có).

## Nhập lịch vào Google Lịch
1. Bấm **Lịch của tôi (.ics)**.
2. Trên máy tính mở Google Lịch → nên tạo lịch riêng "Nhắc việc tổ Toán" (Cài đặt → Thêm lịch → Tạo lịch mới).
3. Cài đặt → **Nhập và xuất** → chọn file vừa tải, chọn lịch "Nhắc việc tổ Toán" → **Nhập**.
4. Khi nhắc việc thay đổi: xóa lịch riêng đó, tạo lại và nhập file mới.

## Tệp thay đổi
- `src/types/index.ts`: thêm `WeeklyReminder`, trường `DepartmentConfig.weeklyReminders`.
- `src/utils/reminders.ts` (mới): tính lịch, tạo .ics (RFC 5545, múi giờ Asia/Ho_Chi_Minh), liên kết Google Lịch, mốc mẫu.
- `src/components/modules/WeeklyRemindersPanel.tsx` (mới), `OperationsModule.tsx`: hiển thị khung nhắc việc.
- `tests/reminders.test.ts` (mới). Kiểm tra: 256/256 test đạt, build thành công.
