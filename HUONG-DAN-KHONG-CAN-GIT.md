# Áp dụng bản sửa mà KHÔNG cần cài git

Có 2 việc. Việc 1 quan trọng nhất và làm xong trong 2 phút.

====================================================================
VIỆC 1 — Cập nhật quy tắc bảo mật Firestore (GẤP, không cần GitHub)
====================================================================

Đây là phần vá 4 lỗ hổng phân quyền. Nó KHÔNG đi qua GitHub hay Vercel —
quy tắc nằm trên máy chủ Firebase và dán thẳng vào là có hiệu lực ngay.

1. Mở https://console.firebase.google.com
2. Chọn dự án  ho-so-to-toan-2026-2027
3. Menu trái: Firestore Database  →  thẻ  Rules
4. Mở tệp `firestore.rules` tôi gửi kèm, chọn tất cả (Ctrl+A), sao chép
5. Quay lại trình duyệt, xóa hết nội dung trong ô soạn thảo, dán bản mới vào
6. Bấm  Publish  (hoặc Xuất bản)

Xong. Từ giây phút này giáo viên không ghi đè được kế hoạch cá nhân của
đồng nghiệp, không sửa được phiếu dự giờ người khác viết về mình.

MẸO: trước khi dán, sao chép nội dung cũ ra một tệp Notepad để phòng khi
cần quay lại.

====================================================================
VIỆC 2 — Đưa 15 tệp mã nguồn lên GitHub (qua trình duyệt)
====================================================================

GitHub cho phép tải tệp lên bằng cách kéo thả, không cần cài gì.

## Bước 1: Giải nén

Giải nén tệp `15-tep-da-sua-keo-tha-len-github.zip`. Bên trong có:

    README.md
    firestore.rules
    package.json
    src/...        (11 tệp)
    tests/...      (1 tệp)

GIỮ NGUYÊN cấu trúc thư mục. Đừng gom hết vào một chỗ.

## Bước 2: Tải lên

1. Mở  https://github.com/thuyetdung-dev/ho-so-to-toan-2026-2027
2. Bấm nút  Add file  →  Upload files
3. Kéo TOÀN BỘ nội dung bên trong thư mục vừa giải nén (cả thư mục `src`
   và `tests`) thả vào vùng tải lên.
   Lưu ý: kéo thả THƯ MỤC thì GitHub mới giữ đúng đường dẫn.
4. Kéo xuống cuối trang, ô "Commit changes":
   - Dòng tiêu đề, điền:
     Siết phân quyền theo chủ sở hữu, dọn phần đã chuyển ra công cụ ngoài
   - Chọn  "Create a new branch for this commit and start a pull request"
   - Tên nhánh để mặc định hoặc đổi thành:  fix/phan-quyen
5. Bấm  Propose changes

## Bước 3: Xóa 2 tệp mã chết

Hai tệp này không còn được dùng (894 dòng), xóa riêng vì tải lên không
xóa được tệp cũ. Làm ngay trên nhánh vừa tạo:

  src/components/modules/ExamCreatorModule.tsx
  src/components/modules/AnalyticsModule.tsx

Với từng tệp:
1. Mở tệp trên GitHub (nhớ đang ở nhánh fix/phan-quyen, không phải main)
2. Bấm biểu tượng thùng rác ở góc trên bên phải
3. Kéo xuống, chọn "Commit directly to the fix/phan-quyen branch"
4. Bấm  Commit changes

Nếu bỏ qua bước này cũng không sao — ứng dụng vẫn chạy đúng, chỉ là còn
894 dòng mã thừa trong kho.

## Bước 4: Gộp vào main

1. Vào thẻ  Pull requests  →  mở pull request vừa tạo
2. Xem lại danh sách tệp thay đổi nếu muốn
3. Bấm  Merge pull request  →  Confirm merge

Vercel sẽ tự động build lại sau 1–2 phút.

## Bước 5: Kiểm tra

Mở https://ho-so-to-toan-2026-2027.vercel.app/ và kiểm tra:

- Cuối thanh menu bên trái có nhóm "LIÊN KẾT NGOÀI" với 2 mục
- Vào Cài đặt → Thông tin chung → thấy mục "Liên kết ngoài" để điền địa chỉ
- Cài đặt không còn thẻ "Cấu trúc đề mẫu"
- Bảng phân quyền không còn 2 dòng về đề kiểm tra

Nếu trang lỗi trắng: vào Vercel → Deployments → xem build log.

====================================================================
VIỆC 3 — Hai thiết lập nên làm luôn
====================================================================

1. ĐẶT KHÓA GEMINI TRÊN VERCEL
   Vercel → chọn dự án → Settings → Environment Variables
   → Add New:  tên  GEMINI_API_KEY   giá trị: khóa lấy tại
     https://aistudio.google.com/apikey
   → tích cả Production và Preview → Save
   → Deployments → dấu ... ở bản mới nhất → Redeploy
   Kiểm chứng: mở  https://ho-so-to-toan-2026-2027.vercel.app/api/ai
   phải thấy  {"ok":true,"ai":true}
   Làm xong thì giáo viên không phải tự dán khóa Gemini riêng nữa.

2. ĐIỀN HAI ĐỊA CHỈ LIÊN KẾT NGOÀI
   Trong ứng dụng: Cài đặt → Thông tin chung → mục "Liên kết ngoài"
   - Ngân hàng câu hỏi & Đề kiểm tra:  https://dinhcaotritue.com
   - Kho tài liệu của tổ:  đường dẫn thư mục Google Drive của tổ
   → Lưu cấu hình hệ thống
   Nhớ đặt quyền chia sẻ thư mục Drive cho đúng phạm vi tổ — quyền đó do
   Google quản lý, không theo phân quyền của phần mềm.

====================================================================
KIỂM THỬ NÊN LÀM SAU KHI CẬP NHẬT QUY TẮC
====================================================================

Nhờ một giáo viên trong tổ (không phải tổ trưởng) đăng nhập và thử:

- Mở kế hoạch cá nhân của đồng nghiệp, bấm sửa  →  phải báo không có quyền
- Mở phiếu dự giờ đồng nghiệp viết về tiết dạy của mình
  →  chỉ sửa được ô "Phản hồi của giáo viên dạy"
- Vào Cài đặt  →  không còn nút đổi vai trò
- Đánh dấu một tiết đã dạy trong kế hoạch tổ  →  vẫn làm được bình thường

Nếu một thao tác đúng quyền mà bị chặn, chụp màn hình thông báo lỗi
(đã dịch sang tiếng Việt) rồi gửi lại, tôi chỉnh quy tắc cho khớp.
