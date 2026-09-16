/**
 * Utility functions for parsing LaTeX tabular environments, statistical data,
 * and generating SVGs for charts and diagrams in SimilarExam Studio.
 */

export interface ParsedTableData {
  headers: string[];
  rows: string[][];
}

/**
 * Kiểm tra xem một bảng dữ liệu có phải là Bảng Biến Thiên (Toán THCS/THPT) hay không
 */
export function isVariationTable(table?: ParsedTableData | null): boolean {
  if (!table || !table.headers) return false;
  const allRows = [table.headers, ...(table.rows || [])];
  const allText = allRows.flat().join(' ');

  // 1. Chứa mũi tên biến thiên (\nearrow, \searrow, ↗, ↘, \uparrow, \downarrow)
  const hasArrows = /\\nearrow|\\searrow|↗|↘|\\uparrow|\\downarrow/i.test(allText);

  // 2. Chứa vô cực (-\infty, +\infty, -∞, +∞)
  const hasInfinity = /\\infty|[-+]\\infty|[-+]∞/i.test(allText);

  // 3. Cột đầu tiên chứa x, y', y hoặc f'(x), f(x)
  const firstColText = allRows.map((r) => (r[0] || '').trim()).join(' ');
  const hasX = /(?:^|\b|\$)x(?:\$|\b|$)/i.test(firstColText);
  const hasYPrime = /(?:^|\b|\$)(?:y'|f'|f\(x\)'|f'\s*\(\s*x\s*\))(?:\$|\b|$)/i.test(firstColText);
  const hasY = /(?:^|\b|\$)(?:y|f|f\s*\(\s*x\s*\))(?:\$|\b|$)/i.test(firstColText);

  if ((hasX && (hasYPrime || hasY)) || (hasArrows && (hasInfinity || hasX || hasYPrime))) {
    return true;
  }

  // 4. Có hàng dấu đạo hàm (+, -, 0)
  const hasSignsRow = allRows.some((r) => {
    const signs = r.filter((c) => /^[+-0]$|^\\pm$/.test(c.trim().replace(/\$/g, '')));
    return signs.length >= 3;
  });

  if (hasX && hasSignsRow) {
    return true;
  }

  return false;
}

export interface FormattedVariationTable {
  xRow: string[];
  yPrimeRow: string[];
  yRows: string[][];
  maxCols: number;
}

/**
 * Chuẩn hóa và phân tách các dòng trong Bảng Biến Thiên:
 * Dòng x, dòng y', và các dòng nhánh của y (chứa số và mũi tên ↗ ↘)
 */
export function structureVariationTable(table: ParsedTableData): FormattedVariationTable {
  const allRows = [table.headers, ...(table.rows || [])];
  const maxCols = Math.max(...allRows.map((r) => r.length), 1);

  // Cân bằng số cột cho tất cả các hàng
  const paddedRows = allRows.map((r) => {
    const copy = [...r];
    while (copy.length < maxCols) copy.push('');
    return copy;
  });

  let xRowIdx = -1;
  let yPrimeRowIdx = -1;

  for (let i = 0; i < paddedRows.length; i++) {
    const firstCell = (paddedRows[i][0] || '').trim().toLowerCase().replace(/\$/g, '');
    if (xRowIdx === -1 && (firstCell === 'x' || /^(?:\\text\{)?x(?:\})?$/.test(firstCell))) {
      xRowIdx = i;
    } else if (yPrimeRowIdx === -1 && (firstCell.includes("y'") || firstCell.includes("f'"))) {
      yPrimeRowIdx = i;
    }
  }

  if (xRowIdx === -1) xRowIdx = 0;
  if (yPrimeRowIdx === -1 && paddedRows.length > 1) yPrimeRowIdx = 1;

  const xRow = paddedRows[xRowIdx] || [];
  const yPrimeRow = yPrimeRowIdx >= 0 && yPrimeRowIdx !== xRowIdx ? paddedRows[yPrimeRowIdx] : [];

  const yRows: string[][] = [];
  const handledIndices = new Set([xRowIdx, yPrimeRowIdx].filter((idx) => idx >= 0));
  for (let i = 0; i < paddedRows.length; i++) {
    if (!handledIndices.has(i)) {
      yRows.push(paddedRows[i]);
    }
  }

  if (yRows.length === 0 && paddedRows.length > 2) {
    yRows.push(...paddedRows.slice(2));
  }

  return { xRow, yPrimeRow, yRows, maxCols };
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
