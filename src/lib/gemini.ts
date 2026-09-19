import { ApiKeyInfo, ConfigState, ExamData, Question, ExamSection, QuestionType } from '../types';
import { extractAndParseTabular, isVariationTable, extractQuestionOptions } from './tableAndChartHelper';

export const MODELS = [
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash — Nhanh, phổ thông' },
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite — Nhẹ nhất' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash — Cân bằng' },
  { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash — Mạnh nhất' },
] as const;

export const DEFAULT_KEYS_STORAGE_KEY = 'similarexam_keys_v1';
export const DEFAULT_MODEL_STORAGE_KEY = 'similarexam_model_v1';

/**
 * Gets currently saved API keys from localStorage
 */
export function getStoredApiKeys(): ApiKeyInfo[] {
  try {
    const raw = localStorage.getItem(DEFAULT_KEYS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse API keys from localStorage:', e);
    return [];
  }
}

/**
 * Saves API keys list back to localStorage
 */
export function saveApiKeys(keys: ApiKeyInfo[]): void {
  try {
    localStorage.setItem(DEFAULT_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch (e) {
    console.error('Failed to save API keys to localStorage:', e);
  }
}

/**
 * Tests a single API key using a minimal test payload
 */
export async function testApiKey(keyInfo: ApiKeyInfo, model = 'gemini-3.5-flash'): Promise<{ success: boolean; status: ApiKeyInfo['status']; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(keyInfo.value.trim())}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Trả lời đúng 1 từ "OK".' }] }],
      }),
    });

    if (response.ok) {
      return { success: true, status: 'valid' };
    }

    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || response.statusText;

    if (response.status === 429 || response.status === 403) {
      return { success: false, status: 'rate_limited', error: `Lỗi giới hạn lượt (429/403): ${errMsg}` };
    } else if (response.status === 400 || response.status === 401) {
      return { success: false, status: 'invalid', error: `API Key không hợp lệ (${response.status}): ${errMsg}` };
    }

    return { success: false, status: 'invalid', error: errMsg };
  } catch (err: any) {
    return { success: false, status: 'invalid', error: err.message || 'Lỗi kết nối mạng' };
  }
}

/**
 * Executes Gemini API request with round-robin key selection and fallback error handling
 */
