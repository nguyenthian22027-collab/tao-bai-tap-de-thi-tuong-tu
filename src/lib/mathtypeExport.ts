/**
 * @license
 * EduSheet Studio & Math Tools - MathType OLE Word Exporter
 *
 * Chuyen ExamData -> Markdown chuan -> Backend MathType OLE -> DOCX
 * Cong thuc trong file xuat la OLE object (Equation.DSMT4) - MathType that su.
 */

import { ExamData, QuestionType, Question } from '../types';
import JSZip from 'jszip';
import { ensureQuestionImages, parseBase64Image, base64ToUint8Array, getImageDimensions } from './docxExporter';

const MATHTYPE_PROXY = '/mathtype-api';

export interface MathTypeResult {
  converted: number;
  failed: number;
}

/**
 * Sanitize 1 chuoi LaTeX/text truoc khi dua vao markdown:
 * - Loai bo SVG markup (Pandoc khong xu ly duoc SVG)
 * - Loai bo anh base64 inline
 * - Chuyen \vec{ -> \overrightarrow{ (mui ten vecto dai chuan SGK)
 * - Loai bo ky tu control characters (0x00-0x1F tru \n, \t)
 * - Chuan hoa xuong dong CRLF -> LF
 */
export type MathTypeExportMode = 'exam_only' | 'both_in_one' | 'answers_only';

/**
 * Chuyển đổi mã bảng LaTeX \begin{tabular} sang bảng Markdown chuẩn cho Pandoc
 */
export function convertTabularToMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(
    /\\begin\{tabular\}\s*\{[^\}]*\}\s*([\s\S]*?)\\end\{tabular\}/gi,
    (_, body) => {
      const rows = body
        .split(/\\\\|\\cr/)
        .map((r: string) => r.replace(/\\hline/g, '').trim())
        .filter((r: string) => r.length > 0)
        .map((r: string) => r.split('&').map((c: string) => c.trim()));

      if (rows.length === 0) return '';
      const colCount = Math.max(...rows.map((r: string[]) => r.length));
      if (colCount === 0) return '';

      const mdRows: string[] = [];
      const headerRow = rows[0];
      while (headerRow.length < colCount) headerRow.push('');
      mdRows.push('| ' + headerRow.join(' | ') + ' |');
      mdRows.push('| ' + Array(colCount).fill(':---:').join(' | ') + ' |');

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        while (row.length < colCount) row.push('');
        mdRows.push('| ' + row.join(' | ') + ' |');
      }

      return '\n\n' + mdRows.join('\n') + '\n\n';
    }
  );
}

/**
 * Sanitize 1 chuỗi LaTeX/text trước khi đưa vào markdown:
 * - Chuyển đổi bảng tabular sang bảng Markdown
 * - Loại bỏ \begin{center}, \end{center}
 * - Loại bỏ SVG markup (Pandoc không xử lý được SVG thô)
 * - Loại bỏ ảnh base64 inline
 * - Chuyển \vec{ -> \overrightarrow{ (mũi tên vectơ dài chuẩn SGK)
 * - Loại bỏ ký tự control characters (0x00-0x1F trừ \n, \t)
 * - Chuẩn hóa xuống dòng CRLF -> LF
 */
export function sanitizeMathText(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Chuyển đổi bảng LaTeX sang bảng Markdown
  cleaned = convertTabularToMarkdown(cleaned);

  return cleaned
    // Loại bỏ thẻ \begin{center} và \end{center}
    .replace(/\\begin\{center\}/gi, '')
    .replace(/\\end\{center\}/gi, '')
    // Loại bỏ SVG markup
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    // Loại bỏ ảnh base64 inline để Pandoc không bị lỗi
    .replace(/!\[([^\]]*)\]\((data:[^)]+)\)/gi, '')
    // Bóc tách mã TikZ nếu có
    .replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/gi, '')
    // Chuyển \vec{ -> \overrightarrow{ (mũi tên vectơ dài chuẩn SGK)
    .replace(/\\vec\{/g, '\\overrightarrow{')
    // Loại bỏ ký tự NULL và control chars không hợp lệ
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Chuẩn hóa xuống dòng
    .replace(/\r\n?/g, '\n')
    .trim();
}

