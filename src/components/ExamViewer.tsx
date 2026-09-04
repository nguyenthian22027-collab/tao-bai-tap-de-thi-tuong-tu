import React, { useRef, useEffect, useState } from 'react';
import { ExamData, Question } from '../types';
import { Search, Eye, EyeOff } from 'lucide-react';
import { QuestionCard } from './QuestionCard';

interface ExamViewerProps {
  exam: ExamData;
  showAnswer: boolean;
  onToggleAnswer: () => void;
  onChangeExam?: (newExam: ExamData) => void;
  onEditQuestion?: (q: Question) => void;
  onAddToast?: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const ExamViewer: React.FC<ExamViewerProps> = ({
  exam,
  showAnswer,
  onToggleAnswer,
  onChangeExam,
  onEditQuestion,
  onAddToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.MathJax?.typesetPromise && containerRef.current) {
      window.MathJax.typesetPromise([containerRef.current]).catch((e) =>
        console.error('MathJax viewer error:', e)
      );
    }
  }, [exam, showAnswer, searchTerm]);

  const handleCopyLatex = (latex: string, stt: number) => {
    navigator.clipboard.writeText(latex);
    if (onAddToast) {
      onAddToast('success', `✓ Đã sao chép LaTeX câu ${stt}!`);
    }
  };

  const handleUpdateQuestion = (updatedQ: Question) => {
    if (!onChangeExam) return;
    const updatedSections = exam.phan.map((section) => {
      const qIdx = section.cauHoi.findIndex((q) => q.id === updatedQ.id);
      if (qIdx === -1) return section;

      const newQuestions = [...section.cauHoi];
      newQuestions[qIdx] = updatedQ;
      return { ...section, cauHoi: newQuestions };
    });

    onChangeExam({ ...exam, phan: updatedSections });
  };

  return (
    <div className="space-y-4">
      {/* Search & Answer Toggle Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs no-print">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm kiếm từ khóa câu hỏi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={onToggleAnswer}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors ${
            showAnswer
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
          }`}
        >
          {showAnswer ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
          <span>{showAnswer ? 'Đang Hiện Đáp Án' : 'Xem Đáp Án'}</span>
        </button>
      </div>

      {/* Printable Exam Paper Document Container */}
      <div
        ref={containerRef}
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm space-y-6 print-container"
      >
        {/* Exam Header Header */}
        <div className="text-center space-y-1 pb-4 border-b-2 border-slate-900">
          {exam.meta.truong && (
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {exam.meta.truong}
            </h3>
          )}
          <h1 className="text-lg sm:text-xl font-bold font-sora text-slate-900 uppercase">
            {exam.meta.tieuDe || 'ĐỀ KIỂM TRA TƯƠNG TỰ'}
          </h1>
          <div className="text-xs text-slate-600 font-medium flex items-center justify-center space-x-2">
            <span>Môn: {exam.meta.mon}</span>
            <span>•</span>
            <span>Lớp: {exam.meta.lop}</span>
            <span>•</span>
            <span>Thời gian: {exam.meta.thoiGian || 90} phút</span>
          </div>
        </div>

        {/* Sections */}
        {exam.phan.map((section, sIdx) => {
          const matchingQuestions = section.cauHoi.filter((q) =>
            searchTerm
              ? q.noiDung.toLowerCase().includes(searchTerm.toLowerCase())
              : true
          );

          if (searchTerm && matchingQuestions.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-1">
                {section.ten || (section.loai === 'trac_nghiem' ? 'PHẦN I. TRẮC NGHIỆM' : 'PHẦN II. TỰ LUẬN')}
              </h2>

              <div className="space-y-3">
                {matchingQuestions.map((q, qIdx) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={qIdx}
                    onEdit={onEditQuestion || (() => {})}
                    onDelete={() => {}}
                    onCopyLatex={handleCopyLatex}
                    showAnswer={showAnswer}
                    onUpdateQuestion={handleUpdateQuestion}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

