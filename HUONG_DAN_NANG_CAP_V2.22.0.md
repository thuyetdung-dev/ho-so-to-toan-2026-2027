# Nâng cấp V2.22.0 – Xuất Sổ chuyên môn ra Word/PDF/Excel, sửa ý kiến thảo luận

## 1. Đóng cuốn Sổ chuyên môn (mục 10. Báo cáo & In → Đóng cuốn Sổ chuyên môn)
Sau khi bấm **Tạo bản xem trước**, có 3 nút xuất:
- **In / Xuất PDF**: mở hộp thoại in, chọn máy in hoặc **"Lưu dưới dạng PDF"** (Save as PDF).
- **Xuất Word**: tải file `.docx` khổ A4, Times New Roman 12, có trang bìa, mục lục, mỗi phần sang trang mới, đánh số trang.
  Bảng giữ nguyên dạng bảng; hình và đồ thị được chèn vào file; **công thức toán được chuyển thành công thức Word (Equation)**
  nên mở trong Word sửa tiếp được. Ảnh nào không tải được sẽ ghi chú "[... – không tải được ảnh, xem bản PDF]".
- **Xuất Excel**: tải file `.xlsx`, trang "Tổng hợp" + mỗi phần hồ sơ một trang tính (Thành viên, Phân công, Kế hoạch, Biên bản, …),
  mỗi hồ sơ một dòng, có bộ lọc. Công thức giữ dạng LaTeX, ảnh ghi thành "[hình]".

## 2. Sinh hoạt chuyên môn – sửa / xóa ý kiến thảo luận
- Mỗi ý kiến trong mục **"2. Ý kiến thảo luận của các thành viên"** có nút **bút (Sửa)** và **thùng rác (Xóa)** khi biên bản **chưa chốt**.
- Tổ trưởng / Tổ phó / Thư ký: sửa, xóa mọi ý kiến, đổi được tên người phát biểu.
- Giáo viên: chỉ sửa, xóa ý kiến của chính mình.
- Thư ký / Tổ trưởng ghi ý kiến **thay người phát biểu**: nhập tên vào ô "Người phát biểu" (gợi ý sẵn danh sách thành viên) trước khi bấm **Ghi biên bản**; để trống thì ghi tên người đang đăng nhập.
- Biên bản đã chốt: không sửa được, cần Tổ trưởng/Tổ phó mở khóa trước.

## Phân quyền
- Không đổi `firestore.rules` (luật hiện tại đã cho phép sửa `memberOpinions` khi biên bản còn nháp).

## Tệp thay đổi
- `src/utils/bookletExport.ts` (mới)
- `src/components/modules/Booklet.tsx`
- `src/components/modules/LessonStudyModule.tsx`
- `package.json` (phiên bản 2.22.0)

## Cách triển khai
GitHub Desktop: Commit + Push (Vercel tự cập nhật). Không cần cài thêm thư viện, không cần deploy lại firestore.rules.
