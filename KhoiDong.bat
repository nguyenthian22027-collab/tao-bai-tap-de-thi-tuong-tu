@echo off
chcp 65001 >nul
title Khởi động Ứng dụng Tạo Đề Thi Tương Tự
color 0B

echo ===================================================================
echo     HỆ THỐNG TẠO ĐỀ THI TƯƠNG TỰ - CHUẨN ĐỊNH DẠNG GDPT 2025
echo ===================================================================
echo.

:: Di chuyển tới đúng thư mục chứa file .bat
cd /d "%~dp0"

:: 1. Kiểm tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LỖI] Máy tính của bạn chưa cài đặt Node.js!
    echo Vui lòng tải và cài đặt Node.js tại: https://nodejs.org/
    echo Sau khi cài đặt xong, hãy chạy lại file này.
    echo.
    pause
    exit /b
)

:: 2. Kiểm tra node_modules, nếu chưa có thì tự động npm install
if not exist "node_modules\" (
    echo [THÔNG BÁO] Đang cài đặt thư viện cần thiết lần đầu... Vui lòng đợi trong giây lát.
    call npm install
    if %errorlevel% neq 0 (
        echo [LỖI] Quá trình cài đặt thư viện gặp sự cố. Vui lòng kiểm tra kết nối mạng.
        pause
        exit /b
    )
    echo [THÀNH CÔNG] Đã cài đặt xong thư viện!
    echo.
)

:: 3. Tự động mở trình duyệt sau 2 giây
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: 4. Khởi chạy ứng dụng với Vite
echo [ĐANG CHẠY] Ứng dụng đang hoạt động tại địa chỉ: http://localhost:3000
echo Bạn có thể thu nhỏ cửa sổ này lại (không tắt cửa sổ này khi đang dùng).
echo Nhấn phím Ctrl + C nếu muốn dừng ứng dụng.
echo ===================================================================
echo.

npm run dev

pause
