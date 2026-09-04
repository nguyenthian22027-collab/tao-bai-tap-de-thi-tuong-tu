import React, { useState } from 'react';
import { ApiKeyInfo } from '../types';
import { testApiKey } from '../lib/gemini';
import { Plus, Trash2, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Key, ShieldCheck } from 'lucide-react';

interface ApiKeyManagerProps {
  keys: ApiKeyInfo[];
  onUpdateKeys: (keys: ApiKeyInfo[]) => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({
  keys,
  onUpdateKeys,
  onAddToast,
}) => {
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isTestingAll, setIsTestingAll] = useState(false);

  const maskKey = (val: string) => {
    if (!val) return '';
    if (val.length <= 8) return '••••••••';
    return `${val.slice(0, 4)}••••••••${val.slice(-4)}`;
  };

  const handleAddKey = async () => {
    if (!newValue.trim()) {
      onAddToast('warning', 'Vui lòng nhập chuỗi API Key');
      return;
    }

    const label = newLabel.trim() || `API Key #${keys.length + 1}`;
    const newKeyItem: ApiKeyInfo = {
      id: `key_${Date.now()}`,
      label,
      value: newValue.trim(),
      status: 'testing',
      lastTested: new Date().toISOString(),
      usageCount: 0,
    };

    const updated = [...keys, newKeyItem];
    onUpdateKeys(updated);
    setNewLabel('');
    setNewValue('');

    // Test new key immediately
    const res = await testApiKey(newKeyItem);
    const finalKeys = updated.map((k) =>
      k.id === newKeyItem.id
        ? { ...k, status: res.status, lastTested: new Date().toISOString() }
        : k
    );
    onUpdateKeys(finalKeys);

    if (res.success) {
      onAddToast('success', `Đã thêm và xác nhận thành công "${label}"`);
    } else {
      onAddToast('error', `Thêm key thành công nhưng test thất bại: ${res.error}`);
    }
  };

  const handleDeleteKey = (id: string) => {
    const updated = keys.filter((k) => k.id !== id);
    onUpdateKeys(updated);
    onAddToast('info', 'Đã xóa API Key');
  };

  const handleTestSingle = async (id: string) => {
    const target = keys.find((k) => k.id === id);
    if (!target) return;

    onUpdateKeys(
      keys.map((k) => (k.id === id ? { ...k, status: 'testing' } : k))
    );

    const res = await testApiKey(target);
    onUpdateKeys(
      keys.map((k) =>
        k.id === id
          ? { ...k, status: res.status, lastTested: new Date().toISOString() }
          : k
      )
    );

    if (res.success) {
      onAddToast('success', `Key "${target.label}" hoạt động tốt!`);
    } else {
      onAddToast('error', `Key "${target.label}" lỗi: ${res.error}`);
    }
  };

  const handleTestAll = async () => {
    if (keys.length === 0) return;
    setIsTestingAll(true);

    let currentKeys = [...keys];
    for (let i = 0; i < currentKeys.length; i++) {
      const k = currentKeys[i];
      currentKeys = currentKeys.map((item, idx) =>
        idx === i ? { ...item, status: 'testing' } : item
      );
      onUpdateKeys(currentKeys);

      const res = await testApiKey(k);
      currentKeys = currentKeys.map((item, idx) =>
        idx === i
          ? { ...item, status: res.status, lastTested: new Date().toISOString() }
          : item
      );
      onUpdateKeys(currentKeys);

      // 500ms delay between tests to avoid rapid spamming
      await new Promise((r) => setTimeout(r, 500));
    }

    setIsTestingAll(false);
    onAddToast('success', 'Đã hoàn tất kiểm tra tất cả API Key');
  };

  const getStatusBadge = (status: ApiKeyInfo['status']) => {
    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Hoạt động tốt</span>
          </span>
        );
      case 'testing':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
            <span>Đang test...</span>
          </span>
        );
      case 'rate_limited':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Đạt giới hạn lượt</span>
          </span>
        );
      case 'invalid':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Không hợp lệ</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <span>Chưa test</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-1.5">
            <Key className="w-4 h-4 text-indigo-600" />
            <span>Danh sách Google Gemini API Key</span>
          </h3>
          <p className="text-xs text-slate-500">
            Cơ chế Round-Robin tự động luân chuyển key & tự chuyển khi gặp lỗi giới hạn (429)
          </p>
        </div>
        {keys.length > 0 && (
          <button
            onClick={handleTestAll}
            disabled={isTestingAll}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingAll ? 'animate-spin' : ''}`} />
            <span>{isTestingAll ? 'Đang test...' : 'Test tất cả'}</span>
          </button>
        )}
      </div>

      {/* Keys Table / List */}
      {keys.length === 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
          <ShieldCheck className="w-8 h-8 text-amber-600 mx-auto" />
          <p className="text-xs text-amber-900 font-medium">
            Bạn chưa lưu Google Gemini API Key nào. Hãy thêm ít nhất 1 key để bắt đầu tạo đề thi.
          </p>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-semibold text-indigo-600 hover:underline"
          >
            Lấy Gemini API Key miễn phí tại Google AI Studio ➔
          </a>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="divide-y divide-slate-100">
            {keys.map((k) => (
              <div
                key={k.id}
                className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-slate-800">{k.label}</span>
                    {getStatusBadge(k.status)}
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      Đã dùng: {k.usageCount || 0} lần
                    </span>
                  </div>
                  <div className="font-mono text-xs text-slate-500">
                    {maskKey(k.value)}
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-center">
                  <button
                    onClick={() => handleTestSingle(k.id)}
                    className="px-2 py-1 text-xs text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => handleDeleteKey(k.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                    title="Xóa Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Add Key */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <span className="text-xs font-semibold text-slate-700 block">+ Thêm API Key mới</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Tên gợi nhớ (VD: Key cá nhân)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
          <input
            type="password"
            placeholder="Dán AIzaSy... vào đây"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white sm:col-span-1"
          />
          <button
            onClick={handleAddKey}
            className="flex items-center justify-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm & Test ngay</span>
          </button>
        </div>
      </div>
    </div>
  );
};
