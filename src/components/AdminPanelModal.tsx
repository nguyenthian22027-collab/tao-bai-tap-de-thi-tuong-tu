/**
 * @license
 * EduSheet Studio - Admin Dashboard & Realtime License Approval Modal
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Search,
  Users,
  Award,
  Clock,
  Ban,
  Calendar,
  Sparkles,
  Flame,
  Sliders,
  Check,
  CalendarDays,
} from 'lucide-react';
import { subscribeAllUsers, adminUpdateUserLicense } from '../lib/licenseService';
import { FirebaseUserProfile, LicenseTier } from '../types';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminEmail?: string | null;
  onOpenFirebaseConfig: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  adminEmail,
  onOpenFirebaseConfig,
}) => {
  const [users, setUsers] = useState<FirebaseUserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | LicenseTier>('all');
  const [isProcessingUid, setIsProcessingUid] = useState<string | null>(null);

  // Modal phê duyệt tùy chọn (số ngày / số lượt)
  const [customTargetUser, setCustomTargetUser] = useState<FirebaseUserProfile | null>(null);
  const [customDaysInput, setCustomDaysInput] = useState<number>(30);
  const [customDateInput, setCustomDateInput] = useState<string>('');
  const [customTrialsInput, setCustomTrialsInput] = useState<number>(5);

  useEffect(() => {
    if (!isOpen) return;

    // Lắng nghe toàn bộ người dùng từ Cloud Firestore (Realtime)
    const unsubscribe = subscribeAllUsers((userList) => {
      setUsers(userList);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Lọc và tìm kiếm người dùng
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'all' || u.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  // Thống kê nhanh
  const countTrial = users.filter((u) => u.tier === 'trial').length;
  const countPro = users.filter((u) => u.tier === '1_year' || u.tier === 'custom_days').length;
  const countLifetime = users.filter((u) => u.tier === 'lifetime').length;
  const countBlocked = users.filter((u) => u.tier === 'blocked').length;

  const handleApprove = async (
    uid: string,
    tier: LicenseTier,
    options?: { customDays?: number; exactExpireAt?: number; customTrials?: number }
  ) => {
    setIsProcessingUid(uid);
    try {
      await adminUpdateUserLicense(uid, tier, {
        ...options,
        adminEmail: adminEmail || 'Admin',
      });
      if (customTargetUser) {
        setCustomTargetUser(null);
      }
    } catch (err: any) {
      alert(`Lỗi khi phê duyệt: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsProcessingUid(null);
    }
  };

  const formatDate = (ms?: number | null) => {
    if (!ms) return '-';
    return new Date(ms).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const calculateDaysLeft = (ms?: number | null) => {
    if (!ms) return 0;
    return Math.max(0, Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-400/20 border border-amber-400/40 rounded-xl text-amber-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold">BẢNG QUẢN TRỊ VIÊN — PHÊ DUYỆT BẢN QUYỀN</h2>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Realtime Cloud
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Phê duyệt Dùng thử (5 lượt), Gói Pro (1 Năm / Tùy chọn ngày) và Gói Vĩnh Viễn trực tiếp từ xa
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenFirebaseConfig}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer border border-white/20"
              title="Cấu hình kết nối Firebase"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Cấu hình Firebase</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thống kê thẻ số liệu */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase block">Tổng Giáo Viên</span>
              <span className="text-xl font-extrabold text-slate-900">{users.length}</span>
            </div>
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <div className="p-2.5 bg-white border border-amber-200 rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10.5px] font-bold text-amber-700 uppercase block">Đang Dùng Thử</span>
              <span className="text-xl font-extrabold text-amber-900">{countTrial}</span>
            </div>
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
          <div className="p-2.5 bg-white border border-blue-200 rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10.5px] font-bold text-blue-700 uppercase block">Bản Pro Có Hạn</span>
              <span className="text-xl font-extrabold text-blue-900">{countPro}</span>
            </div>
            <Calendar className="w-6 h-6 text-blue-500" />
          </div>
          <div className="p-2.5 bg-white border border-purple-200 rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10.5px] font-bold text-purple-700 uppercase block">Gói Vĩnh Viễn</span>
              <span className="text-xl font-extrabold text-purple-900">{countLifetime}</span>
            </div>
            <Award className="w-6 h-6 text-purple-500" />
          </div>
        </div>

        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo Email hoặc Tên giáo viên..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 outline-hidden"
            />
          </div>

          <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto text-xs">
            {(
              [
                { key: 'all', label: 'Tất cả' },
                { key: 'trial', label: 'Dùng thử' },
                { key: '1_year', label: '1 Năm / Pro' },
                { key: 'lifetime', label: 'Vĩnh viễn' },
                { key: 'blocked', label: 'Đã khóa' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setTierFilter(f.key)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  tierFilter === f.key
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Danh sách người dùng (Table) */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredUsers.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 stroke-1 text-slate-300" />
              <p className="text-xs">Chưa có người dùng nào phù hợp với bộ lọc</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Giáo viên</th>
                    <th className="p-3">Gói Bản Quyền</th>
                    <th className="p-3">Lượt / Hạn Dùng</th>
                    <th className="p-3">Ngày Tham Gia</th>
                    <th className="p-3 text-right">Phê Duyệt Nhanh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const isProcessing = isProcessingUid === u.uid;
                    const isExpired =
                      (u.tier === '1_year' || u.tier === 'custom_days') &&
                      (u.expireAt || 0) <= Date.now();
                    const daysLeft = calculateDaysLeft(u.expireAt);

                    return (
                      <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                        {/* Thông tin giáo viên */}
                        <td className="p-3">
                          <div className="flex items-center space-x-2.5">
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt={u.displayName}
                                className="w-8 h-8 rounded-full border border-slate-300 object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                                {u.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-slate-900 block leading-tight">{u.displayName}</span>
                              <span className="text-[11px] text-slate-500 leading-tight">{u.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Gói bản quyền */}
                        <td className="p-3">
                          {u.tier === 'lifetime' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-100 text-purple-800 font-bold rounded-full border border-purple-300 text-[10.5px]">
                              <Sparkles className="w-3 h-3 text-purple-600" />
                              <span>Vĩnh Viễn</span>
                            </span>
                          )}
                          {(u.tier === '1_year' || u.tier === 'custom_days') && (
                            <span
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 font-bold rounded-full border text-[10.5px] ${
                                isExpired
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-blue-100 text-blue-800 border-blue-300'
                              }`}
                            >
                              <Calendar className="w-3 h-3" />
                              <span>{isExpired ? 'Bản Pro (Hết Hạn)' : 'Bản Pro'}</span>
                            </span>
                          )}
                          {u.tier === 'trial' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-full border border-amber-300 text-[10.5px]">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Dùng Thử</span>
                            </span>
                          )}
                          {u.tier === 'blocked' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-full border border-rose-300 text-[10.5px]">
                              <Ban className="w-3 h-3 text-rose-600" />
                              <span>Đã Khóa</span>
                            </span>
                          )}
                        </td>

                        {/* Số lượt hoặc ngày hết hạn */}
                        <td className="p-3 font-semibold text-slate-700">
                          {u.tier === 'trial' && (
                            <span
                              className={`font-bold ${
                                u.trialRemaining > 0 ? 'text-amber-700' : 'text-rose-600'
                              }`}
                            >
                              {u.trialRemaining} / {u.trialTotal || 5} lượt tạo & tải
                            </span>
                          )}
                          {(u.tier === '1_year' || u.tier === 'custom_days') && (
                            <div>
                              <span className={isExpired ? 'text-rose-600 font-bold' : 'text-blue-900'}>
                                Hạn: <b>{formatDate(u.expireAt)}</b>
                              </span>
                              {!isExpired && (
                                <span className="text-[10px] text-blue-600 font-normal block">
                                  (Còn {daysLeft} ngày)
                                </span>
                              )}
                            </div>
                          )}
                          {u.tier === 'lifetime' && <span className="text-purple-900">Không giới hạn</span>}
                          {u.tier === 'blocked' && <span className="text-rose-600 italic">Bị khóa</span>}
                        </td>

                        {/* Ngày tham gia */}
                        <td className="p-3 text-slate-500 text-[11px]">{formatDate(u.createdAt)}</td>

                        {/* Nút thao tác Admin */}
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center space-x-1">
                            {/* Cấp lại 5 lượt dùng thử */}
                            <button
                              onClick={() => handleApprove(u.uid, 'trial', { customTrials: 5 })}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-md font-bold text-[10.5px] transition-colors cursor-pointer"
                              title="Cấp lại 5 lượt dùng thử tạo & tải cho giáo viên"
                            >
                              +5 Lượt
                            </button>

                            {/* Duyệt 1 Năm */}
                            <button
                              onClick={() => handleApprove(u.uid, '1_year')}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-md font-bold text-[10.5px] transition-colors cursor-pointer"
                              title="Kích hoạt gói Pro 1 Năm (365 ngày)"
                            >
                              1 Năm
                            </button>

                            {/* Duyệt Vĩnh Viễn */}
                            <button
                              onClick={() => handleApprove(u.uid, 'lifetime')}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-md font-bold text-[10.5px] transition-colors cursor-pointer"
                              title="Kích hoạt gói Vĩnh viễn không giới hạn"
                            >
                              Vĩnh Viễn
                            </button>

                            {/* Nút Tùy Chọn Ngày / Số Lượt */}
                            <button
                              onClick={() => {
                                setCustomTargetUser(u);
                                setCustomDaysInput(30);
                                setCustomDateInput('');
                                setCustomTrialsInput(u.trialTotal || 5);
                              }}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-md font-bold text-[10.5px] transition-colors cursor-pointer flex items-center space-x-1"
                              title="Tùy chọn số ngày hoặc chọn ngày cụ thể"
                            >
                              <Sliders className="w-3 h-3" />
                              <span>Tùy Chọn</span>
                            </button>

                            {/* Khóa / Mở Khóa */}
                            <button
                              onClick={() => handleApprove(u.uid, u.tier === 'blocked' ? 'trial' : 'blocked')}
                              disabled={isProcessing}
                              className={`p-1 border rounded-md transition-colors cursor-pointer ${
                                u.tier === 'blocked'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                              }`}
                              title={u.tier === 'blocked' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL DUYỆT TÙY CHỌN (SỐ NGÀY HOẶC SỐ LƯỢT) */}
        {customTargetUser && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold flex items-center space-x-1.5">
                    <Sliders className="w-4 h-4" />
                    <span>Duyệt Tùy Chọn Bản Quyền</span>
                  </h3>
                  <p className="text-[11px] text-indigo-100 truncate max-w-xs">
                    Giáo viên: <b>{customTargetUser.displayName}</b> ({customTargetUser.email})
                  </p>
                </div>
                <button
                  onClick={() => setCustomTargetUser(null)}
                  className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs">
                {/* Cách 1: Chọn gói theo số ngày */}
                <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2.5">
                  <span className="font-bold text-indigo-950 flex items-center space-x-1">
                    <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Gia Hạn Bản Pro Theo Thời Gian:</span>
                  </span>

                  {/* Nút bấm nhanh ngày */}
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[
                      { days: 30, label: '30 Ngày (1 Tháng)' },
                      { days: 90, label: '90 Ngày (1 Quý)' },
                      { days: 180, label: '180 Ngày (6 Tháng)' },
                      { days: 365, label: '365 Ngày (1 Năm)' },
                    ].map((item) => (
                      <button
                        key={item.days}
                        type="button"
                        onClick={() => {
                          setCustomDaysInput(item.days);
                          setCustomDateInput('');
                        }}
                        className={`p-1.5 border rounded-lg font-bold text-[10.5px] cursor-pointer transition-all ${
                          customDaysInput === item.days && !customDateInput
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-700 hover:bg-indigo-50 border-slate-300'
                        }`}
                      >
                        {item.days} Ngày
                      </button>
                    ))}
                  </div>

                  {/* Nhập số ngày tùy ý */}
                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-[11px] text-slate-600 font-semibold whitespace-nowrap">
                      Hoặc nhập số ngày:
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={customDaysInput}
                      onChange={(e) => {
                        setCustomDaysInput(parseInt(e.target.value, 10) || 1);
                        setCustomDateInput('');
                      }}
                      className="w-20 p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center"
                    />
                    <span className="text-[11px] text-slate-500">ngày</span>
                  </div>

                  {/* Hoặc chọn ngày kết thúc cụ thể */}
                  <div className="flex items-center space-x-2 pt-1 border-t border-indigo-100">
                    <span className="text-[11px] text-slate-600 font-semibold whitespace-nowrap">
                      Hoặc chọn ngày hết hạn:
                    </span>
                    <input
                      type="date"
                      value={customDateInput}
                      onChange={(e) => setCustomDateInput(e.target.value)}
                      className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  <button
                    onClick={() => {
                      let exactExpireAt: number | undefined;
                      if (customDateInput) {
                        exactExpireAt = new Date(`${customDateInput}T23:59:59`).getTime();
                      }
                      handleApprove(customTargetUser.uid, 'custom_days', {
                        customDays: customDaysInput,
                        exactExpireAt,
                      });
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Xác Nhận Kích Hoạt Bản Pro</span>
                  </button>
                </div>

                {/* Cách 2: Cấp thêm số lượt Dùng Thử */}
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                  <span className="font-bold text-amber-950 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Cấp Thêm Lượt Dùng Thử (Tạo & Tải):</span>
                  </span>
                  <div className="flex items-center space-x-2">
                    {[5, 10, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCustomTrialsInput(num)}
                        className={`px-3 py-1 border rounded-lg font-bold text-[11px] cursor-pointer transition-all ${
                          customTrialsInput === num
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-700 hover:bg-amber-50 border-slate-300'
                        }`}
                      >
                        +{num} Lượt
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={customTrialsInput}
                      onChange={(e) => setCustomTrialsInput(parseInt(e.target.value, 10) || 1)}
                      className="w-16 p-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center"
                    />
                  </div>
                  <button
                    onClick={() => {
                      handleApprove(customTargetUser.uid, 'trial', {
                        customTrials: customTrialsInput,
                      });
                    }}
                    className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Cấp {customTrialsInput} Lượt Dùng Thử
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setCustomTargetUser(null)}
                  className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-semibold cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
