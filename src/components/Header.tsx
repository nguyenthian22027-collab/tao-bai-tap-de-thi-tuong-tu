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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold font-sora text-slate-900 tracking-tight">
                SimilarExam <span className="text-indigo-600">Studio</span>
              </h1>
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Tạo đề thi tương tự bằng AI — Xuất Word hỗ trợ MathType & OMML
            </p>
          </div>
        </div>

        {/* Action Buttons & Auth */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Nút Admin nếu là Quản trị viên */}
          {isAdmin && (
            <button
              onClick={onOpenAdminPanel}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-600 border border-amber-500 rounded-lg shadow-xs transition-all cursor-pointer animate-in fade-in"
              title="Bảng điều khiển Quản trị viên và Phê duyệt bản quyền"
            >
              <ShieldCheck className="w-4 h-4 text-amber-900" />
              <span className="hidden sm:inline">👑 Quản Trị Viên</span>
            </button>
          )}

          {/* Lịch sử */}
          <button
            onClick={onToggleHistory}
            className="flex items-center space-x-1.5 px-3 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
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
            className={`flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
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
                  <span className="hidden md:inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-full border border-amber-300">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Dùng thử: {userProfile.trialRemaining}/5</span>
                  </span>
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
