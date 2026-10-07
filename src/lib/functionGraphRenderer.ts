/**
 * @license
 * SimilarExam Studio - Math Function Graph Renderer (Đồ thị hàm số THPT GDPT 2018)
 *
 * Tự động tính toán điểm cực trị, tiệm cận và vẽ đồ thị hàm số:
 * 1. Hàm bậc 3: y = ax^3 + bx^2 + cx + d
 * 2. Hàm bậc 4 trùng phương: y = ax^4 + bx^2 + c
 * 3. Phân thức bậc nhất / bậc nhất: y = (ax + b) / (cx + d)
 * 4. Phân thức bậc hai / bậc nhất: y = (ax^2 + bx + c) / (dx + e)
 *
 * Xuất vector SVG sắc nét và PNG 300 DPI để nhúng trực tiếp vào Word MathType OLE.
 */

import { svgStringToPngBase64 } from './tableAndChartHelper';

export type FunctionType = 'bac3' | 'bac4' | 'phanthuc11' | 'phanthuc21';

export interface FunctionGraphParams {
  type: FunctionType;
  // Hệ số
  a: number;
  b: number;
  c: number;
  d?: number;
  e?: number;
  // Giới hạn hiển thị
  xmin?: number;
  xmax?: number;
  ymin?: number;
  ymax?: number;
  // Tùy chọn hiển thị
  showGrid?: boolean;
  showExtrema?: boolean;
  showAsymptotes?: boolean;
  showAxisLabels?: boolean;
  color?: string;
  title?: string;
}

export interface ExtremaPoint {
  x: number;
  y: number;
  type: 'max' | 'min' | 'inflection';
  label?: string;
}

/**
 * Tính toán giá trị y = f(x)
 */
export function evaluateFunction(x: number, p: FunctionGraphParams): number | null {
  const { type, a, b, c, d = 0, e = 0 } = p;

  switch (type) {
    case 'bac3':
      // y = ax^3 + bx^2 + cx + d
      return a * Math.pow(x, 3) + b * Math.pow(x, 2) + c * x + d;

    case 'bac4':
      // y = ax^4 + bx^2 + c
      return a * Math.pow(x, 4) + b * Math.pow(x, 2) + c;

    case 'phanthuc11': {
      // y = (ax + b) / (cx + d)
      const denom = c * x + d;
      if (Math.abs(denom) < 1e-5) return null;
      return (a * x + b) / denom;
    }

    case 'phanthuc21': {
      // y = (ax^2 + bx + c) / (dx + e)
      const denom = d * x + e;
      if (Math.abs(denom) < 1e-5) return null;
      return (a * Math.pow(x, 2) + b * x + c) / denom;
    }

    default:
      return null;
  }
}

/**
 * Tìm các điểm đặc biệt (cực trị, điểm uốn, tiệm cận)
 */
