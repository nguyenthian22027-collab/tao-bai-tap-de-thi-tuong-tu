import JSZip from 'jszip';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  PageBreak,
} from 'docx';
import { ExamData, Question, QuestionType } from '../types';
import { latexToOmml } from './latexToOmml';
import { extractAndParseTabular, extractAndGenerateStatisticalChart, svgStringToPngBase64 } from './tableAndChartHelper';
import { renderTikzToPng } from './tikzRenderer';

export type ExportFormat = 'latex' | 'omml' | 'mathtype';
export type ExportDocxMode = 'exam_only' | 'both_in_one' | 'answers_only';

/**
 * Escapes special XML characters
 */
function xmlEscape(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parses a base64 string or data URL
 */
export function parseBase64Image(dataUriOrBase64: string): { ext: string; mime: string; base64: string } {
  let mime = 'image/png';
  let ext = 'png';
  let base64 = dataUriOrBase64;

  const match = dataUriOrBase64.match(/^data:([^;]+);base64,(.*)$/);
  if (match) {
    mime = match[1];
    base64 = match[2];
    if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpeg';
    else if (mime.includes('png')) ext = 'png';
    else if (mime.includes('gif')) ext = 'gif';
    else if (mime.includes('webp')) ext = 'webp';
  }
  return { ext, mime, base64 };
}

/**
 * Converts a base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Safely determines image dimensions in browser or Node environment
 */
export async function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      resolve({ width: 400, height: 260 });
      return;
    }
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 260 });
    };
    img.onerror = () => {
      resolve({ width: 400, height: 260 });
    };
    img.src = src;
  });
}

/**
 * Extracts question illustration images from hinhAnh or markdown content
 */
function extractQuestionImages(q: Question): string[] {
  const images: string[] = [];
  if (q.hinhAnh && q.hinhAnh.trim()) {
    images.push(q.hinhAnh.trim());
  }

  // Check markdown image syntax in noiDung: ![alt](src)
  const mdImgRegex = /!\[.*?\]\((data:image\/[^;]+;base64,[^)]+|https?:\/\/[^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdImgRegex.exec(q.noiDung || '')) !== null) {
    if (match[1] && !images.includes(match[1])) {
      images.push(match[1]);
    }
  }

  return images;
}

/**
 * Strips raw markdown image syntax from text so it doesn't render as ugly text
 */
function cleanMarkdownImages(text: string): string {
  if (!text) return '';
  return text.replace(/!\[.*?\]\((data:image\/[^;]+;base64,[^)]+|https?:\/\/[^)]+)\)/g, '').trim();
}

/**
 * Strips TikZ LaTeX code from question text so it doesn't render as ugly code in the prompt
 */
export function extractAndCleanTikz(content: string): { cleanText: string; tikzCode?: string } {
  if (!content) return { cleanText: '' };
  const match = content.match(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/);
  if (match) {
    return {
      cleanText: content.replace(match[0], '').trim(),
      tikzCode: match[0].trim(),
    };
  }
  return { cleanText: content };
}

/**
 * Converts SVG XML string to PNG base64 data URL via canvas
 */
export function svgToPngBase64(svgString: string, defaultW = 500, defaultH = 350): Promise<string> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return resolve('');
    }
    try {
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || (window as any).webkitURL || window;
      const blobUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const w = img.naturalWidth || img.width || defaultW;
          const h = img.naturalHeight || img.height || defaultH;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(blobUrl);
            resolve(canvas.toDataURL('image/png'));
            return;
          }
        } catch (canvasErr) {
          console.warn('Canvas conversion failed:', canvasErr);
        }
        URL.revokeObjectURL(blobUrl);
        resolve('');
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve('');
      };
      img.src = blobUrl;
    } catch {
      resolve('');
    }
  });
}

/**
 * Ensures images for a question: checks q.hinhAnh, markdown images, and DOM-rendered TikZ SVGs
 */
export async function ensureQuestionImages(q: Question): Promise<string[]> {
  const images = extractQuestionImages(q);
  if (images.length > 0) return images;

  // 1. Try DOM rendered SVG first (fastest if already rendered on page)
  if (typeof document !== 'undefined') {
    const svgEl = document.querySelector(
      `[data-question-id="${q.id}"] .tikz-container svg, [data-question-id="${q.id}"] .chart-container svg`
    );
    if (svgEl && !svgEl.classList.contains('lucide') && !svgEl.closest('button')) {
      try {
        const svgStr = new XMLSerializer().serializeToString(svgEl);
        const pngBase64 = await svgStringToPngBase64(svgStr);
        if (pngBase64) {
          q.hinhAnh = pngBase64;
          return [pngBase64];
        }
      } catch (err) {
        console.warn('Failed to capture DOM TikZ SVG for question', q.stt, err);
      }
    }
  }

  // 2. If question has TikZ code or extracted TikZ, compile it to PNG directly
  const activeTikz = q.tikzCode || extractAndCleanTikz(q.noiDung).tikzCode;
  if (activeTikz) {
    try {
      const pngBase64 = await renderTikzToPng(activeTikz);
      if (pngBase64) {
        q.hinhAnh = pngBase64;
        return [pngBase64];
      }
    } catch (err) {
      console.warn('Failed to compile TikZ to PNG for question', q.stt, err);
    }
  }

  // 3. If question contains statistical frequency grouped data, generate chart PNG
  const { chartSvg } = extractAndGenerateStatisticalChart(q.noiDung);
  if (chartSvg) {
    try {
      const pngBase64 = await svgStringToPngBase64(chartSvg);
      if (pngBase64) {
        q.hinhAnh = pngBase64;
        return [pngBase64];
      }
    } catch (err) {
      console.warn('Failed to compile chart SVG to PNG for question', q.stt, err);
    }
  }

  return [];
}

/**
 * Helper to split an array into chunks of a given size
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

/** No-border table cell style */
const NO_BORDER_STYLE = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

/**
 * Builds TextRun array for a single option label + text (helper for inline & table layouts)
 * NOTE: Must be defined before parseLineTokens is used, so will be called lazily.
 */
