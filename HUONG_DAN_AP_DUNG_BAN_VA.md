# BẢN VÁ VÒNG ĐỜI CÔNG VIỆC - 03/10/2026

Chỉ thay 2 file:

1. `src/components/modules/OperationsModule.tsx`
2. `src/context/AppContext.tsx`

## Cải tiến
- Tổ trưởng mặc định xem `Toàn tổ`.
- Sau khi giao việc thành công, form đóng và tự chuyển về `Toàn tổ`.
- Nút `Lưu & giao việc` hiển thị `Đang lưu...` trong thời gian xử lý.
- Các thao tác `Bắt đầu`, `Nộp minh chứng`, `Xác nhận` có trạng thái đang xử lý và khóa bấm lặp.
- Ghi Audit không còn chặn thao tác chính.
- Hiển thị thời điểm nộp minh chứng và xác nhận hoàn thành.
- KPI vẫn lấy tự động từ `workTasks` có trạng thái `completed`; không nhập KPI thủ công.

## Cách áp dụng
Sao lưu project trước. Sau đó copy thư mục `src` của gói này vào thư mục gốc project và chọn Replace khi Windows hỏi.

Không thay `firestore.rules`, không cần deploy Rules lại.

Chạy thử:

```cmd
npm run dev
```

Sau khi kiểm tra vòng đời công việc, build:

```cmd
npm run build
```
