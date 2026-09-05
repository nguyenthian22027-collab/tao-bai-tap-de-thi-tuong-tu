import React, { useRef, useEffect, useState } from 'react';
import { Question, QuestionType } from '../types';
import { Edit3, Copy, Trash2, GripVertical, CheckCircle2, XCircle, Code, HelpCircle, Image as ImageIcon, BarChart2, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { extractAndCleanTikz } from '../lib/docxExporter';
import { extractAndParseTabular, extractAndGenerateStatisticalChart, svgStringToPngBase64 } from '../lib/tableAndChartHelper';
import { renderTikzToSvg, renderTikzToPng } from '../lib/tikzRenderer';
import { generateTikzFromQuestion, detectShapeType } from '../lib/gemini';

interface QuestionCardProps {
  question: Question;
  index: number;
  onEdit: (q: Question) => void;
  onDelete: (id: string) => void;
  onCopyLatex: (text: string, stt: number) => void;
  showAnswer: boolean;
  isDragHandle?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onUpdateQuestion?: (q: Question) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  onEdit,
  onDelete,
  onCopyLatex,
  showAnswer,
  onDragStart,
  onDragOver,
  onDrop,
  onUpdateQuestion,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Trigger MathJax render when question content changes
  useEffect(() => {
    if (window.MathJax?.typesetPromise && cardRef.current) {
      window.MathJax.typesetPromise([cardRef.current]).catch((e) =>
        console.error('MathJax card error:', e)
      );
    }
  }, [
    question.noiDung,
    question.optionA,
    question.optionB,
    question.optionC,
    question.optionD,
    question.menhDeA,
    question.menhDeB,
    question.menhDeC,
    question.menhDeD,
    question.dapAn,
    question.loai,
  ]);

  const getBloomBadge = (level?: string) => {
    switch (level) {
      case 'nhan_biet':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded">Nhận biết</span>;
      case 'thong_hieu':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded">Thông hiểu</span>;
      case 'van_dung':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded">Vận dụng</span>;
      case 'van_dung_cao':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-semibold px-2 py-0.5 rounded">Vận dụng cao</span>;
      default:
        return null;
    }
  };

  const getTypeBadge = () => {
    switch (question.loai) {
      case QuestionType.TRAC_NGHIEM_DUNG_SAI:
      case 'dung_sai' as any:
        return <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded">Đúng / Sai</span>;
      case QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN:
      case 'tra_loi_ngan' as any:
        return <span className="bg-cyan-100 text-cyan-800 border border-cyan-200 text-[10px] font-bold px-2 py-0.5 rounded">Trả lời ngắn</span>;
      case QuestionType.TU_LUAN:
      case 'tu_luan' as any:
        return <span className="bg-orange-100 text-orange-800 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded">Tự luận</span>;
      case QuestionType.TRAC_NGHIEM_4_LUA_CHON:
      case 'trac_nghiem' as any:
      default:
        return <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded">4 Lựa chọn</span>;
    }
  };

  const getRawLatexText = () => {
    let text = `Câu ${question.stt}: ${question.noiDung}\n`;
    if (question.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI || (question.loai as any) === 'dung_sai') {
      if (question.menhDeA) text += `a) ${question.menhDeA} (${question.dapAnA || ''})\n`;
      if (question.menhDeB) text += `b) ${question.menhDeB} (${question.dapAnB || ''})\n`;
      if (question.menhDeC) text += `c) ${question.menhDeC} (${question.dapAnC || ''})\n`;
      if (question.menhDeD) text += `d) ${question.menhDeD} (${question.dapAnD || ''})\n`;
    } else if (question.loai === QuestionType.TRAC_NGHIEM_4_LUA_CHON || (question.loai as any) === 'trac_nghiem') {
      if (question.optionA) text += `A. ${question.optionA}\n`;
      if (question.optionB) text += `B. ${question.optionB}\n`;
      if (question.optionC) text += `C. ${question.optionC}\n`;
      if (question.optionD) text += `D. ${question.optionD}\n`;
      text += `Đáp án: ${question.dapAn}\n`;
    } else {
      text += `Đáp án / Lời giải: ${question.dapAn}\n`;
    }
    if (question.huongDanGiai) {
      text += `Hướng dẫn giải: ${question.huongDanGiai}\n`;
    }
    if (question.tikzCode) {
      text += `TikZ Code:\n${question.tikzCode}\n`;
    }
    return text;
  };

  const isDungSai = question.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI || (question.loai as any) === 'dung_sai';
  const isTraLoiNgan = question.loai === QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN || (question.loai as any) === 'tra_loi_ngan';
  const isTuLuan = question.loai === QuestionType.TU_LUAN || (question.loai as any) === 'tu_luan';
  const is4LuaChon = !isDungSai && !isTraLoiNgan && !isTuLuan;
  const [copiedTikz, setCopiedTikz] = useState(false);
  const [showTikzAiModal, setShowTikzAiModal] = useState(false);
  const [tikzAiDescription, setTikzAiDescription] = useState('');
  const [isGeneratingTikz, setIsGeneratingTikz] = useState(false);
  const [tikzAiError, setTikzAiError] = useState('');

  // 1. Bóc tách TikZ khỏi nội dung câu hỏi
  const { cleanText: textNoTikz, tikzCode: extractedTikz } = extractAndCleanTikz(question.noiDung);
  const activeTikz = question.tikzCode || extractedTikz;

  // 2. Tự động nhận diện số liệu thống kê ghép nhóm để vẽ biểu đồ
  const { cleanText: textNoChart, chartSvg } = extractAndGenerateStatisticalChart(textNoTikz);

  // 3. Bóc tách bảng dữ liệu LaTeX \begin{tabular} để hiển thị thành bảng HTML chuẩn
  const { cleanText: promptTextNoTable, table: parsedTable } = extractAndParseTabular(textNoChart);

  // 4. Nội dung đề bài sạch sẽ, không còn mã LaTeX thô
  const cleanPrompt = promptTextNoTable
    .replace(/\\begin\{center\}/gi, '')
    .replace(/\\end\{center\}/gi, '')
    .replace(/!\[.*?\]\((data:image\/[^;]+;base64,[^)]+|https?:\/\/[^)]+)\)/g, '')
    .trim();

  // Tự động chuyển đổi biểu đồ SVG thành ảnh PNG để nhúng vào file Word
  useEffect(() => {
    if (chartSvg && !question.hinhAnh) {
      svgStringToPngBase64(chartSvg).then((png) => {
        if (png) {
          question.hinhAnh = png;
        }
      });
    }
  }, [chartSvg, question]);

  const [renderedTikzSvg, setRenderedTikzSvg] = useState<string>('');
  const [isRenderingTikz, setIsRenderingTikz] = useState<boolean>(false);

  // Kích hoạt render TikZ sang SVG sắc nét
  useEffect(() => {
    if (!activeTikz) {
      setRenderedTikzSvg('');
      return;
    }

    let isMounted = true;
    setIsRenderingTikz(true);

    renderTikzToSvg(activeTikz)
      .then(async (svg) => {
        if (!isMounted) return;
        if (svg) {
          setRenderedTikzSvg(svg);
          // Tự động chuyển đổi thành PNG base64 để nhúng vào Word
          if (!question.hinhAnh) {
            const png = await svgStringToPngBase64(svg);
            if (png && isMounted) {
              question.hinhAnh = png;
            }
          }
        }
      })
      .catch((err) => {
        console.warn('TikZ render error:', err);
      })
      .finally(() => {
        if (isMounted) setIsRenderingTikz(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTikz, question]);

  return (
    <div
      ref={cardRef}
      data-question-id={question.id}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="group relative bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs hover:shadow-md transition-all space-y-3 cursor-grab active:cursor-grabbing"
    >
      {/* Top row: STT, Type badge, Bloom badge, Actions */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
          <span className="font-bold text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
            Câu {question.stt}
          </span>
          {getTypeBadge()}
          {getBloomBadge(question.mucDo)}
          {question.diem && (
            <span className="text-[11px] text-slate-500 italic">({question.diem} điểm)</span>
          )}
        </div>

        {/* Hover Action Toolbar */}
        <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onEdit(question)}
            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
            title="Chỉnh sửa câu hỏi"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onCopyLatex(getRawLatexText(), question.stt)}
            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
            title="Sao chép dạng LaTeX"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(question.id)}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
            title="Xóa câu"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Question Main Prompt Content */}
      <div className="text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
        {cleanPrompt}
      </div>

      {/* Bảng dữ liệu số liệu (Bảng tần số, bảng phân bố...) */}
      {parsedTable && (
        <div className="overflow-x-auto my-2 rounded-lg border border-slate-200 shadow-2xs">
          <table className="min-w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-800 font-bold">
                {parsedTable.headers.map((h, i) => (
                  <th key={i} className="py-2 px-3 border-r last:border-r-0 border-slate-200 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsedTable.rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b last:border-b-0 border-slate-200 hover:bg-slate-50/80">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-1.5 px-3 border-r last:border-r-0 border-slate-200 text-slate-700 font-medium">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Biểu đồ thống kê tần số tự động vẽ (như hình minh họa) */}
      {chartSvg && (
        <div className="flex flex-col items-center justify-center p-3 bg-slate-50/80 border border-slate-200 rounded-xl overflow-hidden my-2 space-y-1.5 shadow-2xs">
          <div
            className="w-full flex justify-center overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: chartSvg }}
          />
          <span className="text-[10px] text-slate-500 italic">
            (Hình minh họa: Biểu đồ tần số tương đối ghép nhóm)
          </span>
        </div>
      )}

      {/* Question Illustration Image (chỉ render nếu đề gốc có ảnh và câu KHÔNG có TikZ) */}
      {(question.hinhAnh || question.noiDung.match(/!\[.*?\]\((data:image\/[^;]+;base64,[^)]+|https?:\/\/[^)]+)\)/)?.[1]) && !activeTikz && !chartSvg && (
        <div className="flex justify-center p-2 bg-slate-50/80 border border-slate-100 rounded-xl overflow-hidden">
          <img
            src={question.hinhAnh || question.noiDung.match(/!\[.*?\]\((data:image\/[^;]+;base64,[^)]+|https?:\/\/[^)]+)\)/)?.[1]}
            alt={`Hình minh họa câu ${question.stt}`}
            className="max-h-64 max-w-full object-contain rounded-lg shadow-2xs"
          />
        </div>
      )}

      {/* DẠNG 1: Trắc nghiệm 4 lựa chọn (A, B, C, D) */}
      {is4LuaChon && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
          {[
            { key: 'A', text: question.optionA },
            { key: 'B', text: question.optionB },
            { key: 'C', text: question.optionC },
            { key: 'D', text: question.optionD },
          ].map((opt) => {
            if (!opt.text) return null;
            const isCorrect = (question.dapAn || '').trim().toUpperCase() === opt.key;

            return (
              <div
                key={opt.key}
                className={`p-2 rounded-lg border flex items-start space-x-1.5 transition-colors ${
                  showAnswer && isCorrect
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                    : 'bg-slate-50/70 border-slate-200 text-slate-800'
                }`}
              >
                <span className="font-bold text-indigo-900 shrink-0">{opt.key}.</span>
                <span className="flex-1">{opt.text}</span>
                {showAnswer && isCorrect && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DẠNG 2: Trắc nghiệm Đúng / Sai (1 đề chung + câu lệnh hỏi + 4 mệnh đề a, b, c, d) */}
      {isDungSai && (
        <div className="space-y-1.5 pt-1 text-xs">
          {question.cauLenh && (
            <div className="text-xs font-medium text-slate-700 italic border-l-2 border-indigo-300 pl-2 mb-1">
              {question.cauLenh}
            </div>
          )}
          {!question.cauLenh && (
            <div className="text-[11px] font-semibold text-slate-500 mb-1">Các mệnh đề xét tính Đúng / Sai:</div>
          )}
          {[
            { key: 'a', text: question.menhDeA || question.optionA, ans: question.dapAnA },
            { key: 'b', text: question.menhDeB || question.optionB, ans: question.dapAnB },
            { key: 'c', text: question.menhDeC || question.optionC, ans: question.dapAnC },
            { key: 'd', text: question.menhDeD || question.optionD, ans: question.dapAnD },
          ].map((item) => {
            if (!item.text) return null;
            const isDung = item.ans === 'Đ' || item.ans === 'D' || item.ans?.toLowerCase() === 'đúng' || item.ans?.toLowerCase() === 'true';

            return (
              <div
                key={item.key}
                className={`p-2 rounded-lg border flex items-center justify-between space-x-2 transition-colors ${
                  showAnswer
                    ? isDung
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : 'bg-slate-50/70 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-start space-x-2 flex-1">
                  <span className="font-bold text-purple-900">{item.key})</span>
                  <span>{item.text}</span>
                </div>

                {showAnswer && (
                  <div className="shrink-0 font-bold text-xs flex items-center space-x-1">
                    {isDung ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>ĐÚNG</span>
                      </span>
                    ) : (
                      <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded flex items-center space-x-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>SAI</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}


      {/* DẠNG 3: Trắc nghiệm Trả lời ngắn */}
      {isTraLoiNgan && (
        <div className="p-2.5 bg-cyan-50/60 border border-cyan-200 rounded-lg text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-cyan-900">Trả lời ngắn (Điền kết quả):</span>
            {showAnswer && (
              <span className="font-bold text-xs bg-white text-cyan-800 border border-cyan-300 px-2.5 py-0.5 rounded-md shadow-2xs">
                Đáp án: {question.dapAn || 'Chưa có'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* DẠNG 4: Tự luận */}
      {isTuLuan && !showAnswer && (
        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 italic">
          (Học sinh trình bày bài giải tự luận vào giấy làm bài)
        </div>
      )}

      {/* TikZ Graphic Render Box (Tự động vẽ đồ thị / hình học) */}
      {activeTikz && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
            <span className="flex items-center space-x-1.5 text-indigo-700">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Hình vẽ TikZ (Đồ thị / Hình học):</span>
            </span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setShowTikzAiModal(true)}
                className="px-2 py-0.5 text-[10px] text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded font-medium transition-colors cursor-pointer flex items-center space-x-1"
                title="Dùng AI sinh lại mã TikZ chính xác hơn"
              >
                <Sparkles className="w-3 h-3" />
                <span>Sinh TikZ AI</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeTikz);
                  setCopiedTikz(true);
                  setTimeout(() => setCopiedTikz(false), 2000);
                }}
                className="px-2 py-0.5 text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded font-medium transition-colors cursor-pointer"
              >
                {copiedTikz ? '✓ Đã sao chép' : 'Sao chép TikZ'}
              </button>
            </div>
          </div>

          {/* TikZ Container: Hiển thị trực tiếp hình vẽ vector SVG chuẩn */}
          <div className="tikz-container flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl overflow-x-auto min-h-[80px] shadow-2xs">
            {isRenderingTikz && (
              <div className="flex items-center space-x-2 text-xs text-indigo-600 font-medium py-4">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Đang kết xuất hình vẽ (TeX Engine)...</span>
              </div>
            )}
            {!isRenderingTikz && renderedTikzSvg && (
              <div
                className="w-full flex justify-center overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: renderedTikzSvg }}
              />
            )}
            {!isRenderingTikz && !renderedTikzSvg && (
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 text-center w-full space-y-2">
                <p>Hình vẽ chưa tải được. Hãy thử bấm <strong>Sinh TikZ AI</strong> để AI vẽ lại.</p>
                <button
                  onClick={() => setShowTikzAiModal(true)}
                  className="inline-flex items-center space-x-1 px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Sinh TikZ AI</span>
                </button>
              </div>
            )}
          </div>

          {/* Khung mã nguồn TikZ có thể đóng mở */}
          <details className="text-[11px] font-mono bg-slate-900 text-slate-100 rounded-lg p-2 overflow-x-auto">
            <summary className="cursor-pointer text-slate-400 font-sans text-[11px] pb-1 select-none hover:text-slate-200">
              Xem mã nguồn LaTeX TikZ
            </summary>
            <pre className="text-emerald-400 pt-1 border-t border-slate-800">{activeTikz}</pre>
          </details>
        </div>
      )}

      {/* Nút Sinh TikZ AI khi chưa có hình */}
      {!activeTikz && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowTikzAiModal(true)}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-[11px] text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors cursor-pointer"
            title="Dùng AI sinh mã TikZ cho câu hỏi này"
          >
            <Sparkles className="w-3 h-3" />
            <span>Sinh TikZ AI</span>
          </button>
        </div>
      )}

      {/* Answer / Detailed Explanation (if toggled on) */}
      {showAnswer && (question.dapAn || question.huongDanGiai) && (
        <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-lg text-xs text-indigo-950 space-y-1">
          {question.dapAn && !isDungSai && (
            <div className="font-bold text-indigo-800">
              ➔ Đáp án: <span className="text-slate-900 font-semibold">{question.dapAn}</span>
            </div>
          )}
          {question.huongDanGiai && (
            <div className="pt-1 text-[11px] text-slate-700 leading-relaxed border-t border-indigo-100/70">
              <span className="font-bold text-indigo-900">Lời giải chi tiết:</span>
              <div className="whitespace-pre-wrap mt-0.5">{question.huongDanGiai}</div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Sinh TikZ AI */}
      {showTikzAiModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTikzAiModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>Sinh Mã TikZ bằng AI</span>
              </h3>
              <button onClick={() => setShowTikzAiModal(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none cursor-pointer">✕</button>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed border border-slate-200 max-h-32 overflow-y-auto">
              <strong className="text-slate-800">Đề bài:</strong>{' '}
              {question.noiDung}
            </div>
            {/* Shape type detection badge */}
            {(() => {
              const shapeType = detectShapeType(question.noiDung);
              const shapeLabels: Record<string, { label: string; color: string }> = {
                cone: { label: '🔺 Hình nón', color: 'bg-red-50 text-red-700 border-red-200' },
                box: { label: '📦 Hình hộp / Lập phương', color: 'bg-stone-100 text-stone-700 border-stone-300' },
                circle: { label: '🔵 Đường tròn', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                circle_triangle: { label: '🔵📐 Đường tròn + Tam giác', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
                cylinder: { label: '🛢️ Hình trụ', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                sphere: { label: '🔮 Hình cầu', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                pyramid: { label: '🔺 Hình chóp', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                prism: { label: '📦 Lăng trụ 3D', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                function_graph: { label: '📈 Đồ thị hàm số', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                variation_table: { label: '📊 Bảng biến thiên', color: 'bg-teal-50 text-teal-700 border-teal-200' },
                angle_lines: { label: '📐 Góc & Đường thẳng', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                triangle: { label: '📐 Tam giác', color: 'bg-sky-50 text-sky-700 border-sky-200' },
                quadrilateral: { label: '🔲 Tứ giác', color: 'bg-slate-100 text-slate-700 border-slate-300' },
                coordinate: { label: '📍 Hệ tọa độ', color: 'bg-rose-50 text-rose-700 border-rose-200' },
                generic: { label: '✏️ Hình học tổng quát', color: 'bg-slate-50 text-slate-600 border-slate-200' },
              };
              const info = shapeLabels[shapeType] || shapeLabels['generic'];
              return (
                <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${info.color}`}>
                  <span>🤖 AI nhận dạng loại hình:</span>
                  <span className="font-bold">{info.label}</span>
                </div>
              );
            })()}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Mô tả thêm về hình vẽ cần vẽ (tuỳ chọn):</label>
              <textarea
                value={tikzAiDescription}
                onChange={(e) => setTikzAiDescription(e.target.value)}
                placeholder="VD: Đường tròn tâm O, bán kính R=3. Dây AB song song CD. Điểm E ngoài đường tròn..."
                className="w-full h-24 text-xs p-3 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            {tikzAiError && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">{tikzAiError}</div>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowTikzAiModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                disabled={isGeneratingTikz}
                onClick={async () => {
                  setIsGeneratingTikz(true);
                  setTikzAiError('');
                  try {
                    const fullQuestionPrompt = [
                      question.noiDung,
                      question.cauLenh,
                      question.menhDeA ? `a) ${question.menhDeA}` : '',
                      question.menhDeB ? `b) ${question.menhDeB}` : '',
                      question.menhDeC ? `c) ${question.menhDeC}` : '',
                      question.menhDeD ? `d) ${question.menhDeD}` : '',
                      question.optionA ? `A. ${question.optionA}` : '',
                      question.optionB ? `B. ${question.optionB}` : '',
                      question.optionC ? `C. ${question.optionC}` : '',
                      question.optionD ? `D. ${question.optionD}` : '',
                    ].filter(Boolean).join('\n');

                    const newTikz = await generateTikzFromQuestion(fullQuestionPrompt, tikzAiDescription);
                    if (newTikz) {
                      question.tikzCode = newTikz;
                      question.hinhAnh = undefined;
                      if (onUpdateQuestion) {
                        onUpdateQuestion({ ...question, tikzCode: newTikz, hinhAnh: undefined });
                      }
                      setTikzAiDescription('');
                      setShowTikzAiModal(false);
                      // Force re-render of TikZ
                      setRenderedTikzSvg('');
                      setIsRenderingTikz(true);
                      renderTikzToSvg(newTikz).then(async (svg) => {
                        if (svg) {
                          setRenderedTikzSvg(svg);
                          const png = await svgStringToPngBase64(svg);
                          if (png) {
                            question.hinhAnh = png;
                            if (onUpdateQuestion) {
                              onUpdateQuestion({ ...question, tikzCode: newTikz, hinhAnh: png });
                            }
                          }
                        }
                        setIsRenderingTikz(false);
                      }).catch(() => setIsRenderingTikz(false));
                    } else {
                      setTikzAiError('AI không trả về mã TikZ hợp lệ. Thử lại với mô tả chi tiết hơn.');
                    }
                  } catch (err: any) {
                    setTikzAiError(`Lỗi: ${err.message || 'Không kết nối được AI'}`);
                  } finally {
                    setIsGeneratingTikz(false);
                  }
                }}
                className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingTikz ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang sinh TikZ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Sinh TikZ AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