function buildOptionRunsLazy(key: string, text: string, parseTokensFn: (s: string) => FormattedToken[]): TextRun[] {
  const runs: TextRun[] = [
    new TextRun({ text: `${key}. `, bold: true, size: 22, color: '0F172A' }),
  ];
  parseTokensFn(text).forEach((t) => {
    if (t.type === 'math') {
      runs.push(new TextRun({ text: `$${t.content}$`, font: 'Courier New', color: '4F46E5', size: 20 }));
    } else {
      runs.push(new TextRun({ text: t.content, bold: t.bold, italics: t.italic, size: 22 }));
    }
  });
  return runs;
}

interface FormattedToken {
  type: 'text' | 'math';
  content: string;
  bold?: boolean;
  italic?: boolean;
  display?: boolean;
}

/**
 * Parses a single line of text containing Markdown bold/italic and LaTeX math
 */
function parseLineTokens(line: string): FormattedToken[] {
  if (!line) return [];

  const tokens: FormattedToken[] = [];
  // Tokenize by math expressions $...$ and $$...$$ first to protect LaTeX contents
  const mathRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(line)) !== null) {
    const matchIndex = match.index;
    const matchText = match[0];

    // Non-math text before
    if (matchIndex > lastIndex) {
      const textChunk = line.slice(lastIndex, matchIndex);
      tokens.push(...parseMarkdownStyles(textChunk));
    }

    const isDisplay = matchText.startsWith('$$') && matchText.endsWith('$$');
    const innerMath = isDisplay ? matchText.slice(2, -2) : matchText.slice(1, -1);
    tokens.push({
      type: 'math',
      content: innerMath,
      display: isDisplay,
    });

    lastIndex = mathRegex.lastIndex;
  }

  // Trailing text chunk
  if (lastIndex < line.length) {
    tokens.push(...parseMarkdownStyles(line.slice(lastIndex)));
  }

  return tokens;
}

/**
 * Parses markdown bold **text** and italic *text*
 */
function parseMarkdownStyles(text: string): FormattedToken[] {
  if (!text) return [];
  const tokens: FormattedToken[] = [];
  const styleRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = styleRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.slice(lastIndex, matchIndex),
      });
    }

    if (match[2]) {
      // Bold **match[2]**
      tokens.push({
        type: 'text',
        content: match[2],
        bold: true,
      });
    } else if (match[3]) {
      // Italic *match[3]*
      tokens.push({
        type: 'text',
        content: match[3],
        italic: true,
      });
    }

    lastIndex = styleRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return tokens;
}

/**
 * Renders 4 answer options A/B/C/D in a compact layout:
 * - ≤30 chars avg → 4 cols × 1 row
 * - ≤65 chars avg → 2 cols × 2 rows  
 * - longer → 1 per paragraph (original behaviour)
 */
function renderOptionsBlock(options: { key: string; text: string }[]): (Paragraph | Table)[] {
  const valid = options.filter((o) => o.text);
  if (valid.length === 0) return [];

  const avgLen = valid.reduce((acc, o) => acc + (o.text?.length ?? 0), 0) / valid.length;
  const numCols = avgLen <= 30 ? 4 : avgLen <= 65 ? 2 : 1;

  if (numCols === 1) {
    return valid.map(
      (opt) =>
        new Paragraph({
          children: buildOptionRunsLazy(opt.key, opt.text, parseLineTokens),
          indent: { left: 720 },
        })
    );
  }

  // Build no-border table with numCols columns
  const rows: TableRow[] = [];
  const colWidth = Math.floor(9638 / numCols);
  for (let i = 0; i < valid.length; i += numCols) {
    const rowOpts = valid.slice(i, i + numCols);
    while (rowOpts.length < numCols) rowOpts.push({ key: '', text: '' });
    const cells = rowOpts.map(
      (opt) =>
        new TableCell({
          width: { size: colWidth, type: WidthType.DXA },
          borders: NO_BORDER_STYLE,
          children: [
            new Paragraph({
              children: opt.key
                ? buildOptionRunsLazy(opt.key, opt.text, parseLineTokens)
                : [new TextRun({ text: '' })],
            }),
          ],
        })
    );
    rows.push(new TableRow({ children: cells }));
  }

  return [
    new Table({
      width: { size: 9638, type: WidthType.DXA },
      margins: { left: 720 },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideH: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideV: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows,
    }),
  ];
}

/**
 * Parses multi-line block into formatted paragraphs with indent levels
 */
interface ParsedParagraph {
  tokens: FormattedToken[];
  indentTwips?: number;
  isHeader?: boolean;
  colorHex?: string;
  isBoldOverall?: boolean;
}

function parseBlockToParagraphs(rawText: string, defaultColorHex?: string): ParsedParagraph[] {
  if (!rawText) return [];

  const rawLines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const paragraphs: ParsedParagraph[] = [];

  for (let rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) {
      paragraphs.push({ tokens: [], indentTwips: 0 });
      continue;
    }

    let indentTwips = 0;
    let isHeader = false;
    let colorHex = defaultColorHex;

    // Detect list bullet or sub-proposition: - **a)**, * **a)**, a), b), c), d)
    const subPropMatch = line.match(/^([*-]\s*)?\*\*([a-dA-D][\).:])\*\*\s*(.*)$/);
    if (subPropMatch) {
      indentTwips = 360;
      const propLetter = subPropMatch[2];
      const remainder = subPropMatch[3];
      const tokens: FormattedToken[] = [
        { type: 'text', content: `${propLetter} `, bold: true },
        ...parseLineTokens(remainder),
      ];
      paragraphs.push({ tokens, indentTwips, colorHex });
      continue;
    }

    // Detect general bold subhead: * **Heading:** text
    const subHeadMatch = line.match(/^([*-]\s*)?\*\*([^*]+)\*\*:?\s*(.*)$/);
    if (subHeadMatch && (subHeadMatch[2].length < 40 || line.startsWith('*') || line.startsWith('-'))) {
      const heading = subHeadMatch[2];
      const remainder = subHeadMatch[3];
      indentTwips = line.startsWith('*') || line.startsWith('-') ? 360 : 0;
      const tokens: FormattedToken[] = [
        { type: 'text', content: `${heading}: `, bold: true },
        ...parseLineTokens(remainder),
      ];
      paragraphs.push({ tokens, indentTwips, colorHex });
      continue;
    }

    // Detect simple bullet: - or *
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('+ ')) {
      indentTwips = 360;
      const contentWithoutBullet = line.slice(2).trim();
      const tokens: FormattedToken[] = [
        { type: 'text', content: '• ' },
        ...parseLineTokens(contentWithoutBullet),
      ];
      paragraphs.push({ tokens, indentTwips, colorHex });
      continue;
    }

    // Regular line
    const tokens = parseLineTokens(line);
    paragraphs.push({ tokens, indentTwips, colorHex, isHeader });
  }

  return paragraphs;
}

