# Sổ Sinh hoạt Chuyên môn số – Tổ Toán THPT

Hồ sơ chuyên môn điện tử cho Tổ Toán THPT theo Công văn 5512/BGDĐT-GDTrH và Chương trình GDPT 2018.
Ứng dụng dùng React + Vite, dữ liệu lưu trên Firebase (Firestore), đăng nhập bằng Google, Trợ lý AI dùng Gemini.

## 1. Chạy trên máy

Yêu cầu: Node.js 20 trở lên.

```bash
npm install
cp .env.example .env.local     # rồi điền GEMINI_API_KEY (nếu dùng Trợ lý AI)
npm run dev                    # mở http://localhost:3000
```

Chạy bản chính thức:

```bash
npm run build
npm start                      # phục vụ thư mục dist/ + API AI trên cổng 3000
```

> Lưu ý: `npm run dev` giờ chạy qua `server.ts` (có API `/api/ai`). Nếu chạy `vite` trực tiếp (`npm run dev:vite`) thì Trợ lý AI sẽ không hoạt động.

Kiểm tra trước khi triển khai: `npm run lint`, `npm test`, `npm run build`.

## 2. Triển khai trên Vercel (kèm Trợ lý AI)

Trên Vercel, giao diện được phục vụ từ `dist/`, còn Trợ lý AI chạy bằng hàm `api/ai.ts` (Vercel tự nhận thư mục `api/`; cấu hình trong `vercel.json`). `server.ts` chỉ dùng khi chạy trên máy/VPS.

1. Lấy khóa Gemini tại https://aistudio.google.com/apikey.
2. Vercel → chọn dự án → **Settings → Environment Variables** → thêm `GEMINI_API_KEY` = khóa vừa lấy (chọn cả Production và Preview) → Save.
3. Đưa mã nguồn mới lên (push lên GitHub nếu dự án Vercel nối với GitHub, hoặc chạy `npx vercel --prod` trong thư mục dự án).
4. Nếu đã deploy trước khi thêm khóa: **Deployments → … → Redeploy**.
5. Kiểm tra: mở `https://<tên-miền>/api/ai` phải thấy `{"ok":true,"ai":true}`.

Tùy chọn: `GEMINI_MODEL` (mặc định `gemini-2.5-flash`), `AI_RATE_LIMIT` (mặc định 30 lượt/10 phút/người).

## 3. Triển khai quy tắc bảo mật Firestore (BẮT BUỘC)

Quy tắc cũ cho **mọi tài khoản Google** đọc/ghi/xóa toàn bộ dữ liệu. Hãy triển khai quy tắc mới:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

(Hoặc mở Firebase Console → Firestore Database → Rules → dán nội dung tệp `firestore.rules` → Publish.)

### Chuyển dữ liệu cũ sang cơ chế phân quyền mới

1. Chủ sở hữu hệ thống là email khai báo trong `firestore.rules` (hàm `isOwner`) và `src/firebase.ts` (`OWNER_EMAIL`) – hiện là `thuyetdung@gmail.com`. Nếu đổi người quản trị, sửa **cả hai** nơi.
2. Sau khi triển khai quy tắc, chủ sở hữu **đăng nhập trước**. Ứng dụng sẽ tự tạo chỉ mục phân quyền (`accessIndex`) cho mọi thành viên đang có trong danh sách. Từ lúc đó các thành viên khác đăng nhập bình thường.
3. Thư mời cũ (mã dạng `inv-...`) không dùng được với cơ chế mới – hãy gửi lại thư mời. Thư mời mới dùng email làm mã: giáo viên chỉ cần đăng nhập Google bằng đúng email được mời là tự vào tổ.

### Phân quyền

| Vai trò | Được làm |
|---|---|
| Quản trị (admin) | Mọi việc, kể cả chuyển năm học, xóa trắng dữ liệu, cấp quyền Quản trị |
| Tổ trưởng (head) | Cấu hình tổ, phục hồi sao lưu, quản lý thành viên, duyệt kế hoạch/giáo án/câu hỏi |
| Tổ phó (deputy) | Quản lý lớp, phân công, thư mời; duyệt giáo án, câu hỏi; soạn/trình kế hoạch tổ |
| Giáo viên (teacher) | Soạn giáo án (của mình), dự giờ, câu hỏi (chờ duyệt), đề, tài liệu, bảng điểm |
| Ban Giám hiệu (principal) | Xem toàn bộ, phê duyệt Kế hoạch dạy học của tổ |

## 4. Những gì đã sửa và nâng cấp ở bản 2.0

### Lỗi bảo mật nghiêm trọng
- **Ai đăng nhập Google cũng ghi/xóa được toàn bộ dữ liệu**, kể cả tự thêm mình làm admin → viết lại `firestore.rules` phân quyền theo vai trò.
- **Ở chế độ dữ liệu thật, mọi người đăng nhập đều mang quyền của thành viên đầu tiên (Quản trị)**; thêm vào đó ai cũng "đổi vai" sang Tổ trưởng/Admin được → danh tính nay lấy theo email Google; đổi vai chỉ còn ở chế độ demo.
- **Nút "Xóa trắng dữ liệu" không hỏi lại, ai cũng bấm được** → chỉ Quản trị, phải gõ xác nhận `XOA TRANG`.
- Phục hồi sao lưu JSON: ai cũng làm được, có thể ghi đè danh sách thành viên để chiếm quyền → chỉ Tổ trưởng/Quản trị, có kiểm tra dữ liệu và hỏi xác nhận.
- Nhúng GeoGebra/mở liên kết không kiểm tra địa chỉ (có thể chèn `javascript:`) → chỉ cho http/https, iframe chỉ nhận geogebra.org.
- Thư viện `xlsx` 0.18.5 có lỗ hổng mức cao (prototype pollution, ReDoS) → thay bằng bản vá 0.20.3 (`@e965/xlsx`, bản phát hành lại SheetJS trên npm).
- Khi chưa đăng nhập ở chế độ thật vẫn vào được giao diện → nay hiện màn hình đăng nhập.

