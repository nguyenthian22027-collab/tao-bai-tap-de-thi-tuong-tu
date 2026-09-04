/**
 * @license
 * EduSheet Studio - Firebase Configuration Modal
 */

import React, { useState } from 'react';
import { X, Flame, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { getFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig, isFirebaseConfigured } from '../lib/firebase';
import { FirebaseConfigData } from '../types';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const currentConfig = getFirebaseConfig();

  const [rawJson, setRawJson] = useState('');
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig?.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig?.projectId || '');
  const [storageBucket, setStorageBucket] = useState(currentConfig?.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(currentConfig?.messagingSenderId || '');
  const [appId, setAppId] = useState(currentConfig?.appId || '');

  const [pasteError, setPasteError] = useState('');

  if (!isOpen) return null;

  // Tự động phân tích khi dán cả đoạn const firebaseConfig = { ... }
  const handleParseJson = (text: string) => {
    setRawJson(text);
    setPasteError('');
    try {
      // Tìm khối JSON { ... }
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        setPasteError('Không tìm thấy định dạng { ... } trong đoạn dán vào');
        return;
      }
      // Chuyển format object JS sang JSON hợp lệ
      const cleaned = match[0]
        .replace(/(\w+)\s*:/g, '"$1":')
        .replace(/'/g, '"')
        .replace(/,\s*}/g, '}');

      const parsed = JSON.parse(cleaned);
      if (parsed.apiKey) setApiKey(parsed.apiKey);
      if (parsed.authDomain) setAuthDomain(parsed.authDomain);
      if (parsed.projectId) setProjectId(parsed.projectId);
      if (parsed.storageBucket) setStorageBucket(parsed.storageBucket);
      if (parsed.messagingSenderId) setMessagingSenderId(parsed.messagingSenderId);
      if (parsed.appId) setAppId(parsed.appId);
    } catch {
      setPasteError('Định dạng dán vào không hợp lệ. Bạn có thể nhập tay các ô bên dưới.');
    }
  };

  const handleSave = () => {
    if (!apiKey || !projectId || !appId) {
      alert('Vui lòng điền tối thiểu apiKey, projectId và appId!');
      return;
    }
    const config: FirebaseConfigData = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
    };
    saveFirebaseConfig(config);
    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Cấu Hình Kết Nối Firebase</h2>
              <p className="text-xs text-amber-100">Dành cho Quản trị viên kích hoạt Google Sign-In & Bản quyền Realtime</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Hướng dẫn nhanh */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 text-slate-700">
            <div className="font-bold text-amber-900 flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Cách lấy mã cấu hình Firebase (3 phút miễn phí):</span>
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-[11.5px] text-amber-950 pl-1">
              <li>
                Truy cập{' '}
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue-600 underline inline-flex items-center space-x-0.5"
                >
                  <span>Firebase Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>{' '}
                và tạo dự án mới miễn phí.
              </li>
              <li>Bật <b>Authentication</b> → chọn <b>Google</b>.</li>
              <li>Bật <b>Firestore Database</b> → tạo cơ sở dữ liệu.</li>
              <li>Vào <b>Cài đặt dự án</b> → Tạo Ứng dụng Web (<b>&lt;/&gt;</b>) → Copy đoạn mã <code>firebaseConfig</code>.</li>
            </ol>
          </div>

          {/* Dán nhanh */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Cách 1: Dán trực tiếp cả đoạn mã firebaseConfig vào đây:
            </label>
            <textarea
              rows={3}
              value={rawJson}
              onChange={(e) => handleParseJson(e.target.value)}
              placeholder="const firebaseConfig = { apiKey: '...', projectId: '...', ... };"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px] focus:bg-white focus:border-amber-500 outline-hidden"
            />
            {pasteError && <p className="text-rose-600 mt-0.5">{pasteError}</p>}
          </div>

          <div className="border-t border-slate-200 pt-3">
            <span className="font-bold text-slate-800 block mb-2">Cách 2: Hoặc điền các thông số riêng lẻ:</span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-[11px] text-slate-600 block mb-0.5 font-semibold">apiKey *:</span>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-600 block mb-0.5 font-semibold">authDomain:</span>
                <input
                  type="text"
                  value={authDomain}
                  onChange={(e) => setAuthDomain(e.target.value)}
                  placeholder="my-project.firebaseapp.com"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-600 block mb-0.5 font-semibold">projectId *:</span>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="my-project-id"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-600 block mb-0.5 font-semibold">appId *:</span>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1:123456789:web:abcdef"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {isFirebaseConfigured() && (
              <button
                onClick={clearFirebaseConfig}
                className="text-xs text-rose-600 hover:underline cursor-pointer"
              >
                Xóa cấu hình hiện tại
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Lưu & Kích Hoạt Ngay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