export async function callGeminiRoundRobin(
  prompt: string,
  model = 'gemini-3.5-flash',
  inlineFiles?: { mimeType: string; base64Data: string }[]
): Promise<string> {
  const keys = getStoredApiKeys();

  // If no keys in localStorage, try using process.env or throw user error
  let candidateKeys = keys.filter(k => k.status === 'valid' || k.status === 'untested');

  if (candidateKeys.length === 0 && keys.length > 0) {
    // If all keys are rate-limited or invalid, try resetting rate_limited ones
    candidateKeys = keys.map(k => k.status === 'rate_limited' ? { ...k, status: 'untested' as const } : k);
  }

  if (candidateKeys.length === 0) {
    throw new Error('Chưa có API Key hợp lệ nào! Vui lòng nhấn vào nút "Cài đặt ⚙" ở góc phải màn hình để thêm Google Gemini API Key.');
  }

  // Sort candidate keys by valid status first, then lowest usageCount
  candidateKeys.sort((a, b) => {
    if (a.status === 'valid' && b.status !== 'valid') return -1;
    if (a.status !== 'valid' && b.status === 'valid') return 1;
    return (a.usageCount || 0) - (b.usageCount || 0);
  });

  const errors: string[] = [];

  for (const currentKey of candidateKeys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(currentKey.value.trim())}`;

    // Construct parts
    const parts: any[] = [{ text: prompt }];

    if (inlineFiles && inlineFiles.length > 0) {
      inlineFiles.forEach(f => {
        // Strip data:mime/type;base64, prefix if present
        let cleanBase64 = f.base64Data;
        if (cleanBase64.includes(',')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }

        parts.push({
          inline_data: {
            mime_type: f.mimeType,
            data: cleanBase64,
          },
        });
      });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const errMsg = errorJson.error?.message || response.statusText;

        // Update key status in list
        const allKeys = getStoredApiKeys();
        const keyIndex = allKeys.findIndex(k => k.id === currentKey.id);

        if (response.status === 429 || response.status === 403) {
          if (keyIndex !== -1) {
            allKeys[keyIndex].status = 'rate_limited';
            saveApiKeys(allKeys);
          }
          errors.push(`Key "${currentKey.label}": Đạt giới hạn (429/403)`);
          continue; // Try next key
        } else if (response.status === 400 || response.status === 401) {
          if (keyIndex !== -1) {
            allKeys[keyIndex].status = 'invalid';
            saveApiKeys(allKeys);
          }
          errors.push(`Key "${currentKey.label}": Không hợp lệ (${errMsg})`);
          continue; // Try next key
        } else {
          errors.push(`Key "${currentKey.label}": Lỗi HTTP ${response.status} - ${errMsg}`);
          continue;
        }
      }

      const data = await response.json();
      const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textOutput) {
        throw new Error('Gemini trả về kết quả rỗng.');
      }

      // Success! Update key status and usage count
      const allKeys = getStoredApiKeys();
      const keyIndex = allKeys.findIndex(k => k.id === currentKey.id);
      if (keyIndex !== -1) {
        allKeys[keyIndex].status = 'valid';
        allKeys[keyIndex].lastTested = new Date().toISOString();
        allKeys[keyIndex].usageCount = (allKeys[keyIndex].usageCount || 0) + 1;
        saveApiKeys(allKeys);
      }

      return textOutput;
    } catch (err: any) {
      console.warn(`Key "${currentKey.label}" failed:`, err);
      errors.push(`Key "${currentKey.label}": ${err.message || 'Lỗi mạng'}`);
    }
  }

  throw new Error(`Tất cả API Key đều thất bại:\n${errors.join('\n')}`);
}

/**
 * Sinh ra đoạn quy tắc nhận diện môn học dùng chung cho cả 3 prompt.
 * Giúp AI biết cách trình bày (LaTeX/không LaTeX, TikZ, cấu trúc câu...)
 * tùy theo môn học nhận diện từ đề gốc.
 */
function buildSubjectRules(): string {
  return `
QUY TẮC NHẬN DIỆN MÔN HỌC & CÔ LẬP MÔN HỌC TUYỆT ĐỐI:
Xác định chính xác môn học từ tiêu đề và nội dung đề thi gốc.
TUYỆT ĐỐI KHÔNG LẪN LỘN GIỮA CÁC MÔN: Đề gốc môn nào thì CHỈ ÁP DỤNG 100% cấu trúc, thuật ngữ và định dạng của môn đó!

[NHÓM 1] KHOA HỌC TỰ NHIÊN — Toán, Vật lý, Hóa học, Sinh học:
• BẮT BUỘC dùng LaTeX $...$ (inline) hoặc $$...$$ (display) cho mọi công thức, ký hiệu, đơn vị đo.
• Có thể sinh TikZ nếu câu có hình vẽ hình học, đồ thị, bảng biến thiên.
• Bảng số liệu (bảng tần số, giá trị hàm số): dùng \\begin{tabular}...\\end{tabular}.
• Câu Đúng/Sai: mỗi câu gồm đề dẫn chung + 4 mệnh đề a/b/c/d (MENH_DE_A/B/C/D) chứa khẳng định toán/khtn.
• TUYỆT ĐỐI KHÔNG xuất hiện từ vựng tiếng Anh hay cấu trúc bài đọc reading của môn ngoại ngữ.

[NHÓM 2] NGOẠI NGỮ — Tiếng Anh, Tiếng Pháp, Tiếng Trung, Tiếng Nhật...:
• TUYỆT ĐỐI không dùng LaTeX hay ký hiệu Toán ($...$) vô nghĩa.
• TUYỆT ĐỐI không sinh TikZ.
• QUY TẮC BẮT BUỘC VỀ PHƯƠNG ÁN TRẮC NGHIỆM:
  - MỌI phương án A:, B:, C:, D: BẮT BUỘC PHẢI CHỨA TỪ NGỮ, CỤM TỪ HOẶC CÂU TIẾNG ANH ĐẦY ĐỦ.
  - TUYỆT ĐỐI CẤM xuất các phương án rỗng là chữ cái A, B, C, D (ví dụ CẤM: "A: A", "B: B", "C: C", "D: D").
  - Với câu True / False: BẮT BUỘC là "A: True", "B: False" (DAP_AN là A nếu True, B nếu False).
• CẤU TRÚC ĐỀ THI TIẾNG ANH CHUẨN (GIỮ CHÍNH XÁC NHƯ ĐỀ GỐC, KHÔNG ĐƯỢC TỰ Ý TÁCH THÊM PHẦN MỚI):
  1. PHẦN I. PHONETICS (Chỉ gồm 4 câu):
     - Pronunciation (phát âm âm gạch chân): 
       NOI_DUNG: Pronunciation
       A: m[o]ther
       B: h[ea]lthy
       C: f[a]ther
       D: th[ei]r
       DAP_AN: B
       (Âm cần kiểm tra đặt trong ngoặc vuông [...] hoặc gạch chân).
     - Stress (trọng âm):
       NOI_DUNG: Stress
       A: landmark
       B: famous
       C: museum
       D: palace
       DAP_AN: C
       (TUYỆT ĐỐI KHÔNG dán câu lệnh dài "Mark the letter..." vào đề bài từng câu!).
  2. PHẦN II. USE OF ENGLISH (Từ vựng, Ngữ pháp, Giao tiếp, Biển báo, Word form, Từ điển):
     - TUYỆT ĐỐI KHÔNG TÁCH phần này thành "USE OF ENGLISH - WORD FORM & DICTIONARY". Toàn bộ đều thuộc "II. USE OF ENGLISH".
     - Trắc nghiệm 4 lựa chọn: A, B, C, D là các từ/cụm từ tiếng Anh hoàn chỉnh (vd: A: What, B: Who, C: Where, D: How many).
     - Tình huống giao tiếp (Exchanges): Tom: "..." – Bob: "..." với A, B, C, D là các câu đối thoại.
     - Biển báo (Signs): Nếu đề gốc có hình/mô tả biển báo, NOI_DUNG ghi ngắn gọn mô tả biển báo, A, B, C, D là các câu giải thích ý nghĩa biển báo.
     - Word form (vd: VISIT -> visitors): LOAI: trac_nghiem_tra_loi_ngan hoặc tu_luan, NOI_DUNG chứa câu có chỗ trống và từ in hoa trong ngoặc, DAP_AN là dạng đúng.
     - Mục từ điển (Dictionary entry): Đặt đoạn trích từ điển vào NOI_DUNG câu hỏi đầu tiên, câu tiếp theo hoàn thành câu dựa vào mục từ điển.
  3. PHẦN III. READING (ĐẶC BIỆT QUAN TRỌNG - GIỐNG 100% ĐỀ GỐC):
     DUY NHẤT 1 PHẦN LỚN "TEN: III. READING", TUYỆT ĐỐI KHÔNG TÁCH THÀNH 2 PHẦN RIÊNG. BÀI ĐỌC CHUNG BẮT BUỘC ĐẶT TRONG TRƯỜNG GHI_CHU CỦA PHẦN. TUYỆT ĐỐI KHÔNG LẶP LẠI BÀI ĐỌC VÀO TỪNG CÂU HỎI CON!
     * Đặt vào trường GHI_CHU của ===PHAN=== cả 2 phần đọc:
       Part 1. Choose the word (A, B, C or D) that best fits each space in the following passage.
       [Toàn bộ đoạn văn điền từ có các chỗ trống đánh số (23) _______, (24) _______, (25) _______...]

       Part 2. Read the following passage. Decide whether the statements from 28 to 30 are True or False and choose the correct answer (A, B, C or D) to complete the statements in question 31 and 32.
       [Toàn bộ đoạn văn đọc hiểu hoàn chỉnh về thành phố, du lịch, lịch sử, văn hóa...]
     * Các câu hỏi con phía dưới (23 đến 32) thuộc cùng 1 phần "III. READING":
       - Câu 23 - 27 (Cloze): STT: 23..27, NOI_DUNG: (23), 4 phương án từ vựng A, B, C, D (vd: A: go, B: do, C: play, D: make).
       - Câu 28 - 30 (True/False): LOAI: trac_nghiem_4_lua_chon, NOI_DUNG là câu khẳng định, A: True, B: False, DAP_AN: A (nếu True) hoặc B (nếu False).
       - Câu 31 - 32 (Trắc nghiệm đọc hiểu): LOAI: trac_nghiem_4_lua_chon, NOI_DUNG là câu hỏi, 4 phương án A, B, C, D đầy đủ từ ngữ.
  4. PHẦN IV. WRITING (Viết lại câu - Sentence Rewriting):
     - LOAI: tu_luan
     - NOI_DUNG: [Câu gốc cần viết lại]\n→ [Từ gợi ý bắt đầu câu viết lại] ............................................................................
     - DAP_AN: [Toàn bộ câu viết lại hoàn chỉnh]

[NHÓM 3] NGỮ VĂN — Văn học, Tiếng Việt:
• TUYỆT ĐỐI không dùng LaTeX hay công thức Toán.
• Cấu trúc: PHẦN I. ĐỌC HIỂU (văn bản thơ/văn xuôi đặt trong trường GHI_CHU của phần, các câu hỏi 1, 2, 3, 4 đặt ở dưới) + PHẦN II. LÀM VĂN (nghị luận xã hội, nghị luận văn học).

[NHÓM 4] KHOA HỌC XÃ HỘI — Lịch sử, Địa lý, GDCD, Giáo dục Kinh tế & Pháp luật:
• Không dùng LaTeX. Số liệu thống kê viết bình thường.
• Nếu có đoạn tư liệu hoặc bảng số liệu chung: Đặt vào GHI_CHU của phần, các câu hỏi con đặt ở dưới.
• Trắc nghiệm 4 lựa chọn và tự luận theo chuẩn môn Xã hội.

[NHÓM 5] TIN HỌC — Khoa học máy tính, Công nghệ thông tin:
• Không dùng LaTeX (trừ công thức toán học thực sự).
• Đoạn mã nguồn/code đặt trong triple backtick.
`;
}

/**
 * Builds the strict structured text prompt for exam or problem generation
 */
export function buildExamPrompt(
  sourceContent: string,
  config: ConfigState,
  mathTypeCount = 0,
  deIndex = 1
): string {
  const mathTypeNote = mathTypeCount > 0
    ? `LƯU Ý: File Word gốc chứa ${mathTypeCount} công thức MathType đã bị mất khi đọc text. Hãy suy luận từ ngữ cảnh xung quanh để viết lại công thức đúng chuẩn LaTeX $...$. Nếu không đủ thông tin, hãy điền $[CT?]$.`
    : '';

  const doKhoMap = {
    tuong_duong: 'TƯƠNG ĐƯƠNG ĐỀ GỐC (Giữ nguyên mức độ tư duy, phương pháp giải và thang điểm)',
    de_hon: 'DỄ HƠN ĐỀ GỐC (Giảm bớt số bước suy luận, nhẹ nhàng hơn, số liệu đơn giản)',
    kho_hon: 'KHÓ HƠN ĐỀ GỐC (Tăng độ phức tạp, tăng tính vận dụng, cần thêm nhiều bước phân tích)',
    nang_cao: 'NÂNG CAO / PHÂN LOẠI (Phát triển các câu hỏi vận dụng cao phân loại học sinh giỏi)',
  };

  const tikzShapeGuide = `QUY TẮC VẼ HÌNH TIKZ CHÍNH XÁC (BẮT BUỘC TUÂN THỦ):
  [A] NHẬN DẠNG LOẠI HÌNH TRƯỚC KHI VIẾT CODE — đọc kỹ đề bài, xác định loại hình, sau đó viết mã TikZ phù hợp:
    • Đường tròn / dây cung / tiếp tuyến → \\draw (O) circle (Rcm); \\coordinate (P) at ($(O)+(góc:Rcm)$);
    • Hình trụ (cylinder) → vẽ ellipse cho mặt trên/dưới + 2 đường thẳng bên; TUYỆT ĐỐI không dùng hộp chữ nhật 3D
    • Hình cầu (sphere) → \\draw circle + \\draw[dashed] ellipse cho mặt cắt xích đạo
    • Hình chóp (pyramid) / Lăng trụ 3D → phối cảnh nghiêng, cạnh khuất là nét đứt [dashed]
    • Đồ thị hàm số → \\begin{axis}[...]...\\end{axis} (pgfplots); vẽ đúng domain hàm
    • Bảng biến thiên → Nếu câu hỏi đã có bảng biến thiên dạng \\begin{tabular} trong đề bài (trường NOI_DUNG) thì trường TIKZ BẮT BUỘC ĐỂ TRỐNG (TUYỆT ĐỐI KHÔNG vẽ thêm hình tròn hay hình học lạ). Nếu đề không có \\begin{tabular} mà vẽ TikZ thì vẽ đúng khung bảng biến thiên gồm \\draw + \\node + dấu +/- và mũi tên tăng giảm, TUYỆT ĐỐI KHÔNG vẽ hình tròn.
    • Tam giác / Đa giác phẳng → \\draw (A)--(B)--(C)--cycle; nhãn điểm đúng vị trí
  [B] TUYỆT ĐỐI KHÔNG sao chép cùng mã TikZ cho 2 câu khác nhau. Mỗi câu có mã TikZ ĐỘC LẬP, đúng số liệu riêng của câu đó.
  [C] Số liệu trong TikZ PHẢI CHÍNH XÁC theo đề bài: bán kính, cạnh, góc, tọa độ — không dùng số liệu câu hỏi khác.
  [D] Đánh nhãn đầy đủ các điểm, đường thẳng, góc theo đúng ký hiệu trong đề bài.`;

  const tikzInstruction = config.tikzMode === 'no'
    ? 'KHÔNG tạo mã TikZ. Bỏ trống trường TIKZ.'
    : `SINH MÃ TIKZ THEO QUY TẮC SAU:
- Nếu câu gốc tương ứng được đánh dấu [CÓ_HÌNH] → BẮT BUỘC sinh mã TikZ đầy đủ vào trường TIKZ.
- Nếu câu gốc KHÔNG có [CÓ_HÌNH] → TUYỆT ĐỐI để trống trường TIKZ, không được tự thêm hình.
- Mã TikZ phải viết trực tiếp: TIKZ: \\begin{tikzpicture}...\\end{tikzpicture}
- Mã TikZ PHẢI CHÍNH XÁC 100% theo số liệu, tên đỉnh/điểm (A, B, C, S, O,...) riêng của câu hỏi đó.
- TUYỆT ĐỐI KHÔNG sao chép cùng 1 mã TikZ cho nhiều câu khác nhau.
- Với file ảnh/PDF (không có nhãn [CÓ_HÌNH]): nếu câu gốc trong ảnh rõ ràng có hình vẽ thì sinh TikZ, câu không có hình thì để trống.
${tikzShapeGuide}`;

  // Mode 2: Tạo câu lẻ / bài tập tương tự từ ảnh hoặc vài câu gốc
  if (config.mode === 'cau_le') {
    return `Bạn là chuyên gia sư phạm & giáo viên dạy giỏi hàng đầu Việt Nam, am hiểu TẤT CẢ CÁC MÔN HỌC.
NHIỆM VỤ: Dựa vào ảnh/văn bản bài tập gốc dưới đây, hãy sinh ra ${config.soBai} bài/câu hỏi tương tự chất lượng cao, CÙNG MÔN HỌC và CÙNG DẠNG CÂU HỎI với bài gốc.

YÊU CẦU CẤU HÌNH:
- Số bài cần sinh: ${config.soBai} bài
- Độ khó: ${doKhoMap[config.doKho]}
- Chế độ TikZ: ${tikzInstruction}
- Lời giải chi tiết: ${config.includeAnswers ? 'BẮT BUỘC có lời giải chi tiết từng bước và đáp số.' : 'Chỉ cần đề bài và đáp số ngắn gọn.'}
${config.extraPrompt ? `- YÊU CẦU THÊM TỪ GIÁO VIÊN: "${config.extraPrompt}"` : ''}

${buildSubjectRules()}

QUY TẮC BẮT BUỘC VỀ ĐỊNH DẠNG:
1. Nhận diện môn học từ bài gốc, áp dụng đúng quy tắc trình bày theo nhóm môn ở trên.
2. Nhận diện loại câu hỏi gốc (tự luận, đúng/sai, 4 lựa chọn, trả lời ngắn, đọc hiểu, rewrite...) và sinh ra bài tương tự CÙNG LOẠI.
3. ${mathTypeNote || 'Đảm bảo tính chính xác về nội dung, số liệu đẹp, kết quả đúng đắn.'}
4. TUÂN THỦ ĐỊNH DẠNG TẦNG CỐ ĐỊNH DƯỚI ĐÂY (Không thêm lời chào hỏi hay JSON):

QUY TẮC LOẠI CÂU HỎI:
- Câu TỰ LUẬN → LOAI: tu_luan, có NOI_DUNG và DAP_AN.
- Câu ĐÚNG/SAI (4 mệnh đề) → LOAI: trac_nghiem_dung_sai, BẮT BUỘC có CAU_LENH và MENH_DE_A/B/C/D + DAP_AN_A/B/C/D (D=Đúng, S=Sai).
- Câu 4 LỰA CHỌN → LOAI: trac_nghiem_4_lua_chon, có A/B/C/D và DAP_AN.
- Câu TRẢ LỜI NGẮN → LOAI: trac_nghiem_tra_loi_ngan, DAP_AN là kết quả ngắn gọn.
- Câu READING PASSAGE (Tiếng Anh) → LOAI: trac_nghiem_4_lua_chon, NOI_DUNG chứa toàn bộ đoạn văn rồi mới đến câu hỏi.
- Câu REWRITE / SENTENCE TRANSFORMATION → LOAI: tu_luan, NOI_DUNG là câu gốc cần viết lại, DAP_AN là câu đã viết lại.
- Câu ĐỌC HIỂU VĂN BẢN (Ngữ văn) → LOAI: tu_luan, NOI_DUNG chứa đoạn trích rồi mới đến câu hỏi, DAP_AN là gợi ý trả lời.

===DE===
TIEU_DE: BÀI TẬP TƯƠNG TỰ
THOI_GIAN: 45
===PHAN===
TEN: CÁC BÀI/CÂU HỎI TƯƠNG TỰ (${config.soBai} bài)
LOAI: tu_luan
===CAU===
STT: 1
[Dùng đúng template bên dưới tương ứng với dạng câu gốc:]

[--- DẠNG: TỰ LUẬN (Toán/Lý/Hóa/Sinh/Văn/Sử/Địa...) ---]
LOAI: tu_luan
NOI_DUNG: [Nội dung đề bài tương tự — LaTeX nếu là KHTN, văn bản thuần nếu là KHXH/Ngữ văn]
TIKZ: [Mã \\begin{tikzpicture}...\\end{tikzpicture} nếu câu KHTN có hình vẽ. Để trống nếu không có hình hoặc là môn Ngoại ngữ/KHXH]
DAP_AN: [Lời giải chi tiết và đáp số cuối cùng]
MUC_DO: thong_hieu
DIEM: 1.0

[--- DẠNG: TRẮC NGHIỆM ĐÚNG/SAI (mọi môn) ---]
LOAI: trac_nghiem_dung_sai
NOI_DUNG: [Đề dẫn/bối cảnh chung — KHÔNG liệt kê mệnh đề ở đây]
TIKZ: [Mã TikZ nếu câu KHTN có hình. Để trống nếu không có hình]
CAU_LENH: [Câu lệnh hỏi phù hợp môn — VD: "Trong các mệnh đề sau, mệnh đề nào đúng?" hoặc "Xét các phát biểu sau:"]
MENH_DE_A: [Nội dung mệnh đề a]
DAP_AN_A: D
MENH_DE_B: [Nội dung mệnh đề b]
DAP_AN_B: S
MENH_DE_C: [Nội dung mệnh đề c]
DAP_AN_C: D
MENH_DE_D: [Nội dung mệnh đề d]
DAP_AN_D: S
HUONG_DAN_GIAI: [Giải thích từng mệnh đề]
MUC_DO: thong_hieu
DIEM: 1.0

[--- DẠNG: TRẮC NGHIỆM 4 LỰA CHỌN (mọi môn — Toán, Anh, Sử, Địa...) ---]
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: [Nội dung câu hỏi phù hợp môn học]
TIKZ: [Mã TikZ nếu câu KHTN có hình. Để trống nếu không có hình]
A: [Nội dung phương án A đầy đủ — TUYỆT ĐỐI KHÔNG để chữ A đơn lẻ]
B: [Nội dung phương án B đầy đủ — TUYỆT ĐỐI KHÔNG để chữ B đơn lẻ]
C: [Nội dung phương án C đầy đủ — TUYỆT ĐỐI KHÔNG để chữ C đơn lẻ]
D: [Nội dung phương án D đầy đủ — TUYỆT ĐỐI KHÔNG để chữ D đơn lẻ]
DAP_AN: [A/B/C/D]
HUONG_DAN_GIAI: [Lời giải/giải thích]
MUC_DO: thong_hieu
DIEM: 0.25

[--- DẠNG: TIẾNG ANH — READING PASSAGE (đoạn văn + câu hỏi) ---]
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: [Toàn bộ đoạn văn Reading tương tự — tự nhiên, phù hợp trình độ]

Question 1: [Câu hỏi về đoạn văn]
A: [Nội dung phương án A bằng tiếng Anh]
B: [Nội dung phương án B bằng tiếng Anh]
C: [Nội dung phương án C bằng tiếng Anh]
D: [Nội dung phương án D bằng tiếng Anh]
DAP_AN: A
DIEM: 0.25

[--- DẠNG: TIẾNG ANH — REWRITE / SENTENCE TRANSFORMATION ---]
LOAI: tu_luan
NOI_DUNG: Rewrite the sentence so that it has a similar meaning:
"[Câu gốc tương tự]"
DAP_AN: [Câu đã viết lại hoàn chỉnh]
DIEM: 0.5

[--- DẠNG: NGỮ VĂN — ĐỌC HIỂU VĂN BẢN ---]
LOAI: tu_luan
NOI_DUNG: Đọc đoạn trích sau và trả lời câu hỏi:
[Đoạn trích văn bản tương tự — thơ hoặc văn xuôi]
Câu hỏi: [Câu hỏi về nội dung/nghệ thuật/ý nghĩa]
DAP_AN: [Gợi ý trả lời ngắn gọn]
DIEM: 1.0

===CAU===
... (Tiếp tục sinh đủ ${config.soBai} bài — dùng đúng template tương ứng loại câu và môn học)
===DE===

NỘI DUNG / HÌNH ẢNH BÀI GỐC CẦN TẠO TƯƠNG TỰ:
${sourceContent}
`;
  }


  // Mode 1: Tạo nguyên đề thi (Mọi môn học)
  const modeTextMap = {
    doi_so_lieu: 'ĐỔI SỐ LIỆU (Giữ nguyên cấu trúc ma trận, chỉ thay đổi số liệu, tên biến, đồ thị)',
    cung_dang: 'CÙNG DẠNG BÀI (Giữ phương pháp giải và ma trận đề, sáng tạo ngữ cảnh và dữ kiện mới)',
    hoan_toan_moi: 'HOÀN TOÀN MỚI (Giữ chuẩn kiến thức kỹ năng, sáng tạo câu hỏi mới hoàn toàn)',
  };

  const deTitle = config.soDeCanTao > 1
    ? `${config.tieuDe || 'ĐỀ THI TƯƠNG TỰ'} - ĐỀ SỐ ${deIndex}`
    : config.tieuDe || 'ĐỀ KIỂM TRA TƯƠNG TỰ';

  // 1A. Chế độ: TẠO Y HỆT CẤU TRÚC ĐỀ GỐC (Phân tích tự động môn học & các phần)
  if (config.cautrucDe === 'y_het_goc') {
    return `Bạn là chuyên gia khảo thí và ra đề thi chuyên nghiệp cho TẤT CẢ CÁC MÔN HỌC (Toán, Ngữ văn, Tiếng Anh, Vật lý, Hóa học, Sinh học, Lịch sử, Địa lý, GDCD, Tin học...) thuộc mọi cấp học Việt Nam.

NHIỆM VỤ QUAN TRỌNG:
Phân tích kỹ lưỡng đề thi gốc dưới đây và tạo 1 ĐỀ THI MỚI TƯƠNG TỰ (Mã đề: ${deIndex}) SAO CHÉP Y HỆT 100% CẤU TRÚC ĐỀ GỐC.

${buildSubjectRules()}

QUY TẮC TRÌNH BÀY BẮT BUỘC:
1. LaTeX: Với môn KHTN (Toán, Lý, Hóa, Sinh) → BẮT BUỘC dùng LaTeX $...$ cho mọi công thức, ký hiệu. Với môn Ngoại ngữ, Ngữ văn, KHXH → KHÔNG dùng LaTeX (xem QUY TẮC NHẬN DIỆN MÔN HỌC ở trên).
2. Với CÂU ĐÚNG/SAI: BẮT BUỘC có trường CAU_LENH chứa câu hỏi dẫn phù hợp môn học (VD Toán: "Trong các mệnh đề sau, mệnh đề nào đúng?"; VD Sử: "Xét các phát biểu sau về sự kiện lịch sử:"; VD Anh: "Which of the following statements is true?"). KHÔNG được bỏ trống CAU_LENH.
3. Về hình vẽ / đồ thị: Nếu câu gốc có nhãn [CÓ_HÌNH] → BẮT BUỘC sinh mã TikZ LaTeX đầy đủ trong trường TIKZ: \\begin{tikzpicture}...\\end{tikzpicture}. Nếu câu gốc KHÔNG có [CÓ_HÌNH] → TUYỆT ĐỐI để trống trường TIKZ, không tự thêm hình. TUYỆT ĐỐI KHÔNG viết mã TikZ vào NOI_DUNG. TikZ phải CHÍNH XÁC THEO DỮ KIỆN SỐ trong đề bài. TUYỆT ĐỐI KHÔNG sao chép cùng một mã TikZ cho các câu khác nhau.
4. Nếu câu hỏi có bảng số liệu (bảng tần số, bảng giá trị, bảng thống kê): Viết bảng bằng cú pháp \begin{tabular}{|c|c|...} ... \end{tabular} chuẩn ngoài dấu $.
5. VỚI MỌI CÂU TRẮC NGHIỆM: Các trường A:, B:, C:, D: BẮT BUỘC chứa nội dung phương án thực tế (từ ngữ, con số, biểu thức, câu đầy đủ). TUYỆT ĐỐI CẤM xuất ra chữ cái A, B, C, D đơn lẻ như "A: A", "B: B", "C: C", "D: D".
6. TUÂN THỦ CHÍNH XÁC ĐỊNH DẠNG TẦNG KHÔNG THAY ĐỔI DƯỚI ĐÂY (Không thêm JSON hay lời chào):

QUY TẮC PHÂN TÍCH VÀ SAO CHÉP CẤU TRÚC ĐỀ GỐC:
1. Nhận diện chính xác môn học, tên từng Phần, loại câu hỏi (Tự luận, Đọc hiểu, Phonetics, Trắc nghiệm 4 lựa chọn, Trắc nghiệm Đúng/Sai, Trả lời ngắn, Rewrite...) và số lượng câu hỏi trong từng phần của đề gốc.
2. GIỮ NGUYÊN HOÀN TOÀN TÊN CÁC PHẦN, SỐ LƯỢNG CÂU VÀ LOẠI CÂU HỎI như đề gốc.
   - Nếu đề gốc là Tiếng Anh gồm (I. PHONETICS, II. USE OF ENGLISH, III. READING, IV. WRITING) → đề mới BẮT BUỘC gồm đúng 4 phần đó với nội dung Tiếng Anh tương đương.
   - Nếu đề gốc là Ngữ văn gồm 2 phần (I. ĐỌC HIỂU, II. LÀM VĂN) → đề mới BẮT BUỘC gồm đúng 2 phần đó với đoạn trích/đề văn mới tương đương.
   - Nếu đề gốc có trắc nghiệm hoặc đọc hiểu kèm văn bản → chọn ngữ cảnh/văn bản mới tương đương và sinh các câu hỏi tương ứng.
   - Nếu đề gốc gồm trắc nghiệm và tự luận kết hợp → tái tạo chính xác số câu trắc nghiệm và tự luận như đề gốc.
3. ĐỘ KHÓ ĐỀ THI: ${doKhoMap[config.doKho]}
4. MỨC ĐỘ TƯƠNG TỰ: ${modeTextMap[config.mucDoTuongTu]}
5. VẼ HÌNH TIKZ: ${tikzInstruction}
${config.extraPrompt ? `6. YÊU CẦU THÊM TỪ GIÁO VIÊN: "${config.extraPrompt}"` : ''}

===DE===
TIEU_DE: ${deTitle}
THOI_GIAN: ${config.thoiGian}
TRUONG: ${config.truong || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO'}
NAM_HOC: ${config.namHoc || '2025 - 2026'}
DE_SO: ${deIndex}
TONG_SO_DE: ${config.soDeCanTao}

[GIỮ Y HỆT CẤU TRÚC ĐỀ GỐC — ví dụ dưới đây chỉ là mẫu tham khảo:]

[--- Ví dụ nếu là PHẦN TRẮC NGHIỆM 4 LỰA CHỌN (Toán/Lý/Hóa/Sinh/Sử/Địa/GDCD/Anh...) ---]
===PHAN===
TEN: [Tên phần như đề gốc — VD: PHẦN I. TRẮC NGHIỆM hoặc I. PHONETICS hoặc I. USE OF ENGLISH]
LOAI: trac_nghiem_4_lua_chon
DIEM_MOI_CAU: 0.25
===CAU===
STT: 1
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: [Nội dung câu hỏi đúng môn học — LaTeX nếu KHTN, văn bản thuần nếu Anh/Văn/Sử/Địa. KHÔNG chứa mã TikZ]
TIKZ: [Mã \begin{tikzpicture}...\end{tikzpicture} nếu câu KHTN có hình vẽ/đồ thị. Để trống với môn Ngoại ngữ/KHXH]
A: [Nội dung phương án A đầy đủ — TUYỆT ĐỐI KHÔNG để chữ A đơn lẻ]
B: [Nội dung phương án B đầy đủ — TUYỆT ĐỐI KHÔNG để chữ B đơn lẻ]
C: [Nội dung phương án C đầy đủ — TUYỆT ĐỐI KHÔNG để chữ C đơn lẻ]
D: [Nội dung phương án D đầy đủ — TUYỆT ĐỐI KHÔNG để chữ D đơn lẻ]
DAP_AN: [A/B/C/D]
HUONG_DAN_GIAI: [Lời giải/giải thích]
MUC_DO: nhan_biet
DIEM: 0.25
===CAU===
... (Các câu 4 lựa chọn tiếp theo)

[--- Ví dụ nếu là PHẦN TRẮC NGHIỆM ĐÚNG/SAI (mọi môn) ---]
===PHAN===
TEN: [Tên phần như đề gốc — VD: PHẦN II. TRẮC NGHIỆM ĐÚNG SAI]
LOAI: trac_nghiem_dung_sai
DIEM_MOI_CAU: 1.0
===CAU===
STT: [số thứ tự tiếp theo]
LOAI: trac_nghiem_dung_sai
NOI_DUNG: [Đề dẫn/bối cảnh chung. KHÔNG liệt kê mệnh đề ở đây. KHÔNG chứa mã TikZ]
TIKZ: [Mã TikZ nếu câu KHTN có hình. Để trống nếu không có hình]
CAU_LENH: [Câu lệnh hỏi phù hợp môn — VD: "Trong các mệnh đề sau, mệnh đề nào đúng?" (Toán) / "Xét các phát biểu sau:" (Sử/Địa) / "Which statements are correct?" (Anh)]
MENH_DE_A: [Nội dung mệnh đề a]
DAP_AN_A: D
MENH_DE_B: [Nội dung mệnh đề b]
DAP_AN_B: S
MENH_DE_C: [Nội dung mệnh đề c]
DAP_AN_C: D
MENH_DE_D: [Nội dung mệnh đề d]
DAP_AN_D: S
HUONG_DAN_GIAI: [Giải thích từng mệnh đề]
MUC_DO: thong_hieu
DIEM: 1.0
===CAU===
... (Các câu Đúng/Sai tiếp theo)

[--- Ví dụ nếu là PHẦN TRẢ LỜI NGẮN ---]
===PHAN===
TEN: [Tên phần như đề gốc — VD: PHẦN III. TRẢ LỜI NGẮN]
LOAI: trac_nghiem_tra_loi_ngan
DIEM_MOI_CAU: 0.5
===CAU===
STT: [số thứ tự tiếp theo]
LOAI: trac_nghiem_tra_loi_ngan
NOI_DUNG: [Nội dung câu hỏi]
TIKZ: [Mã TikZ nếu có hình. Để trống nếu không có hình]
DAP_AN: [Đáp án ngắn gọn — chỉ kết quả]
HUONG_DAN_GIAI: [Lời giải]
MUC_DO: van_dung
DIEM: 0.5
===CAU===
... (Các câu trả lời ngắn tiếp theo)

[--- Ví dụ nếu là PHẦN TỰ LUẬN / LÀM VĂN / WRITING ---]
===PHAN===
TEN: [Tên phần như đề gốc — VD: PHẦN IV. TỰ LUẬN hoặc II. LÀM VĂN hoặc IV. WRITING]
LOAI: tu_luan
DIEM_MOI_CAU: 1.0
===CAU===
STT: [số thứ tự tiếp theo]
LOAI: tu_luan
NOI_DUNG: [Nội dung câu hỏi/yêu cầu tự luận đúng môn — VD Toán: bài toán tự luận; Văn: đề nghị luận/phân tích; Anh: câu Rewrite hoặc đoạn văn cần viết]
TIKZ: [Mã \\begin{tikzpicture}...\\end{tikzpicture} nếu câu KHTN có hình. Để trống với Văn/Anh/Sử/Địa]
DAP_AN: [Lời giải chi tiết / Gợi ý dàn ý / Câu viết lại]
MUC_DO: van_dung_cao
DIEM: 1.0
===CAU===
... (Các câu tự luận tiếp theo)

[--- ĐẶC BIỆT: Ví dụ môn TIẾNG ANH - PHẦN III. READING (PART 1 VÀ PART 2) ---]
===PHAN===
TEN: III. READING
LOAI: trac_nghiem_4_lua_chon
DIEM_MOI_CAU: 0.25
GHI_CHU: Part 1. Choose the word (A, B, C or D) that best fits each space in the following passage.

Playing sports regularly brings fantastic benefits to both body and mind. When students (23) _______ exercise or play sports, they become stronger and more energetic. (24) _______ like badminton, table tennis, and tennis help improve speed and coordination. They also teach important values like fair play and respect for (25) _______. Many famous sportspeople started their careers when they were (26) _______. They practiced hard every day at the gym or in the (27) _______ to become champions. Their success stories inspire others to take part in sports and competitions.

Part 2. Read the following passage. Decide whether the statements from 28 to 30 are True or False and choose the correct answer (A, B, C or D) to complete the statements in question 31 and 32.

Hoi An is an ancient town in Vietnam that attracts visitors with its well-preserved architecture and peaceful atmosphere. The Old Town area has narrow streets lined with yellow buildings and colorful lanterns. Visitors can rent bicycles to explore the town or take a boat trip along the river. Many people enjoy taking photos of the beautiful pagodas and traditional houses that reflect Vietnam's rich cultural heritage.
===CAU===
STT: 23
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: (23)
A: go
B: do
C: play
D: make
DAP_AN: B
DIEM: 0.25
===CAU===
STT: 24
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: (24)
A: Photos
B: Champion
C: Equipment
D: Sports
DAP_AN: D
DIEM: 0.25

===CAU===
STT: 28
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: Hoi An is a modern city in Vietnam.
A: True
B: False
DAP_AN: B
HUONG_DAN_GIAI: Hoi An is an ancient town, not a modern city.
DIEM: 0.25
===CAU===
STT: 29
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: The Old Town has yellow buildings and colorful lanterns.
A: True
B: False
DAP_AN: A
DIEM: 0.25
===CAU===
STT: 31
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: What is the main idea of the passage?
A: Hoi An is famous for its factories.
B: Hoi An is an ancient town with beautiful architecture and culture.
C: Hoi An has many shopping malls.
D: Hoi An is the biggest city in Vietnam.
DAP_AN: B
DIEM: 0.25
===DE===

QUAN TRỌNG: Chỉ xuất những PHẦN tồn tại trong đề gốc. Số lượng câu mỗi phần PHẢI bằng đúng số câu trong đề gốc. Tên phần BẮT BUỘC giống đề gốc.

NỘI DUNG ĐỀ GỐC CẦN PHÂN TÍCH VÀ SAO CHÉP Y HỆT CẤU TRÚC:
${sourceContent}
`;
  }

  // 1B-ENG. Chế độ: TÙY CHỈNH MA TRẬN MÔN TIẾNG ANH (4 phần chuẩn: Phonetics, Use of English, Reading, Writing)
  if (config.loaiMaTran === 'tieng_anh') {
    const numPhonetics = config.numEngPhonetics ?? 4;
    const numUse = config.numEngUse ?? 18;
    const numReading = config.numEngReading ?? 10;
    const numWriting = config.numEngWriting ?? 8;

    return `Bạn là chuyên gia khảo thí môn Tiếng Anh bậc THCS & THPT tại Việt Nam.

NHIỆM VỤ: Tạo 1 đề thi Tiếng Anh hoàn chỉnh (Mã đề: ${deIndex}) từ nội dung đề thi gốc dưới đây theo ĐÚNG MA TRẬN TÙY CHỈNH.

${buildSubjectRules()}

CẤU TRÚC ĐỀ THI TIẾNG ANH THEO MA TRẬN YÊU CẦU:
- Tiêu đề: ${deTitle}
- Thời gian làm bài: ${config.thoiGian} phút
- Độ khó đề thi: ${doKhoMap[config.doKho]}
- Mức độ tương tự: ${modeTextMap[config.mucDoTuongTu]}
${config.truong ? `- Tên trường/đơn vị: ${config.truong}` : ''}
${config.namHoc ? `- Năm học: ${config.namHoc}` : ''}
${config.extraPrompt ? `- Yêu cầu thêm từ giáo viên: "${config.extraPrompt}"` : ''}

CÁC PHẦN TRONG ĐỀ THI:
${numPhonetics > 0 ? `1. I. PHONETICS (${numPhonetics} câu): Phát âm (Pronunciation) & Trọng âm (Stress).` : ''}
${numUse > 0 ? `2. II. USE OF ENGLISH (${numUse} câu): Trắc nghiệm ngữ pháp/từ vựng, giao tiếp, biển báo, Word form, mục từ điển.` : ''}
${numReading > 0 ? `3. III. READING (${numReading} câu): Gồm Part 1 (Cloze test điền từ) và Part 2 (Đọc hiểu True/False & Trắc nghiệm).` : ''}
${numWriting > 0 ? `4. IV. WRITING (${numWriting} câu): Viết lại câu không đổi nghĩa (Sentence Rewriting).` : ''}

QUY TẮC BẮT BUỘC:
1. TUYỆT ĐỐI KHÔNG dùng LaTeX ($...$), không sinh TikZ.
2. VỚI MỌI CÂU TRẮC NGHIỆM: Các phương án A:, B:, C:, D: BẮT BUỘC chứa từ ngữ/câu tiếng Anh đầy đủ. TUYỆT ĐỐI CẤM xuất chữ cái rỗng như "A: A", "B: B", "C: C", "D: D".
3. Với câu True/False: BẮT BUỘC "A: True", "B: False", DAP_AN là A hoặc B.
4. Với bài đọc Reading: Đặt bài đọc vào GHI_CHU của ===PHAN===, các câu hỏi con đặt bên dưới.
5. Với câu Writing: NOI_DUNG chứa câu gốc và gợi ý đầu câu viết lại: "→ [Từ gợi ý] ............................................................................", DAP_AN chứa toàn bộ câu viết lại hoàn chỉnh.

===DE===
TIEU_DE: ${deTitle}
THOI_GIAN: ${config.thoiGian}
TRUONG: ${config.truong || 'THCS LÊ QUÝ ĐÔN'}
NAM_HOC: ${config.namHoc || '2025 - 2026'}
DE_SO: ${deIndex}
TONG_SO_DE: ${config.soDeCanTao}

${numPhonetics > 0 ? `===PHAN===
TEN: I. PHONETICS
LOAI: trac_nghiem_4_lua_chon
DIEM_MOI_CAU: 0.25
GHI_CHU: Mark the letter A, B, C or D on your answer sheet to indicate the word whose underlined part differs from the other three in pronunciation, or differs in the position of primary stress.
===CAU===
STT: 1
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: Pronunciation
A: m[o]ther
B: h[ea]lthy
C: f[a]ther
D: th[ei]r
DAP_AN: B
HUONG_DAN_GIAI: Phần gạch chân trong "healthy" phát âm là /e/, các từ còn lại phát âm là /i:/.
DIEM: 0.25
===CAU===
... (Sinh đủ ${numPhonetics} câu: nửa đầu là phát âm, nửa sau là trọng âm)
` : ''}

${numUse > 0 ? `===PHAN===
TEN: II. USE OF ENGLISH
LOAI: trac_nghiem_4_lua_chon
DIEM_MOI_CAU: 0.25
GHI_CHU: Choose the best answer A, B, C or D, or write the correct form of words.
===CAU===
... (Sinh đủ ${numUse} câu bao gồm trắc nghiệm 4 lựa chọn, tình huống giao tiếp, biển báo, word form, từ điển như đề gốc)
` : ''}

${numReading > 0 ? `===PHAN===
TEN: III. READING - PART 1
LOAI: trac_nghiem_4_lua_chon
DIEM_MOI_CAU: 0.25
GHI_CHU: Choose the word (A, B, C or D) that best fits each space in the following passage.\n\n[Đoạn văn đọc điền từ có các chỗ trống đánh số (STT) _______]
===CAU===
... (Sinh các câu hỏi con điền từ của Part 1)

===PHAN===
TEN: III. READING - PART 2
LOAI: trac_nghiem_4_lua_chon
DIEM_MOI_CAU: 0.25
GHI_CHU: Read the passage. Decide whether the statements are True or False and choose the best answer.\n\n[Đoạn văn đọc hiểu hoàn chỉnh về chủ đề du lịch, thành phố, văn hóa...]
===CAU===
... (Sinh các câu True/False với A: True, B: False, và các câu trắc nghiệm 4 lựa chọn)
` : ''}

${numWriting > 0 ? `===PHAN===
TEN: IV. WRITING
LOAI: tu_luan
DIEM_MOI_CAU: 0.25
GHI_CHU: Rewrite each of the following sentences in another way so that it means almost the same as the sentence printed before it.
===CAU===
... (Sinh đủ ${numWriting} câu viết lại câu)
` : ''}

===DE===

QUAN TRỌNG: TUÂN THỦ ĐÚNG SỐ LƯỢNG CÂU CHO TỪNG PHẦN THEO MA TRẬN TRÊN.

NỘI DUNG ĐỀ GỐC CẦN THAM KHẢO CHỦ ĐỀ VÀ KIẾN THỨC:
${sourceContent}
`;
  }

  // 1B-TOAN/KHTN. Chế độ: TÙY CHỈNH SỐ CÂU THEO MA TRẬN GDPT 2025 (Toán / KHTN)
  return `Bạn là chuyên gia khảo thí và ra đề thi chuẩn chương trình GDPT 2025 của Bộ Giáo dục & Đào tạo Việt Nam, am hiểu TẤT CẢ CÁC MÔN HỌC.

NHIỆM VỤ: Tạo 1 đề thi tương tự (Mã đề: ${deIndex}) từ đề thi gốc dưới đây theo ĐÚNG MA TRẬN CẤU HÌNH TÙY CHỈNH.
LƯU Ý: Nhận diện môn học từ đề gốc và sinh nội dung đúng môn đó (Toán, Lý, Hóa, Sinh, Tin học, GDCD...).

${buildSubjectRules()}

CẤU TRÚC ĐỀ THI YÊU CẦU:
- Tiêu đề: ${deTitle}
- Độ khó đề thi: ${doKhoMap[config.doKho]}
- Mức độ tương tự: ${modeTextMap[config.mucDoTuongTu]}
- Thời gian làm bài: ${config.thoiGian} phút
- Vẽ hình TikZ: ${tikzInstruction}
${config.truong ? `- Tên trường/đơn vị: ${config.truong}` : ''}
${config.namHoc ? `- Năm học: ${config.namHoc}` : ''}
${config.extraPrompt ? `- Yêu cầu thêm từ giáo viên: "${config.extraPrompt}"` : ''}

CÁC PHẦN TRONG ĐỀ THI:
${config.numPart1 > 0 ? `1. PHẦN I (${config.numPart1} câu): Trắc nghiệm 4 lựa chọn (Nhiều phương án chọn 1 - A, B, C, D).` : ''}
${config.numPart2 > 0 ? `2. PHẦN II (${config.numPart2} câu): Trắc nghiệm Đúng / Sai (Mỗi câu gồm 1 đề dẫn chung và 4 mệnh đề a, b, c, d; thí sinh trả lời Đúng (D) hoặc Sai (S) cho từng mệnh đề).` : ''}
${config.numPart3 > 0 ? `3. PHẦN III (${config.numPart3} câu): Trắc nghiệm Trả lời ngắn (Thí sinh điền kết quả — số, từ, cụm từ — tùy theo môn học).` : ''}
${config.numPart4 > 0 ? `4. PHẦN IV (${config.numPart4} câu): Tự luận (Trình bày lời giải/luận điểm chi tiết từng bước).` : ''}

QUY TẮC BẮT BUỘC:
1. LaTeX: Với môn KHTN (Toán, Lý, Hóa, Sinh) → BẮT BUỘC dùng LaTeX $...$ cho mọi công thức. Với môn Ngoại ngữ, Ngữ văn, KHXH → KHÔNG dùng LaTeX (xem QUY TẮC NHẬN DIỆN MÔN HỌC ở trên).
2. ${mathTypeNote || 'Đảm bảo nội dung chính xác, phù hợp trình độ học sinh và môn học.'}
3. Ở Phần II (Đúng/Sai), BẮT BUỘC có CAU_LENH và cung cấp rõ nội dung 4 mệnh đề a), b), c), d) và đáp án D (Đúng) hoặc S (Sai) cho từng mệnh đề. Nội dung mệnh đề phải phù hợp môn học.
4. Về hình vẽ / đồ thị: Nếu câu gốc có nhãn [CÓ_HÌNH] → BẮT BUỘC sinh mã TikZ LaTeX đầy đủ trong trường TIKZ: \\begin{tikzpicture}...\\end{tikzpicture}. Nếu câu gốc KHÔNG có [CÓ_HÌNH] → TUYỆT ĐỐI để trống trường TIKZ. TUYỆT ĐỐI KHÔNG viết mã TikZ vào NOI_DUNG.
5. Nếu câu hỏi có bảng số liệu: Viết bảng bằng cú pháp \\begin{tabular}{|c|c|...} ... \\end{tabular} chuẩn ngoài dấu $.
6. VỚI MỌI CÂU TRẮC NGHIỆM: Các trường A:, B:, C:, D: BẮT BUỘC chứa nội dung phương án thực tế (từ ngữ, con số, biểu thức, câu đầy đủ). TUYỆT ĐỐI CẤM xuất ra chữ cái A, B, C, D đơn lẻ như "A: A", "B: B", "C: C", "D: D".
7. TUÂN THỦ CHÍNH XÁC ĐỊNH DẠNG TẦNG KHÔNG THAY ĐỔI DƯỚI ĐÂY:

