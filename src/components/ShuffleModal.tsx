import React, { useState, useMemo } from 'react';
import JSZip from 'jszip';
import { ExamData } from '../types';
import { shuffleExam } from '../lib/seededShuffle';
import { exportExamToDocx } from '../lib/docxExporter';
import { X, Shuffle, Download, Eye, FileArchive, Check } from 'lucide-react';

interface ShuffleModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: ExamData;
  includeAnswers: boolean;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const ShuffleModal: React.FC<ShuffleModalProps> = ({
  isOpen,
  onClose,
  exam,
  includeAnswers,
  onAddToast,
}) => {
  const [numVersions, setNumVersions] = useState<number>(4);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [selectedVersionCode, setSelectedVersionCode] = useState<string>('A');
  const [isExportingZip, setIsExportingZip] = useState(false);

  const versionCodes = useMemo(() => {
    const allCodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    return allCodes.slice(0, numVersions);
  }, [numVersions]);

  // Compute shuffled exams deterministically
  const shuffledExams = useMemo(() => {
    const map: Record<string, ExamData> = {};
    versionCodes.forEach((code) => {
      map[code] = shuffleExam(exam, code, shuffleQuestions, shuffleOptions);
    });
    return map;
  }, [exam, versionCodes, shuffleQuestions, shuffleOptions]);

  if (!isOpen) return null;

  const currentPreviewExam = shuffledExams[selectedVersionCode] || exam;

  // Export single version
  const handleExportSingle = async (code: string) => {
    const targetExam = shuffledExams[code];
    if (!targetExam) return;

    try {
      const blob = await exportExamToDocx(targetExam, 'mathtype', includeAnswers);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `de-thi-ma-${code}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onAddToast('success', `✅ Đã tải file Mã Đề ${code}`);
    } catch (err: any) {
      onAddToast('error', `Lỗi xuất file: ${err.message}`);
    }
  };

  // Export all versions in a ZIP archive using JSZip
  const handleExportAllZip = async () => {
    setIsExportingZip(true);
    try {
      const zip = new JSZip();

      for (const code of versionCodes) {
        const targetExam = shuffledExams[code];
        const blob = await exportExamToDocx(targetExam, 'mathtype', includeAnswers);
        zip.file(`Ma_De_${code}.docx`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `danh-sach-ma-de-${numVersions}-ma.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onAddToast('success', `✅ Đã tải file ZIP chứa ${numVersions} mã đề!`);
    } catch (err: any) {
      onAddToast('error', `Lỗi tạo file ZIP: ${err.message}`);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Trộn Đề Thi — Tạo Các Mã Đề</h3>
              <p className="text-xs text-slate-500">
                Mỗi mã đề sử dụng Seed ngẫu nhiên cố định — Đảm bảo kết quả reproducible
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Config Options Bar */}
        <div className="px-6 py-3 bg-amber-50/50 border-b border-amber-100 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-800">
          <div className="flex items-center space-x-3">
            <span>Số lượng mã đề:</span>
            {[2, 3, 4, 6].map((n) => (
              <button
                key={n}
                onClick={() => setNumVersions(n)}
                className={`px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                  numVersions === n
                    ? 'bg-amber-600 text-white border-amber-600 font-bold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {n} Mã đề
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Trộn thứ tự câu</span>
            </label>

            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Trộn đáp án A/B/C/D</span>
            </label>
          </div>
        </div>

        {/* Body Container: Preview Tabs & Question List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Version Selector Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-slate-700 mr-2">Xem trước mã đề:</span>
            {versionCodes.map((code) => (
              <button
                key={code}
                onClick={() => setSelectedVersionCode(code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedVersionCode === code
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Mã Đề {code}
              </button>
            ))}
          </div>

          {/* Current Preview List */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 max-h-[360px] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase">
                XEM TRƯỚC: MÃ ĐỀ {selectedVersionCode}
              </h4>
              <button
                onClick={() => handleExportSingle(selectedVersionCode)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất riêng mã đề này</span>
              </button>
            </div>

            {currentPreviewExam.phan.map((section, sIdx) => (
              <div key={sIdx} className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  {section.ten}
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {section.cauHoi.slice(0, 5).map((q) => (
                    <div
                      key={q.id}
                      className="p-2 bg-white border border-slate-200 rounded-lg flex items-start space-x-2"
                    >
                      <span className="font-bold text-indigo-700">Câu {q.stt}:</span>
                      <span className="text-slate-800 line-clamp-1">{q.noiDung}</span>
                    </div>
                  ))}
                  {section.cauHoi.length > 5 && (
                    <span className="text-[11px] text-slate-400 italic text-center block pt-1">
                      ... và {section.cauHoi.length - 5} câu hỏi tiếp theo
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
          >
            Đóng
          </button>

          <button
            onClick={handleExportAllZip}
            disabled={isExportingZip}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <FileArchive className="w-4 h-4" />
            <span>{isExportingZip ? 'Đang đóng gói ZIP...' : `Tải tất cả ${numVersions} mã đề (.ZIP)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
