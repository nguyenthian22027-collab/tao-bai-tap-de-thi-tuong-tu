import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { ExamData } from '../types';
import { exportExamToDocx, ExportFormat, ExportDocxMode } from '../lib/docxExporter';
import { exportMathTypeOleDocx, MathTypeExportMode } from '../lib/mathtypeExport';
import { Download, Shuffle, Printer, FileText, FileCode, CheckCircle2, Cpu, Loader2, Files, FileCheck, BookmarkPlus, FileArchive } from 'lucide-react';

export type ExportScope = 'separate_files' | 'exam_only' | 'answers_only' | 'both_in_one';

interface ExportToolbarProps {
  exam: ExamData;
  examList?: ExamData[];
  activeExamIndex?: number;
  onSelectExamIndex?: (index: number) => void;
  includeAnswers: boolean;
  onOpenShuffleModal: () => void;
  onSaveToHistory?: () => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
  onCheckLicense?: () => boolean;
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  exam,
  examList,
  activeExamIndex = 0,
  onSelectExamIndex,
  includeAnswers,
  onOpenShuffleModal,
  onSaveToHistory,
  onAddToast,
  onCheckLicense,
}) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  // Mặc định luôn ưu tiên tách 2 file riêng biệt (1 Đề học sinh + 1 Đáp án giáo viên)
  const [exportScope, setExportScope] = useState<ExportScope>(
    includeAnswers ? 'separate_files' : 'exam_only'
  );

  // Sync exportScope khi prop includeAnswers thay đổi từ bên ngoài
  useEffect(() => {
    setExportScope((prev) => {
      if (prev === 'separate_files' || prev === 'answers_only') return prev;
      return includeAnswers ? 'separate_files' : 'exam_only';
    });
  }, [includeAnswers]);

  const [selectedExamIndices, setSelectedExamIndices] = useState<number[]>([]);

  // Tự động chọn tất cả các đề khi danh sách đề thay đổi
  useEffect(() => {
    if (examList && examList.length > 0) {
      setSelectedExamIndices(examList.map((_, i) => i));
    } else {
      setSelectedExamIndices([0]);
    }
  }, [examList?.length]);

  const toggleSelectExam = (idx: number) => {
    setSelectedExamIndices((prev) => {
      if (prev.includes(idx)) {
        return prev.filter((i) => i !== idx);
      } else {
        return [...prev, idx].sort((a, b) => a - b);
      }
    });
  };

  const selectAllExams = () => {
    if (examList && examList.length > 0) {
      setSelectedExamIndices(examList.map((_, i) => i));
    }
  };

  const deselectAllExams = () => {
    setSelectedExamIndices([]);
  };

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

  // Tải các đề đã chọn thành file ZIP
  const handleExportAllZip = async () => {
    if (onCheckLicense && !onCheckLicense()) return;
    if (!examList || examList.length <= 1) return;

    if (selectedExamIndices.length === 0) {
      onAddToast('warning', '⚠️ Vui lòng tích chọn ít nhất 1 đề thi để tải về file ZIP!');
      return;
    }

    const indicesToExport = selectedExamIndices;

    setIsExporting('all_zip');
    try {
      const zip = new JSZip();
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeMon = (exam.meta?.mon || 'mon').toLowerCase().replace(/\s+/g, '-');

      for (const i of indicesToExport) {
        const curExam = examList[i];
        if (!curExam) continue;
        const deNum = curExam.meta?.deSo || i + 1;

        if (exportScope === 'separate_files') {
          // 1. File Đề thi sạch sẽ (Học sinh)
          const blobExam = await exportExamToDocx(curExam, 'omml', 'exam_only');
          zip.file(`De_So_${deNum}_De_Thi.docx`, blobExam);

          // 2. File Đáp án & Hướng dẫn giải (Giáo viên)
          const blobAns = await exportExamToDocx(curExam, 'omml', 'answers_only');
          zip.file(`De_So_${deNum}_Dap_An.docx`, blobAns);
        } else if (exportScope === 'exam_only') {
          const blobExam = await exportExamToDocx(curExam, 'omml', 'exam_only');
          zip.file(`De_So_${deNum}_De_Thi.docx`, blobExam);
        } else if (exportScope === 'answers_only') {
          const blobAns = await exportExamToDocx(curExam, 'omml', 'answers_only');
          zip.file(`De_So_${deNum}_Dap_An.docx`, blobAns);
        } else {
          const blob = await exportExamToDocx(curExam, 'omml', 'both_in_one');
          zip.file(`De_So_${deNum}_De_Thi_Kem_Dap_An.docx`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const scopeDesc = exportScope === 'separate_files' ? 'tach-de-va-dap-an' : exportScope;
      downloadBlob(zipBlob, `bo-${indicesToExport.length}-de-tuong-tu-${safeMon}-${scopeDesc}-${dateStr}.zip`);
      onAddToast('success', `✅ Đã tải thành công file ZIP gồm ${indicesToExport.length} đề thi tương tự!`);
    } catch (err: any) {
      console.error('All Zip Export error:', err);
      onAddToast('error', `Tải trọn bộ ZIP thất bại: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsExporting(null);
    }
  };

  // Xuất MathType OLE thật sự (Equation.DSMT4)
  const handleExportMathTypeOle = async (overrideScope?: ExportScope) => {
    if (onCheckLicense && !onCheckLicense()) return;
    const scope = overrideScope || exportScope;
    setIsExporting(overrideScope ? `mathtype_ole_${overrideScope}` : 'mathtype_ole');
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeMon = (exam.meta?.mon || 'toan').toLowerCase().replace(/\s+/g, '-');
      const deSo = exam.meta?.deSo || activeExamIndex + 1;
      const dePrefix = examList && examList.length > 1 ? `De_So_${deSo}_` : '';

      if (scope === 'separate_files') {
        // 1. File Đề bài sạch sẽ 100%
        const fnExam = `${dePrefix}de-thi-${safeMon}-mathtype-ole-${dateStr}.docx`;
        await exportMathTypeOleDocx(exam, 'exam_only', fnExam);

        // Chờ 800ms để trình duyệt không chặn pop-up đa tải
        await new Promise((r) => setTimeout(r, 800));

        // 2. File Đáp án & Lời giải
        const fnAns = `${dePrefix}dap-an-loi-giai-${safeMon}-mathtype-ole-${dateStr}.docx`;
        await exportMathTypeOleDocx(exam, 'answers_only', fnAns);

        onAddToast(
          'success',
          `✅ Đã tải xong 2 file Word MathType OLE riêng biệt cho Đề số ${deSo} (1 file Đề + 1 file Đáp án)!`
        );
      } else if (scope === 'answers_only') {
        const fnAns = `${dePrefix}dap-an-loi-giai-${safeMon}-mathtype-ole-${dateStr}.docx`;
        await exportMathTypeOleDocx(exam, 'answers_only', fnAns);
        onAddToast('success', `✅ Đã xuất File Đáp án & Lời giải MathType OLE cho Đề số ${deSo}!`);
      } else {
        const mode: MathTypeExportMode = scope === 'exam_only' ? 'exam_only' : 'both_in_one';
        const prefix = scope === 'exam_only' ? 'de-thi' : 'de-thi-kem-dap-an';
        const filename = `${dePrefix}${prefix}-${safeMon}-mathtype-ole-${dateStr}.docx`;

        const result = await exportMathTypeOleDocx(exam, mode, filename);
        onAddToast(
          'success',
          `✅ Đã xuất Đề số ${deSo} dạng MathType OLE (${result.converted} công thức chuyển đổi thành công)!`
        );
      }
    } catch (err: any) {
      console.error('MathType OLE Export error:', err);
      onAddToast('error', `Xuất MathType OLE thất bại: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExport = async (format: ExportFormat, overrideScope?: ExportScope) => {
    if (onCheckLicense && !onCheckLicense()) return;
    const scope = overrideScope || exportScope;
    setIsExporting(overrideScope ? `${format}_${overrideScope}` : format);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeMon = (exam.meta?.mon || 'mon').toLowerCase().replace(/\s+/g, '-');
      const safeLop = (exam.meta?.lop || 'lop').toLowerCase().replace(/\s+/g, '-');
      const deSo = exam.meta?.deSo || activeExamIndex + 1;
      const dePrefix = examList && examList.length > 1 ? `De_So_${deSo}_` : '';

      const formatNames: Record<string, string> = {
        latex: 'LaTeX (.docx)',
        omml: 'Word Equation (.docx)',
        mathtype: 'MathType-compatible (.docx)',
      };

      if (scope === 'separate_files') {
        // 1. File Đề bài sạch sẽ 100%
        const blobExam = await exportExamToDocx(exam, format, 'exam_only');
        downloadBlob(blobExam, `${dePrefix}de-thi-${safeMon}-${safeLop}-${format}-${dateStr}.docx`);

        // Chờ 600ms
        await new Promise((r) => setTimeout(r, 600));

        // 2. File Đáp án & Lời giải
        const blobAns = await exportExamToDocx(exam, format, 'answers_only');
        downloadBlob(blobAns, `${dePrefix}dap-an-loi-giai-${safeMon}-${safeLop}-${format}-${dateStr}.docx`);

        onAddToast(
          'success',
          `✅ Đã tải xong 2 file ${formatNames[format]} riêng biệt cho Đề số ${deSo} (1 file Đề + 1 file Đáp án)!`
        );
      } else if (scope === 'answers_only') {
        const blobAns = await exportExamToDocx(exam, format, 'answers_only');
        downloadBlob(blobAns, `${dePrefix}dap-an-loi-giai-${safeMon}-${safeLop}-${format}-${dateStr}.docx`);
        onAddToast('success', `✅ Đã tải file Đáp án & Hướng dẫn giải cho Đề số ${deSo}`);
      } else {
        const mode: ExportDocxMode = scope === 'exam_only' ? 'exam_only' : 'both_in_one';
        const prefix = scope === 'exam_only' ? 'de-thi' : 'de-thi-kem-dap-an';
        const blob = await exportExamToDocx(exam, format, mode);
        downloadBlob(blob, `${dePrefix}${prefix}-${safeMon}-${safeLop}-${format}-${dateStr}.docx`);

        const sizeKb = (blob.size / 1024).toFixed(1);
        const desc = scope === 'exam_only' ? 'Chỉ Đề bài sạch' : 'Đề kèm Đáp án';
        onAddToast('success', `✅ Đã xuất Đề số ${deSo} (${desc}) dạng ${formatNames[format] || format} — ${sizeKb}KB`);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      onAddToast('error', `Xuất file thất bại: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsExporting(null);
    }
  };

  const currentDeSo = exam.meta?.deSo || activeExamIndex + 1;

  return (
    <div className="panel-card p-4 sm:p-5 space-y-3 no-print">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-xs font-bold text-slate-900 tracking-wide flex items-center space-x-1.5">
          <Download className="w-4 h-4 text-indigo-600" />
          <span>Xuất File Đề Thi & Tiện Ích</span>
        </h3>
        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
          {exportScope === 'separate_files' && '📦 Chế độ: Tách 2 file riêng (1 Đề + 1 Đáp án)'}
          {exportScope === 'exam_only' && '📄 Chế độ: Chỉ đề bài sạch (100% không đáp án)'}
          {exportScope === 'answers_only' && '📋 Chế độ: Chỉ file Đáp án & Hướng dẫn giải'}
          {exportScope === 'both_in_one' && '📑 Chế độ: Đề kèm đáp án (Gộp 1 file)'}
        </span>
      </div>

      {/* Thanh chọn đề và nút tải ZIP khi có nhiều đề tương tự */}
      {examList && examList.length > 1 && (
        <div className="bg-indigo-50/90 border border-indigo-200 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Files className="w-4 h-4 text-indigo-600" />
                <span>Trọn bộ {examList.length} đề thi tương tự đã tạo:</span>
              </span>
              <p className="text-[11px] text-indigo-700">
                Tích chọn các đề bạn muốn nén vào file ZIP, hoặc bấm xem đề để tải riêng lẻ
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportAllZip}
              disabled={!!isExporting || selectedExamIndices.length === 0}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
              title="Đóng gói các đề đã chọn vào 1 file ZIP"
            >
              {isExporting === 'all_zip' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang nén {selectedExamIndices.length} đề vào ZIP...</span>
                </>
              ) : (
                <>
                  <FileArchive className="w-4 h-4" />
                  <span>
                    📦 Tải ZIP ({selectedExamIndices.length}/{examList.length} Đề Đã Chọn)
                  </span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-indigo-100">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-[11px] font-semibold text-slate-700">Chọn đề vào ZIP:</span>
              <button
                type="button"
                onClick={selectAllExams}
                className="text-[10.5px] text-indigo-600 hover:underline font-bold cursor-pointer"
              >
                (Chọn tất cả)
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={deselectAllExams}
                className="text-[10.5px] text-slate-500 hover:underline cursor-pointer"
              >
                (Bỏ chọn)
              </button>
            </div>

            {examList.map((item, idx) => {
              const isChecked = selectedExamIndices.includes(idx);
              const isActive = activeExamIndex === idx;
              return (
                <div
                  key={idx}
                  className={`flex items-center rounded-lg border text-xs transition-all overflow-hidden ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-400'
                      : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  <label className="flex items-center px-1.5 py-1 cursor-pointer" title="Tích chọn để thêm đề này vào file ZIP">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelectExam(idx)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onSelectExamIndex && onSelectExamIndex(idx)}
                    className={`px-2.5 py-1 font-bold cursor-pointer transition-colors ${
                      isActive ? 'text-white' : 'text-indigo-950 hover:text-indigo-600'
                    }`}
                    title="Bấm để xem và sửa nội dung đề này"
                  >
                    📝 Đề số {idx + 1}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] font-semibold text-indigo-900 bg-white/80 px-2.5 py-1.5 rounded-lg border border-indigo-100 flex items-center justify-between flex-wrap gap-1">
            <span>👉 Đang làm việc với: <strong>Đề số {currentDeSo}</strong></span>
            <span className="text-slate-500">Các nút tải bên dưới áp dụng trực tiếp cho Đề số {currentDeSo}</span>
          </div>
        </div>
      )}

      {/* Tùy chọn nội dung tải: Tách 2 file vs Chỉ đề bài vs Chỉ đáp án vs Gộp chung */}
      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
        <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between flex-wrap gap-1">
          <span className="flex items-center space-x-1">
            <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Chế độ xuất file (Đề riêng / Đáp án riêng):</span>
          </span>
          <span className="text-[10.5px] text-indigo-700 font-medium">
            {exportScope === 'separate_files' && '⭐ Khuyên dùng: Tự động tải 2 file Word riêng biệt (1 Đề học sinh + 1 Đáp án giáo viên)'}
            {exportScope === 'exam_only' && 'Tải 1 file Đề bài sạch sẽ cho học sinh (tuyệt đối KHÔNG có đáp án/lời giải)'}
            {exportScope === 'answers_only' && 'Tải 1 file Đáp án và Hướng dẫn giải chi tiết cho giáo viên'}
            {exportScope === 'both_in_one' && 'Đề thi ở trang trước, sang trang mới là Đáp án & Hướng dẫn giải'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setExportScope('separate_files')}
            className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
              exportScope === 'separate_files'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <Files className="w-3.5 h-3.5 shrink-0" />
            <span>📦 Tách 2 File Riêng (Khuyên Dùng)</span>
          </button>

          <button
            type="button"
            onClick={() => setExportScope('exam_only')}
            className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
              exportScope === 'exam_only'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>📄 Chỉ Đề Bài (Học Sinh)</span>
          </button>

          <button
            type="button"
            onClick={() => setExportScope('answers_only')}
            className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
              exportScope === 'answers_only'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-300'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>📋 Chỉ Đáp Án (Giáo Viên)</span>
          </button>

          <button
            type="button"
            onClick={() => setExportScope('both_in_one')}
            className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border ${
              exportScope === 'both_in_one'
                ? 'bg-slate-700 text-white border-slate-700 shadow-xs ring-2 ring-slate-400'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 shrink-0" />
            <span>📑 Đề Kèm Đáp Án (Gộp 1 File)</span>
          </button>
        </div>
      </div>

      {/* Thanh Tải Nhanh 1-Click Cho Đề Số currentDeSo */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-emerald-50/50 to-amber-50/70 p-2.5 rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1 shrink-0">
          <span>⚡ Tải nhanh Đề số {currentDeSo}:</span>
        </span>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleExport('omml', 'exam_only')}
            disabled={!!isExporting}
            className="flex-1 sm:flex-initial py-1.5 px-3 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
            title="Tải ngay 1 file Word Đề thi sạch sẽ cho học sinh (100% không chứa đáp án)"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>📄 Tải File Đề Bài (Học Sinh)</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('omml', 'answers_only')}
            disabled={!!isExporting}
            className="flex-1 sm:flex-initial py-1.5 px-3 bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
            title="Tải ngay 1 file Word Bảng đáp án & Hướng dẫn giải chi tiết cho giáo viên"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
            <span>📋 Tải File Đáp Án (Giáo Viên)</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('omml', 'separate_files')}
            disabled={!!isExporting}
            className="flex-1 sm:flex-initial py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
            title="Tải đồng thời 2 file Word riêng biệt: 1 file Đề + 1 file Đáp án"
          >
            <Files className="w-3.5 h-3.5" />
            <span>📦 Tải Cả 2 File Riêng</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* 1. Export Word Equation (OMML - Khuyên dùng hàng đầu, tải ngay trong 1 giây) */}
        <button
          onClick={() => handleExport('omml')}
          disabled={!!isExporting}
          className="p-3 bg-indigo-50/80 hover:bg-indigo-100/90 border-2 border-indigo-300 hover:border-indigo-500 rounded-xl text-left transition-all cursor-pointer group shadow-2xs relative"
          title={`Xuất file Đề số ${currentDeSo} chuẩn Word Equation — Tải ngay lập tức trong 1 giây`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-indigo-950 group-hover:text-indigo-900 flex items-center space-x-1.5">
              <FileCode className="w-4 h-4 text-indigo-600" />
              <span>Word Equation (.docx)</span>
            </span>
            <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded shadow-2xs">
              Đề số {currentDeSo}
            </span>
          </div>
          <p className="text-[10px] text-indigo-900/80 leading-tight">
            {exportScope === 'separate_files' && 'Tự động tải 2 file riêng (1 Đề + 1 Đáp án) chuẩn Word 2016-365'}
            {exportScope === 'exam_only' && 'Tải file Đề bài sạch sẽ 100% không đáp án chuẩn Word 2016-365'}
            {exportScope === 'answers_only' && 'Tải file Đáp án & Hướng dẫn giải chuẩn Word 2016-365'}
            {exportScope === 'both_in_one' && 'Tải 1 file gộp Đề thi kèm Đáp án chuẩn Word 2016-365'}
          </p>
          {isExporting?.startsWith('omml') && (
            <div className="absolute inset-0 bg-indigo-50/90 rounded-xl flex items-center justify-center space-x-1.5 text-xs font-bold text-indigo-700">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Đang xuất Đề số {currentDeSo}...</span>
            </div>
          )}
        </button>

        {/* 2. Word MathType OLE (Equation.DSMT4 qua máy chủ Render) */}
        <button
          onClick={() => handleExportMathTypeOle()}
          disabled={!!isExporting}
          className="p-3 bg-purple-50/50 hover:bg-purple-100/80 border border-purple-200 hover:border-purple-400 rounded-xl text-left transition-all cursor-pointer group shadow-2xs relative"
          title={`Xuất file Đề số ${currentDeSo} chuẩn MathType OLE (Equation.DSMT4)`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-purple-950 group-hover:text-purple-900 flex items-center space-x-1.5">
              <Cpu className="w-4 h-4 text-purple-600" />
              <span>Word MathType OLE (.docx)</span>
            </span>
            <span className="text-[9px] bg-purple-200 text-purple-800 font-bold px-1.5 py-0.5 rounded">
              Đề số {currentDeSo}
            </span>
          </div>
          <p className="text-[10px] text-purple-900/70 leading-tight">
            {exportScope === 'separate_files' && 'Tách 2 file MathType OLE riêng (qua máy chủ Render, 30-60s)'}
            {exportScope === 'exam_only' && 'Chỉ tải file Đề bài MathType OLE (không đáp án)'}
            {exportScope === 'answers_only' && 'Chỉ tải file Đáp án MathType OLE'}
            {exportScope === 'both_in_one' && 'Đề kèm đáp án MathType OLE (gộp 1 file)'}
          </p>
          {isExporting?.startsWith('mathtype_ole') && (
            <div className="absolute inset-0 bg-purple-50/95 rounded-xl flex flex-col items-center justify-center p-2 text-center space-y-1">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span className="text-[11px] font-bold text-purple-900">Đang xuất MathType Đề {currentDeSo}...</span>
              <span className="text-[9.5px] text-purple-700 leading-tight">Vui lòng đợi 30-60s để máy chủ chuyển đổi công thức</span>
            </div>
          )}
        </button>

        {/* 3. Export LaTeX */}
        <button
          onClick={() => handleExport('latex')}
          disabled={!!isExporting}
          className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl text-left transition-all cursor-pointer group relative"
          title={`Xuất mã LaTeX cho Đề số ${currentDeSo}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900 flex items-center space-x-1">
              <FileText className="w-4 h-4 text-slate-500 group-hover:text-slate-700" />
              <span>Mã LaTeX (.docx)</span>
            </span>
            <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
              Đề số {currentDeSo}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            {exportScope === 'separate_files' && 'Tách 2 file mã LaTeX $...$ riêng cho Đề số ' + currentDeSo}
            {exportScope === 'exam_only' && 'Chỉ đề bài dạng mã LaTeX $...$ (không đáp án)'}
            {exportScope === 'answers_only' && 'Chỉ đáp án & lời giải dạng mã LaTeX $...$'}
            {exportScope === 'both_in_one' && 'Đề kèm đáp án dạng mã LaTeX $...$'}
          </p>
          {isExporting?.startsWith('latex') && (
            <div className="absolute inset-0 bg-slate-50/90 rounded-xl flex items-center justify-center space-x-1.5 text-xs font-bold text-slate-700">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              <span>Đang xuất LaTeX Đề {currentDeSo}...</span>
            </div>
          )}
        </button>
      </div>

      {/* Utility Buttons: Save to History, Shuffle & Print */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-center gap-2 pt-2 border-t border-slate-100">
        {onSaveToHistory && (
          <button
            onClick={onSaveToHistory}
            className="w-full sm:w-auto py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            title="Lưu bản đề thi hiện tại vào danh sách lịch sử"
          >
            <BookmarkPlus className="w-4 h-4 text-indigo-600" />
            <span>💾 Lưu Vào Lịch Sử</span>
          </button>
        )}

        <button
          onClick={onOpenShuffleModal}
          className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Shuffle className="w-4 h-4 text-amber-700" />
          <span>🔀 Trộn Đề (Tạo Mã Đề A/B/C/D)</span>
        </button>

        <button
          onClick={() => window.print()}
          className="w-full sm:w-auto py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4 text-slate-600" />
          <span>In Đề (Ctrl+P)</span>
        </button>
      </div>
    </div>
  );
};
