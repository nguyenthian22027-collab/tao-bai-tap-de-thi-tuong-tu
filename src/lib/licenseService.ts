/**
 * @license
 * EduSheet Studio - License & User Management Service (Firebase Auth & Firestore)
 */

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  increment,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { FirebaseUserProfile, LicenseTier } from '../types';

const ADMIN_STORAGE_KEY = 'edusheet_admin_pin_verified';

/**
 * Đăng nhập bằng tài khoản Google qua Firebase Popup
 */
export async function loginWithGoogle(): Promise<FirebaseUser> {
  if (!auth || !googleProvider) {
    throw new Error('Firebase chưa được cấu hình. Vui lòng cấu hình Firebase trong Cài đặt!');
  }
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
  return result.user;
}

/**
 * Đăng xuất tài khoản Google
 */
export async function logoutGoogle(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

/**
 * Theo dõi trạng thái đăng nhập Firebase Auth
 */
export function subscribeAuthChange(callback: (user: FirebaseUser | null) => void): Unsubscribe | null {
  if (!auth) {
    callback(null);
    return null;
  }
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

/**
 * Đảm bảo hồ sơ người dùng đã tồn tại trên Firestore (nếu người mới thì tự động cấp 5 lượt dùng thử)
 */
export async function ensureUserProfile(user: FirebaseUser): Promise<FirebaseUserProfile> {
  if (!db) {
    // Fallback nếu chưa có db
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email || 'Giáo viên',
      photoURL: user.photoURL || undefined,
      tier: 'trial',
      trialRemaining: 5,
      trialTotal: 5,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };
  }

  const userDocRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userDocRef);

  if (!snap.exists()) {
    // Tài khoản mới lần đầu đăng nhập: Cấp gói DÙNG THỬ (5 lượt)
    const newProfile: FirebaseUserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email || 'Giáo viên',
      photoURL: user.photoURL || undefined,
      tier: 'trial',
      trialRemaining: 5,
      trialTotal: 5,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };
    await setDoc(userDocRef, newProfile);
    return newProfile;
  } else {
    // Đã tồn tại: Cập nhật lần đăng nhập gần nhất & ảnh/tên nếu có đổi
    const data = snap.data() as FirebaseUserProfile;
    await updateDoc(userDocRef, {
      lastLoginAt: Date.now(),
      displayName: user.displayName || data.displayName,
      photoURL: user.photoURL || data.photoURL,
    });
    return {
      ...data,
      displayName: user.displayName || data.displayName,
      photoURL: user.photoURL || data.photoURL,
      lastLoginAt: Date.now(),
    };
  }
}

/**
 * Lắng nghe thay đổi hồ sơ người dùng thời gian thực (Realtime onSnapshot)
 * Khi Quản trị viên bấm Duyệt 1 Năm hay Vĩnh Viễn, máy giáo viên mở khóa ngay!
 */
export function subscribeUserProfile(
  uid: string,
  callback: (profile: FirebaseUserProfile | null) => void
): Unsubscribe | null {
  if (!db) {
    callback(null);
    return null;
  }
  const userDocRef = doc(db, 'users', uid);
  return onSnapshot(
    userDocRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as FirebaseUserProfile);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn('Lỗi realtime hồ sơ người dùng:', err);
    }
  );
}

/**
 * Giảm 1 lượt dùng thử trên Cloud Firestore khi tạo đề thành công
 */
export async function decrementTrialCredit(uid: string): Promise<number> {
  if (!db) return 0;
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    trialRemaining: increment(-1),
  });
  const snap = await getDoc(userDocRef);
  return snap.exists() ? (snap.data() as FirebaseUserProfile).trialRemaining : 0;
}

// ====================================================================================
// QUẢN TRỊ VIÊN (ADMIN ACTIONS)
// ====================================================================================

/**
 * Kiểm tra xem Email hoặc tài khoản hiện tại có phải là Quản trị viên không
 */
export function isUserAdmin(email?: string | null): boolean {
  if (!email) {
    return sessionStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
  }
  const adminEmailEnv = (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase().trim();
  if (adminEmailEnv && email.toLowerCase().trim() === adminEmailEnv) {
    return true;
  }
  // Cho phép mở khóa bằng mã PIN
  return sessionStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
}

/**
 * Xác thực mã PIN Quản trị viên khẩn cấp
 */
export function verifyAdminPin(pin: string): boolean {
  const correctPin = import.meta.env.VITE_ADMIN_PIN || 'admin888';
  if (pin.trim() === correctPin.trim()) {
    sessionStorage.setItem(ADMIN_STORAGE_KEY, 'true');
    return true;
  }
  return false;
}

/**
 * Lắng nghe toàn bộ danh sách người dùng realtime (dành cho Admin Panel)
 */
export function subscribeAllUsers(
  callback: (users: FirebaseUserProfile[]) => void
): Unsubscribe | null {
  if (!db) {
    callback([]);
    return null;
  }
  const usersCol = collection(db, 'users');
  const q = query(usersCol, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const users: FirebaseUserProfile[] = [];
      snapshot.forEach((docSnap) => {
        users.push(docSnap.data() as FirebaseUserProfile);
      });
      callback(users);
    },
    (err) => {
      console.warn('Lỗi tải danh sách người dùng Admin:', err);
    }
  );
}

/**
 * Quản trị viên phê duyệt gói cho một người dùng:
 * - 'trial': Cấp lại 5 lượt dùng thử
 * - '1_year': 365 ngày kể từ thời điểm duyệt
 * - 'lifetime': Vĩnh viễn không giới hạn
 * - 'blocked': Khóa tài khoản
 */
export async function adminUpdateUserLicense(
  uid: string,
  tier: LicenseTier,
  adminEmail = 'Admin'
): Promise<void> {
  if (!db) throw new Error('Firestore chưa được khởi tạo');

  const userDocRef = doc(db, 'users', uid);
  const now = Date.now();

  const updatePayload: Partial<FirebaseUserProfile> = {
    tier,
    approvedAt: now,
    approvedBy: adminEmail,
  };

  if (tier === 'trial') {
    updatePayload.trialRemaining = 5;
    updatePayload.expireAt = null;
  } else if (tier === '1_year') {
    // 365 ngày = 365 * 24 * 60 * 60 * 1000 ms
    updatePayload.expireAt = now + 365 * 24 * 60 * 60 * 1000;
  } else if (tier === 'lifetime') {
    updatePayload.expireAt = null;
  }

  await updateDoc(userDocRef, updatePayload);
}

/**
 * Cập nhật ghi chú cho người dùng (ví dụ: Trường THPT Chu Văn An...)
 */
export async function adminUpdateUserNotes(uid: string, notes: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'users', uid), { notes });
}
