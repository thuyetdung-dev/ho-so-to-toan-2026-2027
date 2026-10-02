# Kết quả kiểm tra V2.16.1

Ngày: 02/10/2026. Môi trường: Node.js 24.19.0, Linux; dependencies cài sạch từ package-lock.json.

| Kiểm tra | Kết quả |
|---|---|
| npm run lint – TypeScript | Đạt |
| npm test – unit, API, Cloudinary client, luồng lưu hồ sơ | 155/155 đạt |
| npm run test:rules – Firebase Firestore Emulator | 78/78 kiểm tra quyền đạt |
| npm run build – Vite production | Đạt |
| Máy chủ development – trang chủ | HTTP 200 |
| Máy chủ production – trang chủ | HTTP 200 |
| GET API ký ảnh, development và production | HTTP 405 |
| POST API ký ảnh thiếu token, development và production | HTTP 401 |
| POST API xóa ảnh thiếu token, development và production | HTTP 401 |
| Health API, development và production | HTTP 200 |

Các ca mới xác nhận: metadata Cloudinary v2/Firebase v1; từ chối ảnh của người khác/ảnh hồ sơ đã duyệt; ngăn đổi publicId/URL ảnh lịch sử; ký ảnh mới không ghi đè; xác nhận dọn ảnh gắn người dùng và đối tượng, không xóa ảnh đang dùng; phân công theo ID; tên đầy đủ duy nhất; hạn theo ngày Việt Nam; không có minh chứng không tự được điểm; lọc năm học/khoảng ngày; người dự giờ khác người được dự; giáo viên chỉ đổi trạng thái nhiệm vụ có ID thuộc mình.

Giới hạn: phản hồi Cloudinary/Firebase Auth trong test API và upload client được giả lập; Firestore rules được chạy trên Emulator thật. Không thực hiện đăng nhập Google, tải/xóa ảnh trên Cloudinary thật, hoặc cập nhật website/Firebase production của người dùng. Không tuyên bố kiểm thử E2E toàn bộ giao diện đã hoàn tất.
