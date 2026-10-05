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

---

# V2.19.0 – Định mức theo học kỳ thay cho điểm KPI

- Bỏ điểm phần trăm (30/30, 57/100…). Mỗi nhóm minh chứng chỉ ghi **Đạt / Chưa đạt / Chưa đến hạn / Không yêu cầu**.
- Tổ đặt **định mức tối thiểu mỗi học kỳ** trong 12. Cài đặt → Thông tin chung (mặc định: KHGD cá nhân 1 ở HK I;
  KH bài dạy 8/HK; dự giờ có rút kinh nghiệm 4/HK; bồi dưỡng 0) và **ngày kết thúc học kỳ I**.
- Còn trong học kỳ mà chưa đủ → "Chưa đến hạn" (không bị coi là kém). Hết học kỳ mà chưa đủ → "Chưa đạt".
- Nhóm tổ đặt 0 và chưa có minh chứng → "Không yêu cầu", không tính.
- Nhiệm vụ được giao: chỉ xét việc đã đến hạn; có việc quá hạn chưa xong → "Chưa đạt".
- Hồ sơ 360° chọn Học kỳ I / Học kỳ II / Cả năm; Tổng quan hiện số giáo viên đạt đủ định mức và 5 vạch màu cho từng người.

---

# V2.20.0 – Giao diện rút gọn cho giáo viên

- Giáo viên (vai trò "Giáo viên") thấy 6 mục chính: Trang của tôi, Việc của tôi, Giáo án của tôi, Dự giờ,
  Sinh hoạt chuyên môn, Báo cáo tháng. Mục "Xem thêm": Kế hoạch tổ & cá nhân, Phân công chuyên môn,
  Chuyên đề, Tài liệu, Trợ lý AI, Hồ sơ của tôi. Không hiện Cài đặt, Lịch sử & Audit.
- Trên điện thoại có thanh nút cuối màn hình: Trang chủ · Việc · Giáo án · Báo cáo · Thêm.
- Trang của tôi: việc cần làm, việc cần sửa, định mức học kỳ, trạng thái báo cáo tháng, buổi họp tổ sắp tới.
- Phân công: mặc định "Của tôi", có nút "Cả tổ (chỉ xem)"; không có nút Excel; không hiện Thư mời & Phê duyệt.
- Việc của tôi: chỉ hiện việc của chính giáo viên. Hồ sơ 360°: giáo viên chỉ xem hồ sơ của mình.
- Báo cáo & In: giáo viên chỉ có Báo cáo tháng của mình.
- Việc đã nộp minh chứng, đang chờ lãnh đạo xác nhận không bị tính là "quá hạn".
- Tổ trưởng, tổ phó, quản trị và BGH vẫn thấy đầy đủ như trước.
