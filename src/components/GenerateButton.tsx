import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

interface GenerateButtonProps {
  onGenerate: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

export const GenerateButton: React.FC<GenerateButtonProps> = ({
  onGenerate,
  isGenerating,
  disabled,
}) => {
  return (
    <div className="space-y-2">
      <button
        onClick={onGenerate}
        disabled={disabled || isGenerating}
        className={`w-full py-3 px-5 rounded-xl font-bold text-sm text-white shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer ${
          isGenerating
            ? 'bg-amber-600 shadow-amber-200 cursor-wait'
            : disabled
            ? 'bg-slate-300 shadow-none cursor-not-allowed opacity-60'
            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:shadow-lg active:scale-[0.99]'
        }`}
      >
        {isGenerating ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>AI Đang Phân Tích & Sáng Tạo Đề Tương Tự...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 text-amber-200" />
            <span>BẮT ĐẦU TẠO ĐỀ THI TƯƠNG TỰ</span>
          </>
        )}
      </button>

      {isGenerating && (
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div className="bg-amber-500 h-full animate-pulse w-full"></div>
        </div>
      )}
    </div>
  );
};
