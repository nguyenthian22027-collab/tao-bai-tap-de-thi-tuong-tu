/**
 * pdfHelper.ts — Trích xuất văn bản từ file PDF tải lên bằng pdfjs-dist
 */

export async function extractTextFromPdf(file: Blob): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');

    // Cấu hình an toàn cho Web Worker tránh lỗi Same-Origin Policy trên trình duyệt
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const blob = new Blob([`importScripts("${workerUrl}");`], { type: 'application/javascript' });
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      } catch {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      stopAtErrors: false,
      isEvalSupported: false,
    });

    const doc = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((it: any) => it.str)
        .join(' ')
        .replace(/\s+/g, ' ');

      // Loại bỏ các trang giấy làm bài / giấy nháp tự luận của học sinh chỉ có chấm chấm (như trang 5, 6, 7)
      const cleanProbe = pageText.replace(/[.\s…_]/g, '');
      if (cleanProbe.length < 50 && (pageText.includes('……') || pageText.includes('....'))) {
        continue;
      }

      fullText += (fullText ? '\n\n' : '') + pageText;
    }

    return fullText.trim();
  } catch (err) {
    console.warn('[PDF Reader] Lỗi trích xuất văn bản từ PDF:', err);
    return '';
  }
}
