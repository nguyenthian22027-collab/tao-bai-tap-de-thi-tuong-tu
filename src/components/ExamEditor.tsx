import React, { useState } from 'react';
import { ExamData, Question, QuestionType } from '../types';
import { QuestionCard } from './QuestionCard';
import { QuestionEditor } from './QuestionEditor';
import { Plus, Undo2, Redo2, Eye, EyeOff } from 'lucide-react';

interface ExamEditorProps {
  exam: ExamData;
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

export const ExamEditor: React.FC<ExamEditorProps> = ({
  exam,
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
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [draggedQId, setDraggedQId] = useState<string | null>(null);

  const handleEditClick = (q: Question) => {
    setEditingQuestion(q);
  };

  const handleSaveQuestion = (updatedQ: Question) => {
    const updatedSections = exam.phan.map((section) => {
      const qIdx = section.cauHoi.findIndex((q) => q.id === updatedQ.id);
      if (qIdx === -1) return section;

      const newQuestions = [...section.cauHoi];
      newQuestions[qIdx] = updatedQ;
      return { ...section, cauHoi: newQuestions };
    });

    onChangeExam({ ...exam, phan: updatedSections });
  };

  const handleDeleteQuestion = (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;

    let globalCount = 1;
    const updatedSections = exam.phan.map((section) => {
      const filtered = section.cauHoi.filter((q) => q.id !== id);
      const renumbered = filtered.map((q) => ({
        ...q,
        stt: globalCount++,
      }));
      return { ...section, cauHoi: renumbered };
    });

    onChangeExam({ ...exam, phan: updatedSections });
    onAddToast('info', 'Đã xóa câu hỏi khỏi đề');
  };

  const handleAddQuestion = (loai: QuestionType) => {
    const sectionIndex = exam.phan.findIndex((p) => p.loai === loai);
    const targetSection = sectionIndex !== -1 ? exam.phan[sectionIndex] : exam.phan[0];

    if (!targetSection) return;

    const totalQuestionsCount = exam.phan.reduce((acc, p) => acc + p.cauHoi.length, 0);
    const isDungSai = loai === QuestionType.TRAC_NGHIEM_DUNG_SAI;
    const isTraLoiNgan = loai === QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN;
    const isTuLuan = loai === QuestionType.TU_LUAN;
    const is4LuaChon = !isDungSai && !isTraLoiNgan && !isTuLuan;

    const newQ: Question = {
      id: `q_new_${Date.now()}`,
      stt: totalQuestionsCount + 1,
      loai,
      noiDung: 'Nhập nội dung câu hỏi mới tại đây...',
      optionA: is4LuaChon ? 'Phương án A' : undefined,
      optionB: is4LuaChon ? 'Phương án B' : undefined,
      optionC: is4LuaChon ? 'Phương án C' : undefined,
      optionD: is4LuaChon ? 'Phương án D' : undefined,
      menhDeA: isDungSai ? 'Mệnh đề a...' : undefined,
      dapAnA: isDungSai ? 'D' : undefined,
      menhDeB: isDungSai ? 'Mệnh đề b...' : undefined,
      dapAnB: isDungSai ? 'S' : undefined,
      menhDeC: isDungSai ? 'Mệnh đề c...' : undefined,
      dapAnC: isDungSai ? 'D' : undefined,
      menhDeD: isDungSai ? 'Mệnh đề d...' : undefined,
      dapAnD: isDungSai ? 'S' : undefined,
      dapAn: is4LuaChon ? 'A' : isTraLoiNgan ? '0' : 'Hướng dẫn giải mẫu...',
      mucDo: 'thong_hieu',
      diem: is4LuaChon ? 0.25 : isDungSai ? 1.0 : isTraLoiNgan ? 0.5 : 1.0,
    };

    let globalCount = 1;
    const updatedSections = exam.phan.map((section) => {
      let questions = [...section.cauHoi];
      if (section.loai === loai) {
        questions.push(newQ);
      }
      return {
        ...section,
        cauHoi: questions.map((q) => ({ ...q, stt: globalCount++ })),
      };
    });

    onChangeExam({ ...exam, phan: updatedSections });
    setEditingQuestion(newQ);
    onAddToast('success', `Đã thêm câu ${newQ.stt} mới`);
  };

  // Drag & drop reordering handlers
  const handleDragStart = (id: string) => {
    setDraggedQId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetQId: string) => {
    if (!draggedQId || draggedQId === targetQId) return;

    // Flatten all questions, reorder, then reassign to sections
    let allQuestions = exam.phan.flatMap((p) => p.cauHoi);
    const fromIdx = allQuestions.findIndex((q) => q.id === draggedQId);
    const toIdx = allQuestions.findIndex((q) => q.id === targetQId);

    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...allQuestions];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Renumber sequentially
    let globalCount = 1;
    const renumbered = reordered.map((q) => ({ ...q, stt: globalCount++ }));

    // Distribute back to sections
    const updatedSections = exam.phan.map((section) => {
      const sectionQs = renumbered.filter((q) => q.loai === section.loai);
      return { ...section, cauHoi: sectionQs };
    });

    onChangeExam({ ...exam, phan: updatedSections });
    setDraggedQId(null);
    onAddToast('info', 'Đã đổi vị trí câu hỏi');
  };

  const handleCopyLatex = (text: string, stt: number) => {
    navigator.clipboard.writeText(text);
    onAddToast('success', `✓ Đã copy LaTeX Câu ${stt} vào Clipboard!`);
  };

  return (
    <div className="space-y-4">
      {/* Undo/Redo & Answer Toggle Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs no-print">
        <div className="flex items-center space-x-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer disabled:opacity-40"
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Hoàn tác</span>
          </button>

          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer disabled:opacity-40"
            title="Làm lại (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span>Làm lại</span>
          </button>
        </div>

        <button
          onClick={onToggleAnswer}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors ${
            showAnswer
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
          }`}
        >
          {showAnswer ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
          <span>{showAnswer ? 'Hiện Đáp Án' : 'Ẩn Đáp Án'}</span>
        </button>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {exam.phan.map((section, sIdx) => (
          <div key={sIdx} className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                {section.ten || (section.loai === 'trac_nghiem' ? 'PHẦN I. TRẮC NGHIỆM' : 'PHẦN II. TỰ LUẬN')}
              </h3>
              <button
                onClick={() => handleAddQuestion(section.loai)}
                className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm câu {section.loai === 'trac_nghiem' ? 'trắc nghiệm' : 'tự luận'}</span>
              </button>
            </div>

            <div className="space-y-3">
              {section.cauHoi.map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={idx}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteQuestion}
                  onCopyLatex={handleCopyLatex}
                  showAnswer={showAnswer}
                  onDragStart={() => handleDragStart(q.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(q.id)}
                  onUpdateQuestion={handleSaveQuestion}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Question Editor Modal */}
      {editingQuestion && (
        <QuestionEditor
          isOpen={!!editingQuestion}
          onClose={() => setEditingQuestion(null)}
          question={editingQuestion}
          onSave={handleSaveQuestion}
          editModel={editModel}
          onAddToast={onAddToast}
        />
      )}
    </div>
  );
};