export function findSpecialFeatures(p: FunctionGraphParams): {
  extrema: ExtremaPoint[];
  asymptotes: { vertical?: number[]; horizontal?: number[]; slant?: { m: number; n: number } };
} {
  const extrema: ExtremaPoint[] = [];
  const asymptotes: { vertical?: number[]; horizontal?: number[]; slant?: { m: number; n: number } } = {};

  const { type, a, b, c, d = 0, e = 0 } = p;

  if (type === 'bac3') {
    // y' = 3ax^2 + 2bx + c = 0
    const A = 3 * a;
    const B = 2 * b;
    const C = c;
    const delta = B * B - 4 * A * C;

    if (delta > 0 && Math.abs(A) > 1e-6) {
      const x1 = (-B - Math.sqrt(delta)) / (2 * A);
      const x2 = (-B + Math.sqrt(delta)) / (2 * A);
      const y1 = evaluateFunction(x1, p)!;
      const y2 = evaluateFunction(x2, p)!;

      const type1 = a > 0 ? 'max' : 'min';
      const type2 = a > 0 ? 'min' : 'max';

      extrema.push({ x: x1, y: y1, type: type1, label: type1 === 'max' ? 'CĐ' : 'CT' });
      extrema.push({ x: x2, y: y2, type: type2, label: type2 === 'max' ? 'CĐ' : 'CT' });
    }

    // Điểm uốn: y'' = 6ax + 2b = 0 => x = -b / (3a)
    if (Math.abs(a) > 1e-6) {
      const xu = -b / (3 * a);
      const yu = evaluateFunction(xu, p)!;
      extrema.push({ x: xu, y: yu, type: 'inflection', label: 'U' });
    }
  } else if (type === 'bac4') {
    // y' = 4ax^3 + 2bx = 2x(2ax^2 + b) = 0
    // x = 0
    const y0 = c;
    extrema.push({ x: 0, y: y0, type: b * a < 0 ? (a > 0 ? 'max' : 'min') : (a > 0 ? 'min' : 'max'), label: 'x=0' });

    if (a !== 0 && -b / (2 * a) > 0) {
      const x1 = -Math.sqrt(-b / (2 * a));
      const x2 = Math.sqrt(-b / (2 * a));
      const y1 = evaluateFunction(x1, p)!;
      const y2 = evaluateFunction(x2, p)!;
      const extremType = a > 0 ? 'min' : 'max';
      extrema.push({ x: x1, y: y1, type: extremType, label: extremType === 'max' ? 'CĐ' : 'CT' });
      extrema.push({ x: x2, y: y2, type: extremType, label: extremType === 'max' ? 'CĐ' : 'CT' });
    }
  } else if (type === 'phanthuc11') {
    // Tiệm cận đứng: cx + d = 0 => x = -d / c
    if (c !== 0) {
      asymptotes.vertical = [-d / c];
      // Tiệm cận ngang: y = a / c
      asymptotes.horizontal = [a / c];
    }
  } else if (type === 'phanthuc21') {
    // Tiệm cận đứng: dx + e = 0 => x = -e / d
    if (d !== 0) {
      asymptotes.vertical = [-e / d];
      // Tiệm cận xiên: y = (a/d) x + (b - ae/d)/d
      const m = a / d;
      const n = (b - (a * e) / d) / d;
      asymptotes.slant = { m, n };
    }
  }

  return { extrema, asymptotes };
}

/**
 * Tạo vector SVG đồ thị hàm số
 */
