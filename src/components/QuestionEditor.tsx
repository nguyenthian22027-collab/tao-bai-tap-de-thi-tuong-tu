import React, { useState, useEffect, useRef } from 'react';
import { Question, QuestionType } from '../types';
import { parseMixedContent } from '../lib/latexUtils';
import { callGeminiRoundRobin } from '../lib/gemini';
import { X, Save, Bot, Eye, HelpCircle, CheckCircle, Code, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';

interface QuestionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question;
  onSave: (updatedQ: Question) => void;
  editModel: string;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  isOpen,
  onClose,
  question,
  onSave,
  editModel,
  onAddToast,
}) => {
  const [qData, setQData] = useState<Question>({ ...question });
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQData({ ...question });
  }, [question]);

  // Handle Ctrl+V paste image from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const base64 = evt.target?.result as string;
            setQData((prev) => ({ ...prev, hinhAnh: base64 }));
            onAddToast('success', '✓ Đã dán ảnh minh họa từ bộ nhớ tạm (Clipboard)!');
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setQData((prev) => ({ ...prev, hinhAnh: base64 }));
      onAddToast('success', `✓ Đã đính kèm ảnh: ${file.name}`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Debounced MathJax re-typeset preview
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (window.MathJax?.typesetPromise && previewRef.current) {
        window.MathJax.typesetPromise([previewRef.current]).catch((err) =>
          console.error('MathJax error:', err)
        );
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    isOpen,
    qData.noiDung,
    qData.optionA,
    qData.optionB,
    qData.optionC,
    qData.optionD,
    qData.menhDeA,
    qData.menhDeB,
    qData.menhDeC,
    qData.menhDeD,
    qData.dapAn,
    qData.huongDanGiai,
    qData.hinhAnh,
  ]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(qData);
    onAddToast('success', `Đã lưu thay đổi cho Câu ${qData.stt}`);
    onClose();
  };

  const handleAiRefine = async () => {
    if (!aiPrompt.trim()) {
      onAddToast('warning', 'Vui lòng nhập yêu cầu cho AI (VD: Làm câu này khó hơn)');
      return;
    }

    setIsAiRefining(true);
    try {
      const prompt = `Bạn là trợ lý giảng dạy. Hãy chỉnh sửa câu hỏi sau theo yêu cầu: "${aiPrompt}".
CÂU HỎI HIỆN TẠI:
Loại: ${qData.loai}
Nội dung: ${qData.noiDung}
Phương án A: ${qData.optionA || ''}
Phương án B: ${qData.optionB || ''}
Phương án C: ${qData.optionC || ''}
Phương án D: ${qData.optionD || ''}
Mệnh đề a: ${qData.menhDeA || ''} (Đáp án: ${qData.dapAnA || ''})
Mệnh đề b: ${qData.menhDeB || ''} (Đáp án: ${qData.dapAnB || ''})
Mệnh đề c: ${qData.menhDeC || ''} (Đáp án: ${qData.dapAnC || ''})
Mệnh đề d: ${qData.menhDeD || ''} (Đáp án: ${qData.dapAnD || ''})
Đáp án: ${qData.dapAn || ''}
Lời giải: ${qData.huongDanGiai || ''}

YÊU CẦU ĐỊNH DẠNG TRẢ VỀ:
Trả về duy nhất theo định dạng này (Không thêm lời chào):
NOI_DUNG: [Nội dung mới, LaTeX trong $...]
A: [Đáp án A mới nếu là 4 lựa chọn]
B: [Đáp án B mới nếu là 4 lựa chọn]
C: [Đáp án C mới nếu là 4 lựa chọn]
D: [Đáp án D mới nếu là 4 lựa chọn]
MENH_DE_A: [Mệnh đề a nếu là Đúng/Sai]
DAP_AN_A: [Đ hoặc S]
MENH_DE_B: [Mệnh đề b nếu là Đúng/Sai]
DAP_AN_B: [Đ hoặc S]
MENH_DE_C: [Mệnh đề c nếu là Đúng/Sai]
DAP_AN_C: [Đ hoặc S]
MENH_DE_D: [Mệnh đề d nếu là Đúng/Sai]
DAP_AN_D: [Đ hoặc S]
DAP_AN: [Đáp án]
HUONG_DAN_GIAI: [Lời giải chi tiết]
`;

      const responseText = await callGeminiRoundRobin(prompt, editModel);

      // Simple parser for response
      const lines = responseText.split('\n');
      const updated = { ...qData };

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('NOI_DUNG:')) updated.noiDung = trimmed.slice(9).trim();
        else if (trimmed.startsWith('A:')) updated.optionA = trimmed.slice(2).trim();
        else if (trimmed.startsWith('B:')) updated.optionB = trimmed.slice(2).trim();
        else if (trimmed.startsWith('C:')) updated.optionC = trimmed.slice(2).trim();
        else if (trimmed.startsWith('D:')) updated.optionD = trimmed.slice(2).trim();
        else if (trimmed.startsWith('MENH_DE_A:')) updated.menhDeA = trimmed.slice(10).trim();
        else if (trimmed.startsWith('DAP_AN_A:')) updated.dapAnA = trimmed.slice(9).trim();
        else if (trimmed.startsWith('MENH_DE_B:')) updated.menhDeB = trimmed.slice(10).trim();
        else if (trimmed.startsWith('DAP_AN_B:')) updated.dapAnB = trimmed.slice(9).trim();
        else if (trimmed.startsWith('MENH_DE_C:')) updated.menhDeC = trimmed.slice(10).trim();
        else if (trimmed.startsWith('DAP_AN_C:')) updated.dapAnC = trimmed.slice(9).trim();
        else if (trimmed.startsWith('MENH_DE_D:')) updated.menhDeD = trimmed.slice(10).trim();
        else if (trimmed.startsWith('DAP_AN_D:')) updated.dapAnD = trimmed.slice(9).trim();
        else if (trimmed.startsWith('DAP_AN:')) updated.dapAn = trimmed.slice(7).trim();
        else if (trimmed.startsWith('HUONG_DAN_GIAI:')) updated.huongDanGiai = trimmed.slice(15).trim();
      });

      setQData(updated);
      setAiPrompt('');
      setShowAiInput(false);
      onAddToast('success', '✓ AI đã chỉnh sửa câu hỏi theo yêu cầu!');
    } catch (err: any) {
      onAddToast('error', `Lỗi AI: ${err.message}`);
    } finally {
      setIsAiRefining(false);
    }
  };

  const isDungSai = qData.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI || (qData.loai as any) === 'dung_sai';
  const isTraLoiNgan = qData.loai === QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN || (qData.loai as any) === 'tra_loi_ngan';
  const isTuLuan = qData.loai === QuestionType.TU_LUAN || (qData.loai as any) === 'tu_luan';
  const is4LuaChon = !isDungSai && !isTraLoiNgan && !isTuLuan;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in no-print">
      <div
        onPaste={handlePaste}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">
              {qData.stt}
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Chỉnh Sửa Câu {qData.stt}
              </h3>
              <span className="text-[11px] text-slate-500">
                Định dạng chuẩn chương trình GDPT 2025
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={qData.loai}
              onChange={(e) => setQData({ ...qData, loai: e.target.value as QuestionType })}
              className="text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-indigo-900 focus:ring-2 focus:ring-indigo-500"
            >
              <option value={QuestionType.TRAC_NGHIEM_4_LUA_CHON}>Phần I: 4 Lựa chọn</option>
              <option value={QuestionType.TRAC_NGHIEM_DUNG_SAI}>Phần II: Đúng / Sai</option>
              <option value={QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN}>Phần III: Trả lời ngắn</option>
              <option value={QuestionType.TU_LUAN}>Phần IV: Tự luận</option>
            </select>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Question Text & Realtime Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Nội dung câu hỏi chung (hỗ trợ LaTeX $...$):
              </label>
              <textarea
                rows={5}
                value={qData.noiDung}
                onChange={(e) => setQData({ ...qData, noiDung: e.target.value })}
                className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center space-x-1">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Xem trước công thức MathJax:</span>
              </label>
              <div
                ref={previewRef}
                className="p-3 text-xs border border-dashed border-indigo-200 rounded-xl bg-indigo-50/30 min-h-[110px] max-h-[160px] space-y-2 overflow-y-auto text-slate-800"
              >
                <p className="font-semibold text-indigo-900">Câu {qData.stt}: {qData.noiDung}</p>
                {qData.hinhAnh && (
                  <div className="flex justify-center p-1.5 bg-white rounded-lg border border-indigo-100 my-1">
                    <img src={qData.hinhAnh} alt="Xem trước ảnh" className="max-h-24 object-contain rounded" />
                  </div>
                )}
                {is4LuaChon && (
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-700 pt-1 border-t border-indigo-100">
                    <div>A. {qData.optionA}</div>
                    <div>B. {qData.optionB}</div>
                    <div>C. {qData.optionC}</div>
                    <div>D. {qData.optionD}</div>
                  </div>
                )}
                {isDungSai && (
                  <div className="space-y-1 text-[11px] text-slate-700 pt-1 border-t border-indigo-100">
                    <div>a) {qData.menhDeA} [{qData.dapAnA || '?'}]</div>
                    <div>b) {qData.menhDeB} [{qData.dapAnB || '?'}]</div>
                    <div>c) {qData.menhDeC} [{qData.dapAnC || '?'}]</div>
                    <div>d) {qData.menhDeD} [{qData.dapAnD || '?'}]</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DẠNG 1: 4 LỰA CHỌN */}
          {is4LuaChon && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-700 block">
                Các phương án lựa chọn (Chọn radio trước đáp án đúng):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'A', field: 'optionA' },
                  { key: 'B', field: 'optionB' },
                  { key: 'C', field: 'optionC' },
                  { key: 'D', field: 'optionD' },
                ].map((opt) => (
                  <div
                    key={opt.key}
                    className={`flex items-center space-x-2 p-2 border rounded-xl transition-colors ${
                      (qData.dapAn || '').trim().toUpperCase() === opt.key ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="correct_ans_4"
                      checked={(qData.dapAn || '').trim().toUpperCase() === opt.key}
                      onChange={() => setQData({ ...qData, dapAn: opt.key })}
                      className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="font-bold text-xs text-slate-700 w-4">{opt.key}.</span>
                    <input
                      type="text"
                      value={(qData as any)[opt.field] || ''}
                      onChange={(e) => setQData({ ...qData, [opt.field]: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DẠNG 2: ĐÚNG / SAI (4 MỆNH ĐỀ a, b, c, d) */}
          {isDungSai && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-700 block">
                Nội dung 4 Mệnh đề và lựa chọn Đúng / Sai:
              </span>
              <div className="space-y-2">
                {[
                  { key: 'a', textField: 'menhDeA', ansField: 'dapAnA' },
                  { key: 'b', textField: 'menhDeB', ansField: 'dapAnB' },
                  { key: 'c', textField: 'menhDeC', ansField: 'dapAnC' },
                  { key: 'd', textField: 'menhDeD', ansField: 'dapAnD' },
                ].map((m) => {
                  const currentAns = ((qData as any)[m.ansField] || '').toUpperCase();
                  const isD = currentAns === 'Đ' || currentAns === 'D' || currentAns === 'TRUE';
                  const isS = currentAns === 'S' || currentAns === 'SAI' || currentAns === 'FALSE';

                  return (
                    <div key={m.key} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-3">
                      <span className="font-bold text-sm text-purple-900 w-5">{m.key})</span>
                      <input
                        type="text"
                        placeholder={`Nội dung mệnh đề ${m.key}...`}
                        value={(qData as any)[m.textField] || ''}
                        onChange={(e) => setQData({ ...qData, [m.textField]: e.target.value })}
                        className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
                      />
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setQData({ ...qData, [m.ansField]: 'Đ' })}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                            isD ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50'
                          }`}
                        >
                          Đúng
                        </button>
                        <button
                          type="button"
                          onClick={() => setQData({ ...qData, [m.ansField]: 'S' })}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                            isS ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-rose-50'
                          }`}
                        >
                          Sai
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DẠNG 3: TRẢ LỜI NGẮN */}
          {isTraLoiNgan && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="font-semibold text-slate-700 block">
                Kết quả / Đáp án ngắn (VD: 12, -3/4, 5.2):
              </label>
              <input
                type="text"
                placeholder="Nhập giá trị đáp án..."
                value={qData.dapAn || ''}
                onChange={(e) => setQData({ ...qData, dapAn: e.target.value })}
                className="w-full max-w-sm px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* LỜI GIẢI CHI TIẾT */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="font-semibold text-slate-700 block">
              Hướng dẫn giải chi tiết (LaTeX $...$):
            </label>
            <textarea
              rows={3}
              value={qData.huongDanGiai || (isTuLuan ? qData.dapAn : '') || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (isTuLuan) {
                  setQData({ ...qData, huongDanGiai: val, dapAn: val });
                } else {
                  setQData({ ...qData, huongDanGiai: val });
                }
              }}
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 font-sans"
            />
          </div>

          {/* TikZ Code Box if present or wanted */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="font-semibold text-slate-700 flex items-center space-x-1">
              <Code className="w-3.5 h-3.5 text-indigo-600" />
              <span>Mã TikZ LaTeX (tùy chọn):</span>
            </label>
            <textarea
              rows={2}
              placeholder="\begin{tikzpicture} ... \end{tikzpicture}"
              value={qData.tikzCode || ''}
              onChange={(e) => setQData({ ...qData, tikzCode: e.target.value })}
              className="w-full p-2 text-xs font-mono border border-slate-300 rounded-xl bg-slate-900 text-emerald-400 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* HÌNH ẢNH MINH HỌA CÂU HỎI */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 flex items-center space-x-1.5 text-xs">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Hình ảnh minh họa câu hỏi:</span>
              </label>
              <span className="text-[10px] text-slate-400">
                (Hỗ trợ chọn file hoặc bấm Ctrl+V để dán ảnh)
              </span>
            </div>

            {qData.hinhAnh ? (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={qData.hinhAnh}
                    alt="Xem trước ảnh"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-2xs"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">Đã đính kèm ảnh minh họa</span>
                    <span className="text-[10px] text-emerald-600 font-medium">✓ Sẽ được xuất trực tiếp vào file Word</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    Thay ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQData({ ...qData, hinhAnh: undefined });
                      onAddToast('info', 'Đã xóa ảnh minh họa câu hỏi');
                    }}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Xóa ảnh này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => imageInputRef.current?.click()}
                className="p-3 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl bg-slate-50/60 hover:bg-indigo-50/30 flex items-center justify-center space-x-2 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium">
                  Nhấn để tải ảnh lên hoặc bấm Ctrl+V để dán ảnh trực tiếp
                </span>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageFileChange}
            />
          </div>

          {/* Metadata: Bloom & Score */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Mức độ tư duy:</label>
              <select
                value={qData.mucDo || 'thong_hieu'}
                onChange={(e) => setQData({ ...qData, mucDo: e.target.value as any })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="nhan_biet">Nhận biết</option>
                <option value="thong_hieu">Thông hiểu</option>
                <option value="van_dung">Vận dụng</option>
                <option value="van_dung_cao">Vận dụng cao</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Điểm số câu này:</label>
              <input
                type="number"
                step="0.1"
                value={qData.diem || ''}
                onChange={(e) => setQData({ ...qData, diem: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          {/* AI Refinement Section */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-900 flex items-center space-x-1">
                <Bot className="w-4 h-4 text-indigo-600" />
                <span>Yêu cầu AI chỉnh sửa câu này</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAiInput(!showAiInput)}
                className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer"
              >
                {showAiInput ? 'Thu gọn' : 'Mở công cụ AI 🤖'}
              </button>
            </div>

            {showAiInput && (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="VD: Đổi số liệu thành số nguyên đẹp, nâng độ khó câu hỏi..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAiRefine}
                  disabled={isAiRefining}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg shadow-xs flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>{isAiRefining ? 'AI đang viết lại...' : 'Gửi yêu cầu AI'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Lưu Thay Đổi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
