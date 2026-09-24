import React, { useState, useCallback, useEffect } from 'react';
import { ApiKeyInfo, ConfigState, SourceState, ExamData, ToastMessage, ExamHistoryItem, FirebaseUserProfile } from './types';
import { useLocalStorage } from './lib/useLocalStorage';
import { useUndoRedo } from './lib/useUndoRedo';
import { buildExamPrompt, callGeminiRoundRobin, parseExam, DEFAULT_KEYS_STORAGE_KEY, DEFAULT_MODEL_STORAGE_KEY, generateTikzFromQuestion, detectShapeType, normalizeModelName } from './lib/gemini';
import { renderTikzToSvg } from './lib/tikzRenderer';
import { svgStringToPngBase64 } from './lib/tableAndChartHelper';
import {
  loginWithGoogle,
  logoutGoogle,
  subscribeAuthChange,
  subscribeUserProfile,
  ensureUserProfile,
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
  clearCurrentDraft,
  hasDraft,
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
import { GuideModal } from './components/GuideModal';

export function App() {
  // 1. Storage & State Management
  const [apiKeys, setApiKeys] = useLocalStorage<ApiKeyInfo[]>(DEFAULT_KEYS_STORAGE_KEY, []);
  const [models, setModels] = useLocalStorage<{ genModel: string; editModel: string }>(DEFAULT_MODEL_STORAGE_KEY, {
    genModel: 'gemini-3.6-flash',
    editModel: 'gemini-3.6-flash',
  });

  // Tự động nâng cấp model sang gemini-3.6-flash nếu localStorage còn lưu model cũ (3.5 hoặc 2.x)
  useEffect(() => {
    if (models.genModel !== 'gemini-3.6-flash' && models.genModel !== 'gemini-3.7-flash') {
      setModels({
        genModel: 'gemini-3.6-flash',
        editModel: 'gemini-3.6-flash',
      });
    }
  }, []);

  // Tự động khôi phục key nếu tất cả đang bị đánh dấu nhầm là 'invalid' hoặc 'rate_limited'
  useEffect(() => {
    if (apiKeys.length > 0 && apiKeys.every((k) => k.status === 'invalid' || k.status === 'rate_limited')) {
      const resetKeys = apiKeys.map((k) => ({ ...k, status: 'untested' as const }));
      setApiKeys(resetKeys);
    }
  }, []);

  // Auth & License State (Firebase)
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<FirebaseUserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true); // true until Firebase resolves auth state
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isFirebaseConfigOpen, setIsFirebaseConfigOpen] = useState(false);
  const [isLicenseStatusOpen, setIsLicenseStatusOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
    loaiMaTran: 'toan_khtn',
    numPart1: 12,
    numPart2: 4,
    numPart3: 6,
    numPart4: 0,
    numEngPhonetics: 4,
    numEngUse: 18,
    numEngReading: 10,
    numEngWriting: 8,
    thoiGian: 90,
    tieuDe: 'ĐỀ KIỂM TRA TƯƠNG TỰ',
    truong: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO',
    namHoc: '2025 - 2026',
    soBai: 3,
    extraPrompt: '',
    targetQuestionType: 'auto',
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

  // Quản lý trọn bộ các đề thi khi tạo nhiều đề (soDeCanTao >= 1)
  const [examList, setExamList] = useState<ExamData[]>([]);
  const [activeExamIndex, setActiveExamIndex] = useState<number>(0);

  const handleUpdateCurrentExam = (newExam: ExamData) => {
    setExam(newExam);
    setExamList((prev) => {
      if (prev.length === 0) return [newExam];
      const copy = [...prev];
      if (copy[activeExamIndex]) {
        copy[activeExamIndex] = newExam;
      }
      return copy;
    });
  };

  const handleSelectExamIndex = (idx: number) => {
    if (examList[idx]) {
      setActiveExamIndex(idx);
      resetExamState(examList[idx]);
    }
  };

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
      setIsAuthLoading(false); // Firebase đã xác định trạng thái đăng nhập
      if (!user) {
        setUserProfile(null);
      } else {
        ensureUserProfile(user)
          .then((p) => setUserProfile(p))
          .catch((err) => console.warn('Lỗi ensureUserProfile:', err));
      }
    });
    return () => {
      if (unsubAuth) unsubAuth();
    };
  }, []);

  // Lắng nghe thay đổi hồ sơ bản quyền người dùng từ Firestore (Realtime)
  useEffect(() => {
    if (!currentUser) return;
    const unsubProfile = subscribeUserProfile(
      currentUser.uid,
      (profile) => {
        if (profile) setUserProfile(profile);
      },
      currentUser
    );
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

  // Kiểm tra quyền hạn tạo đề và tải file Word
  const checkCanPerformAction = useCallback((): boolean => {
    if (!isFirebaseConfigured()) {
      return true;
    }

    if (!currentUser) {
      addToast('warning', 'Vui lòng đăng nhập Google để tiếp tục tạo và tải đề thi!');
      handleLoginGoogle();
      return false;
    }

    if (userProfile) {
      if (userProfile.tier === 'blocked') {
        setIsLicenseStatusOpen(true);
        return false;
      }
      if (
        (userProfile.tier === '1_year' || userProfile.tier === 'custom_days') &&
        (userProfile.expireAt || 0) <= Date.now()
      ) {
        setIsLicenseStatusOpen(true);
        return false;
      }
      if (userProfile.tier === 'trial' && (userProfile.trialRemaining || 0) <= 0) {
        setIsLicenseStatusOpen(true);
        return false;
      }
    }

    return true;
  }, [currentUser, userProfile, handleLoginGoogle]);

  // Handler for source change with intelligent subject detection
  const handleChangeSource = (newSource: SourceState) => {
    setSource(newSource);
    const text = (newSource.textContent || '').toLowerCase();
    const hasEnglishKeywords =
      text.includes('phonetics') ||
      text.includes('use of english') ||
      text.includes('tiếng anh') ||
      text.includes('english') ||
      text.includes('reading passage') ||
      (newSource.fileData && newSource.fileData.some((f) => /anh|english/i.test(f.fileName)));
    if (hasEnglishKeywords && config.loaiMaTran !== 'tieng_anh') {
      setConfig((prev) => ({ ...prev, loaiMaTran: 'tieng_anh' }));
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

    // 1. Kiểm tra Đăng nhập Google & Hạn mức bản quyền tạo/tải
    if (!checkCanPerformAction()) {
      return;
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

      // Phát hiện câu nào trong đề gốc có hình vẽ và gắn nhãn [CÓ_HÌNH] để AI biết câu nào cần vẽ TikZ
      // Chỉ áp dụng với source text (không áp dụng với file ảnh/PDF nhị phân vì AI tự đọc hình)
      if (source.textContent && source.type !== 'image' && source.type !== 'pdf') {
        const figureKeywords = ['xem hình bên', 'như hình bên', 'trong hình bên', 'hình vẽ dưới đây', 'cho hình vẽ', 'bảng biến thiên dưới đây', 'đồ thị hàm số dưới đây', 'hình minh họa', '\\begin{tikzpicture}', '[hình]', '[ảnh]', '.png', '.jpg', 'base64,', '!['];
        const cauRegex = /^(Câu\s*\d+[\s.:)]|\d+[\s.])/;

        // Xử lý theo từng dòng: nhận diện đầu câu và đánh dấu khối câu nếu có hình
        const lines = sourceTextForPrompt.split('\n');
        let inFigureBlock = false;
        let blockStart = -1;
        const markedLines = [...lines];

        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (cauRegex.test(trimmed)) {
            // Đây là đầu câu mới
            blockStart = i;
            inFigureBlock = false;
          }
          // Kiểm tra từ khóa hình trong dòng hiện tại
          if (blockStart >= 0) {
            const lowerLine = lines[i].toLowerCase();
            if (figureKeywords.some((kw) => lowerLine.includes(kw.toLowerCase()))) {
              // Gắn [CÓ_HÌNH] vào đầu câu (dòng blockStart)
              if (!markedLines[blockStart].includes('[CÓ_HÌNH]')) {
                markedLines[blockStart] = markedLines[blockStart].replace(
                  cauRegex,
                  (m) => m + ' [CÓ_HÌNH]'
                );
              }
              inFigureBlock = true;
            }
          }
        }
        sourceTextForPrompt = markedLines.join('\n');

        // Nếu source có hình ảnh nhúng (docx), ghi chú chung
        if (source.imageCount && source.imageCount > 0) {
          sourceTextForPrompt = `[Lưu ý: Đề gốc có ${source.imageCount} hình ảnh nhúng. Câu nào đề gốc có hình thì câu tương tự phải sinh TikZ, câu không có hình thì KHÔNG sinh TikZ]\n\n` + sourceTextForPrompt;
        }
      }


      const totalExams = config.mode === 'cau_le' ? 1 : Math.max(1, Math.min(5, config.soDeCanTao || 1));
      const generatedExams: ExamData[] = [];

      for (let deIdx = 1; deIdx <= totalExams; deIdx++) {
        if (totalExams > 1) {
          addToast('info', `⏳ Đang tạo Đề số ${deIdx}/${totalExams}...`);
        }

        // 1. Build structured prompt cho mã đề deIdx
        const prompt = buildExamPrompt(sourceTextForPrompt, config, source.mathTypeCount || 0, deIdx);

        // 2. Call Gemini API via round-robin
        const rawResponse = await callGeminiRoundRobin(prompt, models.genModel, inlineFiles);

        // 3. Parse block output format without JSON.parse
        const parsedExamData = parseExam(rawResponse);

        if (!parsedExamData.phan || parsedExamData.phan.length === 0) {
          throw new Error(`AI không tạo đúng cấu trúc cho Đề số ${deIdx}. Vui lòng thử lại!`);
        }

        if (totalExams > 1) {
          parsedExamData.meta.deSo = deIdx;
          parsedExamData.meta.tongSoDe = totalExams;
          parsedExamData.meta.tieuDe = `${config.tieuDe || 'ĐỀ THI TƯƠNG TỰ'} - ĐỀ SỐ ${deIdx}`;
        }

        // 5. Quét và TỰ ĐỘNG VẼ HÌNH SVG CHÍNH XÁC cho mọi câu có hình học trong đề này
        const allQuestions = parsedExamData.phan.flatMap((p) => p.cauHoi);

        // Bước 5a: Phát hiện và xử lý nếu AI vô tình sao chép trùng 100% mã TikZ giữa các câu
        const tikzCountMap = new Map<string, number>();
        allQuestions.forEach((q) => {
          if (q.tikzCode && q.tikzCode.trim().length > 20) {
            const normalized = q.tikzCode.replace(/\s+/g, ' ').trim();
            tikzCountMap.set(normalized, (tikzCountMap.get(normalized) || 0) + 1);
          }
        });

        const seenTikzSet = new Set<string>();
        allQuestions.forEach((q) => {
          if (q.tikzCode) {
            const normalized = q.tikzCode.replace(/\s+/g, ' ').trim();
            if (q.tikzCode.includes('[CAN_VE]')) {
              q.tikzCode = '';
              q.hinhAnh = undefined;
            } else if ((tikzCountMap.get(normalized) || 0) > 1) {
              if (seenTikzSet.has(normalized)) {
                q.tikzCode = '';
                q.hinhAnh = undefined;
              } else {
                seenTikzSet.add(normalized);
              }
            }
          }
        });

        // Bước 5b (LƯỢT 2 TỰ ĐỘNG): Gọi AI riêng từng câu để vẽ hình chuẩn xác cho câu chưa có TikZ hoặc bị xóa trùng
        if (config.tikzMode !== 'no') {
          const needsFigurePattern = /(đường cong trong hình|hình vẽ dưới đây|như hình bên|trong hình bên|quan sát hình|cho hình vẽ|đồ thị hàm số (?:ở|trong) hình|hình bên là đồ thị|đồ thị như hình|hình dưới đây là đồ thị)/i;

          const questionsNeedingTikz = allQuestions.filter((q) => {
            if (q.tikzCode && q.tikzCode.includes('tikzpicture')) return false;
            if (q.noiDung && /\\begin\{tabular/i.test(q.noiDung)) return false;

            const textToTest = `${q.noiDung || ''} ${q.cauLenh || ''}`;
            return needsFigurePattern.test(textToTest);
          });

          if (questionsNeedingTikz.length > 0) {
            for (let i = 0; i < questionsNeedingTikz.length; i++) {
              const q = questionsNeedingTikz[i];
              try {
                const fullPromptForTikz = [
                  `Câu ${q.stt}: ${q.noiDung}`,
                  q.cauLenh ? `Câu hỏi: ${q.cauLenh}` : '',
                  q.optionA ? `A. ${q.optionA}` : '',
                  q.optionB ? `B. ${q.optionB}` : '',
                  q.optionC ? `C. ${q.optionC}` : '',
                  q.optionD ? `D. ${q.optionD}` : '',
                  q.dapAn ? `Phương án đúng: ${q.dapAn}` : '',
                ].filter(Boolean).join('\n');

                const generatedTikz = await generateTikzFromQuestion(fullPromptForTikz, '', models.genModel);
                if (generatedTikz && generatedTikz.includes('tikzpicture')) {
                  q.tikzCode = generatedTikz;
                }
              } catch (err) {
                console.warn(`[Pass2-TikZ] Không thể sinh TikZ riêng cho câu ${q.stt}:`, err);
              }
            }
          }
        }

        // Bước 5c: Render SVG sắc nét cho các câu đã có mã TikZ riêng biệt từ AI
        const questionsWithTikz = allQuestions.filter((q) => q.tikzCode && q.tikzCode.includes('tikzpicture'));
        for (let i = 0; i < questionsWithTikz.length; i++) {
          const q = questionsWithTikz[i];
          try {
            const svg = await renderTikzToSvg(q.tikzCode!);
            if (svg) {
              const png = await svgStringToPngBase64(svg);
              if (png) {
                q.hinhAnh = png;
              }
            }
          } catch (renderErr) {
            console.warn(`[TikZ-Render] Câu ${q.stt}:`, renderErr);
          }
        }

        generatedExams.push(parsedExamData);

        // Tự động lưu từng đề vào Lịch sử IndexedDB
        try {
          await saveExamToHistory(parsedExamData);
        } catch (histErr) {
          console.warn(`Lỗi tự động lưu lịch sử đề ${deIdx}:`, histErr);
        }

        // Nếu là Đề số 1, hiển thị ngay lập tức lên màn hình để giáo viên theo dõi
        if (deIdx === 1) {
          setExamList([...generatedExams]);
          setActiveExamIndex(0);
          resetExamState(parsedExamData);
        }
      }

      // Trừ 1 lượt dùng thử trên Cloud Firestore nếu đang dùng gói Dùng thử
      if (currentUser && userProfile && userProfile.tier === 'trial') {
        try {
          const remaining = await decrementTrialCredit(currentUser.uid);
          if (remaining <= 0) {
            addToast('warning', '⚠️ Bạn đã dùng hết 5 lượt dùng thử! Hãy liên hệ NGUYỄN BỈNH KHÔI (0909 461 641) để kích hoạt bản quyền Pro không giới hạn.');
            setIsLicenseStatusOpen(true);
          } else {
            addToast('info', `🎁 Bạn còn ${remaining}/5 lượt tạo đề dùng thử.`);
          }
        } catch (creditErr) {
          console.warn('Lỗi trừ lượt dùng thử:', creditErr);
        }
      }

      setExamList(generatedExams);
      setActiveExamIndex(0);
      resetExamState(generatedExams[0]);
      await refreshHistory();

      if (totalExams > 1) {
        addToast('success', `✨ Đã tạo thành công trọn bộ ${totalExams} đề thi tương tự!`);
      } else {
        addToast('success', '✨ Đã tạo xong đề thi tương tự kèm đầy đủ hình vẽ SVG!');
      }

    } catch (err: any) {
      console.error('Exam Generation Error:', err);
      addToast('error', err.message || 'Lỗi không xác định khi tạo đề');
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Login Guard ───────────────────────────────────────────────────────────
  // Nếu Firebase được cấu hình mà chưa đăng nhập → hiện màn hình đăng nhập
  if (isFirebaseConfigured()) {
    // Đang chờ Firebase xác định trạng thái đăng nhập
    if (isAuthLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 text-sm">Đang khởi tạo...</p>
          </div>
        </div>
      );
    }

    // Chưa đăng nhập → màn hình login
    if (!currentUser) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-8 border border-slate-100">
            {/* Logo / Header */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Tạo Bài Tập Tương Tự</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Công cụ AI tạo đề thi tương tự dành cho giáo viên.<br />
                Đăng nhập để bắt đầu sử dụng.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '🤖', label: 'AI tạo đề tương tự' },
                { icon: '📝', label: 'Xuất Word chuẩn' },
                { icon: '📐', label: 'Vẽ hình TikZ tự động' },
                { icon: '🔒', label: '5 lượt dùng thử miễn phí' },
              ].map(f => (
                <div key={f.label} className="flex items-center space-x-2 bg-slate-50 rounded-xl px-3 py-2">
                  <span className="text-lg">{f.icon}</span>
                  <span className="text-xs text-slate-700 font-medium">{f.label}</span>
                </div>
              ))}
            </div>

            {/* Login Button */}
            <button
              onClick={handleLoginGoogle}
              className="w-full flex items-center justify-center space-x-3 px-6 py-3.5 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-indigo-300 rounded-2xl font-semibold text-slate-700 transition-all shadow-sm hover:shadow-md cursor-pointer group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Đăng nhập bằng Google</span>
            </button>

            <div className="text-center text-xs space-y-1">
              <p className="text-slate-500">
                Lần đầu đăng nhập sẽ được cấp <strong className="text-indigo-600 font-bold">5 lượt dùng thử miễn phí</strong>
              </p>
              <p className="text-[11px] text-slate-500">
                Hỗ trợ & duyệt kích hoạt Pro: <a href="https://zalo.me/0909461641" target="_blank" rel="noopener noreferrer" className="text-indigo-700 font-bold hover:underline">NGUYỄN BỈNH KHÔI - 0909 461 641</a> (Zalo/Hotline)
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-xs text-slate-400">© 2025 Tạo Bài Tập Tương Tự · Dành cho giáo viên</p>
        </div>
      );
    }
  }

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
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenLicenseStatus={() => setIsLicenseStatusOpen(true)}
      />

      {/* Main Layout Container */}
      <main className="max-w-[1500px] w-full mx-auto px-3 sm:px-5 lg:px-7 py-5 sm:py-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column (Input & Controls - 5/12 for comfortable breathing room) */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-3.5 no-print">
            <SourcePanel
              source={source}
              onChangeSource={handleChangeSource}
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
          <div className="lg:col-span-7 xl:col-span-7 space-y-3.5">
            {/* Export Toolbar (visible when an exam exists) */}
            {exam && (
              <ExportToolbar
                exam={exam}
                examList={examList}
                activeExamIndex={activeExamIndex}
                onSelectExamIndex={handleSelectExamIndex}
                includeAnswers={config.includeAnswers}
                onOpenShuffleModal={() => setIsShuffleOpen(true)}
                onSaveToHistory={handleSaveToHistory}
                onAddToast={addToast}
                onCheckLicense={checkCanPerformAction}
              />
            )}

            {/* Exam Tabs View & Editor */}
            <ExamTabs
              exam={exam}
              source={source}
              onChangeExam={handleUpdateCurrentExam}
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
        onSelectExam={(loadedExam) => {
          setExamList([loadedExam]);
          setActiveExamIndex(0);
          resetExamState(loadedExam);
        }}
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

      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Footer chân trang */}
      <footer className="py-3 px-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white/80 backdrop-blur-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-4 no-print mt-auto">
        <span>© 2025 Tạo Bài Tập Tương Tự · Dành cho giáo viên</span>
        <span className="hidden sm:inline text-slate-300">|</span>
        <span>
          Hỗ trợ & Đăng ký bản quyền Pro: <a href="https://zalo.me/0909461641" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-700 hover:underline">NGUYỄN BỈNH KHÔI - 0909 461 641</a> (Zalo/Hotline)
        </span>
      </footer>

      {/* Stackable Status Toast */}
      <StatusToast toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}

export default App;
