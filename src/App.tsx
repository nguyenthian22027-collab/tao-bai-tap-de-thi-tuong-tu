import React, { useState, useCallback, useEffect } from 'react';
import { ApiKeyInfo, ConfigState, SourceState, ExamData, ToastMessage, ExamHistoryItem, FirebaseUserProfile } from './types';
import { useLocalStorage } from './lib/useLocalStorage';
import { useUndoRedo } from './lib/useUndoRedo';
import { buildExamPrompt, callGeminiRoundRobin, parseExam, DEFAULT_KEYS_STORAGE_KEY, DEFAULT_MODEL_STORAGE_KEY } from './lib/gemini';
import { renderTikzToSvg } from './lib/tikzRenderer';
import { svgStringToPngBase64 } from './lib/tableAndChartHelper';
import {
  loginWithGoogle,
  logoutGoogle,
  subscribeAuthChange,
  subscribeUserProfile,
  decrementTrialCredit,
  isUserAdmin,
  verifyAdminPin,
} from './lib/licenseService';
import { isFirebaseConfigured } from './lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import {
  getAllHistory,
  saveExamToHistory,
  deleteHistoryItem,
  clearAllHistory,
  saveCurrentDraft,
  loadCurrentDraft,
} from './lib/historyDb';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { SourcePanel } from './components/SourcePanel';
import { ConfigPanel } from './components/ConfigPanel';
import { GenerateButton } from './components/GenerateButton';
import { ExamTabs } from './components/ExamTabs';
import { ExportToolbar } from './components/ExportToolbar';
import { ShuffleModal } from './components/ShuffleModal';
import { HistoryPanel } from './components/HistoryPanel';
import { StatusToast } from './components/StatusToast';
import { AdminPanelModal } from './components/AdminPanelModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { LicenseStatusModal } from './components/LicenseStatusModal';