export function renderFunctionGraphToSvg(params: FunctionGraphParams): string {
  const width = 480;
  const height = 400;
  const padding = 45;

  const xmin = params.xmin ?? -4.5;
  const xmax = params.xmax ?? 4.5;
  const ymin = params.ymin ?? -4.5;
  const ymax = params.ymax ?? 4.5;

  const plotW = width - 2 * padding;
  const plotH = height - 2 * padding;

  const scaleX = (x: number) => padding + ((x - xmin) / (xmax - xmin)) * plotW;
  const scaleY = (y: number) => height - padding - ((y - ymin) / (ymax - ymin)) * plotH;

  const originX = Math.max(padding + 10, Math.min(width - padding - 10, scaleX(0)));
  const originY = Math.max(padding + 10, Math.min(height - padding - 10, scaleY(0)));

  let svgContent = '';

  // Nền trắng
  svgContent += `<rect width="${width}" height="${height}" fill="#FFFFFF" rx="8" />`;

  // 1. Lưới tọa độ (Grid)
  if (params.showGrid !== false) {
    let gridXml = '';
    for (let x = Math.ceil(xmin); x <= Math.floor(xmax); x++) {
      const px = scaleX(x);
      gridXml += `<line x1="${px.toFixed(1)}" y1="${padding}" x2="${px.toFixed(1)}" y2="${height - padding}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="2,3" />`;
    }
    for (let y = Math.ceil(ymin); y <= Math.floor(ymax); y++) {
      const py = scaleY(y);
      gridXml += `<line x1="${padding}" y1="${py.toFixed(1)}" x2="${width - padding}" y2="${py.toFixed(1)}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="2,3" />`;
    }
    svgContent += `<g class="grid">${gridXml}</g>`;
  }

  // 2. Trục tọa độ Ox, Oy
  let axesXml = '';
  // Ox
  axesXml += `<line x1="${padding - 15}" y1="${originY.toFixed(1)}" x2="${width - padding + 18}" y2="${originY.toFixed(1)}" stroke="#0F172A" stroke-width="1.8" />`;
  axesXml += `<polygon points="${width - padding + 22},${originY.toFixed(1)} ${width - padding + 14},${originY - 4} ${width - padding + 14},${originY + 4}" fill="#0F172A" />`;
  axesXml += `<text x="${width - padding + 24}" y="${originY + 4}" font-family="Times New Roman, serif" font-size="14" font-style="italic" font-weight="bold" fill="#0F172A">x</text>`;

  // Oy
  axesXml += `<line x1="${originX.toFixed(1)}" y1="${height - padding + 15}" x2="${originX.toFixed(1)}" y2="${padding - 18}" stroke="#0F172A" stroke-width="1.8" />`;
  axesXml += `<polygon points="${originX.toFixed(1)},${padding - 22} ${originX - 4},${padding - 14} ${originX + 4},${padding - 14}" fill="#0F172A" />`;
  axesXml += `<text x="${originX + 6}" y="${padding - 16}" font-family="Times New Roman, serif" font-size="14" font-style="italic" font-weight="bold" fill="#0F172A">y</text>`;

  // Gốc O
  axesXml += `<text x="${originX - 12}" y="${originY + 16}" font-family="Times New Roman, serif" font-size="14" font-style="italic" fill="#0F172A">O</text>`;

  // Số trên trục
  if (params.showAxisLabels !== false) {
    for (let x = Math.ceil(xmin); x <= Math.floor(xmax); x++) {
      if (x === 0) continue;
      const px = scaleX(x);
      axesXml += `<line x1="${px.toFixed(1)}" y1="${originY - 3}" x2="${px.toFixed(1)}" y2="${originY + 3}" stroke="#0F172A" stroke-width="1.2" />`;
      axesXml += `<text x="${px.toFixed(1)}" y="${originY + 15}" font-family="Times New Roman, serif" font-size="11" fill="#475569" text-anchor="middle">${x}</text>`;
    }
    for (let y = Math.ceil(ymin); y <= Math.floor(ymax); y++) {
      if (y === 0) continue;
      const py = scaleY(y);
      axesXml += `<line x1="${originX - 3}" y1="${py.toFixed(1)}" x2="${originX + 3}" y2="${py.toFixed(1)}" stroke="#0F172A" stroke-width="1.2" />`;
      axesXml += `<text x="${originX - 6}" y="${py + 4}" font-family="Times New Roman, serif" font-size="11" fill="#475569" text-anchor="end">${y}</text>`;
    }
  }

  svgContent += `<g class="axes">${axesXml}</g>`;

  // 3. Tiệm cận
  const { extrema, asymptotes } = findSpecialFeatures(params);
  let asympXml = '';

  if (params.showAsymptotes !== false) {
    // Đứng
    if (asymptotes.vertical) {
      asymptotes.vertical.forEach((vx) => {
        if (vx >= xmin && vx <= xmax) {
          const px = scaleX(vx);
          asympXml += `<line x1="${px.toFixed(1)}" y1="${padding}" x2="${px.toFixed(1)}" y2="${height - padding}" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="5,4" />`;
          asympXml += `<text x="${px + 5}" y="${padding + 16}" font-family="Times New Roman, serif" font-size="11" fill="#DC2626" font-style="italic">x=${vx.toFixed(1).replace('.0', '')}</text>`;
        }
      });
    }
    // Ngang
    if (asymptotes.horizontal) {
      asymptotes.horizontal.forEach((hy) => {
        if (hy >= ymin && hy <= ymax) {
          const py = scaleY(hy);
          asympXml += `<line x1="${padding}" y1="${py.toFixed(1)}" x2="${width - padding}" y2="${py.toFixed(1)}" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="5,4" />`;
          asympXml += `<text x="${width - padding - 35}" y="${py - 5}" font-family="Times New Roman, serif" font-size="11" fill="#DC2626" font-style="italic">y=${hy.toFixed(1).replace('.0', '')}</text>`;
        }
      });
    }
    // Xiên
    if (asymptotes.slant) {
      const { m, n } = asymptotes.slant;
      const x1 = xmin;
      const y1 = m * x1 + n;
      const x2 = xmax;
      const y2 = m * x2 + n;
      asympXml += `<line x1="${scaleX(x1).toFixed(1)}" y1="${scaleY(y1).toFixed(1)}" x2="${scaleX(x2).toFixed(1)}" y2="${scaleY(y2).toFixed(1)}" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="5,4" />`;
    }
    svgContent += `<g class="asymptotes">${asympXml}</g>`;
  }

  // 4. Đường cong đồ thị (Sampling curve)
  const steps = 300;
  const dx = (xmax - xmin) / steps;
  const curveColor = params.color || '#2563EB';

  const paths: string[] = [];
  let currentPath: { x: number; y: number }[] = [];

  for (let i = 0; i <= steps; i++) {
    const x = xmin + i * dx;
    const y = evaluateFunction(x, params);

    // Xử lý gián đoạn hoặc vượt ngưỡng quá xa
    if (y === null || isNaN(y) || y < ymin - 10 || y > ymax + 10) {
      if (currentPath.length > 1) {
        paths.push(formatPath(currentPath, scaleX, scaleY));
      }
      currentPath = [];
    } else {
      currentPath.push({ x, y });
    }
  }

  if (currentPath.length > 1) {
    paths.push(formatPath(currentPath, scaleX, scaleY));
  }

  // Clip đồ thị trong vùng vẽ
  svgContent += `<defs><clipPath id="graph-clip"><rect x="${padding}" y="${padding}" width="${plotW}" height="${plotH}" /></clipPath></defs>`;
  svgContent += `<g class="curves" clip-path="url(#graph-clip)">`;
  paths.forEach((pStr) => {
    svgContent += `<path d="${pStr}" fill="none" stroke="${curveColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />`;
  });
  svgContent += `</g>`;

  // 5. Đánh dấu các điểm cực trị & đường gióng tọa độ
  if (params.showExtrema !== false && extrema.length > 0) {
    let extXml = '';
    extrema.forEach((pt) => {
      if (pt.x >= xmin && pt.x <= xmax && pt.y >= ymin && pt.y <= ymax) {
        const px = scaleX(pt.x);
        const py = scaleY(pt.y);

        // Đường gióng đứt nét tới Ox, Oy
        extXml += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${originY.toFixed(1)}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="3,3" />`;
        extXml += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${originX.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="3,3" />`;

        // Điểm tròn
        const dotColor = pt.type === 'max' ? '#DC2626' : pt.type === 'min' ? '#059669' : '#D97706';
        extXml += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="${dotColor}" stroke="#FFFFFF" stroke-width="1.5" />`;

        // Tọa độ
        const labelText = `(${pt.x.toFixed(1).replace('.0', '')}; ${pt.y.toFixed(1).replace('.0', '')})`;
        extXml += `<text x="${px + 6}" y="${py - 6}" font-family="Times New Roman, serif" font-size="11" font-weight="bold" fill="${dotColor}">${labelText}</text>`;
      }
    });
    svgContent += `<g class="extrema">${extXml}</g>`;
  }

  // 6. Tiêu đề
  if (params.title) {
    svgContent += `<text x="${width / 2}" y="25" font-family="Times New Roman, serif" font-size="14" font-weight="bold" fill="#0F172A" text-anchor="middle">${params.title}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${svgContent}</svg>`;
}

function formatPath(
  pts: { x: number; y: number }[],
  scaleX: (x: number) => number,
  scaleY: (y: number) => number
): string {
  if (pts.length === 0) return '';
  let d = `M ${scaleX(pts[0].x).toFixed(1)} ${scaleY(pts[0].y).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${scaleX(pts[i].x).toFixed(1)} ${scaleY(pts[i].y).toFixed(1)}`;
  }
  return d;
}

/**
 * Sinh mã LaTeX TikZ tương đương để giáo viên chèn trực tiếp vào tài liệu TeX
 */
export function generateTikzForFunction(params: FunctionGraphParams): string {
  const { type, a, b, c, d = 0, e = 0, xmin = -4, xmax = 4, ymin = -4, ymax = 4 } = params;

  let formula = '';
  switch (type) {
    case 'bac3':
      formula = `${a}*\\x^3 + (${b})*\\x^2 + (${c})*\\x + (${d})`;
      break;
    case 'bac4':
      formula = `${a}*\\x^4 + (${b})*\\x^2 + (${c})`;
      break;
    case 'phanthuc11':
      formula = `(${a}*\\x + (${b})) / (${c}*\\x + (${d}))`;
      break;
    case 'phanthuc21':
      formula = `(${a}*\\x^2 + (${b})*\\x + (${c})) / (${d}*\\x + (${e}))`;
      break;
  }

  return `\\begin{tikzpicture}[scale=0.8, >=stealth]
  \\draw[->] (${xmin - 0.5},0) -- (${xmax + 0.5},0) node[below] {$x$};
  \\draw[->] (0,${ymin - 0.5}) -- (0,${ymax + 0.5}) node[left] {$y$};
  \\node[below left] at (0,0) {$O$};
  \\clip (${xmin},${ymin}) rectangle (${xmax},${ymax});
  \\draw[thick, blue, samples=200, domain=${xmin}:${xmax}] plot (\\x, {${formula}});
\\end{tikzpicture}`;
}

/**
 * Xuất đồ thị hàm số sang ảnh PNG Base64 để nhúng vào Word
 */
export async function renderFunctionGraphToPng(params: FunctionGraphParams): Promise<string> {
  const svg = renderFunctionGraphToSvg(params);
  if (!svg) return '';
  return await svgStringToPngBase64(svg);
}
