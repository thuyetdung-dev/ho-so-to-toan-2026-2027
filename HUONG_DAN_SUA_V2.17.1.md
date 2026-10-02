# V2.17.1 – Đăng nhập chuyển sang dữ liệu thật

Sửa theo ảnh: ẩn nút dữ liệu mẫu khi có tài khoản Google; ngăn chuyển về demo khi đang đăng nhập; khi Firebase khôi phục phiên sau F5 cũng chuyển về dữ liệu thật. Chỉ cho đổi vai mẫu khi chưa đăng nhập. Danh tính mẫu không hiển thị trong lúc phiên đăng nhập chuyển sang dữ liệu thật. Tên/vai trò thật vẫn hiển thị để xác nhận tài khoản đang dùng.

Chép đè mã mới, commit/push main, chờ Vercel Ready, Ctrl+F5. Không cần thay rules hoặc biến môi trường. Kiểm tra: vào demo chưa đăng nhập có điều khiển mẫu; đăng nhập Google điều khiển mẫu biến mất; F5 vẫn ở dữ liệu thật; tên phải đúng tài khoản/thành viên được cấp quyền.

Kiểm tra bản sửa: TypeScript, unit tests và build. Chưa chạy E2E đăng nhập Google thật do không có phiên kiểm thử; lỗi tải Chromium của môi trường vẫn còn.
