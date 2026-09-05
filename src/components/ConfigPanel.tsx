import React from 'react';
import { ConfigState } from '../types';
import { Sliders, Copy, Clock, Sparkles, FileSpreadsheet, Wand2, ShieldCheck, Compass, Code } from 'lucide-react';

interface ConfigPanelProps {
  config: ConfigState;
  onChangeConfig: (c: ConfigState) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onChangeConfig }) => {
  return (
    <div className="panel-card p-4 sm:p-5 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2 min-w-0">
          <Sliders className="w-4 h-4 text-indigo-600 shrink-0" />
          <h2 className="text-sm font-bold text-slate-900 truncate">Cấu Hình Sinh Đề / Bài Tập</h2>
        </div>

        {/* Mode Selector Pill */}
        <div className="flex flex-wrap p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px] sm:text-xs font-semibold">
          <button
            type="button"
            onClick={() => onChangeConfig({ ...config, mode: 'nguyen_de' })}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              config.mode === 'nguyen_de'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Nguyên đề thi
          </button>
          <button
            type="button"
            onClick={() => onChangeConfig({ ...config, mode: 'cau_le' })}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              config.mode === 'cau_le'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🎯 Câu lẻ / 1-2 bài
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODE 1: NGUYÊN ĐỀ THI (Hỗ trợ mọi môn học & Tùy chọn y hệt đề gốc) */}
      {/* ========================================================= */}
      {config.mode === 'nguyen_de' && (
        <div className="space-y-4 animate-fade-in">
          {/* CẤU TRÚC ĐỀ THI SELECTOR (Y HỆT ĐỀ GỐC vs TÙY CHỈNH MA TRẬN) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-600" />
              <span>Chế độ cấu trúc đề thi:</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeConfig({ ...config, cautrucDe: 'y_het_goc' })}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-start space-x-2 ${
                  config.cautrucDe === 'y_het_goc'
                    ? 'bg-indigo-50/80 border-indigo-500 text-indigo-950 ring-1 ring-indigo-500 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Wand2 className={`w-4 h-4 shrink-0 mt-0.5 ${config.cautrucDe === 'y_het_goc' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <span className="text-xs font-bold block">✨ Tạo y hệt cấu trúc đề gốc</span>
                  <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                    Tự động phân tích mọi môn (Toán, Văn, Anh, Sử, Địa...), giữ 100% số phần & câu hỏi
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onChangeConfig({ ...config, cautrucDe: 'ma_tran_tuy_chinh' })}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-start space-x-2 ${
                  config.cautrucDe === 'ma_tran_tuy_chinh'
                    ? 'bg-indigo-50/80 border-indigo-500 text-indigo-950 ring-1 ring-indigo-500 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet className={`w-4 h-4 shrink-0 mt-0.5 ${config.cautrucDe === 'ma_tran_tuy_chinh' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <span className="text-xs font-bold block">📊 Tùy chỉnh số câu theo ma trận</span>
                  <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                    Tự đặt số câu Phần I (4 lựa chọn), Phần II (Đúng/Sai), Phần III (Trả lời ngắn), Tự luận
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* ĐỘ KHÓ & TIKZ & MỨC ĐỘ TƯƠNG TỰ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            {/* Độ khó đề thi */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Độ khó đề thi:
              </label>
              <select
                value={config.doKho}
                onChange={(e) => onChangeConfig({ ...config, doKho: e.target.value as any })}
                className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="tuong_duong">⚖️ Tương đương đề gốc</option>
                <option value="de_hon">🟢 Dễ hơn (Nhẹ nhàng hơn)</option>
                <option value="kho_hon">🔴 Khó hơn (Nhiều bước suy luận)</option>
                <option value="nang_cao">🔥 Nâng cao (Phân loại HSG)</option>
              </select>
            </div>

            {/* Vẽ hình TikZ */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                <Code className="w-3.5 h-3.5 text-indigo-600" />
                <span>Vẽ hình TikZ (cho câu có hình):</span>
              </label>
              <select
                value={config.tikzMode}
                onChange={(e) => onChangeConfig({ ...config, tikzMode: e.target.value as any })}
                className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="auto">✨ Tự động vẽ hình cho câu có hình/đồ thị</option>
                <option value="yes">🎨 Bắt buộc sinh code TikZ</option>
                <option value="no">🚫 Không tạo hình TikZ</option>
              </select>
            </div>
          </div>

          {/* Số đề cần tạo & Thời gian làm bài */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                <Copy className="w-3.5 h-3.5 text-indigo-600" />
                <span>Số lượng đề tương tự cần tạo:</span>
              </label>
              <select
                value={config.soDeCanTao}
                onChange={(e) =>
                  onChangeConfig({ ...config, soDeCanTao: parseInt(e.target.value, 10) || 1 })
                }
                className="w-full px-3 py-1.5 text-xs font-bold text-indigo-900 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={1}>Tạo 1 đề tương tự</option>
                <option value={2}>Tạo 2 đề tương tự (Đề 1, Đề 2)</option>
                <option value={3}>Tạo 3 đề tương tự (Đề 1, 2, 3)</option>
                <option value={4}>Tạo 4 đề tương tự (Đề 1, 2, 3, 4)</option>
                <option value={5}>Tạo 5 đề tương tự (Đề 1, 2, 3, 4, 5)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Thời gian làm bài:</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={15}
                  max={180}
                  value={config.thoiGian}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      thoiGian: Math.max(15, parseInt(e.target.value, 10) || 45),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg text-center bg-white"
                />
                <span className="text-xs text-slate-500 font-medium">phút</span>
              </div>
            </div>
          </div>

          {/* Mức độ đổi nội dung (3 radio cards) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Mức độ thay đổi nội dung:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChangeConfig({ ...config, mucDoTuongTu: 'doi_so_lieu' })}
                className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                  config.mucDoTuongTu === 'doi_so_lieu'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-bold block">🔢 Đổi số liệu</span>
                <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                  Giữ bài, thay đổi số liệu/biến
                </span>
              </button>

              <button
                type="button"
                onClick={() => onChangeConfig({ ...config, mucDoTuongTu: 'cung_dang' })}
                className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                  config.mucDoTuongTu === 'cung_dang'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-bold block">🔄 Cùng dạng</span>
                <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                  Cùng dạng bài, bối cảnh mới
                </span>
              </button>

              <button
                type="button"
                onClick={() => onChangeConfig({ ...config, mucDoTuongTu: 'hoan_toan_moi' })}
                className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                  config.mucDoTuongTu === 'hoan_toan_moi'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-bold block">✨ Mới hoàn toàn</span>
                <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                  Đề sáng tạo mới theo chuẩn
                </span>
              </button>
            </div>
          </div>

          {/* BẢNG TÙY CHỈNH SỐ CÂU (Chỉ hiện khi chọn cautrucDe === 'ma_tran_tuy_chinh') */}
          {config.cautrucDe === 'ma_tran_tuy_chinh' ? (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Số câu từng dạng (Cấu hình thủ công):</span>
                </label>
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Tổng: {config.numPart1 + config.numPart2 + config.numPart3 + config.numPart4} câu
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Dạng 1: 4 lựa chọn */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-slate-800 block leading-tight">
                    Phần I: 4 Lựa chọn
                  </span>
                  <span className="text-[10px] text-slate-500 block">Chọn 1 trong A, B, C, D</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={config.numPart1}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        numPart1: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded-lg text-center bg-white"
                  />
                </div>

                {/* Dạng 2: Đúng / Sai */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-slate-800 block leading-tight">
                    Phần II: Đúng / Sai
                  </span>
                  <span className="text-[10px] text-slate-500 block">1 đề chung + 4 ý a,b,c,d</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={config.numPart2}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        numPart2: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded-lg text-center bg-white"
                  />
                </div>

                {/* Dạng 3: Trả lời ngắn */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-slate-800 block leading-tight">
                    Phần III: Trả lời ngắn
                  </span>
                  <span className="text-[10px] text-slate-500 block">Điền số / phân số</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={config.numPart3}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        numPart3: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded-lg text-center bg-white"
                  />
                </div>

                {/* Dạng 4: Tự luận */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-slate-800 block leading-tight">
                    Phần IV: Tự luận
                  </span>
                  <span className="text-[10px] text-slate-500 block">Trình bày lời giải</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={config.numPart4}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        numPart4: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded-lg text-center bg-white"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-950">Chế độ Tạo Y Hệt Đề Gốc đang bật</p>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                  AI sẽ tự động quét đề thi gốc, tự nhận diện môn học (Toán, Văn, Anh, Lý, Hóa, Sinh, Sử, Địa...), cấu trúc từng Phần và số lượng câu hỏi để tạo đề thi tương tự chuẩn xác nhất.
                </p>
              </div>
            </div>
          )}

          {/* Yêu cầu thêm từ giáo viên */}
          <div className="space-y-1 pt-1">
            <label className="text-xs font-semibold text-slate-700 block">
              Yêu cầu thêm từ giáo viên (nếu có):
            </label>
            <textarea
              rows={2}
              placeholder="VD: Tập trung chương Hàm số, dùng bối cảnh thực tế môn Vật lý, giữ dạng câu hỏi tự luận mở..."
              value={config.extraPrompt || ''}
              onChange={(e) => onChangeConfig({ ...config, extraPrompt: e.target.value })}
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Tiêu đề & Tên trường */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Tên trường (VD: THPT Chuyên...)"
              value={config.truong || ''}
              onChange={(e) => onChangeConfig({ ...config, truong: e.target.value })}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            />
            <input
              type="text"
              placeholder="Tiêu đề đề thi (VD: ĐỀ KIỂM TRA HỌC KỲ I)"
              value={config.tieuDe || ''}
              onChange={(e) => onChangeConfig({ ...config, tieuDe: e.target.value })}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            />
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 2: CÂU LẺ / 1-2 BÀI TẬP (Theo đúng ảnh người dùng gửi) */}
      {/* ========================================================= */}
      {config.mode === 'cau_le' && (
        <div className="space-y-3.5 animate-fade-in">
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs">
            <p className="font-semibold flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Chế độ sinh bài tập tương tự từ ảnh / câu hỏi lẻ</span>
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Phù hợp khi bạn dán ảnh hoặc nhập 1-2 bài toán cần tạo thêm các bài tương đương để luyện tập.
            </p>
          </div>

          {/* Cấu hình số bài, độ khó & hình TikZ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Số bài */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Số bài cần sinh:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={config.soBai}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      soBai: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs font-bold text-center border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-xs text-slate-500 shrink-0 font-medium">bài tương tự</span>
              </div>
            </div>

            {/* Độ khó */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Độ khó bài tập:
              </label>
              <select
                value={config.doKho}
                onChange={(e) => onChangeConfig({ ...config, doKho: e.target.value as any })}
                className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="tuong_duong">⚖️ Tương đương đề gốc</option>
                <option value="de_hon">🟢 Dễ hơn (Nhẹ nhàng)</option>
                <option value="kho_hon">🔴 Khó hơn (Nhiều bước)</option>
                <option value="nang_cao">🔥 Nâng cao (Phân loại)</option>
              </select>
            </div>

            {/* Hình TikZ (full width) */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                <Code className="w-3.5 h-3.5 text-indigo-600" />
                <span>Vẽ hình TikZ (cho câu có hình học / đồ thị):</span>
              </label>
              <select
                value={config.tikzMode}
                onChange={(e) => onChangeConfig({ ...config, tikzMode: e.target.value as any })}
                className="w-full px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="auto">✨ Tự động vẽ hình chuẩn TikZ khi câu có hình/đồ thị</option>
                <option value="yes">🎨 Bắt buộc sinh mã TikZ cho tất cả câu</option>
                <option value="no">🚫 Không tạo hình TikZ</option>
              </select>
            </div>
          </div>

          {/* Yêu cầu thêm (Textarea theo ảnh người dùng) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              Yêu cầu thêm từ giáo viên:
            </label>
            <textarea
              rows={2}
              placeholder="VD: đổi bối cảnh thực tế, giữ loại hình chóp tam giác, dùng số nguyên đẹp, thêm câu hỏi phụ..."
              value={config.extraPrompt}
              onChange={(e) => onChangeConfig({ ...config, extraPrompt: e.target.value })}
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Kèm lời giải checkbox */}
      <div className="pt-2 border-t border-slate-100">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.includeAnswers}
            onChange={(e) => onChangeConfig({ ...config, includeAnswers: e.target.checked })}
            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
          />
          <span className="text-xs font-semibold text-slate-800">
            Kèm hướng dẫn giải chi tiết & đáp án trong kết quả
          </span>
        </label>
      </div>
    </div>
  );
};
