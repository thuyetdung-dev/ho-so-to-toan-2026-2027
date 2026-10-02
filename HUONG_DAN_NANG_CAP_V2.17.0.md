# V2.17.0 – Báo cáo, đóng sổ, kiểm thử và đồng bộ

## Thay đổi
- Báo cáo và sổ dùng chung phạm vi năm học, ngày bắt đầu/kết thúc và ngày hiện tại tại Việt Nam. Hồ sơ khai báo năm học khác bị loại. Hồ sơ cũ thiếu năm học chỉ được tính khi có ngày hợp lệ thuộc năm học chọn.
- Giáo án tính theo ngày tạo (dự phòng ngày cập nhật); họp chỉ tính bản đã chốt, đã diễn ra. Chuyên đề thiếu ngày không tự tính.
- Loại trùng ID trong hoạt động; phân công dùng quy tắc loại trùng hiện có. Nghiên cứu bài học chỉ in một lần khi chọn cả biên bản và nghiên cứu bài học.
- Gói báo cáo lấy đúng danh sách ID minh chứng đã đồng bộ; từ chối xuất nếu minh chứng bị mất hoặc báo cáo cũ chưa có danh sách ID. Số liệu đã chốt vẫn giữ nguyên. Nội dung minh chứng lấy phiên bản hiện tại, không phải bản sao lịch sử tại lúc chốt; muốn lưu nguyên trạng phải tải ZIP tại thời điểm chốt.
- Gói ZIP tải cả ảnh Cloudinary về thành tệp ảnh; lỗi tải ảnh làm dừng xuất thay vì bỏ ảnh.
- Phân trang danh sách giáo án: 20 mục/trang, đổi bộ lọc về trang đầu. Đây là phân trang giao diện; Firestore vẫn tải các bản tóm tắt để báo cáo đầy đủ. Chưa chuyển truy vấn dữ liệu sang phân trang máy chủ.
- Hiển thị đang lưu, bộ nhớ đệm, lỗi đồng bộ, ngoại tuyến; không báo lưu thành công trước khi ghi được xác nhận.
- Phiên bản đầu/cuối trang thống nhất; lớp trùng trong hồ sơ 360° được gộp.
- Chỉ giữ một lockfile npm và nguồn chính; gói loại node_modules, dist, log, token, báo cáo test và mã lồng trùng.

## Triển khai
Chép mã vào kho hiện có (giữ .git và cấu hình bí mật riêng), chạy npm ci, npm run lint, npm test, npm run build. Commit/push main như lần trước. Phiên bản này không thay đổi Firestore rules so với V2.16.1.

## Kiểm thử trình duyệt
Chạy npm ci rồi npx playwright install chromium.
Mở máy chủ bằng npm run dev. Trong Git Bash:
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
Bài kiểm thử mẫu chỉ thao tác dữ liệu demo. Kiểm thử đăng nhập thật cần E2E_AUTH_STATE trỏ đến tệp trạng thái Playwright được tạo bằng tài khoản kiểm thử (phải bao gồm IndexedDB cho Firebase). Không commit tệp trạng thái.

## Cloudinary thật
Tạo một giáo án nháp dành riêng cho kiểm thử. Thiết lập E2E_BASE_URL, E2E_FIREBASE_TOKEN (Firebase ID token còn hạn của chủ giáo án), E2E_PLAN_ID. Tùy chọn E2E_OTHER_FIREBASE_TOKEN của giáo viên khác, không phải tổ trưởng/quản trị. Chạy node validation/cloudinary-live.mjs.
Bài này gọi API ứng dụng để ký, upload ảnh 1 pixel, tải lại và xóa bằng vé dọn dẹp. Không ghi metadata vào Firestore nên không thay nội dung giáo án. Có tác động upload/xóa một ảnh thử trên Cloudinary. Nếu dọn dẹp thất bại, kiểm tra thư mục giáo án thử trên Cloudinary. Không gửi token hoặc secret qua ảnh chụp/chat.

## Kiểm tra người dùng sau triển khai
1. Báo cáo: cùng năm/khoảng ngày, đồng bộ; đối chiếu ID minh chứng và tổng số. Chốt, thêm hồ sơ mới rồi xuất: minh chứng gói không tự tăng.
2. Sổ: chọn đồng thời SHCM/NCBH; mỗi biên bản NCBH chỉ xuất hiện một lần. Thử năm học khác và ngày ngoài kỳ.
3. Ảnh: tài khoản giáo viên tạo nháp, thêm/thay/xóa, tải lại; tài khoản giáo viên khác không được sửa/xóa; giáo án đã duyệt khóa sửa.
4. Danh sách: hơn 20 giáo án, chuyển trang, lọc, xóa ở trang cuối.
5. Đồng bộ: ngắt mạng, kiểm tra trạng thái; nối lại và chỉ tin thông báo lưu sau xác nhận máy chủ.
