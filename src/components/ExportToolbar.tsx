import React, { useState } from 'react';
import { ExamData } from '../types';
import { exportExamToDocx, ExportFormat, ExportDocxMode } from '../lib/docxExporter';
import { exportMathTypeOleDocx, MathTypeExportMode } from '../lib/mathtypeExport';
import { Download, Shuffle, Printer, FileText, FileCode, CheckCircle2, Cpu, Loader2, Files, FileCheck, BookmarkPlus } from 'lucide-react';

export type ExportScope = 'exam_only' | 'both_in_one' | 'separate_files';

interface ExportToolbarProps {
  exam: ExamData;
  includeAnswers: boolean;
  onOpenShuffleModal: () => void;
  onSaveToHistory?: () => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  exam,
  includeAnswers,
  onOpenShuffleModal,
  onSaveToHistory,
  onAddToast,
}) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportScope, setExportScope] = useState<ExportScope>(
    includeAnswers ? 'both_in_one' : 'exam_only'
  );

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  };

  // Xuất MathType OLE thật sự (Equation.DSMT4)
  const handleExportMathTypeOle = async () => {
    setIsExporting('mathtype_ole');
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeMon = (exam.meta?.mon || 'toan').toLowerCase().replace(/\s+/g, '-');

      if (exportScope === 'separate_files') {
        // 1. File Đề bài
        const fnExam = `de-thi-${safeMon}-mathtype-ole-${dateStr}.docx`;
        await exportMathTypeOleDocx(exam, 'exam_only', fnExam);

        // Chờ 800ms để trình duyệt không chặn pop-up đa tải
        await new Promise((r) => setTimeout(r, 800));

        // 2. File Đáp án & Lời giải
        const fnAns = `dap-an-loi-giai-${safeMon}-mathtype-ole-${dateStr}.docx`;
        await exportMathTypeOleDocx(exam, 'answers_only', fnAns);

        onAddToast(
          'success',
          `Đã tải xong 2 file Word MathType OLE riêng biệt (1 file Đề + 1 file Đáp án)!`
        );
      } else {
        const mode: MathTypeExportMode = exportScope === 'exam_only' ? 'exam_only' : 'both_in_one';
        const prefix = exportScope === 'exam_only' ? 'de-thi' : 'de-thi-kem-dap-an';
        const filename = `${prefix}-${safeMon}-mathtype-ole-${dateStr}.docx`;

        const result = await exportMathTypeOleDocx(exam, mode, filename);
        onAddToast(
          'success',
          `Đã xuất file Word MathType OLE (${result.converted} công thức chuyển đổi thành công)!`
        );
      }
    } catch (err: any) {
      console.error('MathType OLE Export error:', err);
      onAddToast('error', `Xuất MathType OLE thất bại: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(format);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeMon = (exam.meta?.mon || 'mon').toLowerCase().replace(/\s+/g, '-');
      const safeLop = (exam.meta?.lop || 'lop').toLowerCase().replace(/\s+/g, '-');

      const formatNames: Record<string, string> = {
        latex: 'LaTeX (.docx)',
        omml: 'Word Equation (.docx)',
        mathtype: 'MathType-compatible (.docx)',
      };

      if (exportScope === 'separate_files') {
        // 1. File Đề bài
        const blobExam = await exportExamToDocx(exam, format, 'exam_only');
        downloadBlob(blobExam, `de-thi-${safeMon}-${safeLop}-${format}-${dateStr}.docx`);

        // Chờ 500ms
        await new Promise((r) => setTimeout(r, 500));

        // 2. File Đáp án & Lời giải
        const blobAns = await exportExamToDocx(exam, format, 'answers_only');
        downloadBlob(blobAns, `dap-an-loi-giai-${safeMon}-${safeLop}-${format}-${dateStr}.docx`);

        onAddToast(
          'success',
          `Đã tải xong 2 file ${formatNames[format]} riêng biệt (1 file Đề + 1 file Đáp án)!`
        );
      } else {
        const mode: ExportDocxMode = exportScope === 'exam_only' ? 'exam_only' : 'both_in_one';
        const prefix = exportScope === 'exam_only' ? 'de-thi' : 'de-thi-kem-dap-an';
        const blob = await exportExamToDocx(exam, format, mode);
        downloadBlob(blob, `${prefix}-${safeMon}-${safeLop}-${format}-${dateStr}.docx`);

        const sizeKb = (blob.size / 1024).toFixed(1);
        onAddToast('success', `Đã xuất file ${formatNames[format] || format} — ${sizeKb}KB`);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      onAddToast('error', `Xuất file thất bại: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3.5 no-print">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
          <Download className="w-4 h-4 text-indigo-600" />
          <span>Xuất File Đề Thi & Tiện Ích</span>
        </h3>
        <span className="text-[11px] text-slate-500 font-medium">
          {exportScope === 'exam_only' && '📄 Chế độ: Chỉ đề bài'}
          {exportScope === 'both_in_one' && '📑 Chế độ: Đề kèm đáp án (1 file)'}
          {exportScope === 'separate_files' && '📦 Chế độ: 2 file riêng biệt'}
        </span>
      </div>

      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
        <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
          <span className="flex items-center space-x-1">
            <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Tùy chọn tải đề & đáp án:</span>
          </span>
          <span className="text-[10.5px] text-indigo-700 font-medium">
            {exportScope === 'exam_only' && 'Đề bài sạch sẽ cho học sinh làm (không có đáp án/lời giải)'}
            {exportScope === 'both_in_one' && 'Đề thi ở trang trước, sang trang mới là Đáp án & Hướng dẫn giải'}
            {exportScope === 'separate_files' && 'Tự động tải 2 file riêng biệt (1 file Đề + 1 file Đáp án)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setExportScope('exam_only')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
              exportScope === 'exam_only'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <span>📄 1. Chỉ tải đề thi</span>
          </button>

          <button
            type="button"
            onClick={() => setExportScope('both_in_one')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
              exportScope === 'both_in_one'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <span>📑 2. Tải cả đề & đáp án</span>
          </button>

          <button
            type="button"
            onClick={() => setExportScope('separate_files')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
              exportScope === 'separate_files'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <Files className="w-3.5 h-3.5" />
            <span>📦 3. Tải 2 file riêng biệt</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* 1. Export Word Equation (OMML - Khuyên dùng hàng đầu, tải ngay trong 1 giây) */}
        <button
          onClick={() => handleExport('omml')}
          disabled={!!isExporting}
          className="p-3 bg-indigo-50/80 hover:bg-indigo-100/90 border-2 border-indigo-300 hover:border-indigo-500 rounded-xl text-left transition-all cursor-pointer group shadow-2xs relative"
          title="Công thức Equation chuẩn Word — Tải ngay lập tức trong 1 giây, tương thích Word 2016-365"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-indigo-950 group-hover:text-indigo-900 flex items-center space-x-1.5">
              <FileCode className="w-4 h-4 text-indigo-600" />
              <span>1. Word Equation (.docx)</span>
            </span>
            <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded shadow-2xs">
              ⚡ Tải ngay 1s (Khuyên dùng)
            </span>
          </div>
          <p className="text-[10px] text-indigo-900/80 leading-tight">
            Công thức Equation chuẩn Word 2016-365, tải ngay lập tức không cần chờ máy chủ
          </p>
          {isExporting === 'omml' && (
            <div className="absolute inset-0 bg-indigo-50/90 rounded-xl flex items-center justify-center space-x-1.5 text-xs font-bold text-indigo-700">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Đang xuất Word Equation...</span>
            </div>
          )}
        </button>

        {/* 2. Word MathType OLE (Equation.DSMT4 qua máy chủ Render) */}
        <button
          onClick={handleExportMathTypeOle}
          disabled={!!isExporting}
          className="p-3 bg-purple-50/50 hover:bg-purple-100/80 border border-purple-200 hover:border-purple-400 rounded-xl text-left transition-all cursor-pointer group shadow-2xs relative"
          title="Công thức MathType OLE thật sự (Equation.DSMT4) - Cần kết nối máy chủ MathType (khoảng 30-60s)"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-purple-950 group-hover:text-purple-900 flex items-center space-x-1.5">
              <Cpu className="w-4 h-4 text-purple-600" />
              <span>2. Word MathType OLE (.docx)</span>
            </span>
            <span className="text-[9px] bg-purple-200 text-purple-800 font-bold px-1.5 py-0.5 rounded">
              Chờ 30-60s
            </span>
          </div>
          <p className="text-[10px] text-purple-900/70 leading-tight">
            Công thức MathType OLE thật sự (biên dịch qua máy chủ Render, mất khoảng 30-60s)
          </p>
          {isExporting === 'mathtype_ole' && (
            <div className="absolute inset-0 bg-purple-50/95 rounded-xl flex flex-col items-center justify-center p-2 text-center space-y-1">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span className="text-[11px] font-bold text-purple-900">Đang kết nối máy chủ MathType...</span>
              <span className="text-[9.5px] text-purple-700 leading-tight">Vui lòng đợi 30-60s để máy chủ chuyển đổi công thức</span>
            </div>
          )}
        </button>

        {/* 3. Export LaTeX */}
        <button
          onClick={() => handleExport('latex')}
          disabled={!!isExporting}
          className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl text-left transition-all cursor-pointer group relative"
          title="Công thức dạng $...$ — dùng khi cần biên dịch LaTeX hoặc chỉnh sửa thủ công"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900 flex items-center space-x-1">
              <FileText className="w-4 h-4 text-slate-500 group-hover:text-slate-700" />
              <span>3. Mã LaTeX (.docx)</span>
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            Giữ nguyên công thức dạng $...$ cho biên dịch LaTeX & soạn thảo
          </p>
          {isExporting === 'latex' && (
            <div className="absolute inset-0 bg-slate-50/90 rounded-xl flex items-center justify-center space-x-1.5 text-xs font-bold text-slate-700">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              <span>Đang xuất LaTeX...</span>
            </div>
          )}
        </button>
      </div>

      {/* Utility Buttons: Save to History, Shuffle & Print */}
      <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 flex-wrap gap-y-2">
        {onSaveToHistory && (
          <button
            onClick={onSaveToHistory}
            className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            title="Lưu bản đề thi hiện tại vào danh sách lịch sử"
          >
            <BookmarkPlus className="w-4 h-4 text-indigo-600" />
            <span>💾 Lưu Vào Lịch Sử</span>
          </button>
        )}

        <button
          onClick={onOpenShuffleModal}
          className="flex-1 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Shuffle className="w-4 h-4 text-amber-700" />
          <span>🔀 Trộn Đề (Tạo Mã Đề A/B/C/D)</span>
        </button>

        <button
          onClick={() => window.print()}
          className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4 text-slate-600" />
          <span>In Đề (Ctrl+P)</span>
        </button>
      </div>
    </div>
  );
};
