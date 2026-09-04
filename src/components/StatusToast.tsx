import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface StatusToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const StatusToast: React.FC<StatusToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  const getToastStyle = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-900 text-emerald-100 border-emerald-700';
      case 'warning':
        return 'bg-amber-900 text-amber-100 border-amber-700';
      case 'error':
        return 'bg-rose-900 text-rose-100 border-rose-700';
      default:
        return 'bg-slate-900 text-slate-100 border-slate-700';
    }
  };

  const getToastIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2 max-w-sm w-full no-print pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-3 rounded-xl border shadow-xl flex items-start justify-between space-x-2 text-xs font-medium pointer-events-auto transition-all animate-slide-up ${getToastStyle(
            toast.type
          )}`}
        >
          <div className="flex items-start space-x-2 leading-tight">
            {getToastIcon(toast.type)}
            <span className="whitespace-pre-wrap">{toast.message}</span>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
