import { svgStringToPngBase64 } from './tableAndChartHelper';

const svgCache = new Map<string, string>();
const pngCache = new Map<string, string>();

/**
 * Normalizes TikZ code by stripping wrapping environments if duplicated
 */
export function normalizeTikzCode(code: string): string {
  let clean = code.trim();

  // Remove markdown code blocks ```latex ... ```
  clean = clean.replace(/^```(?:latex|tikz)?\s*/i, '').replace(/```\s*$/, '').trim();

  // Ensure it has \begin{tikzpicture} and \end{tikzpicture}
  if (!clean.includes('\\begin{tikzpicture}')) {
    clean = `\\begin{tikzpicture}\n${clean}\n\\end{tikzpicture}`;
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

/**
 * Compiles TikZ code into vector SVG via Kroki TeX engine
 */
export async function renderTikzToSvg(tikzCode: string): Promise<string> {
  if (!tikzCode || !tikzCode.trim()) return '';

  const normalized = normalizeTikzCode(tikzCode);
  if (svgCache.has(normalized)) {
    return svgCache.get(normalized)!;
  }

  const fullLatex = buildStandaloneLatex(normalized);

  const isBrowser = typeof window !== 'undefined';
  const endpoints = isBrowser
    ? ['/kroki-api/tikz/svg', 'https://kroki.io/tikz/svg']
    : ['https://kroki.io/tikz/svg'];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

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

      if (resp.ok) {
        const svg = await resp.text();
        if (svg.includes('<svg')) {
          svgCache.set(normalized, svg);
          return svg;
        }
      }
    } catch (err) {
      console.warn(`[TikZ Renderer] Failed via ${url}:`, err);
    }
  }

  return '';
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
