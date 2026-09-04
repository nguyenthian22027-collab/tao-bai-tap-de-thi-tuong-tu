import { ApiKeyInfo, ConfigState, ExamData, Question, ExamSection, QuestionType } from '../types';

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

  const tikzInstruction = config.tikzMode === 'yes'
    ? 'BẮT BUỘC VẼ HÌNH TIKZ: Bất kỳ câu hỏi nào liên quan tới hình học, đồ thị hàm số, sơ đồ hay hình minh họa, BẮT BUỘC viết mã TikZ LaTeX hoàn chỉnh đặt trong thẻ TIKZ: \\begin{tikzpicture}...\\end{tikzpicture}.'
    : config.tikzMode === 'no'
    ? 'KHÔNG tạo mã TikZ.'
    : 'TỰ ĐỘNG VẼ HÌNH TIKZ: Nếu đề bài hoặc câu hỏi gốc có hình vẽ, đồ thị hàm số, bảng biến thiên hay sơ đồ minh họa, BẮT BUỘC tự động tạo mã TikZ LaTeX chuẩn đẹp tương ứng đặt trong thuộc tính TIKZ: \\begin{tikzpicture}...\\end{tikzpicture}.';

  // Mode 2: Tạo câu lẻ / bài tập tương tự từ ảnh hoặc vài câu gốc
  if (config.mode === 'cau_le') {
    return `Bạn là chuyên gia sư phạm & giáo viên dạy giỏi hàng đầu Việt Nam.
NHIỆM VỤ: Dựa vào ảnh/văn bản bài tập gốc dưới đây, hãy sinh ra ${config.soBai} bài toán tương tự chất lượng cao.

YÊU CẦU CẤU HÌNH BÀI TẬP:
- Số bài cần sinh: ${config.soBai} bài
- Độ khó: ${doKhoMap[config.doKho]}
- Chế độ TikZ: ${tikzInstruction}
- Lời giải chi tiết: ${config.includeAnswers ? 'BẮT BUỘC có lời giải chi tiết từng bước và đáp số.' : 'Chỉ cần đề bài và đáp số ngắn gọn.'}
${config.extraPrompt ? `- YÊU CẦU THÊM TỪ GIÁO VIÊN: "${config.extraPrompt}"` : ''}

QUY TẮC BẮT BUỘC VỀ TRÌNH BÀY:
1. Tất cả công thức Toán, Lý, Hóa, Sinh... BẮT BUỘC dùng LaTeX trong dấu $...$ (inline) hoặc $$...$$ (display).
2. ${mathTypeNote}
3. Đảm bảo tính chính xác tuyệt đối về mặt toán học, số liệu đẹp, kết quả tính đúng đắn.
4. TUÂN THỦ ĐỊNH DẠNG TẦNG CỐ ĐỊNH DƯỚI ĐÂY (Không thêm lời chào hỏi hay JSON):

===DE===
TIEU_DE: BỘ BÀI TẬP TƯƠNG TỰ
THOI_GIAN: 45
===PHAN===
TEN: CÁC BÀI TOÁN TƯƠNG TỰ (${config.soBai} bài)
LOAI: tu_luan
===CAU===
STT: 1
LOAI: tu_luan
NOI_DUNG: [Nội dung đề bài toán tương tự 1, LaTeX trong $...]
TIKZ: [Mã TikZ nếu có, ví dụ: \\begin{tikzpicture}...\\end{tikzpicture}]
DAP_AN: [Lời giải chi tiết và đáp số cuối cùng]
MUC_DO: thong_hieu
DIEM: 1.0
===CAU===
... (Tiếp tục sinh đủ ${config.soBai} bài)
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

QUY TẮC TRÌNH BÀY BẮT BUỘC:
1. Tất cả công thức Toán, Lý, Hóa, Sinh, Ký hiệu BẮT BUỘC dùng LaTeX trong dấu $...$ (inline) hoặc $$...$$ (display).
2. Với CÂU ĐÚNG/SAI: BẮT BUỘC có trường CAU_LENH chứa câu hỏi dẫn trước 4 mệnh đề (ví dụ: "Trong các mệnh đề sau, mệnh đề nào đúng?", "Xét các phát biểu sau về hàm số:", "Khẳng định nào sau đây là đúng?"). KHÔNG được bỏ trống CAU_LENH.
3. Với bất kỳ câu hỏi nào có hình vẽ, đồ thị, sơ đồ, hình học hoặc biểu đồ thống kê: BẮT BUỘC sinh mã TikZ LaTeX đầy đủ trong trường TIKZ: \\begin{tikzpicture}...\\end{tikzpicture}. TUYỆT ĐỐI KHÔNG viết mã TikZ vào NOI_DUNG và KHÔNG viết mô tả gạch đầu dòng thay thế cho hình vẽ. TikZ phải CHÍNH XÁC THEO DỮ KIỆN SỐ trong đề bài (bán kính, tọa độ, góc...).
4. Nếu câu hỏi có bảng số liệu (bảng tần số, bảng giá trị): Viết bảng bằng cú pháp \\begin{tabular}{|c|c|...} ... \\end{tabular} chuẩn ngoài dấu $.
5. TUÂN THỦ CHÍNH XÁC ĐỊNH DẠNG TẦNG KHÔNG THAY ĐỔI DƯỚI ĐÂY (Không thêm JSON hay lời chào):

QUY TẮC PHÂN TÍCH VÀ SAO CHÉP CẤU TRÚC ĐỀ GỐC:
1. Nhận diện chính xác môn học, tên từng Phần, loại câu hỏi (Tự luận, Đọc hiểu, Trắc nghiệm 4 lựa chọn, Trắc nghiệm Đúng/Sai, Trả lời ngắn...) và số lượng câu hỏi trong từng phần của đề gốc.
2. GIỮ NGUYÊN HOÀN TOÀN TÊN CÁC PHẦN, SỐ LƯỢNG CÂU VÀ LOẠI CÂU HỎI như đề gốc.
   - Nếu đề gốc là Ngữ văn gồm 2 phần (I. ĐỌC HIỂU 4 câu tự luận, II. LÀM VĂN 2 câu tự luận), đề mới BẮT BUỘC gồm đúng 2 phần đó với 6 câu tự luận tương tự.
   - Nếu đề gốc có trắc nghiệm hoặc đọc hiểu kèm văn bản, hãy chọn ngữ cảnh/văn bản mới tương đương và sinh các câu hỏi tương ứng.
   - Nếu đề gốc gồm trắc nghiệm và tự luận kết hợp, hãy tái tạo chính xác số câu trắc nghiệm và tự luận như đề gốc.
3. ĐỘ KHÓ ĐỀ THI: ${doKhoMap[config.doKho]}
4. MỨC ĐỘ TƯƠNG TỰ MÔN HỌC: ${modeTextMap[config.mucDoTuongTu]}
5. VẼ HÌNH TIKZ: ${tikzInstruction}
${config.extraPrompt ? `6. YÊU CẦU THÊM TỪ GIÁO VIÊN: "${config.extraPrompt}"` : ''}

QUY TẮC TRÌNH BÀY BẮT BUỘC:
1. Tất cả công thức Toán, Lý, Hóa, Sinh, Ký hiệu BẮT BUỘC dùng LaTeX trong dấu $...$ (inline) hoặc $$...$$ (display).
3. Với bất kỳ câu hỏi nào có hình vẽ, đồ thị, sơ đồ, hình học hoặc biểu đồ thống kê: BẮT BUỘC sinh mã TikZ LaTeX đầy đủ trong trường TIKZ: \\begin{tikzpicture}...\\end{tikzpicture}. TUYỆT ĐỐI KHÔNG viết mã TikZ vào NOI_DUNG và KHÔNG viết mô tả gạch đầu dòng thay thế cho hình vẽ.
4. Nếu câu hỏi có bảng số liệu (bảng tần số, bảng giá trị): Viết bảng bằng cú pháp \\begin{tabular}{|c|c|...} ... \\end{tabular} chuẩn ngoài dấu $.
5. TUÂN THỦ CHÍNH XÁC ĐỊNH DẠNG TẦNG KHÔNG THAY ĐỔI DƯỚI ĐÂY (Không thêm JSON hay lời chào):

===DE===
TIEU_DE: ${deTitle}
THOI_GIAN: ${config.thoiGian}
TRUONG: ${config.truong || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO'}
NAM_HOC: ${config.namHoc || '2025 - 2026'}
DE_SO: ${deIndex}
TONG_SO_DE: ${config.soDeCanTao}

===PHAN===
TEN: [Tên phần 1 như đề gốc, VD: PHẦN I. TRẮC NGHIỆM]
LOAI: trac_nghiem_4_lua_chon
DIEM_MOI_CAU: 0.25
===CAU===
STT: 1
LOAI: trac_nghiem_4_lua_chon
NOI_DUNG: [Nội dung câu hỏi — LaTeX trong $...$. KHÔNG chứa mã TikZ. KHÔNG chứa "Hình vẽ:" hay "xem hình bên"]
TIKZ: [BẮTS BUỘC ghi mã \\begin{tikzpicture}...\\end{tikzpicture} nếu câu có hình vẽ/đồ thị. Để trống nếu không có hình]
A: [Phương án A]
B: [Phương án B]
C: [Phương án C]
D: [Phương án D]
DAP_AN: [Chữ cái A/B/C/D]
HUONG_DAN_GIAI: [Lời giải chi tiết]
MUC_DO: nhan_biet
DIEM: 0.25
===CAU===
... (Các câu 4 lựa chọn tiếp theo của phần 1)

===PHAN===
TEN: [Tên phần 2 — VD: PHẦN II. TRẮC NGHIỆM ĐÚNG SAI]
LOAI: trac_nghiem_dung_sai
DIEM_MOI_CAU: 1.0
===CAU===
STT: [số thứ tự tiếp theo]
LOAI: trac_nghiem_dung_sai
NOI_DUNG: [Đề dẫn bài toán. KHÔNG liệt kê mệnh đề ở đây. KHÔNG chứa mã TikZ]
TIKZ: [Mã TikZ nếu câu có hình. Để trống nếu không có hình]
CAU_LENH: Trong các mệnh đề sau, mệnh đề nào đúng?
MENH_DE_A: [Nội dung mệnh đề a — LaTeX trong $...$]
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
... (Các câu Đúng/Sai tiếp theo của phần 2)

===PHAN===
TEN: [Tên phần 3 — VD: PHẦN III. TRẢ LỜI NGẮN]
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
===DE===

QUAN TRỌNG: Chỉ xuất những PHẦN tồn tại trong đề gốc. Nếu đề gốc không có phần Đúng/Sai thì không xuất phần đó. Số lượng câu mỗi phần PHẢI bằng đúng số câu trong đề gốc.

NỘI DUNG ĐỀ GỐC CẦN PHÂN TÍCH VÀ SAO CHÉP Y HỆT CẤU TRÚC:
${sourceContent}
`;
  }

  // 1B. Chế độ: TÙY CHỈNH SỐ CÂU THEO MA TRẬN GDPT 2025 (4 phần)
  return `Bạn là chuyên gia khảo thí và ra đề thi chuẩn chương trình GDPT 2025 của Bộ Giáo dục & Đào tạo Việt Nam.

NHIỆM VỤ: Tạo 1 đề thi tương tự (Mã đề: ${deIndex}) từ đề thi gốc dưới đây theo ĐÚNG MA TRẬN CẤU HÌNH TÙY CHỈNH.

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
${config.numPart3 > 0 ? `3. PHẦN III (${config.numPart3} câu): Trắc nghiệm Trả lời ngắn (Thí sinh điền kết quả dạng số, phân số, số thập phân hoặc tọa độ).` : ''}
${config.numPart4 > 0 ? `4. PHẦN IV (${config.numPart4} câu): Tự luận (Trình bày lời giải chi tiết từng bước).` : ''}

QUY TẮC BẮT BUỘC:
1. Tất cả công thức BẮT BUỘC dùng LaTeX trong dấu $...$ (inline) hoặc $$...$$ (display).
2. ${mathTypeNote}
3. Ở Phần II (Đúng/Sai), BẮT BUỘC cung cấp rõ nội dung 4 mệnh đề a), b), c), d) và đáp án D (Đúng) hoặc S (Sai) cho từng mệnh đề.
4. Với bất kỳ câu hỏi nào có hình vẽ, đồ thị, sơ đồ, hình học hoặc biểu đồ thống kê: BẮT BUỘC sinh mã TikZ LaTeX đầy đủ trong trường TIKZ: \\begin{tikzpicture}...\\end{tikzpicture}. TUYỆT ĐỐI KHÔNG viết mã TikZ vào NOI_DUNG và KHÔNG viết mô tả gạch đầu dòng thay thế cho hình vẽ.
5. Nếu câu hỏi có bảng số liệu (bảng tần số, bảng giá trị): Viết bảng bằng cú pháp \\begin{tabular}{|c|c|...} ... \\end{tabular} chuẩn ngoài dấu $.
6. TUÂN THỦ CHÍNH XÁC ĐỊNH DẠNG TẦNG KHÔNG THAY ĐỔI DƯỚI ĐÂY:

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
NOI_DUNG: [Nội dung câu hỏi, LaTeX trong $...]
TIKZ: [Mã TikZ nếu có]
A: [Nội dung phương án A]
B: [Nội dung phương án B]
C: [Nội dung phương án C]
D: [Nội dung phương án D]
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
NOI_DUNG: [Đề dẫn chung của bài toán — ngữ cảnh, giả thiết, dữ kiện chung]
TIKZ: [Mã TikZ nếu có hình vẽ hoặc đồ thị]
CAU_LENH: [Câu lệnh hỏi, ví dụ: "Trong các mệnh đề sau, mệnh đề nào đúng?" hoặc "Xét các khẳng định sau:" — PHẢI CÓ, đây là câu hỏi dẫn bắt buộc]
MENH_DE_A: [Nội dung mệnh đề a)]
DAP_AN_A: D
MENH_DE_B: [Nội dung mệnh đề b)]
DAP_AN_B: S
MENH_DE_C: [Nội dung mệnh đề c)]
DAP_AN_C: D
MENH_DE_D: [Nội dung mệnh đề d)]
DAP_AN_D: S
DAP_AN: a) Đúng, b) Sai, c) Đúng, d) Sai
HUONG_DAN_GIAI: [Lời giải thích chi tiết tính đúng sai của từng ý]
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
NOI_DUNG: [Nội dung câu hỏi yêu cầu tính kết quả]
TIKZ: [Mã TikZ nếu có]
DAP_AN: [Đáp số ngắn, ví dụ: 12 hoặc 3/4 hoặc 2.5]
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
NOI_DUNG: [Nội dung câu hỏi tự luận]
TIKZ: [Mã TikZ nếu có]
DAP_AN: [Lời giải chi tiết từng bước]
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

      if (qObj.noiDung && qObj.noiDung.trim()) {
        questions.push(qObj as Question);
      }

    });

    if (questions.length > 0) {
      sections.push({
        ten: sectionName,
        loai: sectionType,
        diemMoiCau,
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
 * Gọi AI để sinh mã TikZ từ nội dung câu hỏi và mô tả hình vẽ
 */
export async function generateTikzFromQuestion(
  questionText: string,
  extraDescription: string,
  model = 'gemini-3.5-flash'
): Promise<string> {
  const prompt = `Bạn là chuyên gia TikZ LaTeX. Hãy viết mã TikZ chính xác để vẽ hình minh họa cho câu hỏi sau.

