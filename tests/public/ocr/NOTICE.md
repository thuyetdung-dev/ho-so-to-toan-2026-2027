# Tài nguyên OCR đi kèm

- `worker.min.js`: tesseract.js 7.0.0, giấy phép Apache-2.0. Bản quyền/thông báo thư viện con trong worker.min.js.LICENSE.txt; giấy phép trong TESSERACT-LICENSE.md.
- `tesseract-core-lstm.wasm.js` và `.wasm`: tesseract.js-core từ cây phụ thuộc được khóa trong package-lock.json; giấy phép trong CORE-LICENSE.
- `lang/vie.traineddata.gz`, `lang/eng.traineddata.gz`: bản `4.0.0_best_int` của @tesseract.js-data/vie 1.0.0 và @tesseract.js-data/eng 1.0.0 (metadata các gói khai báo MIT).

Tài nguyên được phục vụ cùng ứng dụng và chỉ tải khi dùng OCR. Khi cập nhật phiên bản OCR, cập nhật worker, core và dữ liệu ngôn ngữ cùng nhau; kiểm tra lại OCR thực tế trước khi triển khai.
