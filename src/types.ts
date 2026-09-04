declare global {
  interface Window {
    MathJax?: any;
  }
}

export interface ApiKeyInfo {
  id: string;
  label: string;
  value: string;
  status: 'untested' | 'testing' | 'valid' | 'invalid' | 'rate_limited';
  lastTested?: string;
  usageCount: number;
}

export enum QuestionType {
  TRAC_NGHIEM_4_LUA_CHON = 'trac_nghiem_4_lua_chon',
  TRAC_NGHIEM_DUNG_SAI = 'trac_nghiem_dung_sai',
  TRAC_NGHIEM_TRA_LOI_NGAN = 'trac_nghiem_tra_loi_ngan',
  TU_LUAN = 'tu_luan',
  TRAC_NGHIEM = 'trac_nghiem', // backwards compatible
}

export interface Question {
  id: string;
  stt: number;
  loai: QuestionType;
  noiDung: string;
  
  // Dạng 1: Trắc nghiệm 4 lựa chọn
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;

  // Dạng 2: Trắc nghiệm Đúng / Sai (4 mệnh đề quanh câu hỏi chung)
  cauLenh?: string; // Câu lệnh hỏi (VD: "Xét các mệnh đề sau:"), nằm giữa đề dẫn và 4 mệnh đề
  menhDeA?: string;
  menhDeB?: string;
  menhDeC?: string;
  menhDeD?: string;
  dapAnA?: 'D' | 'S' | string;
  dapAnB?: 'D' | 'S' | string;
  dapAnC?: 'D' | 'S' | string;
  dapAnD?: 'D' | 'S' | string;

  // Dạng 3 & 4 / Đáp án chung
  dapAn: string;
  huongDanGiai?: string;
  mucDo?: 'nhan_biet' | 'thong_hieu' | 'van_dung' | 'van_dung_cao' | string;
  diem?: number | string;
  tikzCode?: string;
  hinhAnh?: string; // Base64 data URL or image URL for illustration
}

export interface ExamSection {
  ten: string;
  loai: QuestionType;
  diemMoiCau?: number;
  cauHoi: Question[];
}

export interface ExamMeta {
  mon?: string;
  lop?: string;
  thoiGian?: number;
  tieuDe: string;
  truong?: string;
  namHoc?: string;
  thangDiem?: number | string;
  includeAnswers?: boolean;
  deSo?: number;
  tongSoDe?: number;
}

export interface ExamData {
  meta: ExamMeta;
  phan: ExamSection[];
}

export interface ConfigState {
  // Mode: 'nguyen_de' (Toàn bộ đề thi) vs 'cau_le' (Tạo bài tương tự từ ảnh/câu lẻ)
  mode: 'nguyen_de' | 'cau_le';

  // Chế độ cấu trúc đề khi mode === 'nguyen_de'
  // 'y_het_goc': Tự động nhận diện môn học và sao chép Y HỆT cấu trúc, các phần & số câu của đề gốc
  // 'ma_tran_tuy_chinh': Tùy chỉnh số lượng câu từng phần theo ma trận GDPT 2025
  cautrucDe: 'y_het_goc' | 'ma_tran_tuy_chinh';

  // Khi mode === 'nguyen_de'
  soDeCanTao: number; // 1 - 5 đề
  mucDoTuongTu: 'doi_so_lieu' | 'cung_dang' | 'hoan_toan_moi';
  numPart1: number; // Phần I: 4 lựa chọn (mặc định 12 câu)
  numPart2: number; // Phần II: Đúng/Sai (mặc định 4 câu)
  numPart3: number; // Phần III: Trả lời ngắn (mặc định 6 câu)
  numPart4: number; // Phần IV: Tự luận (mặc định 0 câu)
  thoiGian: number;
  tieuDe: string;
  truong?: string;
  namHoc?: string;

  // Độ khó & TikZ (Dùng chung cho cả 'nguyen_de' và 'cau_le')
  soBai: number; // Số bài cần tạo khi mode === 'cau_le'
  doKho: 'tuong_duong' | 'de_hon' | 'kho_hon' | 'nang_cao';
  tikzMode: 'auto' | 'yes' | 'no';
  extraPrompt: string; // Yêu cầu thêm từ giáo viên

  // Tùy chọn chung
  includeAnswers: boolean;
}

export interface ImageFileItem {
  id: string;
  base64: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
}

export interface SourceState {
  type: 'docx' | 'pdf' | 'image' | 'paste' | 'text';
  textContent?: string;
  htmlContent?: string;
  fileData?: ImageFileItem[];
  mathTypeCount?: number;
  wordCount?: number;
  imageCount?: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface ExamHistoryItem {
  id: string;
  title: string;
  mon?: string;
  lop?: string;
  timestamp: string;
  examData: ExamData;
  questionCount?: number;
  thoiGian?: number;
}

export type LicenseTier = 'trial' | '1_year' | 'lifetime' | 'blocked' | 'custom_days';

export interface FirebaseUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  tier: LicenseTier;
  trialRemaining: number;
  trialTotal: number;
  expireAt?: number | null; // Milliseconds timestamp for 1_year
  createdAt: number;
  lastLoginAt: number;
  approvedAt?: number | null;
  approvedBy?: string;
  notes?: string;
}

export interface FirebaseConfigData {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}
