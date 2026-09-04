import React, { useState } from 'react';
import { ExamData, SourceState } from '../types';
import { ExamViewer } from './ExamViewer';
import { ExamEditor } from './ExamEditor';
import { FileText, Sparkles, Columns, Edit3, Eye, FileUp, Sliders, CheckCircle2, Shuffle, Image as ImageIcon } from 'lucide-react';

interface ExamTabsProps {
  exam: ExamData | null;
  source: SourceState;
  onChangeExam: (newExam: ExamData) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  editModel: string;
  showAnswer: boolean;
  onToggleAnswer: () => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const ExamTabs: React.FC<ExamTabsProps> = ({
  exam,
  source,
  onChangeExam,
  undo,
  redo,
  canUndo,
  canRedo,
  editModel,
  showAnswer,
  onToggleAnswer,
  onAddToast,
}) => {
  const [activeTab, setActiveTab] = useState<'source' | 'generated' | 'compare'>('generated');
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('edit');

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 no-print">
        <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('source')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-all ${
              activeTab === 'source' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Đề Gốc Nguồn</span>
          </button>

          <button
            onClick={() => setActiveTab('generated')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-all ${
              activeTab === 'generated' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>2. Đề Thi Tương Tự</span>
            {exam && (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                Mới
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('compare')}
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-all ${
              activeTab === 'compare' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>3. So Sánh Đội Chiếu</span>
          </button>
        </div>

        {/* View / Edit Mode Toggle (when on generated exam tab) */}
        {activeTab === 'generated' && exam && (
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setViewMode('view')}
              className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer transition-all ${
                viewMode === 'view' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem Đề</span>
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer transition-all ${
                viewMode === 'edit' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Chỉnh Sửa Đề</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab Panels */}

      {/* Tab 1: Source Content */}
      {activeTab === 'source' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-100 pb-2">
            Nội dung đề thi gốc đã trích xuất
          </h3>

          {source.textContent || source.htmlContent ? (
            <div className="prose max-w-none text-xs text-slate-800 leading-relaxed space-y-2 font-sans">
              {source.htmlContent ? (
                <div
                  className="mammoth-output border border-slate-100 p-4 rounded-xl bg-slate-50"
                  dangerouslySetInnerHTML={{ __html: source.htmlContent }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {source.textContent}
                </pre>
              )}
            </div>
          ) : source.fileData?.[0] ? (
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
              <p className="text-xs text-slate-700 font-semibold">
                Nguồn: {source.fileData[0].fileName} ({source.type.toUpperCase()})
              </p>
              <p className="text-xs text-slate-500">
                File nhị phân PDF/Ảnh được gửi trực tiếp lên Gemini API để AI tự đọc và sáng tạo.
              </p>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              Chưa có dữ liệu nguồn. Vui lòng nạp file Word/PDF/Ảnh ở cột bên trái.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Generated Exam */}
      {activeTab === 'generated' && (
        <>
          {!exam ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
              {/* Header */}
              <div className="text-center space-y-2 max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-100">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Sẵn sàng tạo đề thi & bài tập tương tự
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hệ thống hỗ trợ mọi môn học (Toán, Lý, Hóa, Sinh, Văn, Anh...) theo chương trình GDPT 2025. Vui lòng thực hiện theo các bước:
                </p>
              </div>

              {/* 3 Steps Guide Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-2 text-indigo-600">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">1</span>
                    <FileUp className="w-4 h-4" />
                    <span className="text-xs font-bold text-slate-800">Nạp đề bài</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Tải file Word (.docx), PDF, ảnh bài tập hoặc nhấn <strong className="text-slate-700">Ctrl+V</strong> để dán ảnh chụp màn hình.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-2 text-indigo-600">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">2</span>
                    <Sliders className="w-4 h-4" />
                    <span className="text-xs font-bold text-slate-800">Cấu hình đề</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Chọn sao chép 100% cấu trúc đề gốc hoặc chọn tạo bài tập tương tự từ ảnh, tùy chỉnh độ khó & TikZ.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-600">
                    <span className="w-6 h-6 rounded-lg bg-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center">3</span>
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">Bấm Tạo Đề</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    AI tự động thiết kế đề mới chuẩn xác, kèm hướng dẫn giải từng bước và xuất Word (.docx) chuẩn.
                  </p>
                </div>
              </div>

              {/* Feature Pills */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600">
                <span className="flex items-center space-x-1.5 bg-slate-100/80 px-3 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Xuất Word Equation chuẩn & MathType</span>
                </span>
                <span className="flex items-center space-x-1.5 bg-slate-100/80 px-3 py-1.5 rounded-lg">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Nhúng ảnh & hình vẽ trực tiếp vào file Word</span>
                </span>
                <span className="flex items-center space-x-1.5 bg-slate-100/80 px-3 py-1.5 rounded-lg">
                  <Shuffle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Trộn đề & hoán vị phương án A/B/C/D</span>
                </span>
              </div>
            </div>
          ) : viewMode === 'view' ? (
            <ExamViewer
              exam={exam}
              showAnswer={showAnswer}
              onToggleAnswer={onToggleAnswer}
              onChangeExam={onChangeExam}
              onEditQuestion={() => setViewMode('edit')}
              onAddToast={onAddToast}
            />
          ) : (
            <ExamEditor
              exam={exam}
              onChangeExam={onChangeExam}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              editModel={editModel}
              showAnswer={showAnswer}
              onToggleAnswer={onToggleAnswer}
              onAddToast={onAddToast}
            />
          )}
        </>
      )}

      {/* Tab 3: Side-by-side Compare */}
      {activeTab === 'compare' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column: Source */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase border-b border-slate-100 pb-2 flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Cột Trái: Đề Gốc Tham Chiếu</span>
            </h3>

            <div className="max-h-[600px] overflow-y-auto text-xs text-slate-800 p-2 bg-slate-50 rounded-xl space-y-2">
              {source.textContent ? (
                <p className="whitespace-pre-wrap font-sans leading-relaxed">{source.textContent}</p>
              ) : (
                <span className="text-slate-400 italic">Đang sử dụng dữ liệu file nhị phân PDF/Ảnh</span>
              )}
            </div>
          </div>

          {/* Right Column: Generated Exam */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-amber-700 uppercase border-b border-slate-100 pb-2 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Cột Phải: Đề Tương Tự Vừa Sinh</span>
            </h3>

            <div className="max-h-[600px] overflow-y-auto">
              {exam ? (
                <ExamViewer
                  exam={exam}
                  showAnswer={showAnswer}
                  onToggleAnswer={onToggleAnswer}
                />
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  Chưa có đề tương tự được sinh.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