### Lỗi làm mất/sai dữ liệu
- Lưu Firestore **lỗi âm thầm** khi có trường trống (`undefined`): duyệt kế hoạch, khóa biên bản, dạy bù... không được lưu nhưng vẫn báo "thành công" → bật `ignoreUndefinedProperties`, mọi lỗi ghi đều hiện thông báo.
- Nhập phân công từ Excel **chỉ hiện trên màn hình, không ghi vào CSDL**; giáo viên không khớp tên bị gán mã giả → nay ghi thật, kiểm tra từng dòng (khối, số tiết, tên GV).
- Chuyển năm học **chỉ xóa phân công trên màn hình** (tải lại là hiện lại), tùy chọn "sao chép kế hoạch" không có tác dụng ở dữ liệu thật → sửa, có hỏi xác nhận.
- Trang Cài đặt đọc cấu hình **trước khi dữ liệu thật tải xong** → bấm lưu có thể ghi đè cấu hình thật bằng giá trị mặc định.
- Chế độ demo sửa trực tiếp mảng dữ liệu mẫu nên giao diện không cập nhật (thêm chuyên đề/SKKN không hiện, duyệt yêu cầu truy cập không thêm thành viên) → toàn bộ dữ liệu demo là state riêng.
- Tài liệu dùng chung bị nhân đôi khi sửa; mã bản ghi `prefix-${Date.now()}` trùng nhau khi thao tác nhanh (nhật ký ghi đè nhau).
- Lịch năm học ở chế độ mẫu luôn rỗng (đọc sai trường `academicCalendar` / `calendarMilestones`).

### Chức năng "giả" / hiển thị sai
- Màn **So sánh phiên bản (Diff)** của kế hoạch tổ và giáo án hiển thị nội dung **viết cứng**, không phải dữ liệu thật → nay lưu ảnh chụp đầy đủ mỗi lần trình/duyệt và so sánh thật (thêm/bớt/sửa từng bài).
- Báo cáo gán cứng **điểm trung bình 7.42**, "100% giáo viên được phân công", số buổi NCBH lấy nhầm số chuyên đề → tính từ dữ liệu thật.
- Phiếu dự giờ **tự điền nhận xét mẫu** khi để trống (hồ sơ có nội dung không có thật); form thiếu ô "Biện pháp hỗ trợ" và "Nhận xét chung".
- Nút "Tải học liệu", "Tải toàn văn SKKN" chỉ hiện thông báo, không tải gì → nay mở liên kết thật.
- Link mời `?invite=` không được ứng dụng xử lý → cơ chế mời theo email.
- Chọn Khối 10/11 nhưng hiện kế hoạch Khối 12; trạng thái "Bù tiết" hiện nút trống; "Cuộc họp sắp tới" thực ra là 2 phần tử đầu mảng; vai trò "guest" không tồn tại trong thư mời.
- Lỗi hiển thị KaTeX: `'$$$'` bị thay thành `'$'` thay vì `'$$'` (chuỗi thay thế `'$$'` trong JavaScript nghĩa là một dấu `$`).
- Thông báo hiện 2 lần (Navbar + góc màn hình).

### Phân quyền trên giao diện
- Giáo viên trình/duyệt được kế hoạch tổ; BGH không duyệt được dù nội dung ghi "trình BGH phê duyệt" → Tổ trưởng/Tổ phó trình, BGH/Tổ trưởng duyệt.
- Ai cũng trình duyệt giáo án của người khác, tự duyệt giáo án của mình → chỉ người soạn trình; tổ trưởng/phó duyệt.
- Nhập Excel, xóa lớp/phân công không hỏi lại và không giới hạn quyền.

### Tính năng mới
- **Soạn nội dung giáo án** (mục tiêu, thiết bị, 4 hoạt động a-b-c-d) có xem trước công thức; xóa, in giáo án; tìm kiếm, lọc "của tôi".
- **Tạo/sửa Kế hoạch dạy học của tổ** (phân phối chương trình, kiểm tra định kỳ), xóa kế hoạch.
- **Ngân hàng câu hỏi** định dạng 2025 (trắc nghiệm, Đúng/Sai 4 ý, trả lời ngắn ≤ 4 ký tự, tự luận), quy trình duyệt câu hỏi; **tạo đề tự động** theo cấu trúc 12 + 4 + 6, sắp dễ→khó, in đề, xem đáp án, công bố.
- **Phân tích kết quả**: dán cột điểm từ Excel → điểm TB, trung vị, độ lệch chuẩn, tỉ lệ ≥5/≥8/<3,5, phổ điểm, so sánh lớp, xuất Excel.
- **Tài liệu dùng chung**: thêm/sửa/xóa liên kết, phân loại, lọc theo khối, tìm kiếm.
- **Trợ lý AI (Gemini)**: hỏi đáp, giải toán, soạn câu hỏi, gợi ý giáo án, tóm tắt dự giờ; khóa API chỉ ở máy chủ, yêu cầu đăng nhập, giới hạn 30 lượt/10 phút mỗi người.
- Quản lý thành viên: sửa hồ sơ, đổi vai trò, chuyển công tác/nghỉ hưu (tự thu hồi quyền), xóa; chọn vai trò khi duyệt yêu cầu truy cập.
- Biên bản họp: sửa, điểm danh có mặt/vắng, giao việc có hạn và theo dõi trạng thái, in, xóa; hỏi xác nhận khi chốt.
- Dự giờ: nhiều hoạt động, gắn với giáo án, giáo viên được dự phản hồi, in phiếu, lọc "tôi dự / dự giờ tôi".
- Chuyên đề & SKKN: thêm/sửa/xóa, liên kết học liệu, đăng ký SKKN.
- Hộp thoại xác nhận cho mọi thao tác xóa; chặn lỗi theo từng phân hệ (không trắng cả trang); tải phân hệ theo nhu cầu (JS tải lúc mở trang giảm từ ~1,8 MB xuống ~0,9 MB); báo "Ngoại tuyến" khi mất mạng; in ấn gọn (ẩn thanh điều hướng).

### Bản 2.0.1 – Nhập phân công từ Excel
- Trước đây nhập file bị báo "Không tìm thấy giáo viên … (tên phải trùng khớp)" và "Hợp lệ: 0 dòng" nếu giáo viên chưa có trong danh sách thành viên. Nay hệ thống **tự tạo hồ sơ giáo viên và lớp còn thiếu** (có đánh dấu "MỚI" trong bản xem trước). Tên được so khớp không phân biệt hoa/thường, khoảng trắng thừa và danh xưng (ThS., Thầy, Cô…).
- Cột "Học kỳ" trong file được dùng; dòng trùng bị bỏ qua; nhập lại cùng file sẽ cập nhật chứ không nhân đôi.
- Kiêm nhiệm "Tổ trưởng chuyên môn"/"Tổ phó chuyên môn" được gán vai trò tương ứng (không nhầm với "Tổ trưởng Công đoàn").
- Hồ sơ tạo từ file chưa có email: vào **Hồ sơ giáo viên → bút chì** để điền email Google, hoặc gửi thư mời đúng họ tên – hệ thống sẽ gắn email vào hồ sơ có sẵn thay vì tạo trùng.

