import mammoth from 'mammoth';

export interface DocxParseResult {
  html: string;
  text: string;
  mathTypeCount: number;
  wordCount: number;
  warningMessage?: string;
}

/**
 * Reads a .docx file ArrayBuffer, converts to HTML with embedded images,
 * and detects MathType OLE warnings from mammoth result.messages.
 */
export async function readDocxFile(arrayBuffer: ArrayBuffer): Promise<DocxParseResult> {
  try {
    const options = {
      convertImage: mammoth.images.imgElement((element) => {
        return element.read('base64').then((imageBuffer) => {
          return {
            src: `data:${element.contentType};base64,${imageBuffer}`,
          };
        });
      }),
    };

    const result = await mammoth.convertToHtml({ arrayBuffer }, options);
    const html = result.value || '';

    // Extract raw text for word count and prompt
    const rawTextResult = await mammoth.extractRawText({ arrayBuffer });
    const text = rawTextResult.value || '';

    // Count words
    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Detect MathType OLE objects from mammoth warnings
    let mathTypeCount = 0;
    if (result.messages && Array.isArray(result.messages)) {
      result.messages.forEach((msg: any) => {
        if (
          msg.type === 'warning' &&
          (msg.message.toLowerCase().includes('oleobject') ||
            msg.message.toLowerCase().includes('mathtype') ||
            msg.message.toLowerCase().includes('unhandled element'))
        ) {
          mathTypeCount++;
        }
      });
    }

    let warningMessage: string | undefined;
    if (mathTypeCount > 0) {
      warningMessage = `⚠ Phát hiện ${mathTypeCount} công thức MathType trong file Word. AI sẽ cố tái tạo từ ngữ cảnh xung quanh — hãy kiểm tra lại sau khi tạo đề.`;
    }

    return {
      html,
      text,
      mathTypeCount,
      wordCount,
      warningMessage,
    };
  } catch (error) {
    console.error('Error reading DOCX file:', error);
    throw new Error('Không thể đọc file DOCX. Vui lòng đảm bảo file không bị khóa hoặc hư hỏng.');
  }
}
