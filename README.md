# SimilarExam Studio — Tạo Đề Thi Tương Tự

Web application hỗ trợ giáo viên, học sinh và gia sư tạo đề thi tương tự từ đề gốc bằng AI Google Gemini, hỗ trợ xuất Word với công thức toán LaTeX, OMML và MathType.

## 🌟 Tính năng nổi bật

1. **Đa dạng nguồn nhập (5 tabs)**:
   - File Word (.docx): Đọc văn bản, phát hiện và cảnh báo công thức MathType OLE.
   - File PDF: Phân tích file PDF trực tiếp.
   - Ảnh chụp từ máy: Tải lên tối đa 4 trang ảnh.
   - Dán ảnh chụp màn hình (`Ctrl+V`): Lắng nghe event paste trực tiếp từ Clipboard.
   - Dán văn bản text: Nhập trực tiếp văn bản kèm công thức LaTeX `$x^2 + 1 = 0$`.

2. **Quản lý nhiều API Key & Round-Robin**:
   - Lưu danh sách nhiều Google Gemini API Key trong `localStorage`.
   - Cơ chế tự động chọn key hoạt động tốt, cân bằng tải theo số lần dùng.
   - Tự động nhảy sang key tiếp theo khi gặp lỗi giới hạn lượt (429/403) hoặc key hết hạn.
   - Kiểm tra sức khỏe API Key (Status badges: Valid, Rate Limited, Invalid, Untested).

3. **Cấu hình đề thi linh hoạt**:
   - Môn học, khối lớp (1-12 & Đại học).
   - Mức độ tương tự: Đổi số liệu 🔢 | Cùng dạng bài 🔄 | Hoàn toàn mới ✨.
   - Tùy chỉnh số lượng câu trắc nghiệm & tự luận, thời gian, thang điểm, mức độ tư duy Bloom.

4. **Biên tập & Chỉnh sửa trực quan**:
   - Trình xem đề thi phong cách tờ đề thi chuẩn.
   - Trình chỉnh sửa từng câu hỏi: Hỗ trợ xem trước công thức toán MathJax thời gian thực.
   - Hỗ trợ kéo thả reorder vị trí các câu.
   - Công cụ "Hỏi AI" chỉnh sửa từng câu cụ thể.
   - Hoàn tác (`Ctrl+Z`) & Làm lại (`Ctrl+Y`) lên đến 50 thao tác.

5. **Trộn đề (Tạo mã đề A/B/C/D)**:
   - Tạo ngẫu nhiên Seeded shuffle reproducible cho câu hỏi và phương án A/B/C/D.
   - Xuất riêng lẻ từng mã đề hoặc tải file `.ZIP` chứa toàn bộ các mã đề.

6. **Xuất Word 3 định dạng công thức toán**:
   - **1. Xuất LaTeX (.docx)**: Công thức dạng `$x^2$` phông Courier New.
   - **2. Xuất Word Equation (.docx)**: Công thức Equation chuẩn Microsoft Word (OMML).
   - **3. MathType-compatible (.docx)**: OMML kết hợp phông Cambria Math giúp plugin MathType trên Word tự động nhận dạng.

## 🚀 Hướng dẫn chạy Local

```bash
# Cài đặt dependencies
npm install

# Chạy dev server
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:3000`.

## 📦 Deploy Vercel / GitHub Pages

Ứng dụng được xây dựng hoàn toàn Client-side SPA bằng React + Vite, không cần backend server.
Chỉ cần push repository lên GitHub và kết nối với Vercel/Netlify để deploy trong vài giây.