### Bản 2.0.2 – Trợ lý AI chạy trên Vercel
- Thêm hàm serverless `api/ai.ts` + `vercel.json`; `server.ts` dùng lại đúng hàm này nên chạy trên máy hay Vercel đều giống nhau.
- Trang Trợ lý AI tự kiểm tra máy chủ đã có khóa Gemini chưa và hướng dẫn cách thêm nếu thiếu.

### Bản 2.0.3 – Gọn giao diện
- Bỏ khỏi menu 2 mục "Ngân hàng câu hỏi & Đề" và "Phân tích kết quả" (mã nguồn vẫn giữ trong `src/components/modules/ExamCreatorModule.tsx`, `AnalyticsModule.tsx` nếu cần bật lại). Menu đánh số lại 1–11.
- Trang Tổng quan: bỏ cột "Cấu trúc Ngân hàng câu hỏi" và hộp "Lưu ý quy định chuyên môn", nội dung chính dàn rộng toàn trang.
- Bảng "Kế hoạch dạy học theo CV 5512" trên Tổng quan trước đây là 3 bài **viết cứng**; nay lấy đúng các bài của tuần hiện tại từ Kế hoạch dạy học của tổ (tính theo ngày bắt đầu năm học), kèm trạng thái thực dạy thật.
- Bỏ các dòng chữ bịa: "100% đã được phê duyệt", "Đạt chỉ tiêu kế hoạch tháng"; Báo cáo không còn nhắc tới ngân hàng câu hỏi/đề.

### Bản 2.0.4 – Nhập giáo án từ Word/PDF
- Trong "Soạn kế hoạch bài dạy" có nút **Nhập từ Word/PDF**: đọc tệp .docx hoặc .pdf, tự tách theo mẫu Phụ lục IV CV 5512 (Tên bài, Chương, Thời gian thực hiện, I. Mục tiêu 1-2-3, II. Thiết bị, III. Tiến trình – Hoạt động 1..n với a) b) c) d)) và điền vào các ô. Có hỏi trước khi ghi đè nội dung đang soạn.
- Tệp không theo mẫu → đưa toàn bộ chữ vào "Nội dung" của Hoạt động 1 để tự sắp xếp.
- Giới hạn (đã khắc phục ở bản 2.1 và 2.6): công thức Equation/MathType, hình vẽ trong tệp không chuyển thành chữ; PDF dạng ảnh scan không đọc được; tệp .doc cũ cần lưu lại thành .docx.
- Thêm ô "Liên kết tệp giáo án gốc" (Drive/OneDrive) và hiển thị tên/đường dẫn tệp gốc trên giáo án.

### Bản 2.1 – Bộ công cụ toán học cho giáo án
- **Toàn màn hình**: nút "Toàn màn hình" cạnh "Trình duyệt" để trình chiếu giáo án khi họp tổ (chữ phóng to, Esc để thoát).
- **Bộ đọc Word mới** (`src/utils/docxReader.ts`, `omml.ts`): công thức Equation của Word được chuyển sang LaTeX (phân số, lũy thừa, căn, tích phân, tổng, giới hạn, hệ phương trình, ma trận, vectơ, ngoặc...), hình ảnh PNG/JPG trong tệp được nén và giữ lại. Hình WMF/EMF được đánh dấu để chèn lại (trình duyệt không đọc được định dạng này). Công thức MathType: xem bản 2.6.
- **Bộ vẽ đồ thị `mathviz`** (`src/utils/mathviz.ts`, `MathGraph.tsx`): gõ `[[do-thi: y = x^3 - 3x; x = -3..3; y = -4..4; A(1;-2)]]` để vẽ đồ thị (nhiều hàm, tiệm cận đứng `x = 1`, điểm có tên); tự ngắt nét tại điểm gián đoạn. Không dùng eval – an toàn.
- **Bộ hiển thị** (`katex-renderer.tsx`): LaTeX `$...$`, `$$...$$`, môi trường `\begin{cases}`…, ảnh `![chú thích](img:...)`, đồ thị, GeoGebra `[[geogebra: https://www.geogebra.org/m/...]]`.
- **Công cụ trong khung soạn giáo án**: bảng chèn nhanh công thức (đại số, giải tích, hình học, tập hợp, Hy Lạp), hệ phương trình, bảng xét dấu, vẽ đồ thị có xem trước, chèn ảnh (tự nén), nhúng GeoGebra; ô đang soạn hiển thị "Xem nhanh" công thức ngay bên dưới; nút phóng to khung soạn.
- Ảnh được lưu cùng giáo án (giới hạn ~900 KB/giáo án do Firestore); ảnh không còn dùng tự được dọn khi lưu.

### Bản 2.2 – Tự tìm & sửa lỗi công thức (không cần biết LaTeX)
- **Tự sửa khi hiển thị**: công thức lỗi (thường do chép từ Word: `\left` thiếu `\right`, `\text{\Big}`, ngoặc `{}` lệch, mũ kép `x^2^3`, lệnh lạ…) không còn hiện chữ đỏ – phần mềm tự sửa để hiển thị (gạch chân chấm vàng); nếu không sửa được thì hiện nhãn "⚠ công thức" thay vì mã lỗi.
- **Nút "Sửa lỗi công thức"** (`FormulaDoctor.tsx`, `utils/latexDoctor.ts`): trong khung soạn và ở màn hình xem giáo án (khi có lỗi). Quét toàn bộ giáo án, mỗi lỗi hiện **Trước (mã gốc)** / **Sau khi sửa (hình thật)** kèm lời giải thích tiếng Việt. Có "Tự sửa tất cả lỗi", sửa từng cái, "Sửa tay" có xem trước ngay, và "Nhờ AI sửa" (cần đăng nhập + `GEMINI_API_KEY`).
- **Gợi ý khôi phục số mũ/chỉ số bị mất** khi chép từ Word: `b3 − a3` → b³ − a³, `S0, S1` → S₀, S₁, `∫13` → ∫₁³, `|0h =` → thế cận |₀ʰ. Đây là gợi ý nên giáo viên xem lại trước khi áp dụng.
- Khung soạn hiện thông báo "Phát hiện N công thức lỗi" ngay sau khi nhập file Word/PDF hoặc khi gõ sai.
- Bộ đọc Word giữ chữ số mũ/chỉ số dưới định dạng thường (không phải Equation) và lệnh LaTeX gõ tay trong Equation.
- Tổ trưởng/tổ phó có thể sửa lỗi công thức cả khi giáo án đang chờ duyệt.

