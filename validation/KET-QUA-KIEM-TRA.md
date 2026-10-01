# Kiểm tra phiên bản 2.15.0

Ngày 01/10/2026. Môi trường Node.js 24, Firebase SDK 12.19.0.

- Cài đặt theo `package-lock.json` bằng `npm ci`: đạt.
- TypeScript (`npm run lint`): đạt.
- Kiểm thử mã nguồn (`npm test`): 126/126 đạt.
- Firestore Emulator: 70/70 tình huống đạt với Rules trong gói.
- Build sản phẩm (`npm run build`): đạt.

## Nội dung đã kiểm tra

- Ghép tiến độ mà không thay đổi kế hoạch đã duyệt; đúng mã kế hoạch/dòng.
- Quyền Tổ trưởng/BGH cập nhật tiến độ và chặn giáo viên/mã dòng sai trên Emulator.
- Chặn nháp → trả lại, tự duyệt, sửa nội dung trong thao tác duyệt và chuyển trạng thái thiếu nhật ký.
- Ghi nguyên tử giáo án mới với cha/nội dung/phiên bản trong cùng batch theo Rules thật.
- Hàm lưu giáo án thực tế chạy trên Emulator: tạo, nộp với snapshot/nhật ký, trả lại, sửa và giữ snapshot bất biến.
- Snapshot không được sửa hoặc xóa riêng; so sánh theo nội dung bất kể thứ tự khóa.
- Hàm sao lưu thực tế tải đủ chữ, hình và phiên bản; kiểm thử phát hiện hình/snapshot bị thiếu.
- Lỗi commit giả lập khi tạo/sửa/xóa giữ nguyên dữ liệu; vượt giới hạn tổng byte bị chặn trước khi ghi.
- Hàm xóa giáo án thực tế trên Emulator xóa cả cha và các phần; Tổ trưởng xóa được cha/nội dung đang chờ duyệt trong batch.
- Phiên phục hồi chỉ Quản trị mở được, giới hạn 30 phút; phục hồi hồ sơ đã duyệt/nội dung tách/báo cáo khóa; chặn mã phiên sai và phiên đã đóng.
- Nhật ký nhập được gắn nhãn [Phục hồi], giữ người/thời điểm cũ, đọc được lịch sử lồng và khử trùng bản lưu trữ.

## Giới hạn của kết quả

Chưa triển khai lên Firebase/Vercel thật; chưa kiểm tra đăng nhập Google, Gemini thật, thao tác bằng trình duyệt với dữ liệu nhà trường hoặc phục hồi quy mô lớn qua giao diện. Emulator và kiểm thử lỗi commit không thay thế thử nghiệm vận hành trên môi trường kiểm thử của trường. Phục hồi nhiều đợt có thể dừng giữa chừng; không có giao dịch nguyên tử cho toàn bộ hệ thống.

Xem `HUONG-DAN-CAP-NHAT-2.15.0.md` để chạy lại các lệnh và cập nhật Rules.