export function App() {
  // 1. Storage & State Management
  const [apiKeys, setApiKeys] = useLocalStorage<ApiKeyInfo[]>(DEFAULT_KEYS_STORAGE_KEY, []);
  const [models, setModels] = useLocalStorage<{ genModel: string; editModel: string }>(DEFAULT_MODEL_STORAGE_KEY, {
    genModel: 'gemini-3.5-flash',
    editModel: 'gemini-3.5-flash-lite',
  });

  // Auth & License State (Firebase)
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<FirebaseUserProfile | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isFirebaseConfigOpen, setIsFirebaseConfigOpen] = useState(false);
  const [isLicenseStatusOpen, setIsLicenseStatusOpen] = useState(false);

  const [history, setHistory] = useState<ExamHistoryItem[]>([]);

  // Source state
  const [source, setSource] = useState<SourceState>({
    type: 'docx',
  });

  // Config state
  const [config, setConfig] = useState<ConfigState>({
    mode: 'nguyen_de',
    cautrucDe: 'y_het_goc',
    soDeCanTao: 1,
    mucDoTuongTu: 'cung_dang',
    doKho: 'tuong_duong',
    tikzMode: 'auto',
    numPart1: 12,
    numPart2: 4,
    numPart3: 6,
    numPart4: 0,
    thoiGian: 90,
    tieuDe: 'ĐỀ KIỂM TRA TƯƠNG TỰ',
    truong: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO',
    namHoc: '2025 - 2026',
    soBai: 3,
    extraPrompt: '',
    includeAnswers: true,
  });

  // Exam undo/redo state stack (max 50)
  const {
    state: exam,
    setState: setExam,
    undo,
    redo,
    canUndo,
    canRedo,
    resetState: resetExamState,
  } = useUndoRedo<ExamData | null>(null, 50);

  // UI Toggles & Modals
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShuffleOpen, setIsShuffleOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Helper to append stackable toast notifications
  const addToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto dismiss after 5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const validKeyCount = apiKeys.filter((k) => k.status === 'valid').length;

  // Lấy danh sách lịch sử từ IndexedDB
  const refreshHistory = useCallback(async () => {
    try {
      const all = await getAllHistory();
      setHistory(all);
    } catch (err) {
      console.warn('Lỗi lấy lịch sử:', err);
    }
  }, []);

  // Khôi phục bản nháp và nạp lịch sử khi mở ứng dụng
  useEffect(() => {
    refreshHistory();
    loadCurrentDraft().then((draft) => {
      if (draft && !exam) {
        resetExamState(draft);
      }
    });
  }, [refreshHistory]);

  // Tự động lưu bản nháp hiện tại
  useEffect(() => {
    saveCurrentDraft(exam);
  }, [exam]);

  // Lưu bản đề thi hiện tại vào lịch sử
  const handleSaveToHistory = async () => {
    if (!exam) return;
    try {
      const saved = await saveExamToHistory(exam);
      await refreshHistory();
      addToast('success', `💾 Đã lưu "${saved.title}" vào Lịch sử!`);
    } catch (err: any) {
      addToast('error', `Lưu thất bại: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      await deleteHistoryItem(id);
      await refreshHistory();
      addToast('info', 'Đã xóa đề thi khỏi lịch sử.');
    } catch (err: any) {
      addToast('error', `Lỗi xóa đề thi: ${err.message}`);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử đề thi?')) return;
    try {
      await clearAllHistory();
      setHistory([]);
      addToast('info', 'Đã xóa toàn bộ lịch sử đề thi.');
    } catch (err: any) {
      addToast('error', `Lỗi xóa lịch sử: ${err.message}`);
    }
  };

  // Lắng nghe trạng thái đăng nhập Firebase Auth
  useEffect(() => {
    const unsubAuth = subscribeAuthChange((user) => {
      setCurrentUser(user);
      if (!user) setUserProfile(null);
    });
    return () => {
      if (unsubAuth) unsubAuth();
    };
  }, []);

  // Lắng nghe thay đổi hồ sơ bản quyền người dùng từ Firestore (Realtime)
  useEffect(() => {
    if (!currentUser) return;
    const unsubProfile = subscribeUserProfile(currentUser.uid, (profile) => {
      setUserProfile(profile);
    });
    return () => {
      if (unsubProfile) unsubProfile();
    };
  }, [currentUser]);

  const handleLoginGoogle = async () => {
    if (!isFirebaseConfigured()) {
      setIsFirebaseConfigOpen(true);
      return;
    }
    try {
      const user = await loginWithGoogle();
      addToast('success', `✨ Chào mừng giáo viên ${user.displayName || user.email}!`);
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        addToast('error', `Đăng nhập thất bại: ${err.message || 'Lỗi không xác định'}`);
      }
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      await logoutGoogle();
      setCurrentUser(null);
      setUserProfile(null);
      addToast('info', 'Đã đăng xuất tài khoản Google.');
    } catch (err: any) {
      addToast('error', `Đăng xuất thất bại: ${err.message}`);
    }
  };

  const handleOpenAdmin = () => {
    if (isUserAdmin(currentUser?.email)) {
      setIsAdminModalOpen(true);
    } else {
      const pin = window.prompt('Nhập mã PIN Quản trị viên:');
      if (pin && verifyAdminPin(pin)) {
        setIsAdminModalOpen(true);
      } else if (pin) {
        addToast('error', 'Mã PIN Quản trị viên không chính xác!');
      }
    }
  };

  // Primary Exam Generation Dispatcher
  const handleGenerateExam = async () => {
    // Check if source exists
    const hasText = source.textContent && source.textContent.trim().length > 0;
    const hasFiles = source.fileData && source.fileData.length > 0;

    if (!hasText && !hasFiles) {
      addToast('warning', 'Vui lòng nạp nội dung đề thi gốc (Word, PDF, Ảnh hoặc dán Text) trước!');
      return;
    }

    // 1. Kiểm tra Đăng nhập Google & Hạn mức bản quyền (nếu Firebase đã cấu hình)
    if (isFirebaseConfigured()) {
      if (!currentUser) {
        addToast('warning', 'Vui lòng đăng nhập Google để nhận 5 lượt dùng thử và tạo đề!');
        try {
          await handleLoginGoogle();
        } catch {
          return;
        }
        return;
      }

      if (userProfile) {
        if (userProfile.tier === 'blocked') {
          setIsLicenseStatusOpen(true);
          return;
        }
        if (userProfile.tier === '1_year' && (userProfile.expireAt || 0) <= Date.now()) {
          setIsLicenseStatusOpen(true);
          return;
        }
        if (userProfile.tier === 'trial' && (userProfile.trialRemaining || 0) <= 0) {
          setIsLicenseStatusOpen(true);
          return;
        }
      }
    }

    // 2. Kiểm tra Gemini API Key riêng của người dùng (người dùng vẫn phải nhập API key của họ)
    if (apiKeys.length === 0) {
      addToast('error', 'Chưa có Google Gemini API Key. Hãy nhấn "Cài đặt Key" để thêm ít nhất 1 key!');
      setIsSettingsOpen(true);
      return;
    }

    setIsGenerating(true);
    try {
      let sourceTextForPrompt = source.textContent || 'Đề thi dạng file nhị phân đính kèm.';
      let inlineFiles: { mimeType: string; base64Data: string }[] | undefined;

      if (source.fileData && source.fileData.length > 0 && source.type !== 'docx') {
        inlineFiles = source.fileData.map((f) => ({
          mimeType: f.mimeType,
          base64Data: f.base64,
        }));
      }

      // 1. Build structured prompt
      const prompt = buildExamPrompt(sourceTextForPrompt, config, source.mathTypeCount || 0);

      // 2. Call Gemini API via round-robin
      const rawResponse = await callGeminiRoundRobin(prompt, models.genModel, inlineFiles);

      // 3. Parse block output format without JSON.parse
      const parsedExamData = parseExam(rawResponse);

      if (!parsedExamData.phan || parsedExamData.phan.length === 0) {
        throw new Error('AI không tạo đúng cấu trúc đề thi. Vui lòng thử lại!');
      }

      // 4. Hiển thị đề ngay để người dùng thấy
      resetExamState(parsedExamData);
      addToast('success', '✨ Đã tạo xong đề thi tương tự! Đang vẽ hình minh họa...');

      // 5. Trừ 1 lượt dùng thử trên Cloud Firestore nếu đang dùng gói Dùng thử
      if (currentUser && userProfile && userProfile.tier === 'trial') {
        try {
          const remaining = await decrementTrialCredit(currentUser.uid);
          addToast('info', `🎁 Bạn còn ${remaining}/5 lượt tạo đề dùng thử.`);
        } catch (creditErr) {
          console.warn('Lỗi trừ lượt dùng thử:', creditErr);
        }
      }

      // 6. Auto-Render TikZ → SVG → PNG (chạy ngầm, không block UI)
      const allQuestionsWithTikz = parsedExamData.phan
        .flatMap((p) => p.cauHoi)
        .filter((q) => q.tikzCode && q.tikzCode.trim());

      if (allQuestionsWithTikz.length > 0) {
        (async () => {
          let renderedCount = 0;
          for (const q of allQuestionsWithTikz) {
            try {
              const svg = await renderTikzToSvg(q.tikzCode!);
              if (svg) {
                const png = await svgStringToPngBase64(svg);
                if (png) {
                  q.hinhAnh = png;
                  renderedCount++;
                }
              }
            } catch (e) {
              console.warn(`[Auto-Render] Lỗi vẽ hình câu ${q.stt}:`, e);
            }
          }
          if (renderedCount > 0) {
            addToast('success', `🖼️ Đã vẽ sẵn ${renderedCount} hình minh họa — Tải Word sẽ có ảnh ngay!`);
          }
        })();
      }

      // Tự động lưu vào Lịch sử IndexedDB
      try {
        await saveExamToHistory(parsedExamData);
        await refreshHistory();
      } catch (histErr) {
        console.warn('Lỗi tự động lưu lịch sử:', histErr);
      }

    } catch (err: any) {
      console.error('Exam Generation Error:', err);
      addToast('error', err.message || 'Lỗi không xác định khi tạo đề');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleHistory={() => setIsHistoryOpen(!isHistoryOpen)}
        hasKeys={apiKeys.length > 0}
        validKeyCount={validKeyCount}
        historyCount={history.length}
        currentUser={currentUser}
        userProfile={userProfile}
        isAdmin={isUserAdmin(currentUser?.email)}
        onLoginGoogle={handleLoginGoogle}
        onLogoutGoogle={handleLogoutGoogle}
        onOpenAdminPanel={handleOpenAdmin}
        onOpenFirebaseConfig={() => setIsFirebaseConfigOpen(true)}
      />

      {/* Main Layout Container */}
      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (Input & Controls - 5/12 for comfortable breathing room) */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-4 no-print">
            <SourcePanel
              source={source}
              onChangeSource={setSource}
              onAddToast={addToast}
            />

            <ConfigPanel
              config={config}
              onChangeConfig={setConfig}
            />

            <GenerateButton
              onGenerate={handleGenerateExam}
              isGenerating={isGenerating}
              disabled={false}
            />
          </div>

          {/* Right Column (Exam Views & Exporters - 7/12 ideal document width) */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-4">
            {/* Export Toolbar (visible when an exam exists) */}
            {exam && (
              <ExportToolbar
                exam={exam}
                includeAnswers={config.includeAnswers}
                onOpenShuffleModal={() => setIsShuffleOpen(true)}
                onSaveToHistory={handleSaveToHistory}
                onAddToast={addToast}
              />
            )}

            {/* Exam Tabs View & Editor */}
            <ExamTabs
              exam={exam}
              source={source}
              onChangeExam={setExam}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              editModel={models.editModel}
              showAnswer={showAnswer}
              onToggleAnswer={() => setShowAnswer(!showAnswer)}
              onAddToast={addToast}
            />
          </div>
        </div>
      </main>

      {/* Modals & Overlays */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        keys={apiKeys}
        onUpdateKeys={setApiKeys}
        genModel={models.genModel}
        onSelectGenModel={(m) => setModels({ ...models, genModel: m })}
        editModel={models.editModel}
        onSelectEditModel={(m) => setModels({ ...models, editModel: m })}
        onAddToast={addToast}
      />

      {exam && (
        <ShuffleModal
          isOpen={isShuffleOpen}
          onClose={() => setIsShuffleOpen(false)}
          exam={exam}
          includeAnswers={config.includeAnswers}
          onAddToast={addToast}
        />
      )}

      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectExam={resetExamState}
        onDeleteHistoryItem={handleDeleteHistoryItem}
        onClearHistory={handleClearHistory}
        onRefreshHistory={refreshHistory}
        onAddToast={addToast}
      />

      {/* Admin Panel Modal */}
      <AdminPanelModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        adminEmail={currentUser?.email}
        onOpenFirebaseConfig={() => setIsFirebaseConfigOpen(true)}
      />

      {/* Firebase Config Modal */}
      <FirebaseConfigModal
        isOpen={isFirebaseConfigOpen}
        onClose={() => setIsFirebaseConfigOpen(false)}
      />

      {/* License Status / Upgrade Modal */}
      <LicenseStatusModal
        isOpen={isLicenseStatusOpen}
        userProfile={userProfile}
        onClose={() => setIsLicenseStatusOpen(false)}
      />

      {/* Stackable Status Toast */}
      <StatusToast toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}

export default App;