### Bản 2.3 – Nhập Kế hoạch dạy học từ Word / PDF / Excel
- Trong "Chỉnh sửa kế hoạch" (mục 3) có nút **Nhập từ Word/PDF/Excel** và **File mẫu Excel** (`src/utils/planImport.ts`).
- Tự đọc: **bảng phân phối chương trình** (bài học, số tiết, tuần/thời điểm, yêu cầu cần đạt, thiết bị, địa điểm), **bảng kiểm tra đánh giá định kỳ** và mục **"Đặc điểm tình hình"**.
- Nhận được các mẫu hay gặp: Phụ lục I, Phụ lục III (CV 5512), PPCT dạng "Tuần | Tiết | Tên bài" (mỗi tiết một hàng → tự gộp thành bài và cộng số tiết), ô gộp dọc trong Word/Excel, hàng đánh số (1)(2)(3), hàng tiêu đề chương, hàng "Tổng".
- Tệp không có cột tuần → tự ước tính theo 3 tiết/tuần. Bài kiểm tra không ghi tuần → tự xếp theo giữa/cuối kỳ.
- Tệp Excel nhiều sheet hoặc Word nhiều khối → chỉ lấy bảng của khối đang soạn; nhập nhầm tệp khối khác sẽ có cảnh báo.
- PDF: dựng lại bảng theo tọa độ chữ, ghép lại chữ có dấu bị vẽ đè (lỗi thường gặp ở PDF tiếng Việt). PDF scan (ảnh chụp) không đọc được.
- Luôn có màn hình **xem trước** trước khi đưa vào: chọn "Thay thế" hoặc "Thêm vào cuối" danh sách hiện có.

### Bản 2.4 – Lưu trữ giáo án cho cả 3 khối (tiết kiệm dung lượng, mở nhanh)
**Việc cần làm khi nâng cấp (theo đúng thứ tự):**
1. Triển khai quy tắc bảo mật mới: `firebase deploy --only firestore:rules` (hoặc dán nội dung `firestore.rules` vào Firebase Console → Firestore → Rules → Publish). **Bắt buộc** – thiếu bước này giáo viên sẽ không lưu được giáo án.
2. Triển khai phần mềm lên Vercel như bình thường.
3. Tổ trưởng vào **Cài đặt → Dữ liệu & Sao lưu**: bấm *Tải tệp sao lưu JSON*, rồi bấm **Tối ưu lưu trữ giáo án** để chuyển các giáo án cũ sang cách lưu mới (chạy một lần, không làm thay đổi nội dung).

**Thay đổi:**
- Giáo án được lưu tách làm 4 phần (`src/services/lessonPlanStore.ts`): *tóm tắt* (`lessonPlans`), *nội dung* (`lessonPlanContent`), *mỗi hình một bản ghi* (`lessonPlanImages`), *nội dung các phiên bản* (`lessonPlanVersions`).
- Mở phần mềm chỉ tải phần tóm tắt: với 400 giáo án (chữ ~60 KB + 4 hình), lượng tải mỗi lần mở giảm từ **~257 MB xuống ~0,2 MB**. Nội dung + hình chỉ tải khi mở đúng giáo án đó; hình đã tải được giữ trên máy, lần sau không tải lại.
- Bỏ giới hạn 900 KB/giáo án: mỗi giáo án tới 60 hình (mỗi hình < ~950 KB), phần chữ tới ~1 MB.
- Sửa lỗi: nộp/duyệt nhiều lần làm giáo án vượt 1 MB → không lưu được. Nay lịch sử phiên bản lưu riêng; Kế hoạch tổ tự bỏ nội dung phiên bản cũ nhất khi gần giới hạn.
- Bộ nhớ đệm trên máy (IndexedDB) giúp mở lại nhanh; **đăng xuất sẽ xóa bộ nhớ này** (an toàn cho máy dùng chung ở trường), có chờ gửi xong dữ liệu chưa đồng bộ.
- **Đồng hồ dung lượng** trong Cài đặt → Dữ liệu & Sao lưu (ước tính dung lượng đã dùng / 1 GB miễn phí).
- An toàn dữ liệu khi mạng chập chờn: nội dung chưa tải được thì không cho sửa (không lưu đè rỗng); hình chưa tải được vẫn được giữ khi lưu.
- Sao lưu JSON gồm đầy đủ nội dung, hình và phiên bản; phục hồi tự ghi theo cách lưu mới, bỏ qua (và báo) giáo án vượt giới hạn.
- Quy tắc bảo mật: giáo viên chỉ sửa nội dung khi giáo án đang soạn/bị trả lại; tổ trưởng/tổ phó được tạo lại giáo án ở mọi trạng thái khi phục hồi.
- Kiểm thử: `tests/lessonPlanStore.test.ts`, `tests/lessonPlanStore.flow.test.ts` (Firestore giả lập có mô phỏng quy tắc bảo mật). Chạy thử với Firebase Emulator: `VITE_USE_EMULATOR=1 npm run dev:vite`.

### Bản 2.4.1 – Bảng phân công sắp xếp theo giáo viên, dọn phân công trùng
- **Bảng phân công xếp theo giáo viên giống file Excel nhập**: mỗi giáo viên một khối (tên, kiêm nhiệm, tổng tiết/định mức, số lớp), bên trong xếp theo lớp rồi môn, có dòng "Cộng". Thứ tự giáo viên theo đúng thứ tự trong file Excel đã nhập (chưa nhập thì Tổ trưởng, Tổ phó trước, còn lại theo tên).
- Thêm cách xem **Theo lớp** (lớp nào – môn nào – ai dạy), lọc theo **học kỳ HK1/HK2**, **khối**, ô tìm kiếm. Xuất Excel cũng theo thứ tự này.
- **Sửa lỗi cộng trùng số tiết**: cùng một môn nhưng tên viết khác ("Toán (T2)" = "Toán buổi 2", "Chuyên đề Toán (Tc)" = "Chuyên đề học tập Toán") trước đây bị tính 2 lần → định mức sai (vd 22/17 thay vì 17/17). Nay phần mềm nhận ra, đánh dấu TRÙNG, có nút **Dọn trùng lặp**; nhập Excel không tạo thêm dòng trùng.
- Định mức tính theo từng học kỳ (trước đây cộng cả HK1 và HK2).
- Nhập Excel có tùy chọn **"Dùng file này làm bảng phân công chính thức của học kỳ"**: xóa phân công cũ của học kỳ đó không có trong file.

