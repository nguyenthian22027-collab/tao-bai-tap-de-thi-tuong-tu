/**
 * @license
 * EduSheet Studio - License Status & Upgrade Prompt Modal
 */

import React, { useState } from 'react';
import { X, Lock, ShieldAlert, Sparkles, CheckCircle2, PhoneCall, MessageCircle, Copy, Check, ExternalLink } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isTrialExhausted = userProfile?.tier === 'trial' && (userProfile.trialRemaining || 0) <= 0;
  const isExpired =
    (userProfile?.tier === '1_year' || userProfile?.tier === 'custom_days') &&
    (userProfile.expireAt || 0) <= Date.now();
  const isBlocked = userProfile?.tier === 'blocked';

  const handleCopyPhone = () => {
    navigator.clipboard.writeText('0988250112');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
                  : isTrialExhausted
                  ? 'Đã Dùng Hết 5 Lượt Tạo & Tải Dùng Thử'
                  : 'Thông Tin Bản Quyền & Nâng Cấp Pro'}
              </h3>
              <p className="text-xs text-purple-100">
                Tài khoản: <span className="font-semibold underline">{userProfile?.email || 'Chưa xác định'}</span>
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
                Vui lòng liên hệ Quản trị viên <b>Nhân Phúc (0988.250.112)</b> để được mở khóa nhanh chóng.
              </p>
            )}
            {isExpired && (
              <p>
                Thời hạn bản quyền Pro của bạn đã hết. Hãy liên hệ <b>Nhân Phúc (0988.250.112)</b> để được gia hạn tiếp tục
                sử dụng không giới hạn tính năng tạo đề và xuất file Word MathType OLE.
              </p>
            )}
            {isTrialExhausted && (
              <p>
                Bạn đã sử dụng hết <b>5/5 lượt tạo & tải đề thi dùng thử miễn phí</b>. Để tiếp tục tạo và tải đề không giới hạn,
                vẽ hình TikZ và GeoViz tự động, xuất Word MathType OLE chuẩn đẹp, xin vui lòng liên hệ <b>Nhân Phúc (0988.250.112)</b> để kích hoạt bản quyền Pro!
              </p>
            )}
            {!isBlocked && !isExpired && !isTrialExhausted && (
              <p>
                {userProfile?.tier === 'trial' ? (
                  <>
                    Bạn đang sử dụng gói dùng thử (còn <b>{userProfile.trialRemaining || 0}/5 lượt</b>). Quý thầy cô có thể liên hệ <b>Nhân Phúc</b> để nâng cấp lên bản quyền Pro không giới hạn ngay hôm nay!
                  </>
                ) : (
                  <>
                    Quý thầy cô cần hỗ trợ kỹ thuật hoặc gia hạn bản quyền, vui lòng liên hệ Quản trị viên theo thông tin bên dưới.
                  </>
                )}
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

          {/* Thông tin liên hệ Quản trị viên - Nhân Phúc - 0988250112 */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-purple-50/80 to-blue-50/90 border-2 border-indigo-200 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Thông Tin Liên Hệ Duyệt Kích Hoạt:
              </span>
              <span className="text-[10.5px] px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded-full">
                Hỗ trợ trực tiếp
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-[11px] text-slate-500 font-medium">Người phụ trách hỗ trợ & kích hoạt:</div>
                <div className="text-base font-black text-slate-900 flex items-center gap-2 flex-wrap">
                  <span className="text-indigo-950">Nhân Phúc</span>
                  <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    0988.250.112
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Nút Chat Zalo */}
                <a
                  href="https://zalo.me/0988250112"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer"
                  title="Mở Zalo nhắn tin trực tiếp với Nhân Phúc (0988250112)"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat Zalo</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>

                {/* Nút Gọi Hotline */}
                <a
                  href="tel:0988250112"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer"
                  title="Gọi trực tiếp tới số 0988250112"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Gọi ngay</span>
                </a>

                {/* Nút Sao Chép Số */}
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 cursor-pointer"
                  title="Sao chép số điện thoại 0988250112"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã chép' : 'Chép số'}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 italic leading-normal">
              💡 <b>Cách nhanh nhất:</b> Quý thầy cô chỉ cần nhắn Zalo hoặc gọi số <b>0988.250.112 (Nhân Phúc)</b> để được duyệt kích hoạt dùng bản quyền Pro không giới hạn ngay lập tức!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Hotline / Zalo: <b>0988.250.112</b> (Nhân Phúc)
          </span>
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
