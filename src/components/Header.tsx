/**
 * @license
 * EduSheet Studio - Header Component with Google Auth, License Badge & Admin Crown
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  History,
  FileSpreadsheet,
  LogOut,
  ShieldCheck,
  Clock,
  Calendar,
  Sparkles,
  Ban,
  User,
  ChevronDown,
  Flame,
  BookOpen,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { FirebaseUserProfile } from '../types';
import { isFirebaseConfigured } from '../lib/firebase';

interface HeaderProps {
  onOpenSettings: () => void;
  onToggleHistory: () => void;
  hasKeys: boolean;
  validKeyCount: number;
  historyCount?: number;
  currentUser?: FirebaseUser | null;
  userProfile?: FirebaseUserProfile | null;
  isAdmin?: boolean;
  onLoginGoogle?: () => void;
  onLogoutGoogle?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenFirebaseConfig?: () => void;
  onOpenGuide: () => void;
  onOpenLicenseStatus?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onToggleHistory,
  hasKeys,
  validKeyCount,
  historyCount = 0,
  currentUser,
  userProfile,
  isAdmin = false,
  onLoginGoogle,
  onLogoutGoogle,
  onOpenAdminPanel,
  onOpenFirebaseConfig,
  onOpenGuide,
  onOpenLicenseStatus,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isConfigured = isFirebaseConfigured();

  return (
    <header className="bg-white/95 border-b border-slate-200 sticky top-0 z-30 shadow-xs backdrop-blur-sm no-print">
      <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 min-h-16 py-2 flex items-center justify-between gap-3">
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <h1 className="text-lg sm:text-xl font-bold font-sora text-slate-900 tracking-tight truncate">
                SimilarExam <span className="text-indigo-600">Studio</span>
              </h1>
              <span className="bg-amber-100 text-amber-800 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden md:block truncate max-w-[420px]">
              Tạo đề thi tương tự bằng AI — Xuất Word hỗ trợ MathType & OMML
            </p>
          </div>
        </div>

        {/* Action Buttons & Auth */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Nút Admin nếu là Quản trị viên */}
          {isAdmin && (
            <button
              onClick={onOpenAdminPanel}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-amber-950 bg-amber-300 hover:bg-amber-400 border border-amber-400 rounded-lg shadow-xs transition-all cursor-pointer animate-in fade-in"
              title="Bảng điều khiển Quản trị viên và Phê duyệt bản quyền"
            >
              <ShieldCheck className="w-4 h-4 text-amber-900" />
              <span className="hidden sm:inline">👑 Quản Trị Viên</span>
            </button>
          )}

          {/* Lịch sử */}
          <button
            onClick={onToggleHistory}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Xem và quản lý lịch sử đề thi đã tạo"
          >
            <History className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Lịch sử</span>
            {historyCount > 0 && (
              <span className="ml-0.5 bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {historyCount}
              </span>
            )}
          </button>

          {/* Cài đặt Key Gemini */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer ${
              !hasKeys
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm animate-pulse'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
            title="Quản lý API Key và Model Gemini"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Cài đặt Key</span>
            {hasKeys && (
              <span className="ml-1 bg-indigo-200 text-indigo-900 text-xs px-1.5 py-0.2 rounded-full font-bold">
                {validKeyCount}
              </span>
            )}
          </button>

          {/* Hướng dẫn sử dụng */}
          <button
            onClick={onOpenGuide}
            aria-label="Mở hướng dẫn sử dụng"
            className="flex items-center space-x-1.5 p-2 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Xem hướng dẫn sử dụng và cách lấy API Key"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Hướng dẫn</span>
          </button>

          {/* GOOGLE AUTH & USER PROFILE SECTION */}
          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 p-1.5 pl-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                {/* Badge Gói Bản Quyền */}
                {userProfile?.tier === 'lifetime' && (
                  <span className="hidden md:inline-flex items-center space-x-1 px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded-full border border-purple-300">
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    <span>Vĩnh Viễn</span>
                  </span>
                )}
                {(userProfile?.tier === '1_year' || userProfile?.tier === 'custom_days') && (
                  <span className="hidden md:inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-full border border-blue-300">
                    <Calendar className="w-3 h-3 text-blue-600" />
                    <span>
                      {(userProfile.expireAt || 0) <= Date.now()
                        ? 'Bản Pro (Hết Hạn)'
                        : `Bản Pro: Còn ${Math.max(
                            0,
                            Math.ceil(((userProfile.expireAt || 0) - Date.now()) / (1000 * 60 * 60 * 24))
                          )} ngày`}
                    </span>
                  </span>
                )}
                {userProfile?.tier === 'trial' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenLicenseStatus) onOpenLicenseStatus();
                    }}
                    className={`hidden md:inline-flex items-center space-x-1 px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border transition-all cursor-pointer ${
                      (userProfile.trialRemaining || 0) <= 0
                        ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300 animate-pulse'
                        : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
                    }`}
                    title="Nhấn để xem thông tin bản quyền và liên hệ Nhân Phúc (0988250112)"
                  >
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>
                      {(userProfile.trialRemaining || 0) <= 0
                        ? 'Hết lượt dùng thử (0/5)'
                        : `Dùng thử: ${userProfile.trialRemaining}/5`}
                    </span>
                  </button>
                )}
                {userProfile?.tier === 'blocked' && (
                  <span className="hidden md:inline-flex items-center space-x-1 px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-extrabold rounded-full border border-rose-300">
                    <Ban className="w-3 h-3 text-rose-600" />
                    <span>Đã khóa</span>
                  </span>
                )}

                {/* Avatar */}
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ''}
                    className="w-7 h-7 rounded-full border border-slate-300 object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                    {(currentUser.displayName || currentUser.email || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-800 hidden lg:inline max-w-[110px] truncate">
                  {currentUser.displayName || currentUser.email}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <span className="font-bold text-slate-900 block truncate">
                      {currentUser.displayName || 'Giáo viên'}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate">{currentUser.email}</span>
                  </div>

                  {/* Thông tin bản quyền trong dropdown */}
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Tình trạng tài khoản:
                    </span>
                    <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                      {userProfile?.tier === 'lifetime' && (
                        <span className="text-purple-700 flex items-center space-x-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Gói Vĩnh Viễn (Không giới hạn)</span>
                        </span>
                      )}
                      {(userProfile?.tier === '1_year' || userProfile?.tier === 'custom_days') && (
                        <span className="text-blue-700 flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Bản Pro (Hết hạn:{' '}
                            {userProfile.expireAt ? new Date(userProfile.expireAt).toLocaleDateString('vi-VN') : '-'}
                            {' — Còn '}
                            {Math.max(0, Math.ceil(((userProfile.expireAt || 0) - Date.now()) / (1000 * 60 * 60 * 24)))}
                            {' ngày)'}
                          </span>
                        </span>
                      )}
                      {userProfile?.tier === 'trial' && (
                        <span className="text-amber-700 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Còn {userProfile.trialRemaining} / 5 lượt dùng thử</span>
                        </span>
                      )}
                      {userProfile?.tier === 'blocked' && (
                        <span className="text-rose-600 flex items-center space-x-1">
                          <Ban className="w-3.5 h-3.5" />
                          <span>Tài khoản đang bị tạm khóa</span>
                        </span>
                      )}
                    </div>

                    {/* Nút xem bản quyền / nâng cấp */}
                    {onOpenLicenseStatus && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenLicenseStatus();
                        }}
                        className="mt-1 w-full px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg flex items-center justify-between text-[11px] transition-colors cursor-pointer border border-indigo-200"
                        title="Xem chi tiết các gói bản quyền & liên hệ Nhân Phúc (0988250112)"
                      >
                        <span className="flex items-center space-x-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Nâng cấp Pro / Liên hệ</span>
                        </span>
                        <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded">
                          0988.250.112
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Menu items */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onOpenAdminPanel) onOpenAdminPanel();
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-amber-50 text-amber-900 font-bold flex items-center space-x-2 cursor-pointer transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Mở Bảng Quản Trị Viên</span>
                    </button>
                  )}

                  {onOpenFirebaseConfig && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenFirebaseConfig();
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-50 text-slate-700 flex items-center space-x-2 cursor-pointer transition-colors"
                    >
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>Cấu hình Firebase</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      if (onLogoutGoogle) onLogoutGoogle();
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center space-x-2 cursor-pointer transition-colors border-t border-slate-100"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất Google</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-1.5">
              {/* Nút Đăng nhập Google */}
              <button
                onClick={onLoginGoogle}
                className="flex items-center space-x-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer hover:border-slate-400"
                title="Đăng nhập tài khoản Google để nhận 5 lượt dùng thử tạo đề"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Đăng nhập</span>
              </button>

              {/* Nút cấu hình Firebase nếu chưa cấu hình */}
              {!isConfigured && onOpenFirebaseConfig && (
                <button
                  onClick={onOpenFirebaseConfig}
                  className="p-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors cursor-pointer"
                  title="Chưa cấu hình Firebase - Bấm vào đây để cấu hình kết nối"
                >
                  <Flame className="w-4 h-4 animate-bounce text-amber-600" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
