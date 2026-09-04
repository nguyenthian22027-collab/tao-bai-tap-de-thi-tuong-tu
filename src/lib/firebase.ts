/**
 * @license
 * EduSheet Studio - Firebase Configuration & Initialization
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { FirebaseConfigData } from '../types';

const FIREBASE_CONFIG_KEY = 'edusheet_firebase_config';

/**
 * Lấy cấu hình Firebase từ import.meta.env hoặc từ LocalStorage đã lưu
 */
export function getFirebaseConfig(): FirebaseConfigData | null {
  // 1. Kiểm tra biến môi trường .env
  const envConfig: FirebaseConfigData = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };

  if (envConfig.apiKey && envConfig.projectId && envConfig.appId) {
    return envConfig;
  }

  // 2. Kiểm tra LocalStorage nếu người dùng/admin đã nhập cấu hình trực tiếp từ giao diện
  try {
    const saved = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (saved) {
      const parsed: FirebaseConfigData = JSON.parse(saved);
      if (parsed.apiKey && parsed.projectId && parsed.appId) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Lỗi đọc cấu hình Firebase từ LocalStorage:', err);
  }

  return null;
}

/**
 * Lưu cấu hình Firebase nhập từ giao diện và khởi tạo lại
 */
export function saveFirebaseConfig(config: FirebaseConfigData): void {
  try {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    // Tải lại trang để áp dụng cấu hình Firebase mới sạch sẽ
    window.location.reload();
  } catch (err) {
    console.error('Lỗi lưu cấu hình Firebase:', err);
  }
}

/**
 * Xóa cấu hình Firebase đã lưu
 */
export function clearFirebaseConfig(): void {
  localStorage.removeItem(FIREBASE_CONFIG_KEY);
  window.location.reload();
}

/**
 * Kiểm tra xem Firebase đã được cấu hình hợp lệ chưa
 */
export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;

const config = getFirebaseConfig();

if (config) {
  try {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(config);
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
    googleProviderInstance = new GoogleAuthProvider();
    googleProviderInstance.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    console.error('Lỗi khởi tạo Firebase:', err);
  }
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;
export const googleProvider = googleProviderInstance;