// --------------------------------------------------------------------------------------
// 1. LATEX EXPORT (Standard docx.js with LaTeX font formatting + Image Embedding)
// --------------------------------------------------------------------------------------

export async function exportExamToDocxLatex(
  exam: ExamData,
  includeAnswers: boolean | ExportDocxMode = false
): Promise<Blob> {
  const mode: ExportDocxMode = typeof includeAnswers === 'string'
    ? includeAnswers
    : (includeAnswers ? 'both_in_one' : 'exam_only');

  const children: (Paragraph | Table)[] = [];

  // ====================================================================================
  // PHẦN 1: ĐỀ BÀI (KHI MODE !== 'answers_only')
  // ====================================================================================
  if (mode !== 'answers_only') {
    // Header Title
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: exam.meta.truong ? `${exam.meta.truong.toUpperCase()}\n` : '',
            bold: true,
            size: 22,
          }),
          new TextRun({
            text: (exam.meta.tieuDe || 'ĐỀ KIỂM TRA ĐỊNH DẠNG GDPT 2025').toUpperCase(),
            bold: true,
            size: 28,
            color: '1E3A8A',
          }),
          new TextRun({
            text: `\nThời gian làm bài: ${exam.meta.thoiGian || 90} phút (Không kể thời gian phát đề)`,
            italics: true,
            size: 22,
          }),
        ],
      })
    );

    children.push(new Paragraph({ text: '' })); // Spacer

    // Process sections
    for (const section of exam.phan) {
      let sectionTitle = section.ten;
      if (!sectionTitle) {
        if (section.loai === QuestionType.TRAC_NGHIEM_4_LUA_CHON || (section.loai as any) === 'trac_nghiem') {
          sectionTitle = 'PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN';
        } else if (section.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI || (section.loai as any) === 'dung_sai') {
          sectionTitle = 'PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI';
        } else if (section.loai === QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN || (section.loai as any) === 'tra_loi_ngan') {
          sectionTitle = 'PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN';
        } else {
          sectionTitle = 'PHẦN IV. TỰ LUẬN';
        }
      }

      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: sectionTitle,
              bold: true,
              size: 24,
              color: '0F172A',
            }),
          ],
        })
      );

      for (const q of section.cauHoi) {
        const isDungSai = q.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI || (q.loai as any) === 'dung_sai';
        const isTraLoiNgan = q.loai === QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN || (q.loai as any) === 'tra_loi_ngan';
        const isTuLuan = q.loai === QuestionType.TU_LUAN || (q.loai as any) === 'tu_luan';
        const is4LuaChon = !isDungSai && !isTraLoiNgan && !isTuLuan;

        // Extract TikZ from prompt if present so raw TikZ does not clutter the question text
        const { cleanText, tikzCode: extractedTikz } = extractAndCleanTikz(q.noiDung);
        if (extractedTikz && !q.tikzCode) {
          q.tikzCode = extractedTikz;
        }

        // Extract LaTeX tabular from prompt (hỗ trợ nhiều bảng)
        const { cleanText: promptTextNoTable, tables: parsedTables } = extractAndParseTabular(cleanText);

        // Render Question Prompt Paragraphs
        const cleanPrompt = cleanMarkdownImages(promptTextNoTable);
        const parsedPromptParas = parseBlockToParagraphs(cleanPrompt);
        parsedPromptParas.forEach((p, pIdx) => {
        const runs: TextRun[] = [];
        if (pIdx === 0) {
          runs.push(
            new TextRun({
              text: `Câu ${q.stt}: `,
              bold: true,
              size: 22,
            })
          );
        }

        p.tokens.forEach((t) => {
          if (t.type === 'math') {
            runs.push(
              new TextRun({
                text: `$${t.content}$`,
                font: 'Courier New',
                color: '4F46E5',
                size: 20,
              })
            );
          } else {
            runs.push(
              new TextRun({
                text: t.content,
                bold: t.bold,
                italics: t.italic,
                size: 22,
              })
            );
          }
        });

        if (pIdx === parsedPromptParas.length - 1 && q.diem) {
          runs.push(
            new TextRun({
              text: ` (${q.diem} điểm)`,
              italics: true,
              color: '64748B',
              size: 20,
            })
          );
        }

        children.push(
          new Paragraph({
            children: runs,
            indent: p.indentTwips ? { left: p.indentTwips } : undefined,
          })
        );
      });

      // Render all Tabular Tables if question contains LaTeX \begin{tabular}
      if (parsedTables && parsedTables.length > 0) {
        for (const parsedTable of parsedTables) {
          const headerCells = parsedTable.headers.map(
            (h) =>
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: h, bold: true, size: 20 })],
                  }),
                ],
                shading: { fill: 'E2E8F0' },
              })
          );
          const tRows = [new TableRow({ children: headerCells })];
          parsedTable.rows.forEach((r) => {
            const cells = r.map(
              (c) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: c, size: 20 })],
                    }),
                  ],
                })
            );
            tRows.push(new TableRow({ children: cells }));
          });

          children.push(
            new Table({
              rows: tRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            })
          );
          children.push(new Paragraph({ text: '' }));
        }
      }


      // Embed Question Images directly into document (including captured TikZ images)
      const qImages = await ensureQuestionImages(q);
      for (const imgSrc of qImages) {
        try {
          const parsed = parseBase64Image(imgSrc);
          const bytes = base64ToUint8Array(parsed.base64);
          const dims = await getImageDimensions(imgSrc);
          const maxW = 440;
          const scale = dims.width > maxW ? maxW / dims.width : 1;
          const finalW = Math.round(dims.width * scale);
          const finalH = Math.round(dims.height * scale);

          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: bytes,
                  transformation: {
                    width: finalW,
                    height: finalH,
                  },
                }),
              ],
            })
          );
        } catch (imgErr) {
          console.warn(`Failed to embed image in question ${q.stt}:`, imgErr);
        }
      }

      // 1. 4 Options — compact inline layout (auto 4-col / 2-col / 1-col based on length)
      if (is4LuaChon && q.optionA) {
        const options = [
          { key: 'A', text: q.optionA ?? '' },
          { key: 'B', text: q.optionB ?? '' },
          { key: 'C', text: q.optionC ?? '' },
          { key: 'D', text: q.optionD ?? '' },
        ];
        renderOptionsBlock(options).forEach((el) => children.push(el as any));
      }

      // 2. True / False — câu lệnh hỏi + 4 mệnh đề (Đề bài sạch sẽ, KHÔNG đánh dấu ĐÚNG/SAI)
      if (isDungSai) {
        // Câu lệnh hỏi (VD: "Trong các mệnh đề sau, mệnh đề nào đúng?")
        if (q.cauLenh) {
          const clRuns: TextRun[] = [];
          parseLineTokens(q.cauLenh).forEach((t) => {
            if (t.type === 'math') {
              clRuns.push(new TextRun({ text: `$${t.content}$`, font: 'Courier New', color: '4F46E5', size: 22 }));
            } else {
              clRuns.push(new TextRun({ text: t.content, bold: t.bold ?? true, italics: t.italic, size: 22, color: '0F172A' }));
            }
          });
          children.push(new Paragraph({ children: clRuns, indent: { left: 360 }, spacing: { before: 60 } }));
        }

        const propositions = [
          { key: 'a', text: q.menhDeA || q.optionA },
          { key: 'b', text: q.menhDeB || q.optionB },
          { key: 'c', text: q.menhDeC || q.optionC },
          { key: 'd', text: q.menhDeD || q.optionD },
        ];

        propositions.forEach((m) => {
          if (!m.text) return;
          const mdRuns: TextRun[] = [
            new TextRun({ text: `${m.key}) `, bold: true, size: 22 }),
          ];

          parseLineTokens(m.text).forEach((t) => {
            if (t.type === 'math') {
              mdRuns.push(new TextRun({ text: `$${t.content}$`, font: 'Courier New', color: '4F46E5', size: 20 }));
            } else {
              mdRuns.push(new TextRun({ text: t.content, bold: t.bold, italics: t.italic, size: 22 }));
            }
          });

          children.push(new Paragraph({ children: mdRuns, indent: { left: 720 } }));
        });
      }

      children.push(new Paragraph({ text: '' })); // Spacing between questions

    }
  }

  // Kết thúc phần Đề Thi
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: '------------------------ HẾT ------------------------\n',
          bold: true,
          italics: true,
          size: 22,
          color: '0F172A',
        }),
        new TextRun({
          text: '(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)',
          italics: true,
          size: 20,
          color: '64748B',
        }),
      ],
    })
  );
  }

  // ====================================================================================
  // PHẦN 2: ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT
  // ====================================================================================
  if (mode === 'both_in_one' || mode === 'answers_only') {
    if (mode === 'both_in_one') {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // Tiêu đề phần đáp án
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: 'ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT',
            bold: true,
            size: 28,
            color: '1E3A8A',
          }),
        ],
      })
    );
    children.push(new Paragraph({ text: '' }));

    const allQuestions = exam.phan.flatMap((p) => p.cauHoi);
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
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: 'I. BẢNG ĐÁP ÁN TỔNG HỢP',
            bold: true,
            size: 24,
            color: '0F172A',
          }),
        ],
      })
    );
    children.push(new Paragraph({ text: '' }));

    // Bảng đáp án Phần I
    if (part1Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '1. Bảng đáp án Phần I (Trắc nghiệm nhiều lựa chọn):',
              bold: true,
              size: 22,
              color: '1E3A8A',
            }),
          ],
        })
      );

      const chunks = chunkArray(part1Questions, 10);
      chunks.forEach((chunk) => {
        const headerCells = [
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Câu', bold: true, size: 20 })] })],
            shading: { fill: 'E2E8F0' },
          }),
          ...chunk.map(
            (q) =>
              new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(q.stt), bold: true, size: 20 })] })],
                shading: { fill: 'E2E8F0' },
              })
          ),
        ];

        const rowCells = [
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Chọn', bold: true, size: 20, color: '1E3A8A' })] })],
          }),
          ...chunk.map(
            (q) =>
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: (q.dapAn || '-').trim().toUpperCase(), bold: true, size: 20, color: '16A34A' })],
                  }),
                ],
              })
          ),
        ];

        children.push(
          new Table({
            rows: [new TableRow({ children: headerCells }), new TableRow({ children: rowCells })],
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        children.push(new Paragraph({ text: '' }));
      });
    }

    // Bảng đáp án Phần II (Đúng / Sai)
    if (part2Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '2. Bảng đáp án Phần II (Trắc nghiệm Đúng / Sai):',
              bold: true,
              size: 22,
              color: '1E3A8A',
            }),
          ],
        })
      );

      const headerCells = ['Câu', 'Lệnh hỏi a', 'Lệnh hỏi b', 'Lệnh hỏi c', 'Lệnh hỏi d'].map(
        (t) =>
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, size: 20 })] })],
            shading: { fill: 'E2E8F0' },
          })
      );

      const tableRows = [new TableRow({ children: headerCells })];
      part2Questions.forEach((q) => {
        const formatAns = (ans?: string) =>
          ans?.toUpperCase().includes('D') || ans?.includes('Đ') ? 'Đ' : (ans ? 'S' : '-');

        const rowCells = [
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Câu ${q.stt}`, bold: true, size: 20 })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: formatAns(q.dapAnA), bold: true, size: 20, color: formatAns(q.dapAnA) === 'Đ' ? '16A34A' : 'DC2626' })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: formatAns(q.dapAnB), bold: true, size: 20, color: formatAns(q.dapAnB) === 'Đ' ? '16A34A' : 'DC2626' })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: formatAns(q.dapAnC), bold: true, size: 20, color: formatAns(q.dapAnC) === 'Đ' ? '16A34A' : 'DC2626' })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: formatAns(q.dapAnD), bold: true, size: 20, color: formatAns(q.dapAnD) === 'Đ' ? '16A34A' : 'DC2626' })] })],
          }),
        ];
        tableRows.push(new TableRow({ children: rowCells }));
      });

      children.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
      children.push(new Paragraph({ text: '' }));
    }

    // Bảng đáp án Phần III (Trả lời ngắn)
    if (part3Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '3. Bảng đáp án Phần III (Trắc nghiệm Trả lời ngắn):',
              bold: true,
              size: 22,
              color: '1E3A8A',
            }),
          ],
        })
      );

      const chunks = chunkArray(part3Questions, 8);
      chunks.forEach((chunk) => {
        const headerCells = [
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Câu', bold: true, size: 20 })] })],
            shading: { fill: 'E2E8F0' },
          }),
          ...chunk.map(
            (q) =>
              new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(q.stt), bold: true, size: 20 })] })],
                shading: { fill: 'E2E8F0' },
              })
          ),
        ];

        const rowCells = [
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Đáp số', bold: true, size: 20, color: '1E3A8A' })] })],
          }),
          ...chunk.map(
            (q) =>
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: (q.dapAn || '-').trim(), bold: true, size: 20, color: '16A34A' })],
                  }),
                ],
              })
          ),
        ];

        children.push(
          new Table({
            rows: [new TableRow({ children: headerCells }), new TableRow({ children: rowCells })],
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        children.push(new Paragraph({ text: '' }));
      });
    }

    // II. HƯỚNG DẪN GIẢI CHI TIẾT
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: 'II. HƯỚNG DẪN GIẢI CHI TIẾT TỪNG CÂU',
            bold: true,
            size: 24,
            color: '0F172A',
          }),
        ],
      })
    );
    children.push(new Paragraph({ text: '' }));

    for (const q of allQuestions) {
      if (!q.huongDanGiai && !q.dapAn && !q.tikzCode) continue;

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Câu ${q.stt}: `,
              bold: true,
              size: 22,
              color: '1E3A8A',
            }),
            ...(q.dapAn ? [new TextRun({ text: `(Đáp án: ${q.dapAn})`, italics: true, color: '16A34A', size: 20 })] : []),
          ],
        })
      );

      if (q.huongDanGiai) {
        const cleanSol = cleanMarkdownImages(q.huongDanGiai);
        const solParas = parseBlockToParagraphs(cleanSol);
        solParas.forEach((p) => {
          const solRuns: TextRun[] = [];
          p.tokens.forEach((t) => {
            if (t.type === 'math') {
              solRuns.push(new TextRun({ text: `$${t.content}$`, font: 'Courier New', color: '4F46E5', size: 20 }));
            } else {
              solRuns.push(new TextRun({ text: t.content, bold: t.bold, italics: t.italic, size: 22 }));
            }
          });
          children.push(new Paragraph({ children: solRuns, indent: { left: 360 } }));
        });
      }

      // Xuất mã nguồn TikZ trong khung code để giáo viên có thể sao chép dùng lại
      if (q.tikzCode) {
        children.push(
          new Paragraph({
            indent: { left: 360 },
            children: [
              new TextRun({
                text: 'Mã nguồn TikZ (LaTeX Graphics):',
                bold: true,
                size: 20,
                color: '4338CA',
              }),
            ],
          })
        );

        const tikzLines = q.tikzCode.split('\n');
        tikzLines.forEach((tl) => {
          children.push(
            new Paragraph({
              indent: { left: 720 },
              children: [
                new TextRun({
                  text: tl,
                  font: 'Courier New',
                  size: 18,
                  color: '334155',
                }),
              ],
            })
          );
        });
      }

      children.push(new Paragraph({ text: '' }));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