===DE===
TIEU_DE: ${deTitle}
THOI_GIAN: ${config.thoiGian}
TRUONG: ${config.truong || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO'}
NAM_HOC: ${config.namHoc || '2025 - 2026'}
DE_SO: ${deIndex}
TONG_SO_DE: ${config.soDeCanTao}

${config.numPart1 > 0 ? `===PHAN===
TEN: PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN
LOAI: trac_nghiem_4_lua_chon
DIEM_MOI_CAU: 0.25
===CAU===
STT: 1
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: [Nội dung câu hỏi phù hợp môn học — LaTeX nếu KHTN, văn bản thuần nếu Anh/Văn/Sử/Địa]
TIKZ: [Mã \\begin{tikzpicture}...\\end{tikzpicture} nếu câu KHTN có hình vẽ/đồ thị. Để trống với môn Ngoại ngữ/KHXH]
A: [Nội dung phương án A đầy đủ — TUYỆT ĐỐI KHÔNG để chữ A đơn lẻ]
B: [Nội dung phương án B đầy đủ — TUYỆT ĐỐI KHÔNG để chữ B đơn lẻ]
C: [Nội dung phương án C đầy đủ — TUYỆT ĐỐI KHÔNG để chữ C đơn lẻ]
D: [Nội dung phương án D đầy đủ — TUYỆT ĐỐI KHÔNG để chữ D đơn lẻ]
DAP_AN: A
MUC_DO: nhan_biet
DIEM: 0.25
===CAU===
... (Sinh đủ ${config.numPart1} câu trắc nghiệm 4 lựa chọn)
` : ''}

${config.numPart2 > 0 ? `===PHAN===
TEN: PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI
LOAI: trac_nghiem_dung_sai
DIEM_MOI_CAU: 1.0
===CAU===
STT: ${config.numPart1 + 1}
LOAI: trac_nghiem_dung_sai
NOI_DUNG: [Đề dẫn/bối cảnh chung — ngữ cảnh, giả thiết, dữ kiện. KHÔNG liệt kê mệnh đề ở đây]
TIKZ: [Mã \\begin{tikzpicture}...\\end{tikzpicture} nếu câu KHTN có hình vẽ/đồ thị. Để trống với môn Ngoại ngữ/KHXH]
CAU_LENH: [Câu lệnh hỏi phù hợp môn — VD: "Trong các mệnh đề sau, mệnh đề nào đúng?" (Toán) / "Xét các phát biểu sau:" (Sử/Địa/GDCD) / "Which statements are true?" (Anh) — PHẢI CÓ]
MENH_DE_A: [Nội dung mệnh đề a) — phù hợp môn học]
DAP_AN_A: D
MENH_DE_B: [Nội dung mệnh đề b)]
DAP_AN_B: S
MENH_DE_C: [Nội dung mệnh đề c)]
DAP_AN_C: D
MENH_DE_D: [Nội dung mệnh đề d)]
DAP_AN_D: S
DAP_AN: a) Đúng, b) Sai, c) Đúng, d) Sai
HUONG_DAN_GIAI: [Lời giải thích chi tiết tính đúng sai của từng mệnh đề]
MUC_DO: thong_hieu
DIEM: 1.0
===CAU===
... (Sinh đủ ${config.numPart2} câu Đúng/Sai)
` : ''}

${config.numPart3 > 0 ? `===PHAN===
TEN: PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN
LOAI: trac_nghiem_tra_loi_ngan
DIEM_MOI_CAU: 0.5
===CAU===
STT: ${config.numPart1 + config.numPart2 + 1}
LOAI: trac_nghiem_tra_loi_ngan
NOI_DUNG: [Nội dung câu hỏi yêu cầu điền kết quả — phù hợp môn học]
TIKZ: [Mã \\begin{tikzpicture}...\\end{tikzpicture} nếu câu KHTN có hình vẽ/đồ thị. Để trống với môn Ngoại ngữ/KHXH]
DAP_AN: [Đáp án ngắn gọn — số/từ/cụm từ phù hợp môn, VD Toán: 12 hoặc 3/4; Anh: "because" hoặc "were"]
HUONG_DAN_GIAI: [Hướng dẫn giải vắn tắt]
MUC_DO: van_dung
DIEM: 0.5
===CAU===
... (Sinh đủ ${config.numPart3} câu trả lời ngắn)
` : ''}

${config.numPart4 > 0 ? `===PHAN===
TEN: PHẦN IV. TỰ LUẬN
LOAI: tu_luan
DIEM_MOI_CAU: 1.0
===CAU===
STT: ${config.numPart1 + config.numPart2 + config.numPart3 + 1}
LOAI: tu_luan
NOI_DUNG: [Nội dung câu hỏi tự luận phù hợp môn học — VD Toán: bài toán; Văn: đề nghị luận; Sử: câu hỏi phân tích sự kiện]
TIKZ: [Mã \\begin{tikzpicture}...\\end{tikzpicture} nếu câu KHTN có hình vẽ/đồ thị. Để trống với Văn/Anh/Sử/Địa]
DAP_AN: [Lời giải/luận điểm chi tiết từng bước]
MUC_DO: van_dung_cao
DIEM: 1.0
===CAU===
... (Sinh đủ ${config.numPart4} câu tự luận)
` : ''}
===DE===

NỘI DUNG ĐỀ GỐC THAM KHẢO:
${sourceContent}
`;
}

/**
 * Custom robust parser for block-based exam format (===DE===, ===PHAN===, ===CAU===)
 * ABSOLUTELY NO JSON.parse - Completely immune to JSON syntax crashes with LaTeX.
 */
export function parseExam(rawText: string): ExamData {
  const defaultMeta: any = {
    thoiGian: 90,
    tieuDe: 'ĐỀ KIỂM TRA TƯƠNG TỰ',
    truong: 'TRƯỜNG THPT',
    namHoc: '2025 - 2026',
    thangDiem: 10,
    deSo: 1,
    tongSoDe: 1,
  };

  if (!rawText) {
    return { meta: defaultMeta, phan: [] };
  }

  // Extract content between ===DE=== blocks
  let deContent = rawText;
  if (rawText.includes('===DE===')) {
    const deParts = rawText.split('===DE===');
    deContent = deParts[1] || rawText;
  }

  // Split into sections
  const phanBlocks = deContent.split('===PHAN===').filter((b) => b.trim().length > 0);

  const meta: any = { ...defaultMeta };
  const sections: ExamSection[] = [];

  phanBlocks.forEach((block, pIdx) => {
    // Check if the block contains metadata header
    const lines = block.split('\n');
    let sectionName = `PHẦN ${pIdx + 1}`;
    let sectionType: any = 'trac_nghiem_4_lua_chon';
    let diemMoiCau = 0.25;
    let sectionGhiChu = '';
    let currentHeaderKey: string | null = null;

    // Separate CAU blocks
    const cauBlocks = block.split('===CAU===').filter((cb) => cb.trim().length > 0);

    // The first segment before any ===CAU=== contains meta or section header
    const headerLines = cauBlocks[0] ? cauBlocks[0].split('\n') : lines;

    headerLines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('===') || trimmed.startsWith('#')) return;

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx !== -1) {
        const key = trimmed.slice(0, colonIdx).trim();
        const val = trimmed.slice(colonIdx + 1).trim();

        const recognizedHeaderKeys = [
          'MON',
          'LOP',
          'THOI_GIAN',
          'TIEU_DE',
          'TRUONG',
          'NAM_HOC',
          'DE_SO',
          'TONG_SO_DE',
          'TEN',
          'LOAI',
          'DIEM_MOI_CAU',
          'GHI_CHU',
          'MO_TA',
          'DE_DAN',
          'BAI_DOC',
        ];

        if (recognizedHeaderKeys.includes(key)) {
          currentHeaderKey = key;
          if (key === 'MON') meta.mon = val;
          else if (key === 'LOP') meta.lop = val;
          else if (key === 'THOI_GIAN') meta.thoiGian = parseInt(val, 10) || 90;
          else if (key === 'TIEU_DE') meta.tieuDe = val;
          else if (key === 'TRUONG') meta.truong = val;
          else if (key === 'NAM_HOC') meta.namHoc = val;
          else if (key === 'DE_SO') meta.deSo = parseInt(val, 10) || 1;
          else if (key === 'TONG_SO_DE') meta.tongSoDe = parseInt(val, 10) || 1;
          else if (key === 'TEN') sectionName = val;
          else if (key === 'LOAI') {
            if (val === 'trac_nghiem_dung_sai') sectionType = 'trac_nghiem_dung_sai';
            else if (val === 'trac_nghiem_tra_loi_ngan') sectionType = 'trac_nghiem_tra_loi_ngan';
            else if (val === 'tu_luan') sectionType = 'tu_luan';
            else sectionType = 'trac_nghiem_4_lua_chon';
          } else if (key === 'DIEM_MOI_CAU') diemMoiCau = parseFloat(val) || 0.25;
          else if (['GHI_CHU', 'MO_TA', 'DE_DAN', 'BAI_DOC'].includes(key)) {
            sectionGhiChu = val;
          }
          return;
        }
      }

      // Nếu dòng tiếp theo là nội dung kéo dài của GHI_CHU / bài đọc chung
      if (currentHeaderKey && ['GHI_CHU', 'MO_TA', 'DE_DAN', 'BAI_DOC'].includes(currentHeaderKey)) {
        sectionGhiChu += (sectionGhiChu ? '\n' : '') + trimmed;
      }
    });

    const questions: Question[] = [];

    // Parse each CAU block (skip the first element if it was just section headers)
    const questionBlocks = cauBlocks.slice(1);

    questionBlocks.forEach((qBlock, qIdx) => {
      const qLines = qBlock.split('\n');
      const qObj: Partial<Question> = {
        id: `q_${Date.now()}_${pIdx}_${qIdx}`,
        stt: qIdx + 1,
        loai: sectionType,
        noiDung: '',
        dapAn: '',
      };

      let currentMultiLineKey: string | null = null;

      qLines.forEach((qLine) => {
        const lineTrim = qLine.trim();
        if (!lineTrim) return;

        // 1. Nhận diện dòng chứa cả 4 phương án trên 1 dòng: A. ... B. ... C. ... D. ...
        const multiOptMatch = lineTrim.match(/^[*\s]*A[.:\)]\s*(.*?)\s+[*\s]*B[.:\)]\s*(.*?)\s+[*\s]*C[.:\)]\s*(.*?)\s+[*\s]*D[.:\)]\s*(.*)$/i);
        if (multiOptMatch) {
          qObj.optionA = multiOptMatch[1].trim();
          qObj.optionB = multiOptMatch[2].trim();
          qObj.optionC = multiOptMatch[3].trim();
          qObj.optionD = multiOptMatch[4].trim();
          currentMultiLineKey = 'D';
          return;
        }

        // 2. Nhận diện dòng bắt đầu bằng phương án: A., A), **A.**, **A:**, Phương án A:...
        const singleOptMatch = lineTrim.match(/^[*\s]*(?:Phương án\s+|Đáp án\s+)?([ABCD])[.:\)]\s*[*_]*(.*)$/i);
        if (singleOptMatch && !lineTrim.toLowerCase().startsWith('dap_an:')) {
          const optKey = singleOptMatch[1].toUpperCase();
          currentMultiLineKey = optKey;
          if (optKey === 'A') qObj.optionA = singleOptMatch[2].trim();
          else if (optKey === 'B') qObj.optionB = singleOptMatch[2].trim();
          else if (optKey === 'C') qObj.optionC = singleOptMatch[2].trim();
          else if (optKey === 'D') qObj.optionD = singleOptMatch[2].trim();
          return;
        }

        const cIdx = lineTrim.indexOf(':');
        if (cIdx !== -1) {
          const k = lineTrim.slice(0, cIdx).trim();
          const v = lineTrim.slice(cIdx + 1).trim();

          const recognizedKeys = [
            'STT',
            'LOAI',
            'NOI_DUNG',
            'A',
            'B',
            'C',
            'D',
            'CAU_LENH',
            'MENH_DE_A',
            'MENH_DE_B',
            'MENH_DE_C',
            'MENH_DE_D',
            'DAP_AN_A',
            'DAP_AN_B',
            'DAP_AN_C',
            'DAP_AN_D',
            'DAP_AN',
            'HUONG_DAN_GIAI',
            'TIKZ',
            'HINH_ANH',
            'MUC_DO',
            'DIEM',
          ];

          if (recognizedKeys.includes(k)) {
            currentMultiLineKey = k;

            if (k === 'STT') qObj.stt = parseInt(v, 10) || qIdx + 1;
            else if (k === 'LOAI') {
              if (v === 'trac_nghiem_dung_sai') qObj.loai = QuestionType.TRAC_NGHIEM_DUNG_SAI;
              else if (v === 'trac_nghiem_tra_loi_ngan') qObj.loai = QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN;
              else if (v === 'tu_luan') qObj.loai = QuestionType.TU_LUAN;
              else qObj.loai = QuestionType.TRAC_NGHIEM_4_LUA_CHON;
            } else if (k === 'NOI_DUNG') qObj.noiDung = v;
            else if (k === 'A') qObj.optionA = v;
            else if (k === 'B') qObj.optionB = v;
            else if (k === 'C') qObj.optionC = v;
            else if (k === 'D') qObj.optionD = v;
            else if (k === 'CAU_LENH') qObj.cauLenh = v;
            else if (k === 'MENH_DE_A') qObj.menhDeA = v;
            else if (k === 'MENH_DE_B') qObj.menhDeB = v;
            else if (k === 'MENH_DE_C') qObj.menhDeC = v;
            else if (k === 'MENH_DE_D') qObj.menhDeD = v;
            else if (k === 'DAP_AN_A') qObj.dapAnA = (v.toUpperCase().includes('D') || v.includes('Đ') ? 'D' : 'S');
            else if (k === 'DAP_AN_B') qObj.dapAnB = (v.toUpperCase().includes('D') || v.includes('Đ') ? 'D' : 'S');
            else if (k === 'DAP_AN_C') qObj.dapAnC = (v.toUpperCase().includes('D') || v.includes('Đ') ? 'D' : 'S');
            else if (k === 'DAP_AN_D') qObj.dapAnD = (v.toUpperCase().includes('D') || v.includes('Đ') ? 'D' : 'S');
            else if (k === 'DAP_AN') qObj.dapAn = v;
            else if (k === 'HUONG_DAN_GIAI') qObj.huongDanGiai = v;
            else if (k === 'TIKZ') qObj.tikzCode = v;
            else if (k === 'HINH_ANH') qObj.hinhAnh = v;
            else if (k === 'MUC_DO') qObj.mucDo = v;
            else if (k === 'DIEM') qObj.diem = parseFloat(v) || (sectionType === 'trac_nghiem_4_lua_chon' ? 0.25 : 1.0);
            return;
          }
        }

        // If line is a continuation of multiline field
        if (currentMultiLineKey) {
          if (currentMultiLineKey === 'NOI_DUNG') qObj.noiDung += '\n' + lineTrim;
          else if (currentMultiLineKey === 'A') qObj.optionA += '\n' + lineTrim;
          else if (currentMultiLineKey === 'B') qObj.optionB += '\n' + lineTrim;
          else if (currentMultiLineKey === 'C') qObj.optionC += '\n' + lineTrim;
          else if (currentMultiLineKey === 'D') qObj.optionD += '\n' + lineTrim;
          else if (currentMultiLineKey === 'CAU_LENH') qObj.cauLenh = (qObj.cauLenh || '') + '\n' + lineTrim;
          else if (currentMultiLineKey === 'MENH_DE_A') qObj.menhDeA += '\n' + lineTrim;
          else if (currentMultiLineKey === 'MENH_DE_B') qObj.menhDeB += '\n' + lineTrim;
          else if (currentMultiLineKey === 'MENH_DE_C') qObj.menhDeC += '\n' + lineTrim;
          else if (currentMultiLineKey === 'MENH_DE_D') qObj.menhDeD += '\n' + lineTrim;
          else if (currentMultiLineKey === 'DAP_AN') qObj.dapAn += '\n' + lineTrim;
          else if (currentMultiLineKey === 'HUONG_DAN_GIAI') qObj.huongDanGiai = (qObj.huongDanGiai || '') + '\n' + lineTrim;
          else if (currentMultiLineKey === 'TIKZ') qObj.tikzCode = (qObj.tikzCode || '') + '\n' + lineTrim;
          else if (currentMultiLineKey === 'HINH_ANH') qObj.hinhAnh = (qObj.hinhAnh || '') + '\n' + lineTrim;
        }
      });

      // Tự động trích xuất mã TikZ nếu AI chèn trực tiếp vào NOI_DUNG
      if (qObj.noiDung) {
        const tikzMatch = qObj.noiDung.match(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/);
        if (tikzMatch) {
          if (!qObj.tikzCode) {
            qObj.tikzCode = tikzMatch[0].trim();
          }
          qObj.noiDung = qObj.noiDung.replace(tikzMatch[0], '').trim();
        }
      }

      // ===== FALLBACK CHO CÂU ĐÚNG/SAI =====
      // Đảm bảo luôn có mệnh đề a, b, c, d — ngay cả khi AI xuất sai format
      const isDungSaiQ = qObj.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI || (qObj.loai as any) === 'trac_nghiem_dung_sai';
      if (isDungSaiQ) {
        // Fallback 1: Nếu AI nhét mệnh đề vào A/B/C/D thay vì MENH_DE_A..D → chuyển qua
        if (!qObj.menhDeA && qObj.optionA) {
          qObj.menhDeA = qObj.optionA;
          qObj.menhDeB = qObj.optionB;
          qObj.menhDeC = qObj.optionC;
          qObj.menhDeD = qObj.optionD;
          qObj.optionA = undefined; qObj.optionB = undefined;
          qObj.optionC = undefined; qObj.optionD = undefined;
        }

        // Fallback 2: Nếu AI liệt kê a) b) c) d) trong NOI_DUNG → bóc tách ra 4 mệnh đề
        if (!qObj.menhDeA && qObj.noiDung) {
          // Nhận diện các dạng: "a) ...", "a. ...", "A) ...", "A. ...", "- a) ..."
          const menhDeRegex = /(?:^|\n)\s*[-*]?\s*([abcdABCD])\s*[.)]\s*(.+?)(?=(?:\n\s*[-*]?\s*[abcdABCD]\s*[.)])|$)/gs;
          const matches = [...qObj.noiDung.matchAll(menhDeRegex)];
          if (matches.length >= 2) {
            const keyMap: Record<string, string> = {};
            matches.forEach((m) => { keyMap[m[1].toLowerCase()] = m[2].trim(); });
            if (keyMap['a']) { qObj.menhDeA = keyMap['a']; qObj.dapAnA = qObj.dapAnA || 'D'; }
            if (keyMap['b']) { qObj.menhDeB = keyMap['b']; qObj.dapAnB = qObj.dapAnB || 'S'; }
            if (keyMap['c']) { qObj.menhDeC = keyMap['c']; qObj.dapAnC = qObj.dapAnC || 'D'; }
            if (keyMap['d']) { qObj.menhDeD = keyMap['d']; qObj.dapAnD = qObj.dapAnD || 'S'; }
            // Xóa phần mệnh đề khỏi noiDung để tránh hiện trùng
            qObj.noiDung = qObj.noiDung.replace(menhDeRegex, '').trim();
          }
        }

        // Đảm bảo luôn có giá trị mặc định cho DAP_AN (Đúng/Sai có 4 mệnh đề)
        if (!qObj.dapAnA) qObj.dapAnA = 'D';
        if (!qObj.dapAnB) qObj.dapAnB = 'S';
        if (!qObj.dapAnC) qObj.dapAnC = 'D';
        if (!qObj.dapAnD) qObj.dapAnD = 'S';
      }

      // ===== FALLBACK CHO CÂU 4 LỰA CHỌN =====
      const is4LuaChonQ = qObj.loai === QuestionType.TRAC_NGHIEM_4_LUA_CHON || (qObj.loai as any) === 'trac_nghiem_4_lua_chon' || !qObj.loai;
      if (is4LuaChonQ) {
        const extracted = extractQuestionOptions(qObj as any);
        if (extracted.optionA) {
          qObj.optionA = extracted.optionA;
          qObj.optionB = extracted.optionB;
          qObj.optionC = extracted.optionC;
          qObj.optionD = extracted.optionD;
          qObj.noiDung = extracted.cleanNoiDung;
        }
      }

      // 3. Nếu câu hỏi đã có Bảng Biến Thiên (\begin{tabular}) thì TUYỆT ĐỐI XÓA mã TikZ ảo giác
      if (qObj.noiDung && /\\begin\{tabular\*?\}/i.test(qObj.noiDung)) {
        const { tables } = extractAndParseTabular(qObj.noiDung);
        if (tables && tables.some((t) => isVariationTable(t))) {
          qObj.tikzCode = undefined;
        }
      }

      // Fallback cho câu điền từ khuyết nội dung (Cloze test): chỉ có STT và các phương án A, B, C, D
      if (!qObj.noiDung && (qObj.optionA || qObj.dapAn || qObj.menhDeA)) {
        qObj.noiDung = `(${qObj.stt || qIdx + 1})`;
      }

      if (qObj.noiDung && qObj.noiDung.trim()) {
        questions.push(qObj as Question);
      }

    });

    if (questions.length > 0) {
      sections.push({
        ten: sectionName,
        loai: sectionType,
        diemMoiCau,
        ghiChu: sectionGhiChu.trim() || undefined,
        cauHoi: questions,
      });
    }
  });

  // Re-number questions globally if needed
  let globalCount = 1;
  sections.forEach((sec) => {
    sec.cauHoi.forEach((q) => {
      q.stt = globalCount++;
    });
  });

  return {
    meta,
    phan: sections,
  };
}


/**
 * Nhận dạng loại hình học từ nội dung câu hỏi
 */
export function detectShapeType(questionText: string): string {
  const text = questionText.toLowerCase();

  // Hình nón (cone) — THPT phổ biến
  if (/(hình nón|nón tròn xoay|cone|đường sinh.*nón|thể tích.*nón|diện tích xung quanh.*nón)/i.test(text)) return 'cone';

  // Hình hộp / Hình lập phương
  if (/(hình hộp|hình lập phương|hộp chữ nhật|rectangular box|cube)/i.test(text)) return 'box';

  // Hình trụ
  if (/(hình trụ|hình ống|trụ tròn|cylinder|thể tích.*trụ|diện tích.*trụ|sợi dây chuyền)/i.test(text)) return 'cylinder';

  // Hình cầu
  if (/(hình cầu|mặt cầu|sphere|bán cầu|thể tích.*cầu|diện tích.*cầu)/i.test(text)) return 'sphere';

  // Hình chóp
  if (/(hình chóp|chóp tứ giác|chóp tam giác|chóp đều|pyramid)/i.test(text)) return 'pyramid';

  // Lăng trụ 3D
  if (/(lăng trụ|prism|lăng kính)/i.test(text)) return 'prism';

  // Bảng biến thiên — kiểm tra trước đồ thị
  if (/(bảng biến thiên|monoton)/i.test(text)) return 'variation_table';

  // Đồ thị hàm số
  if (/(đồ thị|hàm số|hàm bậc|parabol|đường cong|tiếp tuyến.*hàm|cực trị|cực đại|cực tiểu|điểm uốn|hàm mũ|hàm logarit|hàm lượng giác)/i.test(text)) return 'function_graph';

  // Đường tròn nội/ngoại tiếp tam giác — kiểm tra trước đường tròn đơn
  if (/(đường tròn nội tiếp|đường tròn ngoại tiếp|nội tiếp tam giác|ngoại tiếp tam giác)/i.test(text)) return 'circle_triangle';

  // Đường tròn (hình học phẳng)
  if (/(đường tròn|tâm o|bán kính|dây cung|tiếp tuyến|cát tuyến|góc nội tiếp|góc tâm|cung tròn)/i.test(text)) return 'circle';

  // Góc, đường thẳng song song, cắt nhau — THCS
  if (/(góc vuông|góc nhọn|góc tù|hai đường thẳng song song|đường thẳng cắt nhau|góc so le|góc đồng vị|góc kề bù|góc đối đỉnh|hai góc)/i.test(text)) return 'angle_lines';

  // Tam giác
  if (/(tam giác|đường trung tuyến|đường cao|đường phân giác|trọng tâm|trực tâm|tâm nội tiếp|định lý thales|đồng dạng|congruent)/i.test(text)) return 'triangle';

  // Tứ giác
  if (/(hình vuông|hình chữ nhật|hình thang|hình bình hành|hình thoi|tứ giác|hình đa giác)/i.test(text)) return 'quadrilateral';

  // Vector / Tọa độ không gian
  if (/(vector|vectơ|tọa độ không gian|trục ox|trục oy|trục oz|oxyz|mặt phẳng tọa độ)/i.test(text)) return 'coordinate';

  // Tọa độ phẳng
  if (/(tọa độ|điểm.*\([0-9]|trung điểm|khoảng cách)/i.test(text)) return 'coordinate';

  return 'generic';
}

/**
 * Trả về ví dụ mẫu TikZ phù hợp với từng loại hình
 */
function getTikzExample(shapeType: string): string {
  switch (shapeType) {
    case 'circle':
      return `Ví dụ đường tròn tâm O bán kính R=2, có dây MN và điểm P trên đường tròn:
\\begin{tikzpicture}[scale=1.2]
  \\coordinate (O) at (0,0);
  \\draw[thick] (O) circle (2cm);
  \\fill (O) circle (1.5pt); \\node[below left] at (O) {$O$};
  \\coordinate (M) at ($(O)+(130:2cm)$);
  \\coordinate (N) at ($(O)+(-30:2cm)$);
  \\coordinate (P) at ($(O)+(80:2cm)$);
  \\draw[thick] (M) -- (N);
  \\fill (M) circle (1.5pt); \\node[above left] at (M) {$M$};
  \\fill (N) circle (1.5pt); \\node[right] at (N) {$N$};
  \\fill (P) circle (1.5pt); \\node[above right] at (P) {$P$};
\\end{tikzpicture}`;

    case 'cylinder':
      return `Ví dụ hình trụ bán kính r=2, chiều cao h=4 (ĐÚNG cách vẽ hình trụ — dùng ellipse, KHÔNG dùng hộp):
\\begin{tikzpicture}[scale=0.8]
  % Đáy dưới (ellipse)
  \\draw[thick] (0,0) ellipse (2cm and 0.6cm);
  % Đáy trên (ellipse)
  \\draw[thick] (0,4) ellipse (2cm and 0.6cm);
  % Hai đường bên
  \\draw[thick] (-2,0) -- (-2,4);
  \\draw[thick] (2,0) -- (2,4);
  % Nhãn bán kính và chiều cao
  \\draw[<->] (0,0) -- (2,0); \\node[below] at (1,0) {$r$};
  \\draw[<->] (2.3,0) -- (2.3,4); \\node[right] at (2.3,2) {$h$};
  % Tâm đáy
  \\fill (0,0) circle (1.5pt); \\fill (0,4) circle (1.5pt);
\\end{tikzpicture}`;

    case 'sphere':
      return `Ví dụ hình cầu tâm O bán kính R=2:
\\begin{tikzpicture}[scale=1]
  \\coordinate (O) at (0,0);
  \\draw[thick] (O) circle (2cm);
  \\draw[thick,dashed] (O) ellipse (2cm and 0.6cm);
  \\fill (O) circle (1.5pt); \\node[below right] at (O) {$O$};
  \\draw[thick] (O) -- (2,0); \\node[above] at (1,0) {$R$};
\\end{tikzpicture}`;

    case 'pyramid':
      return `Ví dụ hình chóp S.ABCD đáy hình vuông cạnh a=4, chiều cao h=3 (phối cảnh nghiêng):
\\begin{tikzpicture}[scale=0.8]
  % Đáy ABCD (phối cảnh nghiêng)
  \\coordinate (A) at (0,0); \\coordinate (B) at (4,0);
  \\coordinate (C) at (4.8,1.2); \\coordinate (D) at (0.8,1.2);
  \\coordinate (S) at (2.4,4); % Đỉnh chóp
  % Cạnh đáy (D, DA khuất — nét đứt)
  \\draw[thick] (A)--(B)--(C); \\draw[thick,dashed] (C)--(D)--(A);
  % Cạnh bên
  \\draw[thick] (S)--(A); \\draw[thick] (S)--(B); \\draw[thick] (S)--(C); \\draw[thick,dashed] (S)--(D);
  % Nhãn
  \\node[below left] at (A){$A$}; \\node[below right] at (B){$B$};
  \\node[right] at (C){$C$}; \\node[left] at (D){$D$};
  \\node[above] at (S){$S$};
\\end{tikzpicture}`;

    case 'prism':
      return `Ví dụ lăng trụ đứng ABC.A'B'C' (phối cảnh nghiêng):
\\begin{tikzpicture}[scale=0.8]
  \\coordinate (A) at (0,0); \\coordinate (B) at (3,0); \\coordinate (C) at (1,1.5);
  \\coordinate (A1) at (0,3); \\coordinate (B1) at (3,3); \\coordinate (C1) at (1,4.5);
  % Mặt dưới
  \\draw[thick] (A)--(B); \\draw[thick] (B)--(C); \\draw[thick,dashed] (C)--(A);
  % Mặt trên
  \\draw[thick] (A1)--(B1)--(C1)--cycle;
  % Cạnh bên (AA',BB' hiện, CC' khuất)
  \\draw[thick] (A)--(A1); \\draw[thick] (B)--(B1); \\draw[thick,dashed] (C)--(C1);
  \\node[below left] at (A){$A$}; \\node[below right] at (B){$B$}; \\node[left] at (C){$C$};
  \\node[above left] at (A1){$A'$}; \\node[above right] at (B1){$B'$}; \\node[above right] at (C1){$C'$};
\\end{tikzpicture}`;

    case 'function_graph':
      return `Ví dụ đồ thị hàm số bậc ba y = x^3 - 3x có cực đại tại x=-1, cực tiểu tại x=1:
\\begin{tikzpicture}
  \\begin{axis}[
    axis lines=center, xlabel={$x$}, ylabel={$y$},
    xmin=-3, xmax=3, ymin=-4, ymax=4,
    xtick={-2,-1,0,1,2}, ytick={-2,2},
    tick label style={font=\\small},
    width=7cm, height=7cm,
    samples=100, smooth,
  ]
    \\addplot[thick,blue,domain=-2.5:2.5] {x^3 - 3*x};
    \\addplot[mark=*,mark size=2pt,red] coordinates {(-1,2)} node[above right]{$(−1;2)$};
    \\addplot[mark=*,mark size=2pt,red] coordinates {(1,-2)} node[below right]{$(1;−2)$};
  \\end{axis}
\\end{tikzpicture}`;

    case 'variation_table':
      return `Ví dụ bảng biến thiên hàm bậc ba có cực đại x=-1 và cực tiểu x=2:
\\begin{tikzpicture}[scale=1, font=\\small]
  % Khung bảng
  \\draw[thick] (0,0) rectangle (8,2.5);
  \\draw[thick] (0,2) -- (8,2); % Phân cách dòng x và y
  \\draw[thick] (1.5,0) -- (1.5,2.5); % Cột x
  % Hàng x
  \\node at (0.75,2.25) {$x$};
  \\node at (2.5,2.25) {$-\\infty$};
  \\node at (4,2.25) {$-1$};
  \\node at (5.5,2.25) {$2$};
  \\node at (7.2,2.25) {$+\\infty$};
  % Hàng y' dấu
  \\node at (0.75,1.5) {$y'$};
  \\node at (3,1.5) {$+$}; \\node at (4,1.5) {$0$};
  \\node at (4.8,1.5) {$-$}; \\node at (5.5,1.5) {$0$}; \\node at (6.5,1.5) {$+$};
  % Hàng y mũi tên
  \\node at (0.75,0.7) {$y$};
  \\draw[->] (2,0.3) -- (3.8,1.6); % tăng đến cực đại
  \\draw[->] (4.2,1.6) -- (5.2,0.3); % giảm đến cực tiểu
  \\draw[->] (5.8,0.3) -- (7.5,1.6); % tăng
\\end{tikzpicture}`;

    case 'triangle':
      return `Ví dụ tam giác ABC với đường cao AH:
\\begin{tikzpicture}[scale=1.2]
  \\coordinate (A) at (1,3); \\coordinate (B) at (0,0); \\coordinate (C) at (4,0);
  \\draw[thick] (A)--(B)--(C)--cycle;
  % Chân đường cao
  \\coordinate (H) at ($(B)!(A)!(C)$);
  \\draw[thick] (A)--(H);
  % Ký hiệu vuông tại H
  \\draw ($(H)!0.25cm!(B)$) -- ++(0,0.25cm) -- ($(H)!0.25cm!(C)$);
  \\fill (A) circle (1.5pt); \\node[above] at (A) {$A$};
  \\fill (B) circle (1.5pt); \\node[below left] at (B) {$B$};
  \\fill (C) circle (1.5pt); \\node[below right] at (C) {$C$};
  \\fill (H) circle (1.5pt); \\node[below] at (H) {$H$};
\\end{tikzpicture}`;

    case 'quadrilateral':
      return `Ví dụ hình chữ nhật ABCD có AB=4, BC=3:
\\begin{tikzpicture}[scale=0.9]
  \\coordinate (A) at (0,0); \\coordinate (B) at (4,0);
  \\coordinate (C) at (4,3); \\coordinate (D) at (0,3);
  \\draw[thick] (A)--(B)--(C)--(D)--cycle;
  \\node[below left] at (A){$A$}; \\node[below right] at (B){$B$};
  \\node[above right] at (C){$C$}; \\node[above left] at (D){$D$};
  \\draw[<->] (0,-0.5)--(4,-0.5); \\node[below] at (2,-0.5){$4$};
  \\draw[<->] (4.5,0)--(4.5,3); \\node[right] at (4.5,1.5){$3$};
\\end{tikzpicture}`;

    case 'coordinate':
      return `Ví dụ hệ tọa độ Oxy có điểm A(2,3) và B(-1,1):
\\begin{tikzpicture}[scale=0.8]
  \\draw[->] (-2.5,0) -- (3.5,0) node[right]{$x$};
  \\draw[->] (0,-0.5) -- (0,4) node[above]{$y$};
  \\node[below left] at (0,0){$O$};
  \\coordinate (A) at (2,3); \\coordinate (B) at (-1,1);
  \\fill (A) circle (2pt); \\node[above right] at (A){$A(2;3)$};
  \\fill (B) circle (2pt); \\node[above right] at (B){$B(-1;1)$};
  \\draw[dashed] (2,0) -- (A) -- (0,3);
  \\draw[dashed] (-1,0) -- (B) -- (0,1);
  \\foreach \\x in {-2,-1,1,2,3} { \\draw (\\x,2pt)--(\\x,-2pt) node[below,font=\\tiny]{$\\x$}; }
  \\foreach \\y in {1,2,3} { \\draw (2pt,\\y)--(-2pt,\\y) node[left,font=\\tiny]{$\\y$}; }
\\end{tikzpicture}`;

    case 'cone':
      return `Ví dụ hình nón tròn xoay bán kính đáy r=2, chiều cao h=4, đường sinh l=sqrt(r^2+h^2):
\\begin{tikzpicture}[scale=0.8]
  % Đáy dưới (ellipse biểu diễn mặt tròn)
  \\draw[thick] (0,0) ellipse (2cm and 0.6cm);
  % Đỉnh nón
  \\coordinate (S) at (0,4);
  % Hai đường sinh thấy được
  \\draw[thick] (-2,0) -- (S);
  \\draw[thick] (2,0) -- (S);
  % Nhãn
  \\fill (S) circle (1.5pt); \\node[above] at (S){$S$};
  \\fill (0,0) circle (1.5pt); \\node[below right] at (0,0){$O$};
  % Bán kính
  \\draw[<->] (0,0) -- (2,0); \\node[below] at (1,0){$r$};
  % Chiều cao
  \\draw[dashed] (0,0) -- (S); \\node[left] at (0,2){$h$};
\\end{tikzpicture}`;

    case 'box':
      return `Ví dụ hình hộp chữ nhật ABCD.A'B'C'D' (phối cảnh nghiêng, cạnh khuất nét đứt):
\\begin{tikzpicture}[scale=0.8]
  % Mặt trước ABCD
  \\coordinate (A) at (0,0); \\coordinate (B) at (3,0);
  \\coordinate (C) at (3,2); \\coordinate (D) at (0,2);
  % Mặt sau A'B'C'D' (lùi vào và lên)
  \\coordinate (A1) at (1,0.6); \\coordinate (B1) at (4,0.6);
  \\coordinate (C1) at (4,2.6); \\coordinate (D1) at (1,2.6);
  % Mặt trước (hiện)
  \\draw[thick] (A)--(B)--(C)--(D)--cycle;
  % Mặt trên (hiện)
  \\draw[thick] (D)--(D1)--(C1)--(C);
  % Cạnh bên phải (hiện)
  \\draw[thick] (B)--(B1)--(C1);
  % Mặt sau và đáy (khuất — nét đứt)
  \\draw[thick,dashed] (A)--(A1)--(B1); \\draw[thick,dashed] (A1)--(D1);
  % Nhãn
  \\node[below left] at (A){$A$}; \\node[below right] at (B){$B$};
  \\node[above right] at (C){$C$}; \\node[above left] at (D){$D$};
  \\node[below] at (A1){$A'$}; \\node[below right] at (B1){$B'$};
  \\node[above right] at (C1){$C'$}; \\node[above] at (D1){$D'$};
\\end{tikzpicture}`;

    case 'circle_triangle':
      return `Ví dụ tam giác ABC nội tiếp đường tròn tâm O bán kính R, đường tròn nội tiếp tâm I:
\\begin{tikzpicture}[scale=1.2]
  \\coordinate (O) at (0,0);
  % Đường tròn ngoại tiếp
  \\draw[thick] (O) circle (2cm);
  \\fill (O) circle (1.5pt); \\node[below right] at (O){$O$};
  % Tam giác ABC nội tiếp
  \\coordinate (A) at ($(O)+(100:2cm)$);
  \\coordinate (B) at ($(O)+(220:2cm)$);
  \\coordinate (C) at ($(O)+(-20:2cm)$);
  \\draw[thick] (A)--(B)--(C)--cycle;
  \\fill (A) circle (1.5pt); \\node[above] at (A){$A$};
  \\fill (B) circle (1.5pt); \\node[below left] at (B){$B$};
  \\fill (C) circle (1.5pt); \\node[below right] at (C){$C$};
\\end{tikzpicture}`;

    case 'angle_lines':
      return `Ví dụ hai đường thẳng song song a, b bị cắt bởi đường thẳng c, thể hiện góc so le trong:
\\begin{tikzpicture}[scale=1]
  % Hai đường thẳng song song
  \\draw[thick] (-0.5,0) -- (4.5,0) node[right]{$a$};
  \\draw[thick] (-0.5,2) -- (4.5,2) node[right]{$b$};
  % Đường cắt
  \\draw[thick] (0.5,2.5) -- (3.5,-0.5) node[below]{$c$};
  % Tính giao điểm
  \\coordinate (P) at (1,2); % giao với b
  \\coordinate (Q) at (3,0); % giao với a
  \\fill (P) circle (1.5pt); \\fill (Q) circle (1.5pt);
  % Đánh dấu góc so le trong (xanh)
  \\draw[blue,thick,->] ($(P)+(0.4,0)$) arc (0:-45:0.4cm) node[right,font=\\small]{$\\alpha$};
  \\draw[blue,thick,->] ($(Q)+(-0.4,0)$) arc (180:135:0.4cm) node[left,font=\\small]{$\\alpha$};
\\end{tikzpicture}`;

    default:
      return `Ví dụ hình minh họa tổng quát (điểm, đoạn thẳng, góc):
\\begin{tikzpicture}[scale=1]
  \\coordinate (A) at (0,0); \\coordinate (B) at (4,0); \\coordinate (C) at (2,3);
  \\draw[thick] (A)--(B)--(C)--cycle;
  \\fill (A) circle (1.5pt); \\node[below left] at (A){$A$};
  \\fill (B) circle (1.5pt); \\node[below right] at (B){$B$};
  \\fill (C) circle (1.5pt); \\node[above] at (C){$C$};
\\end{tikzpicture}`;
  }
}

/**
 * Gọi AI để sinh mã TikZ từ nội dung câu hỏi và mô tả hình vẽ.
 * Tự động nhận dạng loại hình và cung cấp ví dụ mẫu phù hợp.
 */
/**
 * Gọi AI để sinh mã TikZ từ nội dung câu hỏi và mô tả hình vẽ.
 * Phân tích trực tiếp các thực thể hình học (điểm, đường, hình khối) trong bài toán để vẽ chính xác 100%.
 */
export async function generateTikzFromQuestion(
  questionText: string,
  extraDescription: string,
  model = 'gemini-3.5-flash'
): Promise<string> {
  const shapeType = detectShapeType(questionText);

  const guidanceByType: Record<string, string> = {
    circle: `- ĐỐI TƯỢNG ĐƯỜNG TRÒN:
• Đọc kỹ đề bài để lấy đúng tên tâm (O, I...), bán kính R, các dây cung (AB, CD...), tiếp tuyến, cát tuyến hoặc góc trong đề.
• Vẽ đường tròn: \\draw[thick] (0,0) circle (2.2cm); \\fill (0,0) circle (1.5pt); \\node[below left] at (0,0) {$Tên_tâm$};
• Tính toán và phân bố các điểm trên đường tròn bằng tọa độ cực \\coordinate (Tên_điểm) at (góc:2.2cm); sao cho thể hiện đúng vị trí tương đối và các giao điểm theo đề bài.
• Nối đúng các đoạn thẳng, dây cung và đánh dấu các góc nếu bài toán có số đo góc.`,
    cone: `- ĐỐI TƯỢNG HÌNH NÓN:
• Đáy là ellipse \\draw[thick] (0,0) ellipse (2cm and 0.6cm); Đỉnh S (hoặc tên đề cho) ở trên (0,3.5);
• Hai đường sinh bên \\draw[thick] (-2,0)--(0,3.5); \\draw[thick] (2,0)--(0,3.5); Trục chiều cao SO vẽ nét đứt [dashed].
• Đánh nhãn đúng các chữ cái đỉnh, tâm, bán kính theo đề bài.`,
    cylinder: `- ĐỐI TƯỢNG HÌNH TRỤ:
• Đáy dưới ellipse và đáy trên ellipse song song; Hai đường sinh thẳng đứng nối hai bên.
• Đánh nhãn tâm đáy dưới và đáy trên (O, O' hoặc tên đề cho), bán kính r và chiều cao h theo số liệu đề.`,
    sphere: `- ĐỐI TƯỢNG HÌNH CẦU:
• Đường tròn lớn \\draw[thick] (0,0) circle (2cm); Vòng xích đạo \\draw[thick,dashed] (0,0) ellipse (2cm and 0.6cm);
• Tâm và bán kính theo đúng đề bài.`,
    pyramid: `- ĐỐI TƯỢNG HÌNH CHÓP:
• Phối cảnh nghiêng; Đáy theo đúng đề bài (tam giác ABC hoặc tứ giác ABCD);
• Cạnh khuất BẮT BUỘC vẽ nét đứt [thick,dashed]; cạnh thấy vẽ nét liền [thick]; Đỉnh S nối xuống các đỉnh đáy.`,
    prism: `- ĐỐI TƯỢNG LĂNG TRỤ 3D / HÌNH HỘP:
• Mặt đáy trên và dưới song song; Các cạnh bên; Cạnh khuất phía sau nét đứt [dashed].
• Tên các đỉnh theo đúng thứ tự trong đề bài.`,
    box: `- ĐỐI TƯỢNG HÌNH HỘP / LẬP PHƯƠNG:
• Vẽ 8 đỉnh ABCD.A'B'C'D' (hoặc tên theo đề); Cạnh khuất bên trong và phía sau là nét đứt [dashed].`,
    function_graph: `- ĐỒ THỊ HÀM SỐ:
• Vẽ hệ trục tọa độ Oxy có mũi tên [->]; Chia các vạch số trên trục;
• Vẽ đường cong hàm số mềm mại đúng công thức trong đề bài; Đánh dấu các điểm cực trị hoặc giao điểm nếu có.`,
    variation_table: `- BẢNG BIẾN THIÊN:
• Khung bảng gồm hàng x, y' (hoặc f'), y (hoặc f); Điền đúng các điểm cực trị, dấu +, - và mũi tên tăng giảm.`,
    triangle: `- ĐỐI TƯỢNG TAM GIÁC:
• Đặt tọa độ các đỉnh phù hợp với hình dạng (vuông, cân, đều, nhọn, tù) và tỉ lệ các cạnh trong đề.
• Đánh nhãn đúng các chữ cái đỉnh (A, B, C...) và các đường cao, phân giác, trung tuyến nếu đề có.`,
    quadrilateral: `- ĐỐI TƯỢNG TỨ GIÁC:
• Vẽ đúng dạng hình (hình bình hành, hình chữ nhật, hình thang, hình thoi, tứ giác lồi) theo đề bài.
• Đặt nhãn 4 đỉnh theo đúng thứ tự trong đề.`,
    angle_lines: `- ĐƯỜNG THẲNG VÀ GÓC:
• Vẽ các đường thẳng, tia, đoạn thẳng cắt nhau hoặc song song theo tên gọi trong đề bài.
• Vẽ cung tròn đánh dấu góc kèm nhãn góc hoặc số đo góc.`,
    coordinate: `- HỆ TỌA ĐỘ:
• Trục Ox, Oy có chia vạch số; Đánh dấu và ghi chú đúng tọa độ (x, y) của các điểm trong đề.`,
    generic: `- Phân tích kỹ các đối tượng hình học trong đề bài để dựng hình chính xác theo đúng tên các điểm và số liệu đề bài.`,
  };

  const specificGuidance = guidanceByType[shapeType] || guidanceByType.generic;

  const prompt = `Bạn là một chuyên gia toán học và lập trình viên LaTeX TikZ hàng đầu, chuyên vẽ hình minh họa cho các đề thi Toán THCS và THPT Việt Nam.

NỘI DUNG ĐỀ BÀI TOÁN CẦN VẼ HÌNH:
"""
${questionText}
"""
${extraDescription ? `MÔ TẢ BỔ SUNG TỪ GIÁO VIÊN: "${extraDescription}"` : ''}

QUY TẮC BẮT BUỘC ĐỂ VẼ HÌNH ĐÚNG 100%:
1. DỰNG HÌNH ĐỘC LẬP VÀ CHÍNH XÁC RIÊNG CHO ĐỀ BÀI NÀY:
   - Dùng chính xác tên các điểm, cạnh, góc trong đề bài (ví dụ: đề cho điểm A, B, C thì BẮT BUỘC vẽ các điểm A, B, C).
   - TUYỆT ĐỐI KHÔNG tự bịa ra điểm lạ không có trong đề bài.
   - TUYỆT ĐỐI KHÔNG dùng mã vẽ cố định của bài toán khác. Tọa độ phải được tính toán phù hợp với số liệu và giả thiết của câu hỏi này.

2. ĐỊNH NGHĨA TỌA ĐỘ VÀ TÊN ĐIỂM (BẮT BUỘC ĐỂ KHÔNG BỊ LỖI BIÊN DỊCH):
   - MỌI điểm được sử dụng trong các lệnh \\draw, \\fill, \\node, arc... PHẢI ĐƯỢC ĐỊNH NGHĨA TRƯỚC bằng \\coordinate (Tên) at (x,y); hoặc dùng tọa độ trực tiếp (x,y).
   - Nếu dùng gốc tọa độ hoặc tâm O: BẮT BUỘC phải viết \\coordinate (O) at (0,0); trước khi gọi (O).
   - TUYỆT ĐỐI không gọi tên điểm chưa được định nghĩa bằng \\coordinate (tránh triệt để lỗi "No shape named ... is known").

3. HƯỚNG DẪN KỸ THUẬT DỰNG HÌNH:
${specificGuidance}

4. KÝ HIỆU VÀ ĐÁNH NHÃN:
   - Tất cả các điểm phải được chấm rõ: \\fill (Tên) circle (1.5pt);
   - Nhãn điểm: \\node[vị_trí] at (Tên) {$Tên$}; (vị trí: above, below, left, right, above left, below right... sao cho chữ không bị đè lên nét vẽ).
   - Dùng \\usetikzlibrary{calc,intersections,angles,quotes,arrows.meta,patterns}

5. ĐỊNH DẠNG ĐẦU RA:
   - BẮT BUỘC bắt đầu bằng \\begin{tikzpicture} và kết thúc bằng \\end{tikzpicture}.
   - Kích thước vừa vặn trong đề thi (dùng [scale=0.8] đến [scale=1.2]).
   - TUYỆT ĐỐI CHỈ TRẢ VỀ DUY NHẤT KHỐI MÃ \\begin{tikzpicture}...\\end{tikzpicture}. KHÔNG giải thích, KHÔNG markdown code block thừa.

Mã TikZ chuẩn xác:`;

  const rawText = await callGeminiRoundRobin(prompt, model);

  // Trích xuất mã TikZ từ response
  const match = rawText.match(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/);
  if (match) {
    return match[0].trim();
  }

  return rawText.trim();
}
