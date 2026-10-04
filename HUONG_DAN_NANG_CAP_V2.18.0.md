# Nâng cấp V2.18.0 – Gộp "Báo cáo tự động" vào Hồ sơ tổ

## Có gì mới
- Phân hệ **10. Báo cáo & In** có thêm tab **Báo cáo tháng** (mở mặc định với giáo viên).
- **Đọc công văn → chọn đầu việc**: tải PDF (cả bản scan), ảnh, Word, Excel; app tự tách đầu việc,
  lọc việc của giáo viên Toán THPT (bỏ tiểu học/THCS, môn khác, việc của Sở, câu bị cắt) và tự xếp ngày.
  Tệp được đọc ngay trên máy, không tải lên máy chủ.
- Đầu việc được tích chọn trở thành **công việc** của chính giáo viên (cũng hiện ở mục 3. Điều hành công việc):
  nộp minh chứng → lãnh đạo tổ xác nhận → tính vào KPI. Chỉ còn một con số tỉ lệ hoàn thành.
- **Báo cáo tháng** giữ cả 2 mẫu: **Hành chính** (quốc hiệu, tiêu ngữ, ký xác nhận) và **Sổ tay** (trang bìa,
  phiếu chốt cuối tháng). Tải Word hoặc In / Lưu PDF.
- Nộp báo cáo → tổ trưởng duyệt / trả lại. Bản đã nộp giữ nguyên danh sách đầu việc lúc nộp.
- Tổ trưởng xem bảng **Báo cáo tháng của cả tổ** (số việc, số hoàn thành, trạng thái báo cáo).
- Nút "Báo cáo" ở mục 3 và Tổng quan giờ mở báo cáo tháng ngay trong app (không còn mở app Báo cáo riêng).

## Phân quyền mới (firestore.rules)
- Giáo viên tự thêm/sửa ngày/xóa đầu việc **tự chọn từ công văn** của mình khi chưa nộp minh chứng;
  không tự đánh dấu hoàn thành.
- Bộ sưu tập mới `monthlyReports`: giáo viên tạo/sửa/nộp báo cáo của mình; tổ trưởng, quản trị duyệt
  (kể cả báo cáo của chính mình); tổ phó duyệt báo cáo người khác; tổ trưởng mở lại báo cáo đã duyệt.

## Cách triển khai
1. GitHub Desktop: Commit + Push (Vercel tự cập nhật).
2. `firebase deploy --only firestore:rules` (bắt buộc – nếu không, giáo viên không lưu được báo cáo tháng).
3. Mở app, bấm Ctrl + F5.

App "Báo cáo tự động" cũ (Supabase) không còn cần dùng; có thể để nguyên hoặc gỡ sau.
