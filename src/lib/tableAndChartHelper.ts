/**
 * Utility functions for parsing LaTeX tabular environments, statistical data,
 * and generating SVGs for charts and diagrams in SimilarExam Studio.
 */

export interface ParsedTableData {
  headers: string[];
  rows: string[][];
}

/**
 * Parses LaTeX \begin{tabular} ... \end{tabular} out of a text string.
 * Returns the cleaned text (without tabular) and the structured table data.
 */
export function extractAndParseTabular(text: string): {
  cleanText: string;
  table?: ParsedTableData;
  tables?: ParsedTableData[];
} {
  if (!text) return { cleanText: '' };

  // Regex khớp cả \begin{tabular} và \begin{tabular*}
  const tabularRegex = /\\begin\{tabular\*?\}\s*(?:\{[^}]*\}\s*)?\{[^}]*\}\s*([\s\S]*?)\\end\{tabular\*?\}/gi;
  const allMatches = [...text.matchAll(tabularRegex)];

  if (allMatches.length === 0) {
    // Fallback: try simpler pattern without optional second arg (for {|c|c|} only)
    const simpleRegex = /\\begin\{tabular\}\s*\{[^}]*\}\s*([\s\S]*?)\\end\{tabular\}/gi;
    const simpleMatches = [...text.matchAll(simpleRegex)];
    if (simpleMatches.length === 0) return { cleanText: text };

    const tables: ParsedTableData[] = [];
    let cleanText = text
      .replace(/\\begin\{center\}/gi, '')
      .replace(/\\end\{center\}/gi, '');

    for (const match of simpleMatches) {
      const table = parseTabularBody(match[1]);
      if (table) {
        tables.push(table);
        cleanText = cleanText.replace(match[0], '').trim();
      }
    }

    return tables.length > 0
      ? { cleanText: cleanText.trim(), table: tables[0], tables }
      : { cleanText: text };
  }

  const tables: ParsedTableData[] = [];
  let cleanText = text
    .replace(/\\begin\{center\}/gi, '')
    .replace(/\\end\{center\}/gi, '');

  for (const match of allMatches) {
    const table = parseTabularBody(match[1]);
    if (table) {
      tables.push(table);
      cleanText = cleanText.replace(match[0], '').trim();
    }
  }

  return tables.length > 0
    ? { cleanText: cleanText.trim(), table: tables[0], tables }
    : { cleanText: text };
}

/**
 * Helper: Parses the body of a tabular environment into ParsedTableData
 */