### Bản 2.4.2 – Tính tiết theo TKB + tiết quy đổi, chức vụ nhiệm vụ đúng như file của tổ
- Nhập đúng file mẫu mới của tổ (2 sheet **TongHop** + **PhanCong**): phần mềm tự chọn sheet PhanCong; nhận các dòng **"Quy đổi nhiệm vụ"** (không có lớp: TTCM, TPCM, CT-CĐCS, UVBCH-CĐ, TTCĐ) và **"Quy đổi chủ nhiệm"** (GVCN).
- Mỗi giáo viên hiển thị **Tiết TKB + Quy đổi = Tổng / định mức 17**, chức vụ ghi đầy đủ (Tổ trưởng chuyên môn; Ủy viên BCH Công đoàn; Chủ nhiệm lớp 12A06...), lớp chủ nhiệm. Đã đối chiếu với sheet TongHop: đúng cả 13 giáo viên.
- Nhận ra tên môn mới/cũ là một: "Toán 2" = "Toán buổi 2" = "Toán (T2)"; "Chuyên đề Toán" = "Chuyên đề học tập Toán".
- Xuất Excel ra đúng 2 sheet TongHop + PhanCong như file của tổ (PhanCong giữ nguyên thứ tự dòng của file đã nhập). File mẫu cũng theo định dạng mới.

### Bản 2.4.3 – Ban giám hiệu, người ký duyệt kế hoạch
- Khung **Ban giám hiệu** ở thanh bên trái: Hiệu trưởng Trần Thị Thắm; PHT phụ trách chuyên môn Mai Thị Ngọc Nhung; PHT phụ trách cơ sở vật chất Đào Văn Tám (sửa trong Cài đặt → Thông tin chung).
- Mục ký **"Ban giám hiệu phê duyệt"** của Kế hoạch dạy học ghi đúng người ký duyệt (mặc định PHT phụ trách chuyên môn) theo thể thức "KT. HIỆU TRƯỞNG – PHÓ HIỆU TRƯỞNG" (trước đây ghi tên người bấm duyệt trên phần mềm).
- Sửa lỗi nhập kế hoạch từ Word/PDF: bảng phân phối có cột "Kiểm tra, đánh giá" bị hiểu nhầm là bảng kiểm tra định kỳ (tạo ra các "bài kiểm tra" ảo, cùng Tuần 9 – 90 phút).

### Bản 2.5 – Trợ lý AI dùng khóa Gemini riêng của từng giáo viên
- Trang **Trợ lý AI** có ô **"Khóa API Google Gemini"**: dán khóa, **Hiện/Ẩn**, **Xóa**, chọn mô hình (**Tự động chọn mô hình** hoặc một mô hình cụ thể) và nút **Dò** để kiểm tra khóa, đọc danh sách mô hình khóa được dùng. Không cần cài `GEMINI_API_KEY` trên Vercel nữa.
- Khóa **chỉ lưu trong trình duyệt** (tùy chọn "Ghi nhớ trên máy này"; bỏ chọn thì tự xóa khi đóng trình duyệt), không lưu vào dữ liệu của tổ, không gửi về máy chủ phần mềm; **tự xóa khi đăng xuất**. Khóa gửi tới Google qua header, không nằm trong đường dẫn.
- "Tự động": ưu tiên Gemini Flash ổn định mới nhất; mô hình hết lượt miễn phí/ngừng hoạt động → tự chuyển mô hình kế tiếp. (Gemini 2.0 đã ngừng, 2.5 bị giới hạn truy cập – mặc định máy chủ đổi sang gemini-3.5-flash.)
- "Nhờ AI sửa" công thức (FormulaDoctor) cũng dùng khóa riêng này. Nếu giáo viên chưa dán khóa mà máy chủ tổ có khóa chung → vẫn dùng máy chủ như trước (cần đăng nhập).

### Bản 2.5.1 – Chỉ Quản trị viên được chuyển năm học
- Nút "Chuyển năm học mới", "Bắt đầu quy trình chuyển năm học" và ô "Năm học hiện tại" chỉ Quản trị viên dùng được; Tổ trưởng thấy thông báo "Chỉ Quản trị viên hệ thống được chuyển năm học".
- Chặn cả ở máy chủ (firestore.rules): Tổ trưởng vẫn sửa được cấu hình tổ nhưng không đổi được năm học. **Cần dán lại firestore.rules lên Firebase.**

### Bản 2.6 – Đọc công thức MathType trong file Word
- Bộ chuyển **MathType → LaTeX** (`src/utils/mtef.ts`): đọc dữ liệu MathType (MTEF 5, Equation.DSMT4–7) nằm trong từng đối tượng OLE của file Word và chuyển thành công thức LaTeX **sửa được** (không phải ảnh): phân số, căn, mũ/chỉ số, ngoặc tự co giãn, hệ phương trình (ngoặc nhọn, ngoặc vuông "hoặc"), ma trận, tích phân, tổng, giới hạn, max/min có cận, vectơ, mũ góc, chữ Việt trong công thức, tên hàm (sin, cos, ln, log...).
- Kiểm tra với giáo án thật "GT12-C1-B2-GTLN GTNN CUA HAM SO.docx": **255/255 công thức** chuyển được, KaTeX hiển thị không lỗi. Công thức đứng riêng dòng (MTDisplayEquation) hiển thị căn giữa.
- Bỏ phần **Mục lục** tự động của Word khi nhập (số trang không có ý nghĩa trên phần mềm).
- Sửa lỗi: dòng thông báo công thức không đọc được chứa "$...$" bị hiển thị thành công thức.

### Bản 2.6.1 – Đổi tên mục 5, sửa lỗi mất nút Xóa giáo án
- Mục 5 đổi tên thành **"Sinh hoạt chuyên môn và Nghiên cứu bài học"**.
- Chủ sở hữu phần mềm (tài khoản tạo tổ) luôn được nhận là **Quản trị viên**, kể cả khi hồ sơ gắn email của mình đang ghi vai trò "Giáo viên".
- Nếu một email gắn với nhiều hồ sơ (VD: hồ sơ nhập từ Excel và hồ sơ tạo khi đăng nhập), phần mềm nhận **tất cả** là của mình: giáo án, tài liệu, phiếu dự giờ… ghi dưới hồ sơ cũ vẫn hiện đủ nút **Soạn/Sửa, Trình duyệt, Xóa**.
- Không thể lỡ tay tự hạ vai trò của chính mình khi sửa hồ sơ.

