import React from 'react';
import { ApiKeyInfo } from '../types';
import { MODELS } from '../lib/gemini';
import { ApiKeyManager } from './ApiKeyManager';
import { X, Cpu, Info, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keys: ApiKeyInfo[];
  onUpdateKeys: (keys: ApiKeyInfo[]) => void;
  genModel: string;
  onSelectGenModel: (m: string) => void;
  editModel: string;
  onSelectEditModel: (m: string) => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  keys,
  onUpdateKeys,
  genModel,
  onSelectGenModel,
  editModel,
  onSelectEditModel,
  onAddToast,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              ⚙
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Cài đặt API Key & Model Gemini</h2>
              <p className="text-xs text-slate-500">
                API key được lưu trên trình duyệt hiện tại (localStorage), không gửi vào máy chủ ứng dụng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section A: API Key Manager */}
          <ApiKeyManager
            keys={keys}
            onUpdateKeys={onUpdateKeys}
            onAddToast={onAddToast}
          />

          <hr className="border-slate-100" />

          {/* Section B: Model Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-1.5">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <span>Cấu hình Model Gemini AI</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Primary Generation Model */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Model tạo đề thi chính:
                </label>
                <select
                  value={genModel}
                  onChange={(e) => onSelectGenModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Info className="w-3 h-3 text-indigo-500" />
                  Mặc định nên dùng Gemini 3.5 Flash để đạt tốc độ nhanh và chính xác nhất.
                </p>
              </div>

              {/* Refinement / Edit Model */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Model chỉnh sửa / hỏi đáp lại câu hỏi:
                </label>
                <select
                  value={editModel}
                  onChange={(e) => onSelectEditModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Info className="w-3 h-3 text-indigo-500" />
                  Có thể chọn Flash Lite hoặc 3.6 Flash để phản hồi tức thì khi sửa từng câu.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <a
            href="https://aistudio.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>Tạo Gemini API Key miễn phí</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Đóng & Lưu Cài Đặt
          </button>
        </div>
      </div>
    </div>
  );
};
