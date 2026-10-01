# Kiểm tra phiên bản 2.15.1

Ngày 01/10/2026. Node.js 24; dùng bộ phụ thuộc trong tệp khóa của 2.15.0, không nâng phiên bản thư viện.

- TypeScript: đạt.
- Kiểm thử mã nguồn: 140/140 đạt (126 kiểm thử của 2.15.0 và 14 kiểm thử nhập bổ sung).
- Build: đạt.
- Firestore Rules giữ nguyên từng byte so với gói 2.15.0. Bộ 70 tình huống Emulator đã chạy cho bản 2.15.0; không chạy lại Emulator trong lần bổ sung giao diện/đọc tệp này.

## Kiểm tra bổ sung

- Bảng Excel có tiêu đề hoạt động viết hoa chuyển đúng sang các mục CV 5512.
- Tệp XLSX nhiều trang tính thực tế đọc riêng từng trang, không trộn giáo án.
- CSV tiếng Việt, Word có công thức Equation thực tế.
- Tệp quá lớn, định dạng không hỗ trợ, Excel rỗng và tác vụ đã hủy bị chặn.
- Giáo án nhập có mã mới, người nhập là tác giả, trạng thái nháp và giữ tham chiếu hình/công thức.
- Văn bản không theo CV 5512 được giữ trong hoạt động đầu.
- Tham chiếu ảnh gốc OCR có trong nội dung để ảnh không bị bộ lưu loại bỏ.
- PDF có chữ giữ dòng; PDF lẫn scan gọi OCR; trang trắng không gọi OCR; PNG gọi OCR. Bốn tình huống này dùng bộ PDF/OCR giả lập, không kiểm tra độ chính xác nhận dạng thực tế.

## Phạm vi chưa xác nhận

Chưa kiểm tra thao tác bằng trình duyệt, chất lượng OCR/canvas nén ảnh thực tế, đăng nhập Google, dữ liệu nhà trường hoặc triển khai Firebase/Vercel thật. Word trong kiểm thử dùng DOMParser XML thay thế cho môi trường Node; nén hình Word trên trình duyệt chưa được chạy trong lượt này.

Xem hướng dẫn 2.15.1 để cập nhật và chạy lại lệnh.