/**
 * Tách chuỗi lời giải có nhiều ý (a, b, c, d) thành các đoạn riêng biệt
 * để Pandoc backend nhận diện và chuyển đổi 100% công thức toán.
 */
export function splitMultiStatementLines(text: string): string[] {
  const sanitized = sanitizeMathText(text);
  const parts = sanitized.split(/(?=\b[abcd]\)\s)/);
  const result = parts.map((p) => p.trim()).filter((p) => p.length > 0);
  return result.length > 1 ? result : [sanitized];
}

/**
 * Chuyển ExamData sang chuỗi Markdown chuẩn để backend MathType xử lý.
 * Hỗ trợ tách riêng Đề bài và Đáp án chuẩn chỉ:
 * - 'exam_only': Chỉ đề thi (không có đáp án, có kết thúc HẾT)
 * - 'both_in_one': Đề thi trước, ngắt trang sang trang sau là Đáp án & Lời giải
 * - 'answers_only': Chỉ xuất file Đáp án & Hướng dẫn giải chi tiết
 */
export function examToMarkdown(
  exam: ExamData,
  exportMode: MathTypeExportMode = 'both_in_one'
): string {
  const lines: string[] = [];
  const meta = exam.meta || { tieuDe: 'DE THI TUONG TU' };

  // ====================================================================================
  // PHẦN 1: ĐỀ BÀI (KHI EXPORT MODE !== 'answers_only')
  // ====================================================================================
  if (exportMode !== 'answers_only') {
    // HEADER
    lines.push(`# ${sanitizeMathText(meta.tieuDe || 'DE THI TUONG TU')}`);
    if (meta.truong) lines.push(`**${sanitizeMathText(meta.truong)}**`);

    const infoParts: string[] = [];
    if (meta.mon) infoParts.push(`**Môn:** ${sanitizeMathText(meta.mon)}`);
    if (meta.lop) infoParts.push(`**Lớp:** ${sanitizeMathText(meta.lop)}`);
    if (meta.thoiGian) infoParts.push(`**Thời gian:** ${meta.thoiGian} phút (không kể thời gian phát đề)`);
    if (meta.namHoc) infoParts.push(`**Năm học:** ${sanitizeMathText(meta.namHoc)}`);
    if (meta.deSo) infoParts.push(`**Mã đề:** ${meta.deSo}`);

    if (infoParts.length > 0) {
      lines.push(infoParts.join(' | '));
    }
    lines.push('');

    // CÁC PHẦN VÀ CÂU HỎI (ĐỀ THI SẠCH SẼ - KHÔNG CHÈN ĐÁP ÁN)
    const phanList = exam.phan || [];

    for (const phan of phanList) {
      if (phan.ten) {
        lines.push(`## ${sanitizeMathText(phan.ten)}`);
        lines.push('');
      }

      const cauHoiList = phan.cauHoi || [];
      for (const q of cauHoiList) {
        const noiDung = sanitizeMathText(q.noiDung);
        lines.push(`**Câu ${q.stt || ''}.** ${noiDung}`);
        lines.push('');

        // Placeholder ảnh minh họa câu hỏi để JSZip nhúng ảnh PNG vào DOCX sau khi máy chủ trả về
        lines.push(`[[IMG_PLACEHOLDER_Q_${q.id}]]`);
        lines.push('');

        // 1. Trắc nghiệm 4 lựa chọn (MCQ) — Layout gọn gàng (4 cột hoặc 2 cột)
        if (
          q.loai === QuestionType.TRAC_NGHIEM_4_LUA_CHON ||
          q.loai === QuestionType.TRAC_NGHIEM ||
          (!q.loai && (q.optionA || q.optionB))
        ) {
          const opts = [
            { key: 'A', text: sanitizeMathText(q.optionA || '') },
            { key: 'B', text: sanitizeMathText(q.optionB || '') },
            { key: 'C', text: sanitizeMathText(q.optionC || '') },
            { key: 'D', text: sanitizeMathText(q.optionD || '') },
          ].filter((o) => o.text);

          const totalLen = opts.reduce((acc, o) => acc + o.text.length, 0);
          const avgLen = totalLen / (opts.length || 1);

          const SP_4 = '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'; // Khoảng cách đều giữa 4 phương án
          const SP_2 = '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'; // Khoảng cách đều giữa 2 phương án

          if (avgLen <= 30 && opts.length === 4) {
            // 4 phương án trên 1 dòng chuẩn văn bản, tuyệt đối KHÔNG tạo khung bảng
            lines.push(
              `**A.** ${opts[0].text}${SP_4}**B.** ${opts[1].text}${SP_4}**C.** ${opts[2].text}${SP_4}**D.** ${opts[3].text}`
            );
            lines.push('');
          } else if (avgLen <= 65 && opts.length >= 2) {
            // 2 dòng, mỗi dòng 2 phương án gọn gàng
            const row1 = opts.slice(0, 2);
            const row2 = opts.slice(2, 4);
            lines.push(`**${row1[0]?.key}.** ${row1[0]?.text || ''}${SP_2}**${row1[1]?.key}.** ${row1[1]?.text || ''}`);
            lines.push('');
            if (row2.length > 0) {
              const opt3 = row2[0] ? `**${row2[0].key}.** ${row2[0].text}` : '';
              const opt4 = row2[1] ? `${SP_2}**${row2[1].key}.** ${row2[1].text}` : '';
              lines.push(`${opt3}${opt4}`);
              lines.push('');
            }
          } else {
            // Phương án dài: Mỗi phương án 1 dòng riêng
            opts.forEach((o) => lines.push(`**${o.key}.** ${o.text}`));
            lines.push('');
          }
        }

        // 2. Trắc nghiệm Đúng / Sai (4 mệnh đề) — Có câu lệnh hỏi & fallback đầy đủ
        if (q.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI) {
          if (q.cauLenh) {
            lines.push(`*${sanitizeMathText(q.cauLenh)}*`);
            lines.push('');
          }
          const propA = q.menhDeA || q.optionA;
          const propB = q.menhDeB || q.optionB;
          const propC = q.menhDeC || q.optionC;
          const propD = q.menhDeD || q.optionD;
          if (propA) lines.push(`**a)** ${sanitizeMathText(propA)}`);
          if (propB) lines.push(`**b)** ${sanitizeMathText(propB)}`);
          if (propC) lines.push(`**c)** ${sanitizeMathText(propC)}`);
          if (propD) lines.push(`**d)** ${sanitizeMathText(propD)}`);
          lines.push('');
        }
      }
    }

    // Kết thúc phần Đề Thi
    lines.push('------------------------ HẾT ------------------------');
    lines.push('*(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)*');
    lines.push('');
  }

  // ====================================================================================
  // PHẦN 2: ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT
  // ====================================================================================
  if (exportMode === 'both_in_one' || exportMode === 'answers_only') {
    // Ngắt trang nếu gộp trong 1 file
    if (exportMode === 'both_in_one') {
      lines.push('```{=openxml}');
      lines.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      lines.push('```');
      lines.push('\\newpage');
      lines.push('');
    }

    lines.push('# ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT');
    lines.push('');

    const allQuestions = (exam.phan || []).flatMap((p) => p.cauHoi || []);
    const part1Questions = allQuestions.filter(
      (q) => q.loai === QuestionType.TRAC_NGHIEM_4_LUA_CHON || (q.loai as any) === 'trac_nghiem'
    );
    const part2Questions = allQuestions.filter(
      (q) => q.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI || (q.loai as any) === 'dung_sai'
    );
    const part3Questions = allQuestions.filter(
      (q) => q.loai === QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN || (q.loai as any) === 'tra_loi_ngan'
    );

    // I. BẢNG ĐÁP ÁN TỔNG HỢP NHANH
    lines.push('## I. BẢNG ĐÁP ÁN TỔNG HỢP');
    lines.push('');

    // Bảng đáp án Phần I
    if (part1Questions.length > 0) {
      lines.push('**1. Bảng đáp án Phần I (Trắc nghiệm nhiều lựa chọn):**');
      lines.push('');

      // Chia nhỏ thành từng khối 10 câu để bảng không bị tràn khổ giấy A4
      for (let i = 0; i < part1Questions.length; i += 10) {
        const chunk = part1Questions.slice(i, i + 10);
        lines.push('| Câu | ' + chunk.map((q) => q.stt).join(' | ') + ' |');
        lines.push('|:---:|' + chunk.map(() => ':---:').join('|') + '|');
        lines.push('| **Chọn** | ' + chunk.map((q) => `**${(q.dapAn || '-').trim().toUpperCase()}**`).join(' | ') + ' |');
        lines.push('');
      }
    }

    // Bảng đáp án Phần II (Đúng / Sai)
    if (part2Questions.length > 0) {
      lines.push('**2. Bảng đáp án Phần II (Trắc nghiệm Đúng / Sai):**');
      lines.push('');
      lines.push('| Câu | Lệnh hỏi a | Lệnh hỏi b | Lệnh hỏi c | Lệnh hỏi d |');
      lines.push('|:---:|:---:|:---:|:---:|:---:|');

      const formatAns = (ans?: string) =>
        ans?.toUpperCase().includes('D') || ans?.includes('Đ') ? '**Đ**' : (ans ? '**S**' : '-');

      part2Questions.forEach((q) => {
        lines.push(
          `| Câu ${q.stt} | ${formatAns(q.dapAnA)} | ${formatAns(q.dapAnB)} | ${formatAns(q.dapAnC)} | ${formatAns(q.dapAnD)} |`
        );
      });
      lines.push('');
    }

    // Bảng đáp án Phần III (Trả lời ngắn)
    if (part3Questions.length > 0) {
      lines.push('**3. Bảng đáp án Phần III (Trắc nghiệm Trả lời ngắn):**');
      lines.push('');

      for (let i = 0; i < part3Questions.length; i += 8) {
        const chunk = part3Questions.slice(i, i + 8);
        lines.push('| Câu | ' + chunk.map((q) => q.stt).join(' | ') + ' |');
        lines.push('|:---:|' + chunk.map(() => ':---:').join('|') + '|');
        lines.push('| **Đáp số** | ' + chunk.map((q) => `**${(q.dapAn || '-').trim()}**`).join(' | ') + ' |');
        lines.push('');
      }
    }

    // II. HƯỚNG DẪN GIẢI CHI TIẾT
    lines.push('## II. HƯỚNG DẪN GIẢI CHI TIẾT TỪNG CÂU');
    lines.push('');

    for (const q of allQuestions) {
      if (!q.huongDanGiai && !q.dapAn && !q.tikzCode) continue;

      lines.push(`### Câu ${q.stt}:${q.dapAn ? ` *(Đáp án: ${sanitizeMathText(q.dapAn)})*` : ''}`);
      lines.push('');

      if (q.huongDanGiai) {
        const splitted = splitMultiStatementLines(q.huongDanGiai);
        splitted.forEach((part) => {
          lines.push(part);
          lines.push('');
        });
      }

      // Xuất khối mã TikZ cho giáo viên tái sử dụng
      if (q.tikzCode) {
        lines.push('**Mã nguồn TikZ (LaTeX Graphics):**');
        lines.push('```latex');
        lines.push(q.tikzCode);
        lines.push('```');
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Xuất ExamData -> Markdown -> Backend MathType OLE -> DOCX tải về máy.
 */
export async function exportMathTypeOleDocx(
  exam: ExamData,
  exportMode: MathTypeExportMode = 'both_in_one',
  filename?: string
): Promise<MathTypeResult> {
  const markdown = examToMarkdown(exam, exportMode);

  const defaultFilename = `de-tuong-tu-${(exam.meta?.mon || 'toan').toLowerCase().replace(/\s+/g, '-')}-mathtype-${new Date().toISOString().slice(0, 10)}.docx`;
  const safeFilename = filename || defaultFilename;

  console.log('[MathType OLE] Markdown length:', markdown.length, '| File:', safeFilename);

  let resp: Response;
  try {
    resp = await fetch(`${MATHTYPE_PROXY}/api/convert-markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown, formula_mode: 'mathtype' }),
    });
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error('[MathType OLE] Network error:', msg);
    throw new Error(`Khong the ket noi may chu MathType: ${msg}`);
  }

  if (!resp.ok) {
    let msg = `Loi may chu MathType (${resp.status})`;
    try {
      const text = await resp.text();
      console.error('[MathType OLE] Error body:', text.slice(0, 300));
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const [converted, failed] = (resp.headers.get('X-Stats') ?? '0,0')
    .split(',')
    .map((n) => parseInt(n, 10) || 0);

  const rawBlob = await resp.blob();
  console.log('[MathType OLE] Blob size:', rawBlob.size, 'bytes | Converted:', converted, '| Failed:', failed);

  // Nhúng ảnh minh họa / TikZ vào file DOCX trả về từ máy chủ MathType qua JSZip
  let docxBlob = rawBlob;
  try {
    const zip = await JSZip.loadAsync(rawBlob);
    let docXml = await zip.file('word/document.xml')?.async('string');
    let relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
    let contentTypesXml = await zip.file('[Content_Types].xml')?.async('string');

    if (docXml && relsXml) {
      const allQuestions = (exam.phan || []).flatMap((p) => p.cauHoi || []);
      let imgCounter = 1;
      let hasImageChanges = false;

      // Tìm số rId lớn nhất hiện có trong relsXml
      const existingRels = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));
      let nextRIdNum = (existingRels.length > 0 ? Math.max(...existingRels) : 10) + 1;

      for (const q of allQuestions) {
        const marker = `[[IMG_PLACEHOLDER_Q_${q.id}]]`;
        if (!docXml.includes(marker)) continue;

        const images = await ensureQuestionImages(q);
        if (images.length > 0 && images[0]) {
          try {
            const imgSrc = images[0];
            const parsed = parseBase64Image(imgSrc);
            const bytes = base64ToUint8Array(parsed.base64);
            const dims = await getImageDimensions(imgSrc);

            const maxW = 440;
            const scale = dims.width > maxW ? maxW / dims.width : 1;
            const finalW = Math.round(dims.width * scale);
            const finalH = Math.round(dims.height * scale);
            const cx = finalW * 9525;
            const cy = finalH * 9525;

            const rId = `rIdMathImg${nextRIdNum++}`;
            const fileName = `image_mathtype_${imgCounter++}.${parsed.ext === 'jpeg' ? 'jpeg' : 'png'}`;

            // Lưu file ảnh nhị phân vào zip
            zip.file(`word/media/${fileName}`, bytes);

            // Thêm relationship vào rels
            const relEntry = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fileName}"/>`;
            relsXml = relsXml.replace('</Relationships>', `${relEntry}</Relationships>`);

            // Tạo Drawing XML chuẩn Word OpenXML
            const drawingXml = `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${nextRIdNum}" name="Picture ${nextRIdNum}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${nextRIdNum}" name="Picture ${nextRIdNum}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

            // Thay thế đoạn văn chứa marker bằng thẻ vẽ ảnh drawingXml
            const pRegex = new RegExp(`<w:p[^>]*>(?:(?!<\\/w:p>)[\\s\\S])*?\\[\\[IMG_PLACEHOLDER_Q_${q.id}\\]\\][\\s\\S]*?<\\/w:p>`, 'g');
            if (pRegex.test(docXml)) {
              docXml = docXml.replace(pRegex, drawingXml);
            } else {
              docXml = docXml.replace(marker, drawingXml);
            }
            hasImageChanges = true;
          } catch (e) {
            console.warn(`[MathType OLE] Error injecting image for question ${q.stt}:`, e);
            docXml = docXml.replace(new RegExp(`<w:p[^>]*>(?:(?!<\\/w:p>)[\\s\\S])*?\\[\\[IMG_PLACEHOLDER_Q_${q.id}\\]\\][\\s\\S]*?<\\/w:p>`, 'g'), '');
          }
        } else {
          // Không có ảnh, xóa bỏ marker để không hiện văn bản thô
          docXml = docXml.replace(new RegExp(`<w:p[^>]*>(?:(?!<\\/w:p>)[\\s\\S])*?\\[\\[IMG_PLACEHOLDER_Q_${q.id}\\]\\][\\s\\S]*?<\\/w:p>`, 'g'), '');
        }
      }

      if (hasImageChanges) {
        if (contentTypesXml && !contentTypesXml.includes('Extension="png"')) {
          contentTypesXml = contentTypesXml.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
          zip.file('[Content_Types].xml', contentTypesXml);
        }
        zip.file('word/document.xml', docXml);
        zip.file('word/_rels/document.xml.rels', relsXml);

        docxBlob = await zip.generateAsync({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        console.log('[MathType OLE] Successfully injected images into DOCX, new size:', docxBlob.size);
      }
    }
  } catch (zipErr) {
    console.warn('[MathType OLE] Failed to inject images via JSZip:', zipErr);
  }

  const url = URL.createObjectURL(docxBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 30000);

  return { converted, failed };
}
