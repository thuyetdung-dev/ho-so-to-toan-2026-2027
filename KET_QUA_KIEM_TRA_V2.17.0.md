# Kết quả kiểm tra V2.17.0

Đã đạt:
- TypeScript: npm run lint.
- 158/158 kiểm thử Node (gồm API Cloudinary dùng mock, client upload/delete, phạm vi báo cáo, loại trùng và minh chứng đã lưu).
- 78/78 kiểm tra Firestore Emulator. Rules không sửa trong bản này.
- Build production: npm run build.
- Playwright API chạy trên máy chủ Express production thật: 1/1 bài từ chối ký/xóa ảnh khi chưa đăng nhập.

Chưa xác nhận:
- E2E giao diện: đã viết các luồng demo danh sách/lọc/phân trang và báo cáo/đóng sổ, nhưng Chromium không tải được (tệp tải lỗi/truncated). Lần chạy thử không mở được trình duyệt. Không ghi nhận đây là lỗi nghiệp vụ ứng dụng, cũng không coi là đạt.
- Cloudinary upload/delete thật và Google login: chưa có token tài khoản kiểm thử/cấu hình dịch vụ. Đã cung cấp validation/cloudinary-live.mjs để chạy với giáo án nháp riêng, bao gồm kiểm tra giáo viên khác nếu cung cấp token thứ hai.
- Chưa triển khai lên GitHub/Vercel của người dùng.

Giới hạn:
- Phân trang giao diện, chưa phân trang truy vấn Firestore; cần giữ đầy đủ tóm tắt cho báo cáo.
- Minh chứng báo cáo được cố định bằng ID; nội dung hồ sơ xuất là phiên bản hiện tại. Muốn lưu nguyên trạng tại ngày chốt cần xuất và giữ ZIP lúc chốt.
- Bộ nhớ đệm/lỗi đồng bộ sẽ chặn đồng bộ báo cáo và đóng sổ để tránh tổng hợp dữ liệu thiếu.
