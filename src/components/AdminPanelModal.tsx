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
  CheckCircle2,
  RefreshCw,
  Settings,
  Sparkles,
  Flame,
  Calendar,
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
  const count1Year = users.filter((u) => u.tier === '1_year').length;
  const countLifetime = users.filter((u) => u.tier === 'lifetime').length;
  const countBlocked = users.filter((u) => u.tier === 'blocked').length;

  const handleApprove = async (uid: string, tier: LicenseTier) => {
    setIsProcessingUid(uid);
    try {
      await adminUpdateUserLicense(uid, tier, adminEmail || 'Admin');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-200 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
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
                Phê duyệt Dùng thử (5 lượt), Gói 1 Năm (365 ngày) và Gói Vĩnh Viễn trực tiếp từ xa
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
              <span className="text-[10.5px] font-bold text-blue-700 uppercase block">Gói 1 Năm</span>
              <span className="text-xl font-extrabold text-blue-900">{count1Year}</span>
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
                { key: '1_year', label: '1 Năm' },
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
                    const is1YearExpired = u.tier === '1_year' && (u.expireAt || 0) <= Date.now();

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
                          {u.tier === '1_year' && (
                            <span
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 font-bold rounded-full border text-[10.5px] ${
                                is1YearExpired
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-blue-100 text-blue-800 border-blue-300'
                              }`}
                            >
                              <Calendar className="w-3 h-3" />
                              <span>{is1YearExpired ? '1 Năm (Hết Hạn)' : 'Gói 1 Năm'}</span>
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
                              {u.trialRemaining} / {u.trialTotal || 5} lượt
                            </span>
                          )}
                          {u.tier === '1_year' && (
                            <span className="text-blue-900">
                              Hạn: <b>{formatDate(u.expireAt)}</b>
                            </span>
                          )}
                          {u.tier === 'lifetime' && <span className="text-purple-900">Không giới hạn</span>}
                          {u.tier === 'blocked' && <span className="text-rose-600 italic">Bị chặn tạo đề</span>}
                        </td>

                        {/* Ngày tham gia */}
                        <td className="p-3 text-slate-500 text-[11px]">{formatDate(u.createdAt)}</td>

                        {/* Nút thao tác Admin */}
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center space-x-1">
                            {/* Cấp lại 5 lượt dùng thử */}
                            <button
                              onClick={() => handleApprove(u.uid, 'trial')}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-md font-bold text-[10.5px] transition-colors cursor-pointer"
                              title="Cấp lại 5 lượt dùng thử cho giáo viên"
                            >
                              +5 Lượt
                            </button>

                            {/* Duyệt 1 Năm */}
                            <button
                              onClick={() => handleApprove(u.uid, '1_year')}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-md font-bold text-[10.5px] transition-colors cursor-pointer"
                              title="Kích hoạt hạn dùng 365 ngày"
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

                            {/* Khóa */}
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
      </div>
    </div>
  );
};
