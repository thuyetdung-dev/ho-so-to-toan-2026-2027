# HỒ SƠ TỔ TOÁN – V2.16.1

Bản nâng cấp ngày 02/10/2026, từ mã nguồn V2.16.0 được cung cấp.

## Những thay đổi trong bản này

1. Firestore chấp nhận metadata Firebase Storage v1 và Cloudinary v2. Ảnh cũ vẫn đọc được. Không tự chuyển hoặc xóa ảnh cũ khi cài bản mới.
2. API tải ảnh kiểm tra tài khoản, vai trò, giáo án, người sở hữu và trạng thái nháp/trả lại. BGH không được sửa ảnh. Giáo viên không sửa ảnh giáo án người khác.
3. Mỗi ảnh tải mới có publicId riêng và overwrite=false. Không ký lại mã ảnh đã có metadata: khi thay hình phải dùng mã ảnh mới để bảo toàn lịch sử. Ảnh vẫn đang được hồ sơ sử dụng không thể xóa trực tiếp bằng API.
4. Dọn ảnh dùng xác nhận có thời hạn, gắn với tài khoản và đúng ảnh. Xác nhận lấy trước khi ghi/xóa dữ liệu; ảnh chỉ dọn sau khi metadata ngừng tham chiếu. Lỗi dọn ảnh sau commit không làm mất nội dung đã lưu.
5. Vercel và máy local/VPS dùng cùng API tải/xóa ảnh. Khóa bí mật chỉ ở máy chủ.
6. Nhiệm vụ có assigneeId. Tên cũ chỉ ghép nếu họ tên đầy đủ trùng duy nhất; tên trùng, tên nhóm hoặc chưa rõ được giữ lại để tổ trưởng xác nhận. Giáo viên chỉ đổi trạng thái nhiệm vụ có ID thuộc mình; Firestore cũng kiểm tra điều này.
7. Hạn hôm nay/quá hạn/sắp đến hạn dùng ngày Việt Nam, không phụ thuộc múi giờ máy.
8. Hồ sơ 360° hiển thị chỉ số tiến độ hồ sơ tham khảo theo năm học và khoảng ngày. Không có minh chứng không tự được điểm. Kế hoạch tính theo tỷ lệ duyệt; dự giờ chỉ tính vai trò người dự, đã rà soát và có rút kinh nghiệm; nhiệm vụ KPI lấy từ biên bản đã chốt. Không dùng chỉ số này thay kết quả đánh giá nhân sự chính thức.
9. Thanh trên hiển thị V2.16.1 để dễ xác nhận đã triển khai đúng mã.

## Cách cập nhật lên GitHub/Vercel

1. Sao lưu dữ liệu thật trước khi thay bản đang dùng.
2. Giải nén ZIP vào một thư mục mới. Các tệp package.json, server.ts, firestore.rules nằm ngay tại thư mục chính.
3. Đưa mã nguồn này vào kho GitHub của phần mềm, thay các tệp trùng tên. Gói không chứa node_modules, dist, lịch sử Git hoặc các bản sao dự án lồng nhau.
4. Trong Vercel → Settings → Environment Variables, điền:
   - CLOUDINARY_CLOUD_NAME
   - CLOUDINARY_API_KEY
   - CLOUDINARY_API_SECRET
   - FIREBASE_PROJECT_ID = ho-so-to-toan-2026-2027
   - FIREBASE_DATABASE_ID = (default), nếu dùng database mặc định.
   Giữ các biến Gemini đã cấu hình nếu đang dùng AI. Không thêm tiền tố VITE_ cho khóa bí mật.
5. CẬP NHẬT FIRESTORE RULES: mở Firebase Console → Firestore Database → Rules; thay bằng toàn bộ nội dung firestore.rules trong gói và bấm Publish. Nếu dùng Firebase CLI, chạy:

```bash
npx firebase deploy --only firestore:rules --project ho-so-to-toan-2026-2027
```

6. Triển khai lại trên Vercel với Node.js 24.x, Build Command `npm run build`, Output Directory `dist`.
7. Khi mở website, kiểm tra thanh trên có V2.16.1. Nếu chưa thấy, tải lại bằng Ctrl+F5.

Lưu ý: thay mã giao diện nhưng chưa cập nhật Firestore rules hoặc biến Cloudinary sẽ chưa giải quyết được việc lưu ảnh.

## Chạy trên máy / VPS

Cài Node.js 24.x. Mở cửa sổ lệnh trong thư mục đã giải nén:

```bash
npm ci
```

Sao chép .env.example thành .env.local và điền ba biến Cloudinary. .env.local không đưa lên GitHub.

Phát triển:

```bash
npm run dev
```

Chạy bản production:

```bash
npm run build
npm start
```

Truy cập http://localhost:3000. Miền chạy thật và localhost cần được cho phép trong Firebase Authentication → Authorized domains. Các API ảnh và AI đều chạy trên cùng máy chủ.

## Xác nhận dữ liệu cũ và người được giao việc

- Mở biên bản có nhiệm vụ cũ bằng vai trò Tổ trưởng. Chọn người thực hiện bằng danh sách giáo viên khi cần giao nhiệm vụ mới; lưu biên bản để gắn ID cho tên cũ trùng đầy đủ duy nhất.
- Với nhiệm vụ có người trùng họ tên, chọn giáo viên ở ô “Xác nhận người thực hiện” ngay dưới từng nhiệm vụ trong biên bản; không tự suy đoán người nhận. Nhiệm vụ kế hoạch có danh sách chọn giáo viên ngay trong bảng sửa.
- Nhiệm vụ chưa có ID được giữ nguyên, có cảnh báo; giáo viên chưa được đổi trạng thái cho đến khi tổ trưởng xác nhận.
- Không tự chạy migration hàng loạt hồ sơ đã duyệt: luồng sửa ảnh thông thường chặn giáo án đã gửi duyệt/đã duyệt. Phục hồi có ngoại lệ riêng, chỉ quản trị trong phiên phục hồi hợp lệ.

## Kiểm thử trên dữ liệu thử trước khi dùng thật

- Giáo viên A tạo giáo án nháp, thêm ảnh, lưu, tải lại và mở lại: ảnh còn đầy đủ.
- A sửa giáo án của B hoặc giáo án đã duyệt: thao tác phải bị từ chối.
- Thay hình bằng mã ảnh mới; bản cũ vẫn giữ hình của phiên bản cũ.
- Xóa giáo án nháp theo đúng quyền; kiểm tra nội dung và metadata đã xóa trước khi dọn ảnh.
- Tạo nhiệm vụ hạn hôm nay: hiển thị nhóm Hôm nay theo giờ Việt Nam.
- Hai giáo viên có tên gần giống không nhận nhầm nhiệm vụ.
- Giáo viên chưa có hồ sơ không nhận tự động 15 điểm; hiển thị chưa đủ dữ liệu.

## Kiểm tra kỹ thuật đã chạy

- TypeScript: đạt.
- Unit/API/client tests: 155/155 đạt, gồm các ca mới cho Cloudinary và phân công/KPI.
- Firestore Emulator: 78/78 kiểm tra quyền đạt.
- Production build: đạt.
- Kiểm tra endpoint máy chủ local/production: xem KET_QUA_KIEM_TRA_V2.16.1.md.

Các kiểm thử API và trình duyệt gọi Cloudinary dùng phản hồi giả lập. Chưa tải/xóa ảnh trên tài khoản Cloudinary thật, chưa triển khai thay website/Firebase của người dùng.
