import { ExamData, ExamHistoryItem } from '../types';

const DB_NAME = 'SimilarExamStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'exam_history';
const DRAFT_STORE = 'current_draft';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB không được hỗ trợ trên trình duyệt này.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('mon', 'mon', { unique: false });
      }
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không thể mở IndexedDB.'));
  });
}

/**
 * Lưu đề thi vào Lịch sử (IndexedDB)
 */
export async function saveExamToHistory(
  exam: ExamData,
  customTitle?: string
): Promise<ExamHistoryItem> {
  const db = await openDatabase();
  const totalQuestions = (exam.phan || []).reduce(
    (acc, p) => acc + (p.cauHoi || []).length,
    0
  );

  const title =
    customTitle ||
    exam.meta.tieuDe ||
    `${exam.meta.mon || 'Môn học'} ${exam.meta.lop || ''}`.trim() ||
    'Đề thi mới';

  const historyItem: ExamHistoryItem = {
    id: `exam_hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    mon: exam.meta.mon || 'Toán',
    lop: exam.meta.lop || 'Lớp 12',
    timestamp: new Date().toISOString(),
    examData: JSON.parse(JSON.stringify(exam)),
    questionCount: totalQuestions,
    thoiGian: exam.meta.thoiGian || 90,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.put(historyItem);

    req.onsuccess = () => resolve(historyItem);
    req.onerror = () => reject(req.error || new Error('Không thể lưu vào IndexedDB.'));
  });
}

/**
 * Lấy toàn bộ danh sách đề thi trong lịch sử (mới nhất xếp trước)
 */
export async function getAllHistory(): Promise<ExamHistoryItem[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = (req.result || []) as ExamHistoryItem[];
        // Sắp xếp mới nhất lên đầu
        items.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[History DB] Lỗi lấy lịch sử:', err);
    return [];
  }
}

/**
 * Xóa một mục đề thi khỏi lịch sử theo ID
 */
export async function deleteHistoryItem(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Xóa toàn bộ lịch sử đề thi
 */
export async function clearAllHistory(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Tự động lưu bản nháp hiện tại để không bị mất khi F5 tải lại trang
 */
export async function saveCurrentDraft(exam: ExamData | null): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([DRAFT_STORE], 'readwrite');
    const store = transaction.objectStore(DRAFT_STORE);

    if (!exam) {
      store.delete('active_draft');
    } else {
      store.put({ id: 'active_draft', exam, updatedAt: new Date().toISOString() });
    }
  } catch (err) {
    console.warn('[Draft DB] Lỗi lưu bản nháp:', err);
  }
}

/**
 * Khôi phục bản nháp đề thi đã làm dở
 */
export async function loadCurrentDraft(): Promise<ExamData | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction([DRAFT_STORE], 'readonly');
      const store = transaction.objectStore(DRAFT_STORE);
      const req = store.get('active_draft');

      req.onsuccess = () => {
        if (req.result && req.result.exam) {
          resolve(req.result.exam as ExamData);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Xuất toàn bộ lịch sử ra file JSON sao lưu (Backup)
 */
export async function exportHistoryBackupJson(): Promise<string> {
  const all = await getAllHistory();
  return JSON.stringify(all, null, 2);
}

/**
 * Nhập lịch sử từ file JSON sao lưu (Restore)
 */
export async function importHistoryBackupJson(jsonStr: string): Promise<number> {
  try {
    const items = JSON.parse(jsonStr) as ExamHistoryItem[];
    if (!Array.isArray(items)) throw new Error('File sao lưu không hợp lệ.');

    const db = await openDatabase();
    let importedCount = 0;

    for (const item of items) {
      if (item.id && item.examData) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const req = store.put(item);
          req.onsuccess = () => {
            importedCount++;
            resolve();
          };
          req.onerror = () => reject(req.error);
        });
      }
    }

    return importedCount;
  } catch (err) {
    console.error('Lỗi nhập lịch sử:', err);
    throw err;
  }
}