function parseTabularBody(tabularBody: string): ParsedTableData | null {
  // Strip horizontal line commands before splitting rows
  const cleanBody = tabularBody
    .replace(/\\hline/g, '')
    .replace(/\\toprule/g, '')
    .replace(/\\midrule/g, '')
    .replace(/\\bottomrule/g, '')
    .replace(/\\cline\{[^}]*\}/g, '');

  // Split rows by '\\' or '\cr'
  const rawRows = cleanBody
    .split(/\\\\|\\cr/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  const rows: string[][] = [];

  for (const rawRow of rawRows) {
    const cells = rawRow.split('&').map((c) => c.trim());
    if (cells.length > 0 && cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return null;

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return { headers, rows: dataRows };
}


/**
 * Extracts statistical group percentages or frequencies (e.g. from Câu 12)
 * like "Nhóm 1 (từ 0 đến dưới 5 giờ): 15%" or "[0; 5): 15%"
 * and generates a clean, scalable SVG bar chart.
 */
export function extractAndGenerateStatisticalChart(text: string): {
  cleanText: string;
  chartSvg?: string;
  chartBase64?: string;
} {
  if (!text) return { cleanText: '' };

  // Look for bullet points with Nhóm X (...): Y% or Y
  const groupRegex = /(?:•|-|\*|\+)?\s*(?:Nhóm\s*\d+\s*)?\((?:từ\s*)?(\d+)\s*(?:đến|;|-)\s*(?:dưới\s*)?(\d+)[^)]*\):\s*([\d.,]+)\s*%/gi;
  const matches = [...text.matchAll(groupRegex)];

  if (matches.length < 2) {
    return { cleanText: text };
  }

  const categories = matches.map((m) => {
    const from = m[1];
    const to = m[2];
    const val = parseFloat(m[3].replace(',', '.'));
    return {
      label: `[${from}; ${to})`,
      value: isNaN(val) ? 0 : val,
      displayValue: `${m[3]}%`,
    };
  });

  const chartSvg = generateBarChartSvg(
    'Biểu đồ tần số tương đối ghép nhóm (%)',
    categories
  );

  // Clean out the bullet list and center tags from the text
  const cleanText = text
    .replace(/\\begin\{center\}[\s\S]*?\\end\{center\}/gi, (match) => {
      if (match.includes('%')) return '';
      return match;
    })
    .replace(groupRegex, '')
    .trim();

  return {
    cleanText,
    chartSvg,
  };
}

/**
 * Generates an SVG Bar Chart for statistical frequency tables.
 */
export function generateBarChartSvg(
  title: string,
  categories: { label: string; value: number; displayValue: string }[]
): string {
  const width = 540;
  const height = 280;
  const margin = { top: 40, right: 30, bottom: 50, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const maxVal = Math.max(...categories.map((c) => c.value), 10);
  const yMax = Math.ceil(maxVal / 10) * 10;

  const barCount = categories.length;
  const barGap = 24;
  const barWidth = Math.max(36, Math.min(70, (plotWidth - barGap * (barCount + 1)) / barCount));
  const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;
  const startX = margin.left + (plotWidth - totalBarsWidth) / 2;

  // Grid lines
  let gridLines = '';
  const stepCount = 5;
  for (let i = 0; i <= stepCount; i++) {
    const yVal = (yMax / stepCount) * i;
    const yPos = margin.top + plotHeight - (yVal / yMax) * plotHeight;
    gridLines += `
      <line x1="${margin.left}" y1="${yPos}" x2="${width - margin.right}" y2="${yPos}" stroke="#E2E8F0" stroke-dasharray="3,3" />
      <text x="${margin.left - 8}" y="${yPos + 4}" text-anchor="end" font-size="11" fill="#64748B" font-family="sans-serif">${yVal}%</text>
    `;
  }

  // Bars & labels
  let barsSvg = '';
  categories.forEach((cat, idx) => {
    const x = startX + idx * (barWidth + barGap);
    const barH = (cat.value / yMax) * plotHeight;
    const y = margin.top + plotHeight - barH;

    barsSvg += `
      <!-- Bar ${idx + 1} -->
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="url(#barGradient)" filter="url(#dropShadow)" />
      <!-- Value Label -->
      <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="12" font-weight="bold" fill="#1E3A8A" font-family="sans-serif">${cat.displayValue}</text>
      <!-- Category Label -->
      <text x="${x + barWidth / 2}" y="${margin.top + plotHeight + 20}" text-anchor="middle" font-size="12" font-weight="600" fill="#334155" font-family="sans-serif">${cat.label}</text>
    `;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: #ffffff; border-radius: 8px;">
    <defs>
      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3B82F6" />
        <stop offset="100%" stop-color="#1D4ED8" />
      </linearGradient>
      <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.15" />
      </filter>
    </defs>
    <!-- Chart Title -->
    <text x="${width / 2}" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="#0F172A" font-family="sans-serif">${title}</text>
    <!-- Y-Axis line -->
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#94A3B8" stroke-width="1.5" />
    <!-- X-Axis line -->
    <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#94A3B8" stroke-width="1.5" />
    <!-- Grid -->
    ${gridLines}
    <!-- Bars & Labels -->
    ${barsSvg}
  </svg>`;
}

/**
 * Converts an SVG string into a data:image/png;base64 string using client-side Canvas.
 */
export async function svgStringToPngBase64(svgString: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';
  return new Promise((resolve) => {
    try {
      // Detect viewBox dimensions
      const vbMatch = svgString.match(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
      let targetW = 600;
      let targetH = 350;

      if (vbMatch) {
        const vbW = parseFloat(vbMatch[3]);
        const vbH = parseFloat(vbMatch[4]);
        if (vbW > 0 && vbH > 0) {
          targetW = Math.round(vbW * 1.5);
          targetH = Math.round(vbH * 1.5);
        }
      }

      let cleanSvg = svgString;
      if (!cleanSvg.includes('xmlns=')) {
        cleanSvg = cleanSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const svgBlob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' });
      const urlObj = window.URL || (window as any).webkitURL;
      const blobURL = urlObj.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const finalW = img.naturalWidth || img.width || targetW;
          const finalH = img.naturalHeight || img.height || targetH;
          canvas.width = finalW;
          canvas.height = finalH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, finalW, finalH);
            ctx.drawImage(img, 0, 0, finalW, finalH);
            const pngUrl = canvas.toDataURL('image/png');
            urlObj.revokeObjectURL(blobURL);
            resolve(pngUrl);
            return;
          }
        } catch (canvasErr) {
          console.warn('Canvas render error:', canvasErr);
        }
        urlObj.revokeObjectURL(blobURL);
        resolve('');
      };

      img.onerror = () => {
        urlObj.revokeObjectURL(blobURL);
        resolve('');
      };

      img.src = blobURL;
    } catch {
      resolve('');
    }
  });
}
