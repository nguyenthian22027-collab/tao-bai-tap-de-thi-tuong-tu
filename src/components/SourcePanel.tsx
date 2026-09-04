import React, { useState, useEffect, useRef } from 'react';
import { SourceState, ImageFileItem } from '../types';
import { readDocxFile } from '../lib/docxReader';
import {
  Upload,
  FileText,
  FileCode,
  Image as ImageIcon,
  Clipboard,
  AlignLeft,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Plus,
  X,
  Eye,
  FileUp,
  Sparkles,
} from 'lucide-react';

interface SourcePanelProps {
  source: SourceState;
  onChangeSource: (s: SourceState) => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  source,
  onChangeSource,
  onAddToast,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showTextInput, setShowTextInput] = useState(Boolean(source.textContent && !source.fileData?.length));

  const fileInputDocxPdfRef = useRef<HTMLInputElement>(null);
  const fileInputImageRef = useRef<HTMLInputElement>(null);

  // Global + Component-wide Paste Listener (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target.id !== 'unified-paste-zone') {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      let foundImage = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          foundImage = true;
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              const newItem: ImageFileItem = {
                id: `pasted_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                base64,
                mimeType: file.type,
                fileName: `Ảnh chụp màn hình #${((source.fileData?.length || 0) + 1)}`,
                fileSize: file.size,
              };

              const existing = source.fileData || [];
              const updated = [...existing, newItem];

              onChangeSource({
                type: 'image',
                fileData: updated,
                imageCount: updated.length,
              });
              onAddToast('success', `✓ Đã dán thêm ảnh chụp #${updated.length} từ Clipboard!`);
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }

      if (!foundImage) {
        const text = e.clipboardData?.getData('text');
        if (text && text.trim().length > 20 && !source.fileData?.length) {
          setShowTextInput(true);
          onChangeSource({
            type: 'text',
            textContent: text,
          });
          onAddToast('success', '✓ Đã dán văn bản đề thi từ Clipboard!');
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [source, onChangeSource, onAddToast]);

  // Process a dropped or selected file
  const processGenericFile = async (file: File, isAppendImage = false) => {
    const fileName = file.name.toLowerCase();

    // 1. DOCX File
    if (fileName.endsWith('.docx')) {
      setIsLoadingFile(true);
      try {
        const buffer = await file.arrayBuffer();
        const res = await readDocxFile(buffer);

        onChangeSource({
          type: 'docx',
          htmlContent: res.html,
          textContent: res.text,
          mathTypeCount: res.mathTypeCount,
          wordCount: res.wordCount,
          fileData: [
            {
              id: `docx_${Date.now()}`,
              base64: '',
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              fileName: file.name,
              fileSize: file.size,
            },
          ],
        });

        if (res.warningMessage) {
          onAddToast('warning', res.warningMessage);
        } else {
          onAddToast('success', `✓ Đọc xong file Word: ${file.name} (${res.wordCount} từ)`);
        }
      } catch (err: any) {
        onAddToast('error', err.message || 'Lỗi khi đọc file Word');
      } finally {
        setIsLoadingFile(false);
      }
      return;
    }

    if (fileName.endsWith('.doc')) {
      onAddToast('error', 'Định dạng .doc cũ không được hỗ trợ. Vui lòng mở bằng Word và Lưu thành .docx trước!');
      return;
    }

    // 2. PDF File
    if (fileName.endsWith('.pdf')) {
      if (file.size > 25 * 1024 * 1024) {
        onAddToast('warning', 'File PDF lớn hơn 25MB, quá trình gửi tới AI có thể mất chút thời gian.');
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onChangeSource({
          type: 'pdf',
          fileData: [
            {
              id: `pdf_${Date.now()}`,
              base64,
              mimeType: 'application/pdf',
              fileName: file.name,
              fileSize: file.size,
            },
          ],
        });
        onAddToast('success', `✓ Đã tải file PDF: ${file.name}`);
      };
      reader.readAsDataURL(file);
      return;
    }

    // 3. Image Files
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(fileName)) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newItem: ImageFileItem = {
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          base64,
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
          fileSize: file.size,
        };

        const existing = isAppendImage && source.fileData ? source.fileData : [];
        const updated = [...existing, newItem];
        onChangeSource({
          type: 'image',
          fileData: updated,
          imageCount: updated.length,
        });
        onAddToast('success', `✓ Đã tải ảnh: ${file.name} (Tổng ${updated.length} ảnh)`);
      };
      reader.readAsDataURL(file);
      return;
    }

    // 4. Plain Text File
    if (fileName.endsWith('.txt')) {
      const text = await file.text();
      setShowTextInput(true);
      onChangeSource({
        type: 'text',
        textContent: text,
      });
      onAddToast('success', `✓ Đã đọc file văn bản: ${file.name}`);
      return;
    }

    onAddToast('warning', `Định dạng file ${fileName} chưa được hỗ trợ. Vui lòng chọn .docx, .pdf hoặc ảnh .png/.jpg.`);
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files: File[] = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    // Check if multiple images dropped
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      for (const imgFile of imageFiles) {
        await processGenericFile(imgFile, true);
      }
    } else {
      await processGenericFile(files[0], false);
    }
  };

  // Image Upload handler
  const handleMultipleImagesSelected = (e: React.ChangeEvent<HTMLInputElement>, isAppend = false) => {
    const files: File[] = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      processGenericFile(file, isAppend || Boolean(source.fileData && source.fileData.length > 0));
    });

    // Reset input value so same files can be re-selected if needed
    e.target.value = '';
  };

  // DOCX / PDF Upload handler
  const handleDocxPdfSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processGenericFile(file, false);
    e.target.value = '';
  };

  // Remove single image
  const handleRemoveSingleImage = (id: string) => {
    if (!source.fileData) return;
    const updated = source.fileData.filter((item) => item.id !== id);
    onChangeSource({
      ...source,
      fileData: updated,
      imageCount: updated.length,
    });
    onAddToast('info', 'Đã gỡ 1 ảnh');
  };

  // Clear all source data
  const handleClearSource = () => {
    onChangeSource({ type: 'text', textContent: '', fileData: [] });
    setShowTextInput(false);
    onAddToast('info', 'Đã xóa dữ liệu đầu vào');
  };

  const hasLoadedContent = Boolean(
    (source.fileData && source.fileData.length > 0) ||
    (source.textContent && source.textContent.trim().length > 0)
  );

  const isDocx = source.type === 'docx' && source.fileData?.[0];
  const isPdf = source.type === 'pdf' && source.fileData?.[0];
  const isImages = (source.type === 'image' || source.type === 'paste') && source.fileData && source.fileData.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
      {/* Lightbox / Zoom Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer animate-fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden p-1 shadow-2xl">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewImage} alt="Phóng to ảnh bài tập" className="max-h-[85vh] w-auto object-contain rounded-lg" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Nạp Đề Gốc & Bài Tập Mẫu
            </h2>
            <p className="text-[11px] text-slate-500">
              Tải file Word, PDF, ảnh bài tập hoặc dán ảnh chụp màn hình
            </p>
          </div>
        </div>

        {hasLoadedContent && (
          <button
            onClick={handleClearSource}
            className="text-xs text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Làm mới</span>
          </button>
        )}
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputDocxPdfRef}
        type="file"
        accept=".docx,.pdf,.doc"
        onChange={handleDocxPdfSelected}
        className="hidden"
      />
      <input
        ref={fileInputImageRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleMultipleImagesSelected(e, true)}
        className="hidden"
      />

      {/* 1. UNIFIED DROPZONE & ACTION HUB */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-5 transition-all text-center ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/80 ring-4 ring-indigo-100'
            : 'border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="flex items-center justify-center space-x-2 text-indigo-600">
            <FileText className="w-6 h-6 text-indigo-500" />
            <ImageIcon className="w-6 h-6 text-violet-500" />
            <Clipboard className="w-6 h-6 text-emerald-500" />
          </div>

          <div>
            <p className="text-xs sm:text-sm font-semibold text-slate-800">
              Kéo thả file vào đây hoặc chọn nguồn bài tập:
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Hỗ trợ <span className="font-medium text-slate-700">.docx</span>, <span className="font-medium text-slate-700">.pdf</span>, <span className="font-medium text-slate-700">ảnh bài tập (nhiều ảnh)</span> & <span className="font-medium text-indigo-700">Ctrl+V</span>
            </p>
          </div>

          {/* 4 Fast Action Buttons in clean 2x2 Grid */}
          <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
            {/* Action 1: Upload File DOCX / PDF */}
            <button
              type="button"
              onClick={() => fileInputDocxPdfRef.current?.click()}
              disabled={isLoadingFile}
              className="px-3 py-2.5 bg-white hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 rounded-xl flex items-center justify-center space-x-2 text-xs font-semibold text-slate-700 hover:text-indigo-700 shadow-2xs transition-all cursor-pointer"
            >
              <FileUp className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>File Word / PDF</span>
            </button>

            {/* Action 2: Upload Multiple Images */}
            <button
              type="button"
              onClick={() => fileInputImageRef.current?.click()}
              className="px-3 py-2.5 bg-white hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 rounded-xl flex items-center justify-center space-x-2 text-xs font-semibold text-slate-700 hover:text-indigo-700 shadow-2xs transition-all cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-violet-600 shrink-0" />
              <span>Tải ảnh lên</span>
            </button>

            {/* Action 3: Paste Screenshot Hint */}
            <div
              className="px-3 py-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-center space-x-2 text-xs font-semibold text-emerald-800 shadow-2xs cursor-default"
              title="Nhấn Ctrl+V sau khi chụp màn hình (Snipping Tool, Zalo, Web...)"
            >
              <Clipboard className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Dán ảnh (Ctrl+V)</span>
            </div>

            {/* Action 4: Direct Text Input Toggle */}
            <button
              type="button"
              onClick={() => setShowTextInput(!showTextInput)}
              className={`px-3 py-2.5 rounded-xl flex items-center justify-center space-x-2 text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
                showTextInput
                  ? 'bg-indigo-600 text-white border border-indigo-600'
                  : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
              }`}
            >
              <AlignLeft className="w-4 h-4 shrink-0" />
              <span>Nhập văn bản</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. LOADED CONTENT PREVIEW & MANAGEMENT */}

      {/* A. DOCX File Display */}
      {isDocx && (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-950">
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[200px] sm:max-w-xs">{source.fileData![0].fileName}</span>
            </span>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
              {source.wordCount || 0} từ
            </span>
          </div>

          {source.mathTypeCount ? (
            <div className="p-2 bg-amber-100/90 border border-amber-300 rounded-lg text-amber-900 text-[11px] flex items-start space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Phát hiện {source.mathTypeCount} công thức MathType trong file. AI sẽ tự động tái tạo thành công thức LaTeX $...$ chính xác.
              </span>
            </div>
          ) : null}

          {source.textContent && (
            <p className="text-[11px] text-slate-600 line-clamp-3 bg-white p-2.5 rounded-lg border border-emerald-100 italic">
              "{source.textContent.slice(0, 250)}..."
            </p>
          )}
        </div>
      )}

      {/* B. PDF File Display */}
      {isPdf && (
        <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-950">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold block truncate max-w-[200px] sm:max-w-xs">
                {source.fileData![0].fileName}
              </span>
              <span className="text-[10px] text-slate-500">
                {((source.fileData![0].fileSize || 0) / (1024 * 1024)).toFixed(2)} MB • Gemini Vision sẽ đọc trực tiếp
              </span>
            </div>
          </div>
          <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg text-[11px] font-semibold">
            Đã sẵn sàng
          </span>
        </div>
      )}

      {/* C. Images Gallery (Both uploaded & pasted screenshots) */}
      {isImages && (
        <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              <span>Đã nạp {source.fileData!.length} ảnh bài tập:</span>
            </span>

            <button
              type="button"
              onClick={() => fileInputImageRef.current?.click()}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm ảnh nữa</span>
            </button>
          </div>

          {/* Thumbnails Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto p-1">
            {source.fileData!.map((img, idx) => (
              <div
                key={img.id || idx}
                className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-900 h-28 shadow-2xs transition-transform hover:scale-[1.02]"
              >
                <img
                  src={img.base64}
                  alt={`Ảnh ${idx + 1}`}
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                />
                <span className="absolute bottom-1.5 left-1.5 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded backdrop-blur-xs">
                  Ảnh #{idx + 1}
                </span>

                {/* Thumbnail Action Buttons */}
                <div className="absolute top-1.5 right-1.5 flex items-center space-x-1 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setPreviewImage(img.base64)}
                    className="p-1.5 bg-black/70 hover:bg-black text-white rounded-md cursor-pointer transition-colors shadow-xs"
                    title="Xem phóng to"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSingleImage(img.id)}
                    className="p-1.5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-md cursor-pointer transition-colors shadow-xs"
                    title="Xóa ảnh này"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-slate-500 italic text-center pt-0.5">
            💡 Bạn có thể tiếp tục nhấn <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-indigo-700">Ctrl+V</kbd> để dán thêm ảnh chụp từ Clipboard!
          </p>
        </div>
      )}

      {/* D. Direct Text Area */}
      {showTextInput && (
        <div className="space-y-1.5 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Nội dung văn bản đề bài:</span>
            <span className="text-[10px] text-slate-400 font-normal">
              {(source.textContent || '').length} ký tự
            </span>
          </div>
          <textarea
            rows={5}
            placeholder="Dán hoặc nhập nội dung bài tập / đề thi vào đây... (Ví dụ: Cho hệ phương trình $2x + y = 5$...)"
            value={source.textContent || ''}
            onChange={(e) =>
              onChangeSource({
                type: 'text',
                textContent: e.target.value,
              })
            }
            className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 font-sans leading-relaxed text-slate-800"
          />
        </div>
      )}
    </div>
  );
};