NỘI DUNG CÂU HỎI:
${questionText}

${extraDescription ? `MÔ TẢ THÊM VỀ HÌNH VẼ:\n${extraDescription}\n` : ''}

YÊU CẦU:
- Viết mã TikZ hoàn chỉnh dạng \\begin{tikzpicture}...\\end{tikzpicture}
- Hình phải CHÍNH XÁC theo dữ kiện số trong câu hỏi (bán kính, tọa độ, góc...)
- Dùng \\usepackage{tikz} và các thư viện: \\usetikzlibrary{calc,intersections,angles,quotes}
- Đánh nhãn các điểm, đường thẳng đúng theo đề bài
- Hình vẽ rõ ràng, cân đối, có tỉ lệ đẹp
- CHỈ trả về mã TikZ thuần túy, KHÔNG giải thích, KHÔNG markdown, KHÔNG thêm gì khác.

Ví dụ đường tròn tâm O bán kính R, có dây AB và điểm E ngoài đường tròn:
\\begin{tikzpicture}[scale=1.2]
  \\coordinate (O) at (0,0);
  \\draw[thick] (O) circle (2cm);
  \\node[below] at (O) {$O$};
  \\coordinate (A) at ($(O)+(55:2cm)$);
  \\coordinate (B) at ($(O)+(-70:2cm)$);
  \\draw[thick] (A) -- (B);
  \\node[above right] at (A) {$A$};
  \\node[below right] at (B) {$B$};
  \\fill (O) circle (1.5pt);
  \\fill (A) circle (1.5pt);
  \\fill (B) circle (1.5pt);
\\end{tikzpicture}

Mã TikZ cho câu hỏi trên:`;

  const rawText = await callGeminiRoundRobin(prompt, model);

  // Trích xuất mã TikZ từ response
  const match = rawText.match(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/);
  if (match) {
    return match[0].trim();
  }

  // Nếu không có tags, trả về toàn bộ nội dung đã trim
  return rawText.trim();
}
