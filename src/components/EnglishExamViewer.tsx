import React, { useState, useRef } from 'react';
import { ExamData, Question, QuestionType } from '../types';
import { parseUnderlineTokens } from '../lib/docxExporter';
import { extractQuestionOptions } from '../lib/tableAndChartHelper';
import { Search, Eye, EyeOff, Printer, Edit3, BookOpen } from 'lucide-react';

interface EnglishExamViewerProps {
  exam: ExamData;
  showAnswer: boolean;
  onToggleAnswer: () => void;
  onEditQuestion?: (q: Question) => void;
  onAddToast?: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

/**
 * Làm sạch tiền tố câu như 'Câu 1:', '1.', '1:' trong nội dung câu hỏi
 */
function cleanQuestionPrompt(text: string): string {
  if (!text) return '';
  return text.replace(/^(?:câu\s*\d+[\.:\s]*|\d+[\.:\s]+)/i, '').trim();
}

export const EnglishExamViewer: React.FC<EnglishExamViewerProps> = ({
  exam,
  showAnswer,
  onToggleAnswer,
  onEditQuestion,
  onAddToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // In đề thi trực tiếp từ trình duyệt
  const handlePrint = () => {
    window.print();
    if (onAddToast) {
      onAddToast('info', 'Đang mở hộp thoại in đề thi A4...');
    }
  };

  // Gom toàn bộ câu hỏi và trích xuất đáp án
  const allQuestions = exam.phan.flatMap((p) => p.cauHoi);

  // Nhận diện các nhóm câu hỏi
  const phoneticsQuestions = allQuestions.filter((q) => q.stt <= 4);
  const useOfEnglishQuestions = allQuestions.filter((q) => q.stt >= 5 && q.stt <= 22);
  const readingQuestions = allQuestions.filter((q) => q.stt >= 23 && q.stt <= 32);
  const writingQuestions = allQuestions.filter((q) => q.stt >= 33);

  // Tách câu hỏi phần Reading
  const clozeQuestions = readingQuestions.filter((q) => q.stt >= 23 && q.stt <= 27);
  const tfQuestions = readingQuestions.filter((q) => {
    if (q.stt >= 28 && q.stt <= 30) return true;
    const { optionA, optionB } = extractQuestionOptions(q);
    const isTF =
      (optionA?.toLowerCase() === 'true' && optionB?.toLowerCase() === 'false') ||
      (optionA?.toLowerCase() === 't' && optionB?.toLowerCase() === 'f');
    return isTF || q.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI;
  });
  const rcQuestions = readingQuestions.filter((q) => q.stt >= 31 && q.stt <= 32);

  // Tìm các đoạn ghi chú / bài đọc chung trong các section
  const readingSection = exam.phan.find((p) => (p.ten || '').toLowerCase().includes('reading'));
  const readingGhiChu = readingSection?.ghiChu || '';

  let clozePassage = '';
  let rcPassage = '';
  if (readingGhiChu) {
    const part2Idx = readingGhiChu.search(/Part 2[.:]/i);
    if (part2Idx !== -1) {
      clozePassage = readingGhiChu.substring(0, part2Idx).trim();
      rcPassage = readingGhiChu.substring(part2Idx).trim();
    } else {
      clozePassage = readingGhiChu.trim();
    }
  }

  // Tách Dictionary Entry (khung từ điển) nếu có trong section Use of English
  const useSection = exam.phan.find((p) => (p.ten || '').toLowerCase().includes('use of english'));
  const useGhiChu = useSection?.ghiChu || '';

  // Kiểm tra bộ lọc tìm kiếm
  const matchesSearch = (text: string) => {
    if (!searchTerm) return true;
    return text.toLowerCase().includes(searchTerm.toLowerCase());
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar (no-print) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs no-print">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm kiếm từ khóa câu hỏi tiếng Anh..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 cursor-pointer transition-colors"
            title="In đề thi ra giấy A4"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>In đề (Ctrl+P)</span>
          </button>

          <button
            onClick={onToggleAnswer}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors ${
              showAnswer
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            {showAnswer ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-indigo-500" />}
            <span>{showAnswer ? 'Đang Hiện Đáp Án' : 'Xem Đáp Án'}</span>
          </button>
        </div>
      </div>

      {/* Printable Exam Paper Container (Mô phỏng tờ giấy thi A4 thực tế) */}
      <div
        ref={containerRef}
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
        className="bg-white border border-slate-300 rounded-xl p-6 sm:p-12 shadow-md space-y-6 print-container text-slate-900 text-[15px] leading-relaxed select-text"
      >
        {/* ==================================================================== */}
        {/* 1. HEADER 2 CỘT CHUẨN THỂ THỨC VĂN BẢN THI THCS/THPT                 */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-12 gap-4 pb-4 border-b-2 border-slate-900 items-start">
          {/* Cột trái: Đơn vị quản lý & Thông tin thí sinh */}
          <div className="col-span-5 text-left space-y-1">
            <div className="text-[13px] uppercase tracking-wide font-medium text-slate-700">
              {exam.meta.truong?.toUpperCase().includes('PHÒNG') ? 'SỞ GIÁO DỤC VÀ ĐÀO TẠO' : 'UBND PHƯỜNG BẾN CÁT'}
            </div>
            <div className="text-[14px] font-bold uppercase text-slate-900">
              {exam.meta.truong?.toUpperCase() || 'TRƯỜNG THCS LÊ QUÝ ĐÔN'}
            </div>
            <div className="text-[13.5px] pt-1">
              <span className="font-bold">Họ và tên:</span>{' '}
              <span className="text-slate-400 font-normal tracking-tighter">
                …………………………………………………………………
              </span>
            </div>
            <div className="text-[13.5px] flex items-center justify-between pr-2">
              <div>
                <span className="font-bold">Lớp:</span>{' '}
                <span className="text-slate-400 font-normal">
                  {exam.meta.khoi ? `${exam.meta.khoi}A……` : '6A……'}
                </span>
              </div>
              <div>
                <span className="font-bold">SBD:</span>{' '}
                <span className="text-slate-400 font-normal">…………………</span>
              </div>
            </div>
          </div>

          {/* Cột phải: Tiêu đề kỳ thi & Môn thi */}
          <div className="col-span-7 text-center space-y-0.5 pl-2 border-l border-slate-200 sm:border-l-0">
            <div className="text-[15px] font-bold uppercase tracking-wide text-slate-900">
              {exam.meta.tieuDe?.toUpperCase() || 'KIỂM TRA GIỮA HỌC KÌ II'}
            </div>
            <div className="text-[14px] font-bold uppercase text-slate-800">
              {exam.meta.namHoc ? `NĂM HỌC ${exam.meta.namHoc.toUpperCase()}` : 'NĂM HỌC 2025 - 2026'}
            </div>
            <div className="text-[14px] font-bold uppercase text-slate-900">
              MÔN: TIẾNG ANH - LỚP {exam.meta.khoi || '6'}
              {exam.meta.maDe ? ` (MÃ ĐỀ: ${exam.meta.maDe})` : ''}
            </div>
            <div className="text-[13px] font-medium text-slate-700">
              Thời gian làm bài: {exam.meta.thoiGian || 60} phút
            </div>
            <div className="text-[12px] italic text-slate-600">
              (Không kể thời gian giao phát đề)
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 2. PHẦN I. PHONETICS (Câu 1 - 4)                                     */}
        {/* ==================================================================== */}
        {phoneticsQuestions.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-[16px] font-bold uppercase tracking-wide text-slate-900">
              I. PHONETICS
            </div>

            {/* Lời dẫn phát âm */}
            <div className="italic text-[13.5px] text-slate-800 leading-normal">
              Mark the letter A, B, C or D on your answer sheet to indicate the word whose underlined part differs from the other three in pronunciation in each of the following questions.
            </div>

            {/* Câu 1 & 2 (Phát âm) */}
            <div className="space-y-1.5 pt-0.5">
              {phoneticsQuestions.filter((q) => q.stt <= 2).map((q) => {
                if (!matchesSearch(q.noiDung)) return null;
                const { optionA, optionB, optionC, optionD } = extractQuestionOptions(q);
                const opts = [
                  { key: 'A', text: optionA || '' },
                  { key: 'B', text: optionB || '' },
                  { key: 'C', text: optionC || '' },
                  { key: 'D', text: optionD || '' },
                ];
                return (
                  <div key={q.id} className="group relative flex items-baseline py-0.5 hover:bg-slate-50 rounded px-1 -mx-1">
                    <span className="font-bold mr-2 w-7 shrink-0">{q.stt}.</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-6 flex-1">
                      {opts.map((opt) => {
                        const isCorrect = showAnswer && q.dapAn?.toUpperCase() === opt.key;
                        const tokens = parseUnderlineTokens(opt.text);
                        return (
                          <div
                            key={opt.key}
                            className={`flex items-baseline space-x-1 ${
                              isCorrect ? 'text-emerald-800 font-bold bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-300' : ''
                            }`}
                          >
                            <span className="font-bold mr-1">{opt.key}.</span>
                            <span>
                              {tokens.map((tok, tIdx) => (
                                <span
                                  key={tIdx}
                                  className={tok.underline ? 'underline font-semibold decoration-2 decoration-slate-900' : ''}
                                >
                                  {tok.text}
                                </span>
                              ))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {onEditQuestion && (
                      <button
                        onClick={() => onEditQuestion(q)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-slate-400 hover:text-indigo-600 no-print"
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Lời dẫn trọng âm */}
            <div className="italic text-[13.5px] text-slate-800 leading-normal pt-2">
              Mark the letter A, B, C or D on your answer sheet to indicate the word that differs from the other three in the position of primary stress in each of the following questions.
            </div>

            {/* Câu 3 & 4 (Trọng âm) */}
            <div className="space-y-1.5 pt-0.5">
              {phoneticsQuestions.filter((q) => q.stt >= 3 && q.stt <= 4).map((q) => {
                if (!matchesSearch(q.noiDung)) return null;
                const { optionA, optionB, optionC, optionD } = extractQuestionOptions(q);
                const opts = [
                  { key: 'A', text: optionA || '' },
                  { key: 'B', text: optionB || '' },
                  { key: 'C', text: optionC || '' },
                  { key: 'D', text: optionD || '' },
                ];
                return (
                  <div key={q.id} className="group relative flex items-baseline py-0.5 hover:bg-slate-50 rounded px-1 -mx-1">
                    <span className="font-bold mr-2 w-7 shrink-0">{q.stt}.</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-6 flex-1">
                      {opts.map((opt) => {
                        const isCorrect = showAnswer && q.dapAn?.toUpperCase() === opt.key;
                        return (
                          <div
                            key={opt.key}
                            className={`flex items-baseline space-x-1 ${
                              isCorrect ? 'text-emerald-800 font-bold bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-300' : ''
                            }`}
                          >
                            <span className="font-bold mr-1">{opt.key}.</span>
                            <span>{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>
                    {onEditQuestion && (
                      <button
                        onClick={() => onEditQuestion(q)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-slate-400 hover:text-indigo-600 no-print"
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 3. PHẦN II. USE OF ENGLISH (Câu 5 - 22)                              */}
        {/* ==================================================================== */}
        {useOfEnglishQuestions.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="text-[16px] font-bold uppercase tracking-wide text-slate-900">
              II. USE OF ENGLISH
            </div>

            {/* Lời dẫn 1: Multiple Choice */}
            <div className="italic text-[13.5px] text-slate-800 leading-normal">
              Choose the best answer A, B, C or D.
            </div>

            {/* Câu 5 - 12 (Trắc nghiệm ngắn) */}
            <div className="space-y-2">
              {useOfEnglishQuestions.filter((q) => q.stt >= 5 && q.stt <= 12).map((q) => {
                if (!matchesSearch(q.noiDung)) return null;
                const { optionA, optionB, optionC, optionD, cleanNoiDung } = extractQuestionOptions(q);
                const opts = [
                  { key: 'A', text: optionA || '' },
                  { key: 'B', text: optionB || '' },
                  { key: 'C', text: optionC || '' },
                  { key: 'D', text: optionD || '' },
                ];
                return (
                  <div key={q.id} className="group py-0.5 space-y-1 hover:bg-slate-50 rounded px-1 -mx-1">
                    <div className="flex items-baseline">
                      <span className="font-bold mr-1.5 shrink-0">{q.stt}.</span>
                      <span className="flex-1">{cleanQuestionPrompt(cleanNoiDung)}</span>
                      {onEditQuestion && (
                        <button
                          onClick={() => onEditQuestion(q)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-slate-400 hover:text-indigo-600 no-print"
                          title="Chỉnh sửa câu hỏi"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {/* 4 phương án dàn 1 dòng ngang */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-5 sm:pl-6">
                      {opts.map((opt) => {
                        const isCorrect = showAnswer && q.dapAn?.toUpperCase() === opt.key;
                        return (
                          <div
                            key={opt.key}
                            className={`flex items-baseline space-x-1 ${
                              isCorrect ? 'text-emerald-800 font-bold bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-300' : ''
                            }`}
                          >
                            <span className="font-bold mr-1">{opt.key}.</span>
                            <span>{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lời dẫn 2: Exchanges (Câu 13 - 14) */}
            {useOfEnglishQuestions.some((q) => q.stt === 13 || q.stt === 14) && (
              <>
                <div className="italic text-[13.5px] text-slate-800 leading-normal pt-2">
                  Mark the letter A, B, C, or D to indicate the most suitable response to complete each of the following exchanges.
                </div>

                <div className="space-y-2">
                  {useOfEnglishQuestions.filter((q) => q.stt === 13 || q.stt === 14).map((q) => {
                    if (!matchesSearch(q.noiDung)) return null;
                    const { optionA, optionB, optionC, optionD, cleanNoiDung } = extractQuestionOptions(q);
                    const opts = [
                      { key: 'A', text: optionA || '' },
                      { key: 'B', text: optionB || '' },
                      { key: 'C', text: optionC || '' },
                      { key: 'D', text: optionD || '' },
                    ];
                    return (
                      <div key={q.id} className="group py-0.5 space-y-1 hover:bg-slate-50 rounded px-1 -mx-1">
                        <div className="flex items-baseline">
                          <span className="font-bold mr-1.5 shrink-0">{q.stt}.</span>
                          <span className="flex-1">{cleanQuestionPrompt(cleanNoiDung)}</span>
                          {onEditQuestion && (
                            <button
                              onClick={() => onEditQuestion(q)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-slate-400 hover:text-indigo-600 no-print"
                              title="Chỉnh sửa câu hỏi"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {/* 4 phương án dàn 2 dòng */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-5 sm:pl-6">
                          {opts.map((opt) => {
                            const isCorrect = showAnswer && q.dapAn?.toUpperCase() === opt.key;
                            return (
                              <div
                                key={opt.key}
                                className={`flex items-baseline space-x-1 ${
                                  isCorrect ? 'text-emerald-800 font-bold bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-300' : ''
                                }`}
                              >
                                <span className="font-bold mr-1">{opt.key}.</span>
                                <span>{opt.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Lời dẫn 3: Signs & Notices (Câu 15 - 16) */}
            {useOfEnglishQuestions.some((q) => q.stt === 15 || q.stt === 16) && (
              <>
                <div className="italic text-[13.5px] text-slate-800 leading-normal pt-2">
                  Look at the sign or the notice. Choose the best answer (A, B, C or D) for these questions.
                </div>

                <div className="space-y-3">
                  {useOfEnglishQuestions.filter((q) => q.stt === 15 || q.stt === 16).map((q) => {
                    if (!matchesSearch(q.noiDung)) return null;
                    const { optionA, optionB, optionC, optionD, cleanNoiDung } = extractQuestionOptions(q);
                    const opts = [
                      { key: 'A', text: optionA || '' },
                      { key: 'B', text: optionB || '' },
                      { key: 'C', text: optionC || '' },
                      { key: 'D', text: optionD || '' },
                    ];
                    return (
                      <div key={q.id} className="group py-1 space-y-1.5 hover:bg-slate-50 rounded px-1 -mx-1">
                        <div className="flex items-baseline">
                          <span className="font-bold mr-1.5 shrink-0">{q.stt}.</span>
                          <span className="flex-1">{cleanQuestionPrompt(cleanNoiDung)}</span>
                          {onEditQuestion && (
                            <button
                              onClick={() => onEditQuestion(q)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-slate-400 hover:text-indigo-600 no-print"
                              title="Chỉnh sửa câu hỏi"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Hình ảnh biển báo nếu có */}
                        {q.hinhAnh && (
                          <div className="pl-6 py-1">
                            <img src={q.hinhAnh} alt={`Sign ${q.stt}`} className="max-h-36 rounded border border-slate-300" />
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-5 sm:pl-6">
                          {opts.map((opt) => {
                            const isCorrect = showAnswer && q.dapAn?.toUpperCase() === opt.key;
                            return (
                              <div
                                key={opt.key}
                                className={`flex items-baseline space-x-1 ${
                                  isCorrect ? 'text-emerald-800 font-bold bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-300' : ''
                                }`}
                              >
                                <span className="font-bold mr-1">{opt.key}.</span>
                                <span>{opt.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Lời dẫn 4: Word Form (Câu 17 - 20) */}
            {useOfEnglishQuestions.some((q) => q.stt >= 17 && q.stt <= 20) && (
              <>
                <div className="italic text-[13.5px] text-slate-800 leading-normal pt-2">
                  Write the correct form of the words in brackets.
                </div>

                <div className="space-y-2">
                  {useOfEnglishQuestions.filter((q) => q.stt >= 17 && q.stt <= 20).map((q) => {
                    if (!matchesSearch(q.noiDung)) return null;
                    return (
                      <div key={q.id} className="group py-0.5 space-y-1 hover:bg-slate-50 rounded px-1 -mx-1">
                        <div className="flex items-baseline">
                          <span className="font-bold mr-1.5 shrink-0">{q.stt}.</span>
                          <span className="flex-1">{cleanQuestionPrompt(q.noiDung)}</span>
                          {onEditQuestion && (
                            <button
                              onClick={() => onEditQuestion(q)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-slate-400 hover:text-indigo-600 no-print"
                              title="Chỉnh sửa câu hỏi"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {showAnswer && q.dapAn && (
                          <div className="pl-6 text-[13px] text-emerald-800 font-semibold">
                            → Đáp án: <span className="underline">{q.dapAn}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Lời dẫn 5: Dictionary Entry & Câu 21 - 22 */}
            {useOfEnglishQuestions.some((q) => q.stt >= 21 && q.stt <= 22) && (
              <>
                <div className="italic text-[13.5px] text-slate-800 leading-normal pt-2">
                  Look at the entry of the word in a dictionary. Use what you can get from the entry to complete the sentences with no more than three words.
                </div>

                {/* Khung Từ Điển (Dictionary Box) */}
                {useGhiChu ? (
                  <div className="my-2 p-3.5 bg-slate-50 border border-slate-300 rounded-lg text-[13.5px] text-slate-800 whitespace-pre-wrap font-serif leading-relaxed shadow-2xs">
                    {useGhiChu}
                  </div>
                ) : (
                  <div className="my-2 p-3.5 bg-slate-50 border border-slate-300 rounded-lg text-[13.5px] text-slate-800 font-serif leading-relaxed italic shadow-2xs">
                    game /ɡeɪm/ noun<br />
                    1. [C] an activity or sport with rules in which people or teams compete against each other: a board game • computer games<br />
                    2. [U] the equipment used for playing a game: a set of games<br />
                    3. [U] video gaming as an entertainment: Playing games is popular among teenagers.
                  </div>
                )}

                <div className="space-y-2">
                  {useOfEnglishQuestions.filter((q) => q.stt >= 21 && q.stt <= 22).map((q) => {
                    if (!matchesSearch(q.noiDung)) return null;
                    return (
                      <div key={q.id} className="group py-0.5 space-y-1 hover:bg-slate-50 rounded px-1 -mx-1">
                        <div className="flex items-baseline">
                          <span className="font-bold mr-1.5 shrink-0">{q.stt}.</span>
                          <span className="flex-1">{cleanQuestionPrompt(q.noiDung)}</span>
                          {onEditQuestion && (
                            <button
                              onClick={() => onEditQuestion(q)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-slate-400 hover:text-indigo-600 no-print"
                              title="Chỉnh sửa câu hỏi"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {showAnswer && q.dapAn && (
                          <div className="pl-6 text-[13px] text-emerald-800 font-semibold">
                            → Đáp án: <span className="underline">{q.dapAn}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* 4. PHẦN III. READING (Câu 23 - 32)                                   */}
        {/* ==================================================================== */}
        {readingQuestions.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="text-[16px] font-bold uppercase tracking-wide text-slate-900">
              III. READING
            </div>

            {/* PART 1: Cloze Passage & Questions 23 - 27 */}
            <div className="space-y-2">
              <div className="italic text-[13.5px] text-slate-800 leading-normal">
                Part 1. Choose the word (A, B, C or D) that best fits each space in the following passage.
              </div>

              {/* Đoạn văn đọc điền từ Cloze */}
              {clozePassage && (
                <div className="my-2.5 p-3.5 bg-slate-50/80 border border-slate-200 rounded-lg text-[14px] text-slate-900 whitespace-pre-wrap font-serif leading-relaxed text-justify">
                  {clozePassage.replace(/^Part 1[.:\s]*/i, '')}
                </div>
              )}

              {/* Câu 23 - 27: Dàn ngang 4 phương án trên 1 dòng */}
              <div className="space-y-1.5">
                {clozeQuestions.map((q) => {
                  if (!matchesSearch(q.noiDung)) return null;
                  const { optionA, optionB, optionC, optionD } = extractQuestionOptions(q);
                  const opts = [
                    { key: 'A', text: optionA || '' },
                    { key: 'B', text: optionB || '' },
                    { key: 'C', text: optionC || '' },
                    { key: 'D', text: optionD || '' },
                  ];
                  return (
                    <div key={q.id} className="group flex items-baseline py-0.5 hover:bg-slate-50 rounded px-1 -mx-1">
                      <span className="font-bold mr-2 w-7 shrink-0">{q.stt}.</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-6 flex-1">
                        {opts.map((opt) => {
                          const isCorrect = showAnswer && q.dapAn?.toUpperCase() === opt.key;
                          return (
                            <div
                              key={opt.key}
                              className={`flex items-baseline space-x-1 ${
                                isCorrect ? 'text-emerald-800 font-bold bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-300' : ''
                              }`}
                            >
                              <span className="font-bold mr-1">{opt.key}.</span>
                              <span>{opt.text}</span>
                            </div>
                          );
                        })}
                      </div>
                      {onEditQuestion && (
                        <button
                          onClick={() => onEditQuestion(q)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-slate-400 hover:text-indigo-600 no-print"
                          title="Chỉnh sửa câu hỏi"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PART 2: Reading Comprehension & Questions 28 - 32 */}
            <div className="space-y-2.5 pt-3">
              <div className="italic text-[13.5px] text-slate-800 leading-normal">
                Part 2. Read the following cool facts. Decide whether the statements from 28 to 30 are True or False and choose the correct answer (A, B, C or D) to complete the statements in the question 31 and 32.
              </div>

              {/* Đoạn văn đọc hiểu hoàn chỉnh */}
              {rcPassage && (
                <div className="my-2.5 p-3.5 bg-slate-50/80 border border-slate-200 rounded-lg text-[14px] text-slate-900 whitespace-pre-wrap font-serif leading-relaxed text-justify">
                  {rcPassage.replace(/^Part 2[.:\s]*/i, '')}
                </div>
              )}

              {/* BẢNG TRUE / FALSE CHO CÂU 28 - 30 */}
              {tfQuestions.length > 0 && (
                <div className="overflow-x-auto my-3">
                  <table className="w-full border-collapse border border-slate-400 text-[14px]">
                    <thead>
                      <tr className="bg-slate-100/80">
                        <th className="border border-slate-400 p-2 text-left font-bold w-[82%]">
                          Statements
                        </th>
                        <th className="border border-slate-400 p-2 text-center font-bold w-[9%]">
                          T
                        </th>
                        <th className="border border-slate-400 p-2 text-center font-bold w-[9%]">
                          F
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tfQuestions.map((tfQ) => {
                        const rawDapAn = (tfQ.dapAn || '').trim().toUpperCase();
                        const isTrue = rawDapAn === 'T' || rawDapAn === 'A' || rawDapAn.includes('TRUE');
                        return (
                          <tr key={tfQ.id} className="hover:bg-slate-50/50">
                            <td className="border border-slate-400 p-2 text-slate-900">
                              <span className="font-bold mr-1.5">{tfQ.stt}.</span>
                              {cleanQuestionPrompt(tfQ.noiDung)}
                            </td>
                            <td className="border border-slate-400 p-2 text-center align-middle">
                              {showAnswer && isTrue ? (
                                <span className="inline-flex items-center justify-center font-bold text-emerald-700 text-sm">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-block w-4 h-4 border border-slate-400 rounded-xs text-[10px] text-transparent select-none">
                                  [ ]
                                </span>
                              )}
                            </td>
                            <td className="border border-slate-400 p-2 text-center align-middle">
                              {showAnswer && !isTrue ? (
                                <span className="inline-flex items-center justify-center font-bold text-rose-700 text-sm">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-block w-4 h-4 border border-slate-400 rounded-xs text-[10px] text-transparent select-none">
                                  [ ]
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Câu 31 - 32 (Trắc nghiệm đọc hiểu) */}
              <div className="space-y-2">
                {rcQuestions.map((q) => {
                  if (!matchesSearch(q.noiDung)) return null;
                  const { optionA, optionB, optionC, optionD, cleanNoiDung } = extractQuestionOptions(q);
                  const opts = [
                    { key: 'A', text: optionA || '' },
                    { key: 'B', text: optionB || '' },
                    { key: 'C', text: optionC || '' },
                    { key: 'D', text: optionD || '' },
                  ];
                  return (
                    <div key={q.id} className="group py-0.5 space-y-1 hover:bg-slate-50 rounded px-1 -mx-1">
                      <div className="flex items-baseline">
                        <span className="font-bold mr-1.5 shrink-0">{q.stt}.</span>
                        <span className="flex-1">{cleanQuestionPrompt(cleanNoiDung)}</span>
                        {onEditQuestion && (
                          <button
                            onClick={() => onEditQuestion(q)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-slate-400 hover:text-indigo-600 no-print"
                            title="Chỉnh sửa câu hỏi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-5 sm:pl-6">
                        {opts.map((opt) => {
                          const isCorrect = showAnswer && q.dapAn?.toUpperCase() === opt.key;
                          return (
                            <div
                              key={opt.key}
                              className={`flex items-baseline space-x-1 ${
                                isCorrect ? 'text-emerald-800 font-bold bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-300' : ''
                              }`}
                            >
                              <span className="font-bold mr-1">{opt.key}.</span>
                              <span>{opt.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 5. PHẦN IV. WRITING (Câu 33 - 40)                                    */}
        {/* ==================================================================== */}
        {writingQuestions.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="text-[16px] font-bold uppercase tracking-wide text-slate-900">
              IV. WRITING
            </div>

            {/* Lời dẫn viết lại câu */}
            <div className="italic text-[13.5px] text-slate-800 leading-normal">
              Rewrite each of the following sentences in another way so that it means almost the same as the sentence printed before it.
            </div>

            {/* Câu 33 - 40 */}
            <div className="space-y-2.5">
              {writingQuestions.map((q) => {
                if (!matchesSearch(q.noiDung)) return null;
                const promptLines = q.noiDung.split('\n').map((l) => l.trim()).filter(Boolean);
                const originalSentence = cleanQuestionPrompt(promptLines[0] || '');
                const rewritePrompt = promptLines.length > 1 ? promptLines[1] : '→ ';

                return (
                  <div key={q.id} className="group py-1 space-y-1 hover:bg-slate-50 rounded px-1 -mx-1">
                    <div className="flex items-baseline">
                      <span className="font-bold mr-1.5 shrink-0">{q.stt}.</span>
                      <span className="flex-1 font-medium">{originalSentence}</span>
                      {onEditQuestion && (
                        <button
                          onClick={() => onEditQuestion(q)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 text-slate-400 hover:text-indigo-600 no-print"
                          title="Chỉnh sửa câu hỏi"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Dòng viết lại câu có đường kẻ chấm dài */}
                    <div className="pl-5 sm:pl-6 text-slate-800 flex items-baseline">
                      <span>{rewritePrompt.startsWith('→') ? rewritePrompt : `→ ${rewritePrompt}`}</span>
                      <span className="text-slate-400 font-normal tracking-tighter flex-1 overflow-hidden whitespace-nowrap ml-1">
                        …………………………………………………………………………………………………………………………………………………………………………………………………………………………
                      </span>
                    </div>

                    {/* Hiển thị đáp án gợi ý khi bật showAnswer */}
                    {showAnswer && (
                      <div className="pl-5 sm:pl-6 text-[13.5px] text-emerald-800 font-semibold flex items-center gap-1">
                        <span>→ Đáp án:</span>
                        <span className="font-normal italic underline">
                          {q.dapAn || q.huongDanGiai || 'Hướng dẫn giải chi tiết...'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 6. BẢNG ĐÁP ÁN & HƯỚNG DẪN GIẢI Ở CUỐI ĐỀ (Khi bật showAnswer)        */}
        {/* ==================================================================== */}
        {showAnswer && (
          <div className="pt-8 mt-8 border-t-2 border-dashed border-slate-400 space-y-5">
            <div className="text-center space-y-1">
              <div className="text-[17px] font-bold uppercase tracking-wider text-emerald-900">
                ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT
              </div>
              <div className="text-[13px] italic text-slate-600">
                (Dành cho giáo viên chấm bài và đối chiếu đáp án)
              </div>
            </div>

            {/* Bảng tổng hợp đáp án các phần */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cột 1: Phonetics */}
              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/70 space-y-2">
                <div className="font-bold text-[14px] text-slate-900 border-b border-slate-200 pb-1 uppercase">
                  I. PHONETICS
                </div>
                <div className="grid grid-cols-2 gap-2 text-[13.5px]">
                  {phoneticsQuestions.map((q) => (
                    <div key={q.id} className="flex items-center space-x-1.5">
                      <span className="font-bold">{q.stt}.</span>
                      <span className="text-emerald-700 font-bold px-1.5 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                        {q.dapAn || 'A'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cột 2: Use of English */}
              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/70 space-y-2">
                <div className="font-bold text-[14px] text-slate-900 border-b border-slate-200 pb-1 uppercase">
                  II. USE OF ENGLISH
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[13px]">
                  {useOfEnglishQuestions.map((q) => (
                    <div key={q.id} className="flex items-center space-x-1 truncate">
                      <span className="font-bold shrink-0">{q.stt}.</span>
                      <span className="text-emerald-800 font-semibold truncate">
                        {q.dapAn || '...'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cột 3: Reading */}
              <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/70 space-y-2">
                <div className="font-bold text-[14px] text-slate-900 border-b border-slate-200 pb-1 uppercase">
                  III. READING
                </div>
                <div className="grid grid-cols-2 gap-2 text-[13.5px]">
                  {readingQuestions.map((q) => {
                    let ans = q.dapAn || '';
                    if (q.stt >= 28 && q.stt <= 30) {
                      ans = ans.toUpperCase().startsWith('T') || ans.toUpperCase() === 'A' ? 'True (T)' : 'False (F)';
                    }
                    return (
                      <div key={q.id} className="flex items-center space-x-1.5">
                        <span className="font-bold">{q.stt}.</span>
                        <span className="text-emerald-700 font-bold">
                          {ans}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Phần Writing */}
            {writingQuestions.length > 0 && (
              <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50/70 space-y-2">
                <div className="font-bold text-[14px] text-slate-900 border-b border-slate-200 pb-1 uppercase">
                  IV. WRITING (CÂU VIẾT LẠI HOÀN CHỈNH)
                </div>
                <div className="space-y-1.5 text-[13.5px]">
                  {writingQuestions.map((q) => (
                    <div key={q.id} className="flex items-baseline space-x-2">
                      <span className="font-bold shrink-0">{q.stt}.</span>
                      <span className="text-emerald-900 font-medium">
                        {q.dapAn || q.huongDanGiai || '...'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
