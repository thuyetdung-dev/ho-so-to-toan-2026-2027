# Nâng cấp V2.21.0 – Thư ký tổ, sửa/xóa giáo án và kế hoạch cá nhân

## 1. Thư ký tổ (Sinh hoạt chuyên môn)
- Hồ sơ thành viên có thêm ô **"Thư ký tổ"** (mục 2. Thành viên & Phân công → Hồ sơ giáo viên → bấm bút sửa).
  Chỉ Tổ trưởng / Tổ phó / Quản trị đánh dấu được; giáo viên không tự gán cho mình.
- Người là thư ký có nhãn **Thư ký** cạnh tên (góc trên, thanh bên trái, danh sách thành viên).
- Thư ký được: **Tạo cuộc họp mới**, **Sửa**, **Xóa** biên bản khi biên bản **chưa chốt**.
- Thư ký không chốt / mở khóa biên bản, không giao việc. Biên bản đã chốt cần Tổ trưởng/Tổ phó mở khóa thì thư ký mới sửa/xóa được.
- Ô "Thư ký" trong biên bản gợi ý sẵn tên các thư ký tổ; thư ký tạo biên bản thì tên mình được điền sẵn.

## 2. Kế hoạch bài dạy (Phụ lục IV) – người soạn sửa / xóa giáo án của mình
- Giáo án **đang chờ duyệt** hoặc **đã duyệt** nay có nút **Sửa**: bấm → xác nhận → giáo án về **bản nháp** và mở trình soạn.
  Sửa xong bấm **Trình duyệt** để tổ duyệt lại. Lịch sử phiên bản ghi lại lần rút về.
- Nút **Xóa** có chữ, hiện với người soạn ở mọi trạng thái (giáo án đã duyệt có cảnh báo không còn tính định mức).
- Giáo viên không sửa/xóa được giáo án của người khác (vẫn dùng **Nhân bản** để có bản riêng).

## 3. Kế hoạch cá nhân (Phụ lục III)
- Tương tự: người lập kế hoạch có nút **Sửa** (kế hoạch chờ duyệt/đã duyệt về bản nháp, sửa xong bấm **Nộp** lại) và **Xóa**.
- Tổ trưởng / Quản trị cũng rút về nháp được để hỗ trợ giáo viên.

## Phân quyền (firestore.rules)
- `ownerReopen()`: người soạn (hoặc Tổ trưởng/Quản trị) chuyển `lessonPlans`/`teacherPlans` từ chờ duyệt/đã duyệt về nháp,
  chỉ đổi trạng thái và lịch sử, không kèm sửa nội dung trong cùng bước.
- `isSecretary()`: đọc cờ `isSecretary` trên hồ sơ thành viên của chính người đăng nhập.
- `meetings`: thư ký tạo (nháp), sửa (không đổi trạng thái), xóa khi chưa chốt.
- `teacherPlans`: người lập được xóa kế hoạch của mình.

## Cách triển khai
1. GitHub Desktop: Commit + Push (Vercel tự cập nhật).
2. `firebase deploy --only firestore:rules` (**bắt buộc** – nếu không, thư ký và giáo viên bấm Sửa/Xóa sẽ báo lỗi quyền).
3. Mở app, bấm Ctrl + F5.
4. Vào 2. Thành viên & Phân công → Hồ sơ giáo viên → sửa hồ sơ cô **Mai Thị Tường Vi** và cô **Nguyễn Thị Thu Thủy** → tích **Thư ký tổ** → Lưu.

## Kiểm thử
- `npm test` (đã thêm kiểm thử luồng rút về bản nháp).
- `npm run test:rules` (đã thêm 19 kiểm tra cho thư ký và sửa/xóa hồ sơ; cần Firebase Emulator trên máy).