### Bản 2.12 – Ba loại kế hoạch riêng, nhập tệp gộp thì phần mềm hỏi rồi tự tách

**Ba loại kế hoạch.** Phân hệ 3 nay lọc theo *loại kế hoạch* trước khi lọc theo khối:

| Loại | Bảng phân phối |
| --- | --- |
| Kế hoạch giảng dạy | Tuần \| Tiết PPCT \| Nội dung \| Yêu cầu cần đạt \| Thiết bị và định hướng năng lực số, AI |
| Hoạt động trải nghiệm, hướng nghiệp | thêm cột *Tích hợp NLS, giáo dục AI* và *Quy mô / Địa điểm* |
| Giáo dục học sinh hòa nhập | *Nội dung có điều chỉnh cho HSHN* \| *Mức độ điều chỉnh* \| *Đồ dùng trực quan và phương pháp hỗ trợ* \| *Ghi chú* |

Mỗi loại có đủ ba khối, nên tổ có tối đa chín hồ sơ độc lập thay vì gộp chung một chỗ.
Kế hoạch lập từ bản 2.11 trở về trước không có trường loại thì hiểu là *Kế hoạch giảng dạy*.

**Nhập tệp gộp nhiều phần.** Bản Word của tổ thường gộp cả khối 10, khối 11, hoạt động trải nghiệm
và giáo dục hòa nhập trong một tệp. Nút "Nhập từ Word / Excel / PDF" nay **không tạo kế hoạch ngay**:

1. Phần mềm dò từng bảng trong tệp, dựa vào chữ đứng ngay phía trên bảng để đoán loại và khối.
2. Hiện hộp thoại liệt kê từng phần: dòng chữ nhận ra được, loại kế hoạch, khối, và đọc được bao nhiêu dòng.
3. Thầy/cô sửa loại hoặc khối nếu phần mềm đoán sai, bỏ qua phần không cần, rồi bấm xác nhận.
4. Phần mềm tách thành từng kế hoạch riêng. Hai phần cùng loại và cùng khối được gộp làm một.

- **Nhớ ngữ cảnh giữa các bảng.** Trong tệp thật chỉ bảng đầu của mỗi phần mới có dòng "Khối 10" phía trên;
  các bảng sau ("III. Chuyên đề lựa chọn", "2. Kiểm tra, đánh giá") không ghi lại khối. Bộ dò nhớ loại và khối
  của bảng liền trước, nếu không thì bảng chuyên đề của khối 10 sẽ rơi sang khối khác (đã có kiểm thử cho ca này).
- Dấu hiệu "hòa nhập" được xét trước "trải nghiệm", nên dòng "Hoạt động trải nghiệm cho học sinh hòa nhập"
  vào đúng kế hoạch hòa nhập.
- Dòng gộp ô kiểu "HỌC KÌ I" trải hết chiều ngang và dòng rỗng bị bỏ qua, không thành dòng phân phối rác.
- Mục **Thông tin cá nhân** ở đầu tệp (họ tên, lớp được phân công, nhiệm vụ kiêm nhiệm) được đọc và điền
  vào tất cả kế hoạch tách ra.
- Phần nào không đọc được dòng nào thì không tạo hồ sơ rỗng.

**Dọn mã:** tách `readPlanGrids` khỏi `importPlanFile` để phần nhập kế hoạch của giáo viên dùng lại được
`context` của từng bảng; `splitGrid` giữ thêm nguyên văn hàng tiêu đề để đọc lại nhãn cột.
`teacherPlanSplit.ts` được nạp động nên bộ đọc bảng không nằm trong gói khởi động.

### Bản 2.11 – Kế hoạch giảng dạy dựng theo đúng bản Word tổ đang dùng

Bản 2.10 dựng theo khung Phụ lục III trần. Bản Word thật của tổ (kế hoạch giảng dạy của
thầy Đặng Quang Vinh, năm học 2026-2027) cho thấy tổ dùng một khung **rộng hơn** khung trần:
một giáo viên dạy nhiều khối thì kế hoạch có nhiều phần, mỗi phần có căn cứ xây dựng, hai bảng
phân phối, bảng tổng hợp thời lượng, bảng kiểm tra đánh giá và phần tổ chức thực hiện riêng.

**Cấu trúc mới của phân hệ 3 – thẻ Kế hoạch cá nhân:**

```
1. Thông tin cá nhân
   - Họ và tên giáo viên
   - Lớp được phân công giảng dạy
   - Nhiệm vụ khác được phân công kiêm nhiệm
2. Kế hoạch dạy học  → mỗi khối lớp là một phần:
   I.   Căn cứ và nguyên tắc xây dựng
   II.  Phân phối phần nội dung cốt lõi
        Tuần | Tiết PPCT | Nội dung dạy học | Yêu cầu cần đạt trọng tâm | Thiết bị và định hướng năng lực số, AI
   III. Phân phối chuyên đề học tập lựa chọn
        Tuần | Tiết | Nội dung chuyên đề | Yêu cầu cần đạt và sản phẩm gợi ý
   IV.  Tổng hợp thời lượng            (phần mềm tự cộng, không nhập tay)
        Kiểm tra, đánh giá định kỳ
        Bài kiểm tra | Thời gian (1) | Thời điểm (2) | Yêu cầu cần đạt (3) | Hình thức (4)
   V.   Tổ chức thực hiện
TỔ TRƯỞNG CHUYÊN MÔN DUYỆT   |   ... ngày ... tháng ... năm ... GIÁO VIÊN (Ghi rõ họ tên, ký tên)
```

- **Nhiều phần trong một kế hoạch.** Thầy/cô dạy khối 10 và khối 11 thì bấm "Thêm khối" để có
  hai phần, không phải lập hai kế hoạch rời. Có thêm loại phần **Hoạt động trải nghiệm, hướng nghiệp**
  với bảng sáu cột riêng (thêm cột *Tích hợp năng lực số, giáo dục AI* và *Quy mô / Địa điểm*).
- **Cột "Tiết PPCT" nhận khoảng tiết** ("1-3", "4–6"). Phần mềm tự suy ra số tiết của dòng nên
  không phải gõ thêm cột số tiết; ô ghi ngược ("9-3") thì tính 0 chứ không ra số âm.
