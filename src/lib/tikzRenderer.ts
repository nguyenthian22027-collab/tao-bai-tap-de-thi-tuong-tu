import { svgStringToPngBase64 } from './tableAndChartHelper';

const svgCache = new Map<string, string>();
const pngCache = new Map<string, string>();

/**
 * Normalizes TikZ code by stripping markdown fences, document wrappers,
 * and auto-healing undeclared origin coordinate (O).
 */
export function normalizeTikzCode(code: string): string {
  let clean = code.trim();

  // Strip markdown code blocks ```latex ... ``` or ```tikz ... ```
  clean = clean.replace(/^```(?:latex|tikz)?\s*/i, '').replace(/```\s*$/, '').trim();

  // Strip standalone/document wrapper if user or AI included it
  clean = clean.replace(/\\documentclass(\[[^\]]*\])?\{[^}]+\}/gi, '');
  clean = clean.replace(/\\usepackage(\[[^\]]*\])?\{[^}]+\}/gi, '');
  clean = clean.replace(/\\usetikzlibrary(\[[^\]]*\])?\{[^}]+\}/gi, '');
  clean = clean.replace(/\\begin\{document\}/gi, '');
  clean = clean.replace(/\\end\{document\}/gi, '');
  clean = clean.trim();

  // Ensure it has \begin{tikzpicture} and \end{tikzpicture}
  if (!clean.includes('\\begin{tikzpicture}')) {
    clean = `\\begin{tikzpicture}\n${clean}\n\\end{tikzpicture}`;
  }

  // Auto-heal undeclared origin coordinate (O) or (o):
  // When code references (O) or (o) (e.g. `(O) arc`, `(O) circle`, `-- (O)`, `at (O)`)
  // but forgot to define `\coordinate (O)`
  const referencesO = /\([Oo]\)/.test(clean);
  const definesO = /\\coordinate\s*\([Oo]\)/.test(clean) || /\\node.*?\([Oo]\)/.test(clean);
  if (referencesO && !definesO) {
    clean = clean.replace(/(\\begin\{tikzpicture\}(?:\[[^\]]*\])?)/, '$1\n  \\coordinate (O) at (0,0);');
  }

  return clean;
}

/**
 * Builds a standalone LaTeX document ready for compilation
 */
export function buildStandaloneLatex(tikzCode: string): string {
  const normalized = normalizeTikzCode(tikzCode);

  return `\\documentclass[border=6pt]{standalone}
\\usepackage{amsmath,amssymb}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\usepackage{tkz-tab}
\\usepackage{tkz-euclide}
\\usetikzlibrary{shapes,arrows,calc,intersections,patterns,decorations.pathreplacing,angles,quotes,arrows.meta,positioning,through,backgrounds,fit,matrix,chains,3d}
\\begin{document}
${normalized}
\\end{document}`;
}


export interface TikzRenderResult {
  svg: string;
  png?: string;
  error?: string;
  engineUsed?: 'kroki' | 'texlive';
}

export type TikzEngine = 'auto' | 'kroki' | 'texlive';

/**
 * Trích xuất đoạn thông báo lỗi cụ thể từ log của trình biên dịch LaTeX
 */
export function extractLatexError(log: string): string {
  if (!log) return '';
  const lines = log.split('\n');
  const errorLines: string[] = [];
  let capturing = false;
  for (const line of lines) {
    if (line.startsWith('!') || line.includes('Error') || line.includes('error')) {
      capturing = true;
    }
    if (capturing) {
      errorLines.push(line);
      if (errorLines.length > 8) break;
    }
  }
  if (errorLines.length > 0) {
    return errorLines.join('\n');
  }
  return log.slice(0, 280).trim();
}

/**
 * Converts a PDF Blob into a high-res PNG base64 data URL via PDF.js and HTML5 Canvas
 */
export async function convertPdfBlobToPng(pdfBlob: Blob, scale = 2.5): Promise<string> {
  if (typeof window === 'undefined') return '';

  try {
    const pdfjsLib = await import('pdfjs-dist');

    // Cấu hình an toàn cho Web Worker tránh lỗi Same-Origin Policy trên trình duyệt
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const blob = new Blob([`importScripts("${workerUrl}");`], { type: 'application/javascript' });
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      } catch {
        // Dự phòng chế độ Fake Worker chạy trực tiếp trong main thread
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      }
    }

    const arrayBuffer = await pdfBlob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      stopAtErrors: false,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) return '';

    // Nền trắng tinh khiết
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[PDF.js] Failed to convert PDF to PNG:', err);
    return '';
  }
}

