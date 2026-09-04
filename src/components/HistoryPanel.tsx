import React, { useState, useMemo } from 'react';
import { ExamHistoryItem, ExamData } from '../types';
import {
  Clock,
  FolderOpen,
  Trash2,
  X,
  FileCheck,
  Search,
  Download,
  Upload,
  Calendar,
  Layers,
  HelpCircle,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { exportHistoryBackupJson, importHistoryBackupJson } from '../lib/historyDb';
import { exportExamToDocx } from '../lib/docxExporter';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: ExamHistoryItem[];
  onSelectExam: (data: ExamData) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory: () => void;
  onRefreshHistory: () => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  history,
  onSelectExam,
  onDeleteHistoryItem,
  onClearHistory,
  onRefreshHistory,
  onAddToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [isExportingItem, setIsExportingItem] = useState<string | null>(null);

  // Extract unique subjects from history
  const uniqueSubjects = useMemo(() => {
    const subs = new Set<string>();
    history.forEach((h) => {
      const mon = h.mon || h.examData?.meta?.mon;
      if (mon) subs.add(mon);
    });
    return Array.from(subs);
  }, [history]);

  // Filtered list
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.mon && item.mon.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.lop && item.lop.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchSubject =
        selectedSubject === 'all' ||
        item.mon === selectedSubject ||
        item.examData?.meta?.mon === selectedSubject;

      return matchSearch && matchSubject;
    });
  }, [history, searchTerm, selectedSubject]);

  if (!isOpen) return null;

  // Quick export Word from history card
  const handleQuickExportDocx = async (item: ExamHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExportingItem(item.id);
    try {
      const blob = await exportExamToDocx(item.examData, 'omml', 'both_in_one');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeMon = (item.mon || 'mon').toLowerCase().replace(/\s+/g, '-');
      a.download = `de-thi-${safeMon}-omml-${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      onAddToast('success', `Đã xuất nhanh file Word cho "${item.title}"!`);
    } catch (err: any) {
      console.error('Quick export error:', err);
      onAddToast('error', `Xuất file thất bại: ${err.message}`);
    } finally {
      setIsExportingItem(null);
    }
  };

  // Export JSON backup file
  const handleDownloadBackup = async () => {
    try {
      const json = await exportHistoryBackupJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sao-luu-lich-su-de-thi-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onAddToast('success', 'Đã tải file sao lưu lịch sử thành công!');
    } catch (err: any) {
      onAddToast('error', `Lỗi sao lưu: ${err.message}`);
    }
  };

  // Restore from JSON backup file
  const handleRestoreBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const count = await importHistoryBackupJson(text);
        onRefreshHistory();
        onAddToast('success', `Đã khôi phục thành công ${count} đề thi vào lịch sử!`);
      } catch (err: any) {
        onAddToast('error', `Lỗi khôi phục: ${err.message}`);
      }
    };
    input.click();
  };

  const getSubjectColor = (mon?: string) => {
    const s = (mon || '').toLowerCase();
    if (s.includes('toán')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s.includes('văn')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (s.includes('lí') || s.includes('vật')) return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    if (s.includes('hóa')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (s.includes('sinh')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (s.includes('anh')) return 'bg-rose-100 text-rose-800 border-rose-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs no-print">
      {/* Background click to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Content */}
      <div className="w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full animate-slide-left">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <span>Lịch Sử Đề Thi Đã Tạo</span>
                <span className="bg-indigo-100 text-indigo-800 text-[11px] font-semibold px-2 py-0.2 rounded-full">
                  {history.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Tự động lưu trữ an toàn trong IndexedDB của máy tính
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            title="Đóng bảng lịch sử"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-3.5 bg-white border-b border-slate-100 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên đề, môn học, lớp..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl outline-none transition-all"
            />
          </div>

          {/* Subject Pills */}
          {uniqueSubjects.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedSubject('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                  selectedSubject === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({history.length})
              </button>
              {uniqueSubjects.map((sub) => {
                const count = history.filter(
                  (h) => h.mon === sub || h.examData?.meta?.mon === sub
                ).length;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubject(sub)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                      selectedSubject === sub
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sub} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* History Items List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <FileCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600">
                  {searchTerm || selectedSubject !== 'all'
                    ? 'Không tìm thấy đề thi phù hợp với từ khóa'
                    : 'Chưa có đề thi nào trong lịch sử'}
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Các đề thi bạn tạo hoặc nhấn nút "Lưu Đề Vào Lịch Sử" sẽ được lưu trữ tự động tại đây.
                </p>
              </div>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const totalQ =
                item.questionCount ||
                (item.examData?.phan || []).reduce(
                  (acc, p) => acc + (p.cauHoi || []).length,
                  0
                );

              const dateFormatted = new Date(item.timestamp).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });

              return (
                <div
                  key={item.id}
                  className="p-3.5 bg-slate-50/80 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all space-y-2.5 group shadow-2xs"
                >
                  {/* Title & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getSubjectColor(
                            item.mon
                          )}`}
                        >
                          {item.mon || item.examData?.meta?.mon || 'Môn học'}
                        </span>
                        {(item.lop || item.examData?.meta?.lop) && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                            {item.lop || item.examData?.meta?.lop}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {dateFormatted}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 line-clamp-2">
                        {item.title}
                      </h4>
                    </div>

                    <button
                      onClick={() => onDeleteHistoryItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Xóa đề này khỏi lịch sử"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Metadata preview: Questions count, duration, school */}
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span className="flex items-center space-x-1">
                      <Layers className="w-3 h-3 text-slate-400" />
                      <span>{totalQ} câu hỏi</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{item.thoiGian || item.examData?.meta?.thoiGian || 90} phút</span>
                    </span>
                    {item.examData?.meta?.truong && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[120px]" title={item.examData.meta.truong}>
                          {item.examData.meta.truong}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions: Open & Quick Word Export */}
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      onClick={(e) => handleQuickExportDocx(item, e)}
                      disabled={isExportingItem === item.id}
                      className="px-2.5 py-1 text-slate-600 hover:text-indigo-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                      title="Tải nhanh file Word đề này"
                    >
                      <Download className="w-3 h-3" />
                      <span>{isExportingItem === item.id ? 'Đang xuất...' : 'Tải Word'}</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectExam(item.examData);
                        onClose();
                        onAddToast('success', `Đã mở đề thi "${item.title}"!`);
                      }}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg shadow-2xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Mở lại đề này</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Backup, Restore & Clear All */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={history.length === 0}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                title="Tải file JSON sao lưu toàn bộ lịch sử"
              >
                <Download className="w-3 h-3" />
                <span>Sao lưu (JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreBackup}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                title="Khôi phục lịch sử từ file JSON"
              >
                <Upload className="w-3 h-3" />
                <span>Khôi phục</span>
              </button>
            </div>

            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-[11px] text-rose-600 hover:text-rose-700 hover:underline cursor-pointer font-medium"
              >
                Xóa tất cả ({history.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