- **IV. Tổng hợp thời lượng do phần mềm cộng**, tách học kỳ theo ô "Học kỳ I kết thúc ở tuần"
  (mặc định tuần 18). Dòng chưa ghi tuần vẫn được cộng vào tổng cả năm để không âm thầm bỏ sót.
- **Bảng kiểm tra, đánh giá định kỳ** có sẵn bốn dòng Giữa/Cuối học kỳ I và II.
- **Không mất dữ liệu cũ.** Kế hoạch lập bằng bản 2.10 được chuyển thành một phần khối;
  cột *Thiết bị* và *Địa điểm* của bản cũ gộp vào cột *Thiết bị và định hướng năng lực số, AI*,
  và màn hình báo rõ điều đó bằng dải màu vàng. Kế hoạch bản 2.8 vẫn gom ba ô văn xuôi vào
  mục nhiệm vụ kiêm nhiệm như bản 2.10.
- Mục ký đổi thành **"TỔ TRƯỞNG CHUYÊN MÔN DUYỆT"** và **"GIÁO VIÊN (Ghi rõ họ tên, ký tên)"**
  đúng như bản Word.

**Chưa có trong bản này** (có trong bản Word nhưng là phân hệ riêng, cần làm tiếp):
- **Kế hoạch giáo dục học sinh hòa nhập**: đặc điểm tình hình, danh sách học sinh khuyết tật,
  mục tiêu từng học kỳ, kế hoạch từng tháng (9 bảng), phân phối 105 tiết có điều chỉnh,
  nhận xét cuối năm. Đây là một hồ sơ riêng, không phải một mục của kế hoạch giảng dạy.
- **Kế hoạch giáo dục của tổ (Phụ lục I và Phụ lục II)** vẫn chưa được đối chiếu với biểu mẫu
  chính thức, vì tệp gửi sang là kế hoạch của *giáo viên*. Phụ lục I hiện thừa cột *Thiết bị*,
  *Địa điểm* và thiếu bảng *Chuyên đề lựa chọn*; Phụ lục II chưa có.

### Bản 2.10 – Kế hoạch cá nhân dựng lại đúng khung Phụ lục III (CV 5512)

**Sửa sai của bản 2.9.** Màn hình Kế hoạch cá nhân ở bản 2.9 gồm ba mục
"Nhiệm vụ được giao", "Kế hoạch tự học/BDTX", "Kết quả dự kiến". Đối chiếu với
khung Phụ lục III kèm Công văn 5512/BGDĐT-GDTrH thì **ba mục đó không có trong biểu mẫu**;
hai mục "tự học/BDTX" và "kết quả dự kiến" là do phần mềm tự đặt thêm, còn hai bảng bắt buộc
thì thiếu. Bản 2.10 dựng lại đúng khung:

| Phụ lục III chính thức | Bản 2.9 | Bản 2.10 |
| --- | --- | --- |
| Tiêu đề trường / tổ / họ tên giáo viên + quốc hiệu | thiếu | có |
| Dòng "MÔN HỌC/HOẠT ĐỘNG GIÁO DỤC …, LỚP …" | thiếu | có (`subject`, `className`) |
| I.1. Phân phối chương trình (Bài học \| Số tiết \| Thời điểm \| Thiết bị \| Địa điểm) | thiếu | bảng nhập/sửa được, tự cộng tổng số tiết |
| I.2. Chuyên đề lựa chọn (cấp THPT) | thiếu | bảng riêng, cùng 5 cột |
| II. Nhiệm vụ khác (nếu có) | — | có |
| Chú thích (1)–(5) dưới bảng | thiếu | có |
| Ký tên hai cột: TỔ TRƯỞNG / GIÁO VIÊN | thiếu | có |
| "Kế hoạch tự học, BDTX" | có | **bỏ** (không có trong biểu mẫu) |
| "Kết quả dự kiến" | có | **bỏ** (không có trong biểu mẫu) |

- Kế hoạch cũ **không mất dữ liệu**: ba trường của bản 2.9 được giữ lại trong kiểu `TeacherPlan`
  (đánh dấu `@deprecated`) và nội dung của chúng được gộp vào mục **II. Nhiệm vụ khác** khi mở kế hoạch cũ.
- `teacherPlanImport.ts` viết lại: dùng chung bộ dò bảng của Phụ lục I (`planImport.ts`) vì sáu cột
  trùng nhau, rồi tách bảng nào là "chuyên đề", cắt lấy mục II, đọc dòng môn/lớp và bỏ phần chú thích
  `(1)…(5)`, dòng chấm lửng và phần ký tên của khung mẫu.
- Nhập từ tệp nay đổ thẳng vào **hai bảng**, không còn đổ vào ô văn xuôi.
- `planImport.ts` được nạp động, không kéo vào gói khởi động.
- **Sửa tên người ký ô "TỔ TRƯỞNG".** Ô này đang lấy `planApprover(config)` — tức người ký duyệt
  của Phụ lục I, thường là Phó hiệu trưởng phụ trách chuyên môn — nên in ra tên Ban giám hiệu.
  Phụ lục III do **tổ trưởng của chính tổ** ký. Nay dùng `departmentHead(allMembers)`:
  lấy thành viên có vai trò *Tổ trưởng*, nếu chưa gán thì lấy *Quản trị*, không có ai thì **để trống**
  chứ không điền tên người khác.

### Bản 2.9 – Siết phân quyền, Kế hoạch cá nhân (Phụ lục III) và nhập từ Word/Excel/PDF

**Bảo mật (firestore.rules – phải `firebase deploy --only firestore:rules` mới có hiệu lực):**
- `teacherPlans`: trước đây *bất kỳ thành viên nào* cũng ghi đè được kế hoạch cá nhân của đồng nghiệp.
  Nay chỉ chính chủ sửa được, và giáo viên không tự chuyển kế hoạch của mình sang trạng thái "đã duyệt".
- `observations`: người dự viết phiếu; người được dự chỉ thêm được `teacherFeedback`, không sửa
  được nhận xét đồng nghiệp đã ghi về tiết dạy của mình.
- `skknTopics`, `trainings`: chỉ người đứng tên sửa bản của mình (tổ trưởng sửa mọi bản).
- `specialTopics`, `documents`: như trên, bản ghi cũ chưa có trường chủ sở hữu vẫn sửa được để không kẹt dữ liệu.
- `departmentPlans`: giáo viên cập nhật tiến độ dạy nhưng không được thêm/bớt dòng phân phối chương trình
  của kế hoạch đã duyệt (số dòng phải giữ nguyên).
