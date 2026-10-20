# Nâng cấp V2.23.0 – Biên bản họp tổ theo cấu trúc biên bản Hội nghị VC-NLĐ

## 1. Trình bày biên bản (mục 6. Sinh hoạt chuyên môn & NCBH)
Biên bản đang chọn hiển thị và in theo bố cục biên bản Hội nghị viên chức, người lao động năm học 2026 – 2027:
- Đầu trang: tên trường, **TỔ: …** | Quốc hiệu, tiêu ngữ; tiêu đề **BIÊN BẢN + tên cuộc họp** (in hoa), năm học.
- Phần mở đầu: *Hôm nay, ngày … tháng … năm …, vào lúc … giờ …*; tại đâu; **hiện diện x/y người** (kèm danh sách);
  **vắng mặt** (số người, từng người và lý do); **chủ trì + chức vụ**; **đại diện lãnh đạo/khách mời** (nếu có); **thư ký**.
- Nội dung: **1-** Chủ trì triển khai các nội dung · **2-** Thảo luận (ý kiến từng người) · **3-** Chủ trì tổng hợp ý kiến và kết luận ·
  **4-** Phân công thực hiện · **5-** Đọc lại biên bản, **biểu quyết** (x/y người tán thành, đạt …%), **giờ kết thúc**.
- Cuối trang: chữ ký **CHỦ TRÌ** | **THƯ KÝ** (ghi họ tên).
- Nút **In**: chỉ in tờ biên bản (ẩn thanh điều hướng, danh sách kỳ họp, các nút sửa/xóa/giao việc).

## 2. Biểu mẫu "Tạo cuộc họp mới" / "Sửa biên bản"
Thêm các ô: **Giờ bắt đầu**, **Giờ kết thúc**, **Chức vụ người chủ trì** (tự điền "Tổ trưởng chuyên môn" khi tổ trưởng tạo),
**Đại diện lãnh đạo trường / khách mời** (mỗi dòng: Họ tên - Chức vụ), **Số người tán thành khi biểu quyết**.
Ô "Nội dung" đổi tên thành "1- Nội dung chủ trì triển khai", ô "Kết luận" thành "3- Tổng hợp ý kiến và kết luận".
Biên bản cũ vẫn mở bình thường; các ô mới để trống sẽ in thành dấu chấm "……" để ghi tay.

## Phân quyền / dữ liệu
- Không đổi `firestore.rules`: các trường mới (`startTime`, `endTime`, `chairRole`, `guests`, `voteAgree`) là trường tùy chọn của tài liệu `meetings`.
- Cuốn Sổ chuyên môn hiển thị thêm nhãn tiếng Việt cho các trường mới.

## Tệp thay đổi
- `src/utils/minutes.ts` (mới) – hàm trình bày ngày giờ, tiêu đề, biểu quyết
- `src/components/modules/LessonStudyModule.tsx`
- `src/components/modules/Booklet.tsx` (nhãn trường mới)
- `src/types/index.ts` (kiểu `Meeting`)
- `tests/minutes.test.ts` (mới)
- `package.json` (phiên bản 2.23.0)

## Cách triển khai
GitHub Desktop: Commit + Push (Vercel tự cập nhật). Không cần cài thêm thư viện, không cần deploy lại firestore.rules.
