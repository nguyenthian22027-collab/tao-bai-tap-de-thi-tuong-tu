/**
 * @license
 * EduSheet Studio - License Status & Upgrade Prompt Modal
 */

import React from 'react';
import { X, Lock, ShieldAlert, Sparkles, CheckCircle2, PhoneCall, Mail } from 'lucide-react';
import { FirebaseUserProfile } from '../types';

interface LicenseStatusModalProps {
  isOpen: boolean;
  userProfile: FirebaseUserProfile | null;
  onClose: () => void;
}

export const LicenseStatusModal: React.FC<LicenseStatusModalProps> = ({
  isOpen,
  userProfile,
  onClose,
}) => {
  if (!isOpen) return null;

  const isTrialExhausted = userProfile?.tier === 'trial' && (userProfile.trialRemaining || 0) <= 0;
  const isExpired =
    (userProfile?.tier === '1_year' || userProfile?.tier === 'custom_days') &&
    (userProfile.expireAt || 0) <= Date.now();
  const isBlocked = userProfile?.tier === 'blocked';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
        {/* Top banner */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-xs shadow-inner">
              {isBlocked ? (
                <ShieldAlert className="w-6 h-6 text-rose-200" />
              ) : (
                <Lock className="w-6 h-6 text-amber-200" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isBlocked
                  ? 'Tài Khoản Đang Bị Tạm Khóa'
                  : isExpired
                  ? 'Bản Quyền Pro Đã Hết Hạn'
                  : 'Đã Dùng Hết 5 Lượt Tạo & Tải Dùng Thử'}
              </h3>
              <p className="text-xs text-purple-100">
                Tài khoản: <span className="font-semibold underline">{userProfile?.email}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 leading-relaxed">
            {isBlocked && (
              <p>
                Tài khoản của bạn tạm thời chưa được kích hoạt hoặc đã bị khóa bởi Quản trị viên.
                Vui lòng liên hệ Quản trị viên để được mở khóa.
              </p>
            )}
            {isExpired && (
              <p>
                Thời hạn bản quyền Pro của bạn đã hết. Hãy liên hệ với Quản trị viên để được gia hạn tiếp tục
                sử dụng không giới hạn tính năng tạo và tải file Word MathType OLE.
              </p>
            )}
            {isTrialExhausted && (
              <p>
                Bạn đã sử dụng hết <b>5/5 lượt tạo & tải đề thi dùng thử miễn phí</b>. Để tiếp tục tạo và tải đề không giới hạn,
                vẽ hình TikZ tự động và xuất Word MathType OLE, bạn hãy liên hệ Quản trị viên để kích hoạt bản quyền Pro!
              </p>
            )}
          </div>

          {/* Pricing options info */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-0.5 text-center">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Gói Tùy Chọn</span>
              <div className="text-xs font-extrabold text-indigo-950">1 - 6 Tháng</div>
              <p className="text-[10.5px] text-indigo-800/80">Linh hoạt theo nhu cầu</p>
            </div>
            <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-0.5 text-center">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Gói 1 Năm</span>
              <div className="text-xs font-extrabold text-blue-950">365 Ngày</div>
              <p className="text-[10.5px] text-blue-800/80">Trọn năm học không giới hạn</p>
            </div>
            <div className="p-2.5 bg-purple-50/60 border border-purple-200 rounded-xl space-y-0.5 text-center">
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Vĩnh Viễn</span>
              <div className="text-xs font-extrabold text-purple-950">Trọn Đời</div>
              <p className="text-[10.5px] text-purple-800/80">Mãi mãi & trọn bộ tính năng</p>
            </div>
          </div>

          {/* Contact Admin */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="font-bold text-slate-700 block">Thông tin liên hệ Quản trị viên để duyệt kích hoạt:</span>
            <div className="flex flex-col sm:flex-row gap-2 text-[11.5px] text-slate-600">
              <div className="flex items-center space-x-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zalo / Hotline: <b>09xx.xxx.xxx</b></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>Email: <b>admin@edusheet.vn</b></span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Đã Hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