- Bỏ quy tắc của `questions`, `examBlueprints`, `exams`, `examResults` — các collection này không còn được dùng.
- Còn tồn: `initiatives` chưa khóa được theo chủ sở hữu vì kiểu `InitiativeRecord` mới chỉ có `teacherName`
  (chuỗi tên), chưa có mã người đăng. Cần thêm `authorId` rồi siết như các collection khác.

**Riêng tư:**
- Dữ liệu mẫu không còn chứa địa chỉ Gmail của người thật (đổi sang tên miền `example.com`).
- Đăng xuất / xóa khóa AI nay xóa cả `gemini_model` (trước đây bỏ sót, máy dùng chung còn lưu lựa chọn mô hình).

**Liên kết ngoài:**
- `examAndQuestionBankUrl` trước đây được khai báo trong kiểu dữ liệu và dữ liệu mẫu nhưng **không hiển thị ở đâu cả**.
  Nay thanh bên có nhóm "Liên kết ngoài" gồm ngân hàng câu hỏi/đề kiểm tra và kho tài liệu Drive;
  địa chỉ đặt trong Cài đặt → Thông tin chung, chỉ nhận `https://`, để trống thì mục hiện mờ.

**Phân công:**
- `saveAssignment` nay có ghi nhật ký (các thao tác khác đã có, riêng phân công bị sót).
- Cảnh báo mới khi **một lớp có từ hai giáo viên trở lên cùng dạy một môn** — khác với cảnh báo trùng dòng
  của cùng một giáo viên. Phần mềm chỉ cảnh báo, không tự xóa, vì có thể là dạy ghép hoặc chia nhóm.

**Dọn mã:**
- Xóa `ExamCreatorModule.tsx` và `AnalyticsModule.tsx` (894 dòng, không được `App.tsx` gọi từ bản 2.6).
- Bỏ tab "Cấu trúc đề mẫu" trong Cài đặt, hai dòng về đề kiểm tra trong bảng phân quyền,
  loại tài liệu "Đề kiểm tra", và các số liệu câu hỏi/đề/điểm trong Báo cáo (các collection này
  không còn nơi nhập nên báo cáo luôn in ra câu "chưa có dữ liệu").
- Nhãn "Mô phỏng vai trò" trong Cài đặt nói rõ chỉ dùng ở chế độ dữ liệu mẫu.

**Kế hoạch (phân hệ 3) — bổ sung theo yêu cầu của tổ:**
- Phân hệ 3 nay có hai thẻ: **Kế hoạch của tổ (Phụ lục I)** và **Kế hoạch cá nhân (Phụ lục III)**.
- `teacherPlans` trước đây đã có đủ dữ liệu, hàm lưu, sao lưu và quy tắc bảo mật nhưng **không có màn hình nào**,
  nên tổ không lập được kế hoạch cá nhân dù menu ghi "Phụ lục I, III". Nay có `TeacherPlansPanel`:
  lập, sửa, nộp, tổ trưởng duyệt hoặc trả lại kèm ý kiến, lọc theo khối và theo "chỉ của tôi".
  Giáo viên chỉ lập được cho chính mình; tổ trưởng lập hộ và duyệt được.
- Nút **"Thêm kế hoạch tổ chuyên môn"** nay luôn hiện với tổ trưởng và mở hộp chọn khối
  (khối đã có kế hoạch thì hiện mờ kèm ghi chú). Trước đây nút chỉ xuất hiện khi khối đang xem
  chưa có kế hoạch, nên khi cả ba khối đã có thì không thấy nút đâu.
- Thêm `deleteTeacherPlan`, và `saveTeacherPlan` nay ghi nhật ký kèm trạng thái.

**Nhập kế hoạch cá nhân từ tệp có sẵn (bản 2.9):**
- Nút **"Nhập từ Word / Excel / PDF"** trong thẻ Kế hoạch cá nhân: đọc tệp thầy/cô đã soạn sẵn
  rồi đổ vào biểu mẫu để xem lại, KHÔNG tự lưu vào cơ sở dữ liệu.
- `src/utils/teacherPlanImport.ts` tách văn bản thành 3 mục của Phụ lục III theo tiêu đề
  ("Nhiệm vụ được giao", "Kế hoạch tự học/BDTX", "Kết quả dự kiến/Chỉ tiêu"), nhận ra cả khi
  viết hoa, có số thứ tự La Mã, hoặc gõ không dấu. Tự đoán khối lớp và họ tên người lập.
- Tiêu đề mục phải nằm ở đầu dòng: nếu không neo như vậy thì một dòng nội dung như
  "Hoàn thành 2 mô-đun BDTX" sẽ bị nhận nhầm là tiêu đề và mất nội dung (đã có kiểm thử cho ca này).
- Word/PDF dùng lại bộ đọc của phần nhập giáo án nên giữ được công thức MathType đổi sang LaTeX.
  Excel đọc theo kiểu "ô đầu là nhãn mục, các ô sau là nội dung".
- Tệp không nhận ra tiêu đề nào thì toàn văn được đưa vào mục "Nhiệm vụ được giao" kèm cảnh báo
  màu vàng để thầy/cô cắt lại cho đúng.

**Chưa làm trong bản này:**
- Chưa có đường dẫn riêng cho từng phân hệ (nhấn F5 vẫn giữ đúng phân hệ nhờ `localStorage`,
  nhưng chưa gửi được liên kết trực tiếp tới một giáo án hay kế hoạch cụ thể).
- Hình trong giáo án vẫn lưu base64 trong Firestore thay vì Firebase Storage.
- `sample-data.ts` vẫn nằm trong gói chính (~217 kB gzip) dù chỉ dùng cho chế độ dữ liệu mẫu.


## 5. Cấu trúc thư mục chính

```
api/ai.ts                 API Trợ lý AI (hàm Vercel, dùng chung với server.ts)
vercel.json               Cấu hình triển khai Vercel
server.ts                 Máy chủ Express khi chạy trên máy/VPS
firestore.rules           Quy tắc bảo mật Firestore (triển khai bằng firebase deploy)
src/context/AppContext.tsx  Trạng thái, đồng bộ Firestore, phân quyền
src/components/modules/   Các phân hệ (Kế hoạch, Giáo án, Dự giờ, Đề, Phân tích, ...)
src/utils/                mathviz (đồ thị), omml + docxReader (công thức & hình trong Word), lessonImport, diff (so sánh phiên bản), stats (thống kê điểm), ids, excel, katex
tests/                    Kiểm thử đơn vị (npm test)
```