// --------------------------------------------------------------------------------------
// 2. OMML & MATHTYPE EXPORT (Native Word Equation XML + DrawingML Direct Image Embedding)
// --------------------------------------------------------------------------------------

interface ExportImageRecord {
  id: number;
  relId: string;
  fileName: string;
  bytes: Uint8Array;
  cx: number;
  cy: number;
}

export async function exportExamToDocxOmml(
  exam: ExamData,
  includeAnswers: boolean | ExportDocxMode = false,
  isMathTypeCompat = false
): Promise<Blob> {
  const mode: ExportDocxMode = typeof includeAnswers === 'string'
    ? includeAnswers
    : (includeAnswers ? 'both_in_one' : 'exam_only');

  const zip = new JSZip();
  const imageRecords: ExportImageRecord[] = [];

  // Helper to create an XML paragraph from FormattedTokens
  const createXmlParagraph = (
    tokens: FormattedToken[],
    indentTwips = 0,
    isCenter = false,
    colorHex?: string,
    isBoldOverall = false
  ): string => {
    let pPr = '<w:pPr>';
    if (isCenter) pPr += '<w:jc w:val="center"/>';
    if (indentTwips > 0) pPr += `<w:ind w:left="${indentTwips}"/>`;
    pPr += '</w:pPr>';

    let runsXml = '';
    tokens.forEach((t) => {
      if (t.type === 'math') {
        runsXml += latexToOmml(t.content, isMathTypeCompat);
      } else {
        let rPr = '<w:rPr>';
        if (t.bold || isBoldOverall) rPr += '<w:b/>';
        if (t.italic) rPr += '<w:i/>';
        if (colorHex) rPr += `<w:color w:val="${colorHex}"/>`;
        rPr += '</w:rPr>';
        runsXml += `<w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(t.content)}</w:t></w:r>`;
      }
    });

    return `<w:p>${pPr}${runsXml}</w:p>`;
  };

  const createSimpleTextParagraph = (
    text: string,
    isBold = false,
    isCenter = false,
    colorHex?: string,
    indentTwips = 0
  ): string => {
    const tokens = parseLineTokens(text);
    return createXmlParagraph(tokens, indentTwips, isCenter, colorHex, isBold);
  };

  // Helper to emit multi-line markdown block into OMML paragraphs
  const emitMarkdownBlockXml = (
    rawText: string,
    prefixTokens: FormattedToken[] = [],
    baseIndent = 0,
    defaultColorHex?: string
  ): string => {
    const parsedParas = parseBlockToParagraphs(rawText, defaultColorHex);
    let xml = '';

    parsedParas.forEach((p, idx) => {
      const allTokens = idx === 0 ? [...prefixTokens, ...p.tokens] : p.tokens;
      const totalIndent = baseIndent + (p.indentTwips || 0);
      xml += createXmlParagraph(allTokens, totalIndent, false, p.colorHex || defaultColorHex);
    });

    return xml;
  };

  // Helper to create inline DrawingML image XML
  const createDrawingXml = (imgRecord: ExportImageRecord): string => {
    return `<w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="120" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${imgRecord.cx}" cy="${imgRecord.cy}"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="${imgRecord.id}" name="Picture ${imgRecord.id}"/>
            <wp:cNvGraphicFramePr>
              <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
            </wp:cNvGraphicFramePr>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="${imgRecord.id}" name="Picture ${imgRecord.id}"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${imgRecord.relId}"/>
                    <a:stretch>
                      <a:fillRect/>
                    </a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="${imgRecord.cx}" cy="${imgRecord.cy}"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect">
                      <a:avLst/>
                    </a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>`;
  };

  // Helper to create clean OpenXML WordML Tables for Answer Keys
  const createOmmlTable = (
    headers: string[],
    rows: string[][],
    colWidthsTwips?: number[]
  ): string => {
    let xml = '<w:tbl>';
    xml += '<w:tblPr>';
    xml += '<w:tblW w:w="0" w:type="auto"/>';
    xml += '<w:jc w:val="center"/>';
    xml += '<w:tblBorders>';
    xml += '<w:top w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>';
    xml += '<w:left w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>';
    xml += '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>';
    xml += '<w:right w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>';
    xml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
    xml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>';
    xml += '</w:tblBorders>';
    xml += '</w:tblPr>';

    // Header row
    xml += '<w:tr>';
    headers.forEach((h, idx) => {
      const w = colWidthsTwips?.[idx]
        ? `<w:tcW w:w="${colWidthsTwips[idx]}" w:type="dxa"/>`
        : '<w:tcW w:w="0" w:type="auto"/>';
      xml += `<w:tc><w:tcPr>${w}<w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/><w:tcMar><w:top w:w="80"/><w:bottom w:w="80"/><w:left w:w="120"/><w:right w:w="120"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${xmlEscape(h)}</w:t></w:r></w:p></w:tc>`;
    });
    xml += '</w:tr>';

    // Data rows
    rows.forEach((r) => {
      xml += '<w:tr>';
      r.forEach((c, idx) => {
        const w = colWidthsTwips?.[idx]
          ? `<w:tcW w:w="${colWidthsTwips[idx]}" w:type="dxa"/>`
          : '<w:tcW w:w="0" w:type="auto"/>';
        xml += `<w:tc><w:tcPr>${w}<w:tcMar><w:top w:w="80"/><w:bottom w:w="80"/><w:left w:w="120"/><w:right w:w="120"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="1E3A8A"/></w:rPr><w:t xml:space="preserve">${xmlEscape(c)}</w:t></w:r></w:p></w:tc>`;
      });
      xml += '</w:tr>';
    });

    xml += '</w:tbl>';
    return xml;
  };

  // Helper to create monospaced code blocks for TikZ LaTeX in Word
  const createCodeBlockXml = (code: string): string => {
    const lines = code.split('\n');
    let xml = '';
    lines.forEach((l) => {
      xml += `<w:p>
        <w:pPr>
          <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
          <w:ind w:left="720"/>
          <w:spacing w:line="240" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>
            <w:sz w:val="18"/>
            <w:color w:val="0F172A"/>
          </w:rPr>
          <w:t xml:space="preserve">${xmlEscape(l)}</w:t>
        </w:r>
      </w:p>`;
    });
    return xml;
  };

  let bodyXml = '';

  // ====================================================================================
  // PHẦN 1: ĐỀ BÀI (KHI MODE !== 'answers_only')
  // ====================================================================================
  if (mode !== 'answers_only') {
    // Header Title
    if (exam.meta.truong) {
      bodyXml += createSimpleTextParagraph(exam.meta.truong.toUpperCase(), true, true);
    }
    bodyXml += createSimpleTextParagraph(
      (exam.meta.tieuDe || 'ĐỀ KIỂM TRA ĐỊNH DẠNG GDPT 2025').toUpperCase(),
      true,
      true,
      '1E3A8A'
    );
    bodyXml += createSimpleTextParagraph(
      `Thời gian làm bài: ${exam.meta.thoiGian || 90} phút (Không kể thời gian phát đề)`,
      false,
      true
    );
    bodyXml += '<w:p/>'; // Spacing

    // Sections
    for (const section of exam.phan) {
      let sectionTitle = section.ten;
      if (!sectionTitle) {
        if (section.loai === QuestionType.TRAC_NGHIEM_4_LUA_CHON || (section.loai as any) === 'trac_nghiem') {
          sectionTitle = 'PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN';
        } else if (section.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI || (section.loai as any) === 'dung_sai') {
          sectionTitle = 'PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI';
        } else if (section.loai === QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN || (section.loai as any) === 'tra_loi_ngan') {
          sectionTitle = 'PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN';
        } else {
          sectionTitle = 'PHẦN IV. TỰ LUẬN';
        }
      }

      bodyXml += createSimpleTextParagraph(sectionTitle, true, false, '0F172A');

      for (const q of section.cauHoi) {
        const isDungSai = q.loai === QuestionType.TRAC_NGHIEM_DUNG_SAI || (q.loai as any) === 'dung_sai';
        const isTraLoiNgan = q.loai === QuestionType.TRAC_NGHIEM_TRA_LOI_NGAN || (q.loai as any) === 'tra_loi_ngan';
        const isTuLuan = q.loai === QuestionType.TU_LUAN || (q.loai as any) === 'tu_luan';
        const is4LuaChon = !isDungSai && !isTraLoiNgan && !isTuLuan;

        // Extract TikZ from prompt if present so raw TikZ does not clutter the question prompt
        const { cleanText, tikzCode: extractedTikz } = extractAndCleanTikz(q.noiDung);
        if (extractedTikz && !q.tikzCode) {
          q.tikzCode = extractedTikz;
        }

        // Extract LaTeX tabular from prompt (hỗ trợ nhiều bảng)
        const { cleanText: promptTextNoTable, tables: parsedTables } = extractAndParseTabular(cleanText);

        // Question Prompt
        const prefixTokens: FormattedToken[] = [
          { type: 'text', content: `Câu ${q.stt}: `, bold: true },
        ];

        const cleanPrompt = cleanMarkdownImages(promptTextNoTable);
        bodyXml += emitMarkdownBlockXml(cleanPrompt, prefixTokens, 0);

        // Render all Tabular Tables if question contains LaTeX \begin{tabular}
        if (parsedTables && parsedTables.length > 0) {
          for (const parsedTable of parsedTables) {
            bodyXml += createOmmlTable(parsedTable.headers, parsedTable.rows);
            bodyXml += '<w:p/>';
          }
        }


      // Embed Question Images directly into Word document (including captured TikZ images)
      const qImages = await ensureQuestionImages(q);
      for (const imgSrc of qImages) {
        try {
          const parsed = parseBase64Image(imgSrc);
          const bytes = base64ToUint8Array(parsed.base64);
          const dims = await getImageDimensions(imgSrc);
          const maxW = 440;
          const scale = dims.width > maxW ? maxW / dims.width : 1;
          const finalW = Math.round(dims.width * scale);
          const finalH = Math.round(dims.height * scale);
          const cx = finalW * 9525;
          const cy = finalH * 9525;

          const imgIndex = imageRecords.length + 1;
          const relId = `rIdImg${imgIndex}`;
          const fileName = `image_${imgIndex}.${parsed.ext === 'jpeg' ? 'jpeg' : 'png'}`;

          const record: ExportImageRecord = {
            id: imgIndex,
            relId,
            fileName,
            bytes,
            cx,
            cy,
          };
          imageRecords.push(record);
          bodyXml += createDrawingXml(record);
        } catch (imgErr) {
          console.warn(`Failed to process image in OMML for question ${q.stt}:`, imgErr);
        }
      }

      // 1. 4 Options — inline compact layout (2 per row if short, 1 per row if long)
      if (is4LuaChon && q.optionA) {
        const options = [
          { key: 'A', text: q.optionA ?? '' },
          { key: 'B', text: q.optionB ?? '' },
          { key: 'C', text: q.optionC ?? '' },
          { key: 'D', text: q.optionD ?? '' },
        ].filter((o) => o.text);

        const avgLen = options.reduce((acc, o) => acc + o.text.length, 0) / (options.length || 1);
        const numCols = avgLen <= 30 ? 4 : avgLen <= 65 ? 2 : 1;

        if (numCols === 1) {
          options.forEach((opt) => {
            const optTokens: FormattedToken[] = [
              { type: 'text', content: `${opt.key}. `, bold: true },
              ...parseLineTokens(opt.text),
            ];
            bodyXml += createXmlParagraph(optTokens, 720, false, '0F172A');
          });
        } else {
          // Build XML table with numCols columns for compact layout
          const colWidthDxa = Math.floor(9638 / numCols);
          bodyXml += `<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"/><w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/><w:left w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/><w:right w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="FFFFFF"/></w:tblBorders><w:tblInd w:w="720" w:type="dxa"/></w:tblPr>`;
          for (let i = 0; i < options.length; i += numCols) {
            const rowOpts = options.slice(i, i + numCols);
            while (rowOpts.length < numCols) rowOpts.push({ key: '', text: '' });
            bodyXml += '<w:tr>';
            rowOpts.forEach((opt) => {
              bodyXml += `<w:tc><w:tcPr><w:tcW w:w="${colWidthDxa}" w:type="dxa"/><w:tcBorders><w:top w:val="none" w:sz="0" w:color="FFFFFF"/><w:left w:val="none" w:sz="0" w:color="FFFFFF"/><w:bottom w:val="none" w:sz="0" w:color="FFFFFF"/><w:right w:val="none" w:sz="0" w:color="FFFFFF"/></w:tcBorders></w:tcPr>`;
              if (opt.key) {
                const optTokens: FormattedToken[] = [
                  { type: 'text', content: `${opt.key}. `, bold: true },
                  ...parseLineTokens(opt.text),
                ];
                bodyXml += createXmlParagraph(optTokens, 0, false, '0F172A');
              } else {
                bodyXml += '<w:p/>';
              }
              bodyXml += '</w:tc>';
            });
            bodyXml += '</w:tr>';
          }
          bodyXml += '</w:tbl>';
        }
      }

      // 2. True / False — câu lệnh hỏi + 4 mệnh đề (Đề bài sạch sẽ, KHÔNG đánh dấu ĐÚNG/SAI)
      if (isDungSai) {
        // Câu lệnh hỏi dẫn trước mệnh đề
        if (q.cauLenh) {
          const clTokens: FormattedToken[] = [...parseLineTokens(q.cauLenh)];
          bodyXml += createXmlParagraph(clTokens, 360, false, '0F172A');
        }

        const propositions = [
          { key: 'a', text: q.menhDeA || q.optionA },
          { key: 'b', text: q.menhDeB || q.optionB },
          { key: 'c', text: q.menhDeC || q.optionC },
          { key: 'd', text: q.menhDeD || q.optionD },
        ];

        propositions.forEach((m) => {
          if (!m.text) return;
          const mdTokens: FormattedToken[] = [
            { type: 'text', content: `${m.key}) `, bold: true },
            ...parseLineTokens(m.text),
          ];

          bodyXml += createXmlParagraph(mdTokens, 720, false, '0F172A');
        });
      }

      bodyXml += '<w:p/>'; // Spacing between questions

    }
  }

  // Kết thúc phần Đề Thi
  bodyXml += createSimpleTextParagraph('------------------------ HẾT ------------------------', true, true);
  bodyXml += createSimpleTextParagraph(
    '(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)',
    false,
    true,
    '64748B'
  );
  }

  // ====================================================================================
  // PHẦN 2: ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT
  // ====================================================================================
  if (mode === 'both_in_one' || mode === 'answers_only') {
    if (mode === 'both_in_one') {
      // Page Break
      bodyXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    }

    // Tiêu đề phần đáp án
    bodyXml += createSimpleTextParagraph('ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT', true, true, '1E3A8A');
    bodyXml += '<w:p/>';

    const allQuestions = exam.phan.flatMap((p) => p.cauHoi);
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
    bodyXml += createSimpleTextParagraph('I. BẢNG ĐÁP ÁN TỔNG HỢP', true, false, '0F172A');
    bodyXml += '<w:p/>';

    // Bảng đáp án Phần I
    if (part1Questions.length > 0) {
      bodyXml += createSimpleTextParagraph(
        '1. Bảng đáp án Phần I (Trắc nghiệm nhiều lựa chọn):',
        true,
        false,
        '1E3A8A'
      );

      const chunks = chunkArray(part1Questions, 10);
      chunks.forEach((chunk) => {
        const headers = ['Câu', ...chunk.map((q) => String(q.stt))];
        const rowData = ['Chọn', ...chunk.map((q) => (q.dapAn || '-').trim().toUpperCase())];
        bodyXml += createOmmlTable(headers, [rowData]);
        bodyXml += '<w:p/>';
      });
    }

    // Bảng đáp án Phần II (Đúng / Sai)
    if (part2Questions.length > 0) {
      bodyXml += createSimpleTextParagraph(
        '2. Bảng đáp án Phần II (Trắc nghiệm Đúng / Sai):',
        true,
        false,
        '1E3A8A'
      );

      const headers = ['Câu', 'Lệnh hỏi a', 'Lệnh hỏi b', 'Lệnh hỏi c', 'Lệnh hỏi d'];
      const rows = part2Questions.map((q) => {
        const formatAns = (ans?: string) =>
          ans?.toUpperCase().includes('D') || ans?.includes('Đ') ? 'Đ' : (ans ? 'S' : '-');
        return [
          `Câu ${q.stt}`,
          formatAns(q.dapAnA),
          formatAns(q.dapAnB),
          formatAns(q.dapAnC),
          formatAns(q.dapAnD),
        ];
      });

      bodyXml += createOmmlTable(headers, rows);
      bodyXml += '<w:p/>';
    }

    // Bảng đáp án Phần III (Trả lời ngắn)
    if (part3Questions.length > 0) {
      bodyXml += createSimpleTextParagraph(
        '3. Bảng đáp án Phần III (Trắc nghiệm Trả lời ngắn):',
        true,
        false,
        '1E3A8A'
      );

      const chunks = chunkArray(part3Questions, 8);
      chunks.forEach((chunk) => {
        const headers = ['Câu', ...chunk.map((q) => String(q.stt))];
        const rowData = ['Đáp số', ...chunk.map((q) => (q.dapAn || '-').trim())];
        bodyXml += createOmmlTable(headers, [rowData]);
        bodyXml += '<w:p/>';
      });
    }

    // II. HƯỚNG DẪN GIẢI CHI TIẾT
    bodyXml += createSimpleTextParagraph('II. HƯỚNG DẪN GIẢI CHI TIẾT TỪNG CÂU', true, false, '0F172A');
    bodyXml += '<w:p/>';

    for (const q of allQuestions) {
      if (!q.huongDanGiai && !q.dapAn && !q.tikzCode) continue;

      const titleText = `Câu ${q.stt}:` + (q.dapAn ? ` (Đáp án: ${q.dapAn})` : '');
      bodyXml += createSimpleTextParagraph(titleText, true, false, '1E3A8A');

      if (q.huongDanGiai) {
        const cleanSol = cleanMarkdownImages(q.huongDanGiai);
        bodyXml += emitMarkdownBlockXml(cleanSol, [], 360, '0F172A');
      }

      // Xuất mã nguồn TikZ trong khung code để giáo viên có thể sao chép dùng lại
      if (q.tikzCode) {
        bodyXml += createSimpleTextParagraph('Mã nguồn TikZ (LaTeX Graphics):', true, false, '4338CA', 360);
        bodyXml += createCodeBlockXml(q.tikzCode);
      }

      bodyXml += '<w:p/>';
    }
  }

  // 1. [Content_Types].xml (including image extensions)
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Default Extension="webp" ContentType="image/webp"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // 3. word/_rels/document.xml.rels (including all image relationships)
  let imageRelsXml = '';
  imageRecords.forEach((rec) => {
    imageRelsXml += `\n  <Relationship Id="${rec.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${rec.fileName}"/>`;
    zip.file(`word/media/${rec.fileName}`, rec.bytes);
  });

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${imageRelsXml}
</Relationships>`
  );

  // 4. word/settings.xml (includes w:compatMode=15 to eliminate [Compatibility Mode] in modern Word)
  zip.file(
    'word/settings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
  <w:compat>
    <w:compatMode>15</w:compatMode>
  </w:compat>
  <m:mathPr>
    <m:mathFont m:val="Cambria Math"/>
    <m:brkBin m:val="before"/>
    <m:brkBinSub m:val="--"/>
    <m:smallFrac m:val="0"/>
    <m:dispDef/>
    <m:lMargin m:val="0"/>
    <m:rMargin m:val="0"/>
    <m:defJc m:val="center"/>
    <m:wrapIndent m:val="1440"/>
    <m:intLim m:val="subSup"/>
    <m:naryLim m:val="undOvr"/>
  </m:mathPr>
</w:settings>`
  );

  // 5. word/styles.xml
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`
  );

  // 6. word/document.xml (declares wp, a, pic DrawingML namespaces for pictures)
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  mc:Ignorable="w14">
  <w:body>
    ${bodyXml}
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Dispatcher for exporting exams into specified format
 */
export async function exportExamToDocx(
  exam: ExamData,
  format: ExportFormat,
  includeAnswers: boolean | ExportDocxMode = false
): Promise<Blob> {
  if (format === 'latex') {
    return exportExamToDocxLatex(exam, includeAnswers);
  } else if (format === 'omml') {
    return exportExamToDocxOmml(exam, includeAnswers, false);
  } else {
    // mathtype compatible
    return exportExamToDocxOmml(exam, includeAnswers, true);
  }
}