/**
 * Wraps a PNG base64 string inside an SVG image tag for unified rendering
 */
export function wrapPngInSvg(pngBase64: string, width = 600, height = 450): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="max-height: 400px; object-fit: contain;">
  <image href="${pngBase64}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />
</svg>`;
}

/**
 * Compiles TikZ code via TeXLive.net (or local app-tikz-hinh-ve backend if running) and converts output to PNG/SVG
 */
export async function renderTikzTeXLive(tikzCode: string): Promise<TikzRenderResult> {
  if (!tikzCode || !tikzCode.trim()) return { svg: '', error: 'Mã TikZ trống' };

  const normalized = normalizeTikzCode(tikzCode);
  const cacheKey = `texlive_${normalized}`;
  if (svgCache.has(cacheKey)) {
    return {
      svg: svgCache.get(cacheKey)!,
      png: pngCache.get(normalized),
      engineUsed: 'texlive',
    };
  }

  const isBrowser = typeof window !== 'undefined';
  let lastError = '';

  // 1. Kiểm tra backend cục bộ nếu người dùng chạy localhost (tránh lỗi Mixed Content trên HTTPS Vercel)
  if (isBrowser && (window.location.protocol === 'http:' || window.location.hostname === 'localhost')) {
    try {
      const localCtrl = new AbortController();
      const localTimeout = setTimeout(() => localCtrl.abort(), 1500);
      const localResp = await fetch('http://localhost:8000/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tikz: normalized, dpi: 300 }),
        signal: localCtrl.signal,
      });
      clearTimeout(localTimeout);

      if (localResp.ok && localResp.headers.get('content-type')?.includes('image/png')) {
        const blob = await localResp.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        if (base64) {
          const svg = wrapPngInSvg(base64);
          svgCache.set(cacheKey, svg);
          pngCache.set(normalized, base64);
          return { svg, png: base64, engineUsed: 'texlive' };
        }
      }
    } catch {
      // Backend cục bộ không bật, chuyển sang gọi TeXLive Cloud
    }
  }

  // 2. Biên dịch qua máy chủ Serverless Proxy /api/texlive (trên Vercel & Vite)
  const fullLatex = buildStandaloneLatex(normalized);

  // A. Thử gọi qua endpoint Serverless Proxy /api/texlive (không bao giờ bị lỗi CORS trên trình duyệt)
  if (isBrowser) {
    try {
      const proxyCtrl = new AbortController();
      const proxyTimeout = setTimeout(() => proxyCtrl.abort(), 35000);
      const proxyResp = await fetch('/api/texlive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: fullLatex }),
        signal: proxyCtrl.signal,
      });
      clearTimeout(proxyTimeout);

      const contentType = proxyResp.headers.get('content-type') || '';
      if (proxyResp.ok && contentType.includes('pdf')) {
        const pdfBlob = await proxyResp.blob();
        const png = await convertPdfBlobToPng(pdfBlob);
        if (png) {
          const svg = wrapPngInSvg(png);
          svgCache.set(cacheKey, svg);
          pngCache.set(normalized, png);
          return { svg, png, engineUsed: 'texlive' };
        }
      } else if (proxyResp.status === 422) {
        const logText = await proxyResp.text();
        lastError = extractLatexError(logText) || 'Lỗi biên dịch LaTeX trên TeXLive.net';
        console.warn('[TeXLive Proxy] LaTeX compile error:', lastError);
      }
    } catch (err: any) {
      console.warn('[TeXLive Proxy] /api/texlive error, falling back:', err);
    }
  }

  // B. Fallback nếu proxy không khả dụng: Gọi trực tiếp qua FormData
  const formData = new FormData();
  const blob = new Blob([fullLatex], { type: 'text/plain; charset=utf-8' });
  formData.append('filecontents[]', blob, 'document.tex');
  formData.append('filename[]', 'document.tex');
  formData.append('engine', 'pdflatex');
  formData.append('return', 'pdf');

  const fallbackUrls = ['https://texlive.net/cgi-bin/latexcgi'];

  for (const url of fallbackUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 28000);

      const resp = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && contentType.includes('pdf')) {
        const pdfBlob = await resp.blob();
        const png = await convertPdfBlobToPng(pdfBlob);
        if (png) {
          const svg = wrapPngInSvg(png);
          svgCache.set(cacheKey, svg);
          pngCache.set(normalized, png);
          return { svg, png, engineUsed: 'texlive' };
        }
      } else {
        const logText = await resp.text();
        lastError = extractLatexError(logText) || 'Lỗi biên dịch TeXLive.net';
        console.warn(`[TeXLive.net] Error via ${url}:`, lastError);
      }
    } catch (err: any) {
      lastError = err.message || 'Lỗi kết nối TeXLive.net';
      console.warn(`[TeXLive.net] Failed via ${url}:`, err);
    }
  }


  return {
    svg: '',
    error: lastError || 'Máy chủ TeXLive.net không phản hồi',
    engineUsed: 'texlive',
  };
}


/**
 * Compiles TikZ code into vector SVG via Kroki TeX engine
 */
export async function renderTikzKroki(tikzCode: string): Promise<TikzRenderResult> {
  if (!tikzCode || !tikzCode.trim()) return { svg: '', error: 'Mã TikZ trống' };

  const normalized = normalizeTikzCode(tikzCode);
  if (svgCache.has(normalized)) {
    return { svg: svgCache.get(normalized)!, engineUsed: 'kroki' };
  }

  const fullLatex = buildStandaloneLatex(normalized);

  const isBrowser = typeof window !== 'undefined';
  const endpoints = isBrowser
    ? ['/kroki-api/tikz/svg', 'https://kroki.io/tikz/svg']
    : ['https://kroki.io/tikz/svg'];

  let lastError = '';

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 14000);

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          Accept: 'image/svg+xml',
        },
        body: fullLatex,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await resp.text();

      if (resp.ok) {
        if (responseText.includes('<svg')) {
          svgCache.set(normalized, responseText);
          return { svg: responseText, engineUsed: 'kroki' };
        }
      } else {
        // Extract LaTeX compiler error from Kroki's response
        let errSnippet = '';
        const tspanMatches = [...responseText.matchAll(/<tspan[^>]*>(.*?)<\/tspan>/gi)];
        if (tspanMatches.length > 0) {
          errSnippet = tspanMatches
            .map((m) =>
              m[1]
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&apos;/g, "'")
            )
            .filter((t) => t.trim().length > 0 && !t.includes('latex: Not reading'))
            .slice(0, 3)
            .join(' | ');
        } else {
          errSnippet = responseText.slice(0, 200).replace(/<[^>]+>/g, '').trim();
        }

        if (errSnippet) {
          lastError = errSnippet;
          console.warn(`[TikZ Renderer] Kroki compile error via ${url}:`, errSnippet);
        }
      }
    } catch (err: any) {
      lastError = err.message || 'Lỗi kết nối mạng';
      console.warn(`[TikZ Renderer] Failed via ${url}:`, err);
    }
  }

  return {
    svg: '',
    error: lastError || 'Không thể kết xuất mã TikZ qua Kroki.',
    engineUsed: 'kroki',
  };
}

/**
 * Universal TikZ compilation supporting Dual-Engine (Kroki + TeXLive.net fallback)
 */
export async function renderTikzWithDetails(
  tikzCode: string,
  engine: TikzEngine = 'auto'
): Promise<TikzRenderResult> {
  if (engine === 'texlive') {
    return renderTikzTeXLive(tikzCode);
  }

  if (engine === 'kroki') {
    return renderTikzKroki(tikzCode);
  }

  // Engine 'auto': Try Kroki first (super fast vector SVG); fallback to TeXLive.net if needed
  const krokiResult = await renderTikzKroki(tikzCode);
  if (krokiResult.svg) {
    return krokiResult;
  }

  console.info('[TikZ Renderer] Kroki did not return SVG, trying TeXLive.net cloud engine...');
  const texliveResult = await renderTikzTeXLive(tikzCode);
  if (texliveResult.svg) {
    return texliveResult;
  }

  return {
    svg: '',
    error: krokiResult.error || texliveResult.error || 'Biên dịch thất bại trên cả Kroki và TeXLive.net.',
  };
}

/**
 * Compiles TikZ code into vector SVG
 */
export async function renderTikzToSvg(
  tikzCode: string,
  engine: TikzEngine = 'auto'
): Promise<string> {
  const result = await renderTikzWithDetails(tikzCode, engine);
  return result.svg;
}

/**
 * Compiles TikZ code into a high-res PNG base64 data URL for Word docx embedding
 */
export async function renderTikzToPng(tikzCode: string): Promise<string> {
  if (!tikzCode || !tikzCode.trim()) return '';

  const normalized = normalizeTikzCode(tikzCode);
  if (pngCache.has(normalized)) {
    return pngCache.get(normalized)!;
  }

  const svg = await renderTikzToSvg(normalized);
  if (!svg) return '';

  const pngBase64 = await svgStringToPngBase64(svg);
  if (pngBase64) {
    pngCache.set(normalized, pngBase64);
    return pngBase64;
  }

  return '';
}
