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

  return `\\documentclass[border=5pt]{standalone}
\\usepackage{tikz}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\usetikzlibrary{shapes,arrows,calc,intersections,patterns,decorations.pathreplacing,angles,quotes,arrows.meta,positioning,through,backgrounds,fit,matrix,chains}
\\begin{document}
${normalized}
\\end{document}`;
}

export interface TikzRenderResult {
  svg: string;
  error?: string;
}

/**
 * Compiles TikZ code into vector SVG via Kroki TeX engine with detailed error tracking
 */
export async function renderTikzWithDetails(tikzCode: string): Promise<TikzRenderResult> {
  if (!tikzCode || !tikzCode.trim()) return { svg: '', error: 'Mã TikZ trống' };

  const normalized = normalizeTikzCode(tikzCode);
  if (svgCache.has(normalized)) {
    return { svg: svgCache.get(normalized)! };
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
          return { svg: responseText };
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
    error: lastError || 'Không thể kết xuất mã TikZ. Vui lòng kiểm tra lại cú pháp LaTeX.',
  };
}

/**
 * Compiles TikZ code into vector SVG via Kroki TeX engine
 */
export async function renderTikzToSvg(tikzCode: string): Promise<string> {
  const result = await renderTikzWithDetails(tikzCode);
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
