import React, { useRef, useEffect, useState } from 'react';
import { Question, QuestionType } from '../types';
import { Edit3, Copy, Trash2, GripVertical, CheckCircle2, XCircle, Code, HelpCircle, Image as ImageIcon, BarChart2, Loader2, Sparkles, RefreshCw, Eye, Cloud } from 'lucide-react';
import { extractAndCleanTikz } from '../lib/docxExporter';
import { extractAndParseTabular, extractAndGenerateStatisticalChart, svgStringToPngBase64 } from '../lib/tableAndChartHelper';
import { renderTikzToSvg, renderTikzToPng, renderTikzWithDetails, TikzEngine } from '../lib/tikzRenderer';
import { generateTikzFromQuestion, detectShapeType } from '../lib/gemini';

/**
 * Chuẩn hóa các công thức toán LaTeX hay bị lỗi hiển thị:
 * 1. Ký hiệu cung tròn: \wideparen{AB}, \overgroup{AB}, \arc{AB}, hoặc \wideparen AB -> \overset{\Large\frown}{AB}
 * 2. Số đo cung tròn: $sđ ...$ -> $\text{sđ} ...$
 */
export function normalizeMathLatex(text: string): string {
  if (!text) return '';
  // 1. Chuẩn hóa ký hiệu cung tròn có ngoặc hoặc không ngoặc
  let res = text.replace(/\\(?:wideparen|overgroup|arc)\s*(?:\{([^{}]+)\}|([A-Za-z0-9']+))/g, (_m, g1, g2) => {
    const content = (g1 || g2 || '').trim();
    return `\\overset{\\Large\\frown}{${content}}`;
  });

  // 2. Chuẩn hóa chữ sđ trong khối công thức toán $...$ nếu chưa có \text{}
  res = res.replace(/\$([^$]+)\$/g, (_match, mathContent) => {
    let m = mathContent.replace(/\\text\{\s*sđ\s*\}/g, '___TEXT_SD___');
    m = m.replace(/\bsđ\b|sđ/g, '\\text{sđ}');
    m = m.replace(/___TEXT_SD___/g, '\\text{sđ}');
    return `$${m}$`;
  });

  return res;
}

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

  // Trình biên tập & Render TikZ trực tiếp
  const [showTikzEditModal, setShowTikzEditModal] = useState(false);
  const [customTikzCode, setCustomTikzCode] = useState('');
  const [previewSvg, setPreviewSvg] = useState('');
  const [isCustomRendering, setIsCustomRendering] = useState(false);
  const [customRenderError, setCustomRenderError] = useState('');
  const [selectedEngine, setSelectedEngine] = useState<TikzEngine>('auto');

  // 1. Bóc tách TikZ khỏi nội dung câu hỏi
  const { cleanText: textNoTikz, tikzCode: extractedTikz } = extractAndCleanTikz(question.noiDung);
  const activeTikz = question.tikzCode || extractedTikz;

  // 2. Tự động nhận diện số liệu thống kê ghép nhóm để vẽ biểu đồ
  const { cleanText: textNoChart, chartSvg } = extractAndGenerateStatisticalChart(textNoTikz);

  // 3. Bóc tách bảng dữ liệu LaTeX \begin{tabular} để hiển thị thành bảng HTML chuẩn
  const { cleanText: promptTextNoTable, table: parsedTable } = extractAndParseTabular(textNoChart);

  // 4. Nội dung đề bài sạch sẽ, không còn mã LaTeX thô
  const cleanPrompt = normalizeMathLatex(
    promptTextNoTable
      .replace(/\\begin\{center\}/gi, '')
      .replace(/\\end\{center\}/gi, '')
      .replace(/!\[.*?\]\((data:image\/[^;]+;base64,[^)]+|https?:\/\/[^)]+)\)/g, '')
      .trim()
  );

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
    setRenderedTikzSvg(''); // Xóa ngay hình cũ để không bị nhầm lẫn giữa các câu

    renderTikzToSvg(activeTikz)
      .then(async (svg) => {
        if (!isMounted) return;
        if (svg) {
          setRenderedTikzSvg(svg);
          // Tự động chuyển đổi thành PNG base64 để nhúng vào Word
          const png = await svgStringToPngBase64(svg);
          if (png && isMounted) {
            question.hinhAnh = png;
          }
        } else {
          setRenderedTikzSvg('');
        }
      })
      .catch((err) => {
        console.warn('TikZ render error:', err);
        if (isMounted) setRenderedTikzSvg('');
      })
      .finally(() => {
        if (isMounted) setIsRenderingTikz(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTikz, question]);

  // Xóa hình vẽ khỏi câu hỏi
  const handleDeleteFigure = () => {
    question.tikzCode = '';
    question.hinhAnh = undefined;
    setRenderedTikzSvg('');
    if (onUpdateQuestion) {
      onUpdateQuestion({ ...question, tikzCode: '', hinhAnh: undefined });
    }
  };

  // Render lại 1-click từ mã TikZ hiện tại (Hỗ trợ chọn Engine: auto, texlive, kroki)
  const handleReRenderTikz = async (engine: TikzEngine = 'auto') => {
    if (!activeTikz) return;
    setIsRenderingTikz(true);
    setRenderedTikzSvg('');
    try {
      const result = await renderTikzWithDetails(activeTikz, engine);
      if (result.svg) {
        setRenderedTikzSvg(result.svg);
        const png = result.png || (await svgStringToPngBase64(result.svg));
        if (png) {
          question.hinhAnh = png;
          if (onUpdateQuestion) {
            onUpdateQuestion({ ...question, hinhAnh: png });
          }
        }
      } else {
        setRenderedTikzSvg('');
      }
    } catch (e) {
      console.warn('Re-render error:', e);
    } finally {
      setIsRenderingTikz(false);
    }
  };

  // Áp dụng mã TikZ từ modal biên tập trực tiếp
  const handleApplyCustomTikz = async () => {
    if (!customTikzCode.trim()) return;
    setIsCustomRendering(true);
    setCustomRenderError('');
    try {
      const result = await renderTikzWithDetails(customTikzCode, selectedEngine);
      if (result.svg) {
        setRenderedTikzSvg(result.svg);
        const png = result.png || (await svgStringToPngBase64(result.svg));
        question.tikzCode = customTikzCode;
        if (png) question.hinhAnh = png;
        if (onUpdateQuestion) {
          onUpdateQuestion({ ...question, tikzCode: customTikzCode, hinhAnh: png || undefined });
        }
        setShowTikzEditModal(false);
      } else {
        setCustomRenderError(result.error || 'Không kết xuất được hình ảnh từ mã TikZ này. Vui lòng kiểm tra lại cú pháp LaTeX.');
      }
    } catch (err: any) {
      setCustomRenderError(err.message || 'Lỗi khi kết xuất TikZ');
    } finally {
      setIsCustomRendering(false);
    }
  };

  // Xem trước hình kết xuất trong modal biên tập
  const handlePreviewCustomTikz = async () => {
    if (!customTikzCode.trim()) return;
    setIsCustomRendering(true);
    setCustomRenderError('');
    try {
      const result = await renderTikzWithDetails(customTikzCode, selectedEngine);
      if (result.svg) {
        setPreviewSvg(result.svg);
      } else {
        setCustomRenderError(result.error || 'Không kết xuất được hình ảnh xem trước. Vui lòng kiểm tra lại cú pháp.');
      }
    } catch (err: any) {
      setCustomRenderError(err.message || 'Lỗi khi kết xuất xem trước');
    } finally {
      setIsCustomRendering(false);
    }
  };

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
                <span className="flex-1">{normalizeMathLatex(opt.text)}</span>
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
              {normalizeMathLatex(question.cauLenh)}
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
                  <span>{normalizeMathLatex(item.text)}</span>
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
                Đáp án: {normalizeMathLatex(question.dapAn || 'Chưa có')}
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
            <div className="flex items-center space-x-1 flex-wrap gap-y-1">
              {/* Nút Sửa & Render trực tiếp từ mã TikZ hiện tại */}
              <button
                type="button"
                onClick={() => {
                  setCustomTikzCode(activeTikz || '');
                  setPreviewSvg('');
                  setCustomRenderError('');
                  setShowTikzEditModal(true);
                }}
                className="px-2 py-0.5 text-[10px] text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded font-medium transition-colors cursor-pointer flex items-center space-x-1"
                title="Xem hoặc chỉnh sửa mã TikZ này rồi kết xuất thành hình ngay"
              >
                <Code className="w-3 h-3" />
                <span>Sửa &amp; Render TikZ</span>
              </button>

              {/* Nút 1-click Re-render (Tự động) */}
              <button
                type="button"
                onClick={() => handleReRenderTikz('auto')}
                disabled={isRenderingTikz}
                className="px-2 py-0.5 text-[10px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded font-medium transition-colors cursor-pointer flex items-center space-x-1"
                title="Vẽ lại hình trực tiếp từ mã TikZ (Tự động Kroki + TeXLive.net)"
              >
                <RefreshCw className={`w-3 h-3 ${isRenderingTikz ? 'animate-spin' : ''}`} />
                <span>Render lại</span>
              </button>

              {/* Nút 1-click TeXLive.net */}
              <button
                type="button"
                onClick={() => handleReRenderTikz('texlive')}
                disabled={isRenderingTikz}
                className="px-2 py-0.5 text-[10px] text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded font-medium transition-colors cursor-pointer flex items-center space-x-1"
                title="Biên dịch chuẩn xác bằng máy chủ TeXLive.net"
              >
                <Cloud className="w-3 h-3 text-purple-600" />
                <span>☁️ TeXLive.net</span>
              </button>

              {/* Nút Sinh lại bằng AI */}
              <button
                type="button"
                onClick={() => setShowTikzAiModal(true)}
                className="px-2 py-0.5 text-[10px] text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded font-medium transition-colors cursor-pointer flex items-center space-x-1"
                title="Dùng AI sinh lại mã TikZ từ đề bài"
              >
                <Sparkles className="w-3 h-3" />
                <span>Sinh TikZ AI</span>
              </button>

              {/* Nút Sao chép TikZ */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeTikz);
                  setCopiedTikz(true);
                  setTimeout(() => setCopiedTikz(false), 2000);
                }}
                className="px-2 py-0.5 text-[10px] text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded font-medium transition-colors cursor-pointer"
                title="Sao chép mã LaTeX TikZ vào bộ nhớ đệm"
              >
                {copiedTikz ? '✓ Đã sao chép' : 'Sao chép TikZ'}
              </button>

              {/* Nút Xóa hình vẽ */}
              <button
                type="button"
                onClick={handleDeleteFigure}
                className="px-2 py-0.5 text-[10px] text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded font-medium transition-colors cursor-pointer flex items-center space-x-1"
                title="Xóa bỏ hình vẽ này khỏi câu hỏi"
              >
                <Trash2 className="w-3 h-3 text-rose-500" />
                <span>Xóa hình</span>
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
                <p>Hình vẽ chưa tải được hoặc mã TikZ đang cập nhật.</p>
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => handleReRenderTikz('auto')}
                    className="inline-flex items-center space-x-1 px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Render lại</span>
                  </button>
                  <button
                    onClick={() => handleReRenderTikz('texlive')}
                    className="inline-flex items-center space-x-1 px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors cursor-pointer"
                    title="Biên dịch chuẩn xác bằng TeXLive.net"
                  >
                    <Cloud className="w-3 h-3" />
                    <span>☁️ TeXLive.net</span>
                  </button>
                  <button
                    onClick={() => {
                      setCustomTikzCode(activeTikz || '');
                      setShowTikzEditModal(true);
                    }}
                    className="inline-flex items-center space-x-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-pointer"
                  >
                    <Code className="w-3 h-3" />
                    <span>Sửa &amp; Render</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Khung mã nguồn TikZ có thể đóng mở */}
          <details className="text-[11px] font-mono bg-slate-900 text-slate-100 rounded-lg p-2 overflow-x-auto">
            <summary className="cursor-pointer text-slate-400 font-sans text-[11px] pb-1 select-none hover:text-slate-200">
              Xem mã nguồn LaTeX TikZ
            </summary>
            <pre className="text-emerald-400 pt-1 border-t border-slate-800 whitespace-pre-wrap">{activeTikz}</pre>
          </details>
        </div>
      )}

      {/* Nút thêm hình khi câu hỏi chưa có hình */}
      {!activeTikz && (
        <div className="flex justify-end space-x-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setCustomTikzCode('');
              setPreviewSvg('');
              setCustomRenderError('');
              setShowTikzEditModal(true);
            }}
            className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer"
            title="Dán hoặc viết mã TikZ để kết xuất thành hình"
          >
            <Code className="w-3 h-3" />
            <span>+ Thêm/Dán mã TikZ</span>
          </button>
          <button
            type="button"
            onClick={() => setShowTikzAiModal(true)}
            className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors cursor-pointer"
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
              ➔ Đáp án: <span className="text-slate-900 font-semibold">{normalizeMathLatex(question.dapAn)}</span>
            </div>
          )}
          {question.huongDanGiai && (
            <div className="pt-1 text-[11px] text-slate-700 leading-relaxed border-t border-indigo-100/70">
              <span className="font-bold text-indigo-900">Lời giải chi tiết:</span>
              <div className="whitespace-pre-wrap mt-0.5">{normalizeMathLatex(question.huongDanGiai)}</div>
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
                      renderTikzWithDetails(newTikz).then(async (result) => {
                        if (result.svg) {
                          setRenderedTikzSvg(result.svg);
                          const png = await svgStringToPngBase64(result.svg);
                          if (png) {
                            question.hinhAnh = png;
                            if (onUpdateQuestion) {
                              onUpdateQuestion({ ...question, tikzCode: newTikz, hinhAnh: png });
                            }
                          }
                        } else {
                          setRenderedTikzSvg('');
                        }
                        setIsRenderingTikz(false);
                      }).catch(() => {
                        setRenderedTikzSvg('');
                        setIsRenderingTikz(false);
                      });
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

      {/* Modal: Biên tập & Kết xuất TikZ trực tiếp */}
      {showTikzEditModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowTikzEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 flex items-center space-x-2 text-base">
                <Code className="w-5 h-5 text-indigo-600" />
                <span>Biên tập &amp; Kết xuất TikZ trực tiếp</span>
              </h3>
              <button
                onClick={() => setShowTikzEditModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Instruction */}
            <p className="text-xs text-slate-500 leading-relaxed">
              Mã TikZ của câu hỏi đã được nạp sẵn. Bạn có thể kiểm tra, chỉnh sửa tọa độ, tên điểm hoặc dán mã TikZ mới, sau đó bấm <strong>"Render &amp; Áp dụng ngay"</strong> để vẽ thành hình.
            </p>

            {/* Code Editor Textarea */}
            <div className="flex-1 min-h-[220px] flex flex-col space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                <span className="font-semibold">Mã nguồn LaTeX TikZ:</span>
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                  <span className="text-[10px] text-slate-500 font-medium px-1">Máy chủ TeX:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedEngine('auto')}
                    className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors cursor-pointer ${
                      selectedEngine === 'auto'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Tự động dùng Kroki siêu tốc, tự chuyển TeXLive.net nếu cần"
                  >
                    ⚡ Tự động
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEngine('texlive')}
                    className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors cursor-pointer ${
                      selectedEngine === 'texlive'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Dùng máy chủ TeXLive.net (giống app TikZ -> Ảnh)"
                  >
                    ☁️ TeXLive.net
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEngine('kroki')}
                    className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors cursor-pointer ${
                      selectedEngine === 'kroki'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Dùng máy chủ Kroki TeX Engine"
                  >
                    Kroki TeX
                  </button>
                </div>
              </div>
              <textarea
                value={customTikzCode}
                onChange={(e) => setCustomTikzCode(e.target.value)}
                placeholder={"\\begin{tikzpicture}\n  \\draw[thick] (0,0) circle (2cm);\n\\end{tikzpicture}"}
                className="w-full flex-1 p-3 text-xs font-mono bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[180px]"
                rows={9}
              />
            </div>

            {/* Error Display */}
            {customRenderError && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                {customRenderError}
              </div>
            )}

            {/* Live Preview Box */}
            {previewSvg && (
              <div className="space-y-1 border border-slate-200 rounded-xl p-3 bg-slate-50 max-h-48 overflow-y-auto">
                <span className="text-[11px] font-semibold text-slate-700 block">Xem trước hình kết xuất (SVG):</span>
                <div
                  className="w-full flex justify-center overflow-x-auto bg-white p-3 rounded-lg border border-slate-100"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={handlePreviewCustomTikz}
                disabled={isCustomRendering || !customTikzCode.trim()}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isCustomRendering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                <span>Xem trước</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowTikzEditModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustomTikz}
                  disabled={isCustomRendering || !customTikzCode.trim()}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCustomRendering ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang kết xuất...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Render &amp; Áp dụng ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

