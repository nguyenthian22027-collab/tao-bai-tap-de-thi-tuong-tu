/**
 * @license
 * SimilarExam Studio - Linear Inequality System Renderer (Toán 10 GDPT 2018)
 *
 * Tự động phân tích hệ bất phương trình bậc nhất hai ẩn (x, y),
 * tìm giao điểm các đường biên, cắt khung nhìn, gạch sọc (hatching) chuẩn SGK,
 * và xuất vector SVG / PNG độ phân giải cao cho file Word.
 */

import { svgStringToPngBase64 } from './tableAndChartHelper';

export interface LinearInequality {
  raw: string;
  a: number; // Hệ số x
  b: number; // Hệ số y
  c: number; // Hằng số: ax + by + c <= 0 hoặc >= 0
  operator: '<=' | '>=' | '<' | '>';
  color?: string;
  label?: string;
}

export interface InequalityPlotOptions {
  width?: number;
  height?: number;
  xmin?: number;
  xmax?: number;
  ymin?: number;
  ymax?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  showIntersections?: boolean;
  reverseShading?: boolean; // false: gạch bỏ phần không thỏa (chuẩn SGK); true: gạch miền nghiệm
  title?: string;
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Phân tích chuỗi bất phương trình dạng:
 * 2x + y <= 4, x - 2y \ge -2, x >= 0, y \le 3, x + y > 1...
 */
export function parseLinearInequality(input: string): LinearInequality | null {
  if (!input || typeof input !== 'string') return null;

  // Làm sạch chuỗi
  let clean = input
    .trim()
    .replace(/\\left|\\right/g, '')
    .replace(/\\le(?![a-zA-Z])/g, '<=')
    .replace(/\\leq/g, '<=')
    .replace(/\\ge(?![a-zA-Z])/g, '>=')
    .replace(/\\geq/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/−/g, '-')
    .replace(/\s+/g, '');

  // Tách toán tử
  const opMatch = clean.match(/(<=|>=|<|>)/);
  if (!opMatch) return null;

  const operator = opMatch[1] as '<=' | '>=' | '<' | '>';
  const [leftSide, rightSide] = clean.split(operator);
  if (!leftSide || !rightSide) return null;

  // Thuật toán parse vế bậc nhất theo x, y
  // ax + by + c (vế trái - vế phải)
  const parseSide = (sideStr: string): { a: number; b: number; c: number } => {
    let a = 0;
    let b = 0;
    let c = 0;

    // Chuẩn hóa dấu đứng trước
    let s = sideStr;
    if (!s.startsWith('+') && !s.startsWith('-')) {
      s = '+' + s;
    }

    // Tách thành các hạng tử +term hoặc -term
    const termRegex = /([+-][^+-]+)/g;
    const terms = s.match(termRegex) || [];

    for (const term of terms) {
      if (term.includes('x')) {
        const coefStr = term.replace('x', '').trim();
        if (coefStr === '+' || coefStr === '') a += 1;
        else if (coefStr === '-') a -= 1;
        else a += parseFloat(coefStr) || 0;
      } else if (term.includes('y')) {
        const coefStr = term.replace('y', '').trim();
        if (coefStr === '+' || coefStr === '') b += 1;
        else if (coefStr === '-') b -= 1;
        else b += parseFloat(coefStr) || 0;
      } else {
        c += parseFloat(term) || 0;
      }
    }

    return { a, b, c };
  };

  const left = parseSide(leftSide);
  const right = parseSide(rightSide);

  const a = left.a - right.a;
  const b = left.b - right.b;
  const c = left.c - right.c;

  if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) {
    return null; // Không phải BPT 2 ẩn
  }

  return {
    raw: input.trim(),
    a,
    b,
    c,
    operator,
  };
}

/**
 * Tìm giao điểm của 2 đường thẳng a1*x + b1*y + c1 = 0 và a2*x + b2*y + c2 = 0
 */
export function lineIntersection(
  l1: { a: number; b: number; c: number },
  l2: { a: number; b: number; c: number }
): Point2D | null {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < 1e-9) return null; // Song song hoặc trùng nhau

  const x = (l1.b * l2.c - l2.b * l1.c) / det;
  const y = (l2.a * l1.c - l1.a * l2.c) / det;
  return { x, y };
}

/**
 * Cắt đường thẳng a*x + b*y + c = 0 bởi hình chữ nhật [xmin, xmax] x [ymin, ymax]
 * Trả về đoạn thẳng [P1, P2] nằm trong khung nhìn
 */
export function clipLineToRect(
  line: { a: number; b: number; c: number },
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number
): [Point2D, Point2D] | null {
  const { a, b, c } = line;
  const pts: Point2D[] = [];

  // Giao với x = xmin
  if (Math.abs(b) > 1e-9) {
    const y = (-c - a * xmin) / b;
    if (y >= ymin - 1e-5 && y <= ymax + 1e-5) pts.push({ x: xmin, y });
  }

  // Giao với x = xmax
  if (Math.abs(b) > 1e-9) {
    const y = (-c - a * xmax) / b;
    if (y >= ymin - 1e-5 && y <= ymax + 1e-5) pts.push({ x: xmax, y });
  }

  // Giao với y = ymin
  if (Math.abs(a) > 1e-9) {
    const x = (-c - b * ymin) / a;
    if (x >= xmin - 1e-5 && x <= xmax + 1e-5) pts.push({ x, y: ymin });
  }

  // Giao với y = ymax
  if (Math.abs(a) > 1e-9) {
    const x = (-c - b * ymax) / a;
    if (x >= xmin - 1e-5 && x <= xmax + 1e-5) pts.push({ x, y: ymax });
  }

  // Lọc các điểm trùng nhau
  const unique: Point2D[] = [];
  for (const p of pts) {
    if (!unique.some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 1e-4)) {
      unique.push(p);
    }
  }

  if (unique.length < 2) return null;
  return [unique[0], unique[1]];
}

/**
 * Tự động tính khoảng tọa độ phù hợp dựa trên các giao điểm và trục Oxy
 */
export function computeAutoBounds(
  items: LinearInequality[],
  customBounds?: { xmin?: number; xmax?: number; ymin?: number; ymax?: number }
): { xmin: number; xmax: number; ymin: number; ymax: number } {
  let xmin = customBounds?.xmin ?? -2;
  let xmax = customBounds?.xmax ?? 6;
  let ymin = customBounds?.ymin ?? -2;
  let ymax = customBounds?.ymax ?? 6;

  if (customBounds?.xmin !== undefined && customBounds?.xmax !== undefined) {
    return { xmin, xmax, ymin, ymax };
  }

  const importantPoints: Point2D[] = [{ x: 0, y: 0 }];

  // Thêm giao điểm các cặp đường thẳng
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const pt = lineIntersection(items[i], items[j]);
      if (pt && Math.abs(pt.x) < 50 && Math.abs(pt.y) < 50) {
        importantPoints.push(pt);
      }
    }
    // Giao với các trục toạ độ
    if (Math.abs(items[i].a) > 1e-9) {
      importantPoints.push({ x: -items[i].c / items[i].a, y: 0 });
    }
    if (Math.abs(items[i].b) > 1e-9) {
      importantPoints.push({ x: 0, y: -items[i].c / items[i].b });
    }
  }

  const validPts = importantPoints.filter((p) => Math.abs(p.x) < 25 && Math.abs(p.y) < 25);
  if (validPts.length > 0) {
    const xs = validPts.map((p) => p.x);
    const ys = validPts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    xmin = Math.floor(Math.min(minX - 1.5, -1));
    xmax = Math.ceil(Math.max(maxX + 1.5, 4));
    ymin = Math.floor(Math.min(minY - 1.5, -1));
    ymax = Math.ceil(Math.max(maxY + 1.5, 4));

    // Giới hạn tỉ lệ khung nhìn hợp lý
    if (xmax - xmin > 18) xmax = xmin + 18;
    if (ymax - ymin > 18) ymax = ymin + 18;
  }

  return { xmin, xmax, ymin, ymax };
}

/**
 * Sinh vector SVG cho Hệ Bất Phương Trình Toán 10
 */
export function renderInequalitiesToSvg(
  rawInputs: (string | LinearInequality)[],
  options: InequalityPlotOptions = {}
): string {
  const items: LinearInequality[] = [];

  for (const input of rawInputs) {
    if (typeof input === 'string') {
      const parsed = parseLinearInequality(input);
      if (parsed) items.push(parsed);
    } else if (input && typeof input.a === 'number') {
      items.push(input);
    }
  }

  if (items.length === 0) return '';

  const width = options.width || 600;
  const height = options.height || 500;
  const padding = 55;

  const bounds = computeAutoBounds(items, options);
  const { xmin, xmax, ymin, ymax } = bounds;

  const plotW = width - 2 * padding;
  const plotH = height - 2 * padding;

  const scaleX = (x: number) => padding + ((x - xmin) / (xmax - xmin)) * plotW;
  const scaleY = (y: number) => height - padding - ((y - ymin) / (ymax - ymin)) * plotH;

  const originX = scaleX(0);
  const originY = scaleY(0);

  const colors = ['#2563EB', '#DC2626', '#16A34A', '#9333EA', '#D97706'];

  let svgContent = '';

  // 1. Khung nền trắng & Lưới toạ độ (Grid)
  svgContent += `<rect width="100%" height="100%" fill="#ffffff" />`;

  if (options.showGrid !== false) {
    let gridXml = '';
    for (let x = Math.ceil(xmin); x <= Math.floor(xmax); x++) {
      if (x === 0) continue;
      const px = scaleX(x);
      gridXml += `<line x1="${px.toFixed(1)}" y1="${padding}" x2="${px.toFixed(1)}" y2="${height - padding}" stroke="#F1F5F9" stroke-width="1" />`;
    }
    for (let y = Math.ceil(ymin); y <= Math.floor(ymax); y++) {
      if (y === 0) continue;
      const py = scaleY(y);
      gridXml += `<line x1="${padding}" y1="${py.toFixed(1)}" x2="${width - padding}" y2="${py.toFixed(1)}" stroke="#F1F5F9" stroke-width="1" />`;
    }
    svgContent += `<g class="grid">${gridXml}</g>`;
  }

  // 2. Gạch sọc (Hatching) miền không thỏa mãn (hoặc miền nghiệm nếu reverse)
  // Chuẩn SGK Việt Nam: Nửa mặt phẳng KHÔNG chứa nghiệm sẽ bị gạch sọc nghiêng 45 độ
  const hatchLines: string[] = [];
  const hatchSpacing = 14; // khoảng cách giữa các nét gạch

  // Tạo pattern clip-path cho khung nhìn vẽ
  const clipId = `plot_clip_${Date.now()}`;
  svgContent += `<defs>
    <clipPath id="${clipId}">
      <rect x="${padding}" y="${padding}" width="${plotW}" height="${plotH}" />
    </clipPath>
  </defs>`;

  // Kiểm tra điểm (x, y) có thỏa mãn BPT thứ k không
  const satisfies = (item: LinearInequality, x: number, y: number) => {
    const val = item.a * x + item.b * y + item.c;
    if (item.operator === '<=') return val <= 1e-7;
    if (item.operator === '>=') return val >= -1e-7;
    if (item.operator === '<') return val < 0;
    return val > 0;
  };

  // Tạo các đường gạch sọc phủ kín khung nhìn
  // Đường gạch x + y = k (góc 45 độ)
  const diagMin = padding - plotH;
  const diagMax = width + plotH;

  for (let d = diagMin; d <= diagMax; d += hatchSpacing) {
    // Đoạn thẳng chéo cắt khung nhìn
    const x1 = d;
    const y1 = padding;
    const x2 = d - plotH;
    const y2 = height - padding;

    // Lấy mẫu các điểm trên đoạn thẳng để xem có thuộc phần bị gạch không
    const samples = 40;
    let inExcludedSegment = false;
    let segStart: Point2D | null = null;

    for (let s = 0; s <= samples; s++) {
      const t = s / samples;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;

      // Chuyển sang toạ độ toán học
      const mathX = xmin + ((px - padding) / plotW) * (xmax - xmin);
      const mathY = ymin + ((height - padding - py) / plotH) * (ymax - ymin);

      // Thỏa mãn toàn bộ hệ hay không
      const satisfiesAll = items.every((it) => satisfies(it, mathX, mathY));
      const shouldHatch = options.reverseShading ? satisfiesAll : !satisfiesAll;

      if (shouldHatch) {
        if (!inExcludedSegment) {
          inExcludedSegment = true;
          segStart = { x: px, y: py };
        }
      } else {
        if (inExcludedSegment && segStart) {
          hatchLines.push(
            `<line x1="${segStart.x.toFixed(1)}" y1="${segStart.y.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#94A3B8" stroke-width="1.1" stroke-linecap="round" />`
          );
          inExcludedSegment = false;
          segStart = null;
        }
      }
    }

    if (inExcludedSegment && segStart) {
      hatchLines.push(
        `<line x1="${segStart.x.toFixed(1)}" y1="${segStart.y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#94A3B8" stroke-width="1.1" stroke-linecap="round" />`
      );
    }
  }

  svgContent += `<g clip-path="url(#${clipId})" class="hatching">${hatchLines.join('')}</g>`;

  // 3. Vẽ hai trục toạ độ Ox, Oy với mũi tên và gốc O
  let axesXml = '';
  const boundedOriginX = Math.max(padding, Math.min(width - padding, originX));
  const boundedOriginY = Math.max(padding, Math.min(height - padding, originY));

  // Trục Ox
  axesXml += `<line x1="${padding - 15}" y1="${originY.toFixed(1)}" x2="${width - padding + 25}" y2="${originY.toFixed(1)}" stroke="#0F172A" stroke-width="1.6" />`;
  // Mũi tên Ox
  axesXml += `<polygon points="${width - padding + 25},${originY.toFixed(1)} ${width - padding + 15},${(originY - 4).toFixed(1)} ${width - padding + 15},${(originY + 4).toFixed(1)}" fill="#0F172A" />`;
  axesXml += `<text x="${width - padding + 30}" y="${(originY + 4).toFixed(1)}" font-family="Times New Roman, serif" font-size="16" font-style="italic" font-weight="bold" fill="#0F172A">x</text>`;

  // Trục Oy
  axesXml += `<line x1="${originX.toFixed(1)}" y1="${height - padding + 15}" x2="${originX.toFixed(1)}" y2="${padding - 25}" stroke="#0F172A" stroke-width="1.6" />`;
  // Mũi tên Oy
  axesXml += `<polygon points="${originX.toFixed(1)},${padding - 25} ${(originX - 4).toFixed(1)},${padding - 15} ${(originX + 4).toFixed(1)},${padding - 15}" fill="#0F172A" />`;
  axesXml += `<text x="${(originX - 16).toFixed(1)}" y="${padding - 22}" font-family="Times New Roman, serif" font-size="16" font-style="italic" font-weight="bold" fill="#0F172A">y</text>`;

  // Điểm O
  axesXml += `<text x="${(originX - 12).toFixed(1)}" y="${(originY + 16).toFixed(1)}" font-family="Times New Roman, serif" font-size="14" font-style="italic" fill="#0F172A">O</text>`;

  // Các vạch chia toạ độ (Ticks & Numbers)
  for (let x = Math.ceil(xmin); x <= Math.floor(xmax); x++) {
    if (x === 0) continue;
    const px = scaleX(x);
    axesXml += `<line x1="${px.toFixed(1)}" y1="${(originY - 3).toFixed(1)}" x2="${px.toFixed(1)}" y2="${(originY + 3).toFixed(1)}" stroke="#0F172A" stroke-width="1.2" />`;
    axesXml += `<text x="${px.toFixed(1)}" y="${(originY + 16).toFixed(1)}" font-family="Times New Roman, serif" font-size="12" fill="#334155" text-anchor="middle">${x}</text>`;
  }

  for (let y = Math.ceil(ymin); y <= Math.floor(ymax); y++) {
    if (y === 0) continue;
    const py = scaleY(y);
    axesXml += `<line x1="${(originX - 3).toFixed(1)}" y1="${py.toFixed(1)}" x2="${(originX + 3).toFixed(1)}" y2="${py.toFixed(1)}" stroke="#0F172A" stroke-width="1.2" />`;
    axesXml += `<text x="${(originX - 7).toFixed(1)}" y="${(py + 4).toFixed(1)}" font-family="Times New Roman, serif" font-size="12" fill="#334155" text-anchor="end">${y}</text>`;
  }

  svgContent += `<g class="axes">${axesXml}</g>`;

  // 4. Vẽ các đường biên (Boundary lines)
  let linesXml = '';
  items.forEach((item, idx) => {
    const seg = clipLineToRect(item, xmin, xmax, ymin, ymax);
    if (!seg) return;

    const [p1, p2] = seg;
    const sx1 = scaleX(p1.x);
    const sy1 = scaleY(p1.y);
    const sx2 = scaleX(p2.x);
    const sy2 = scaleY(p2.y);

    const isDashed = item.operator === '<' || item.operator === '>';
    const color = item.color || colors[idx % colors.length];

    linesXml += `<line x1="${sx1.toFixed(1)}" y1="${sy1.toFixed(1)}" x2="${sx2.toFixed(1)}" y2="${sy2.toFixed(1)}" stroke="${color}" stroke-width="2" ${isDashed ? 'stroke-dasharray="6,5"' : ''} stroke-linecap="round" />`;

    // Nhãn tên đường thẳng (d1, d2...)
    if (options.showLabels !== false) {
      const midX = (sx1 + sx2) / 2;
      const midY = (sy1 + sy2) / 2;
      const label = item.label || `(d${idx + 1})`;
      linesXml += `<text x="${(midX + 6).toFixed(1)}" y="${(midY - 6).toFixed(1)}" font-family="Times New Roman, serif" font-size="12" font-weight="bold" fill="${color}">${label}</text>`;
    }
  });

  svgContent += `<g class="boundary-lines">${linesXml}</g>`;

  // 5. Đánh dấu các đỉnh giao điểm (Vertices)
  if (options.showIntersections !== false) {
    let ptsXml = '';
    const letterNames = ['A', 'B', 'C', 'D', 'E', 'F'];
    let nameIdx = 0;

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const pt = lineIntersection(items[i], items[j]);
        if (!pt) continue;

        if (pt.x >= xmin - 1e-4 && pt.x <= xmax + 1e-4 && pt.y >= ymin - 1e-4 && pt.y <= ymax + 1e-4) {
          const px = scaleX(pt.x);
          const py = scaleY(pt.y);
          const letter = letterNames[nameIdx % letterNames.length];
          nameIdx++;

          ptsXml += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="#DC2626" stroke="#ffffff" stroke-width="1.5" />`;
          ptsXml += `<text x="${(px + 6).toFixed(1)}" y="${(py - 6).toFixed(1)}" font-family="Times New Roman, serif" font-size="13" font-weight="bold" fill="#DC2626">${letter}</text>`;
        }
      }
    }
    svgContent += `<g class="intersection-points">${ptsXml}</g>`;
  }

  // 6. Tiêu đề hình vẽ
  if (options.title) {
    svgContent += `<text x="${(width / 2).toFixed(1)}" y="25" font-family="Times New Roman, serif" font-size="15" font-weight="bold" fill="#0F172A" text-anchor="middle">${options.title}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${svgContent}</svg>`;
}

/**
 * Xuất Hệ Bất Phương Trình sang ảnh PNG Base64 sắc nét để nhúng trực tiếp vào file Word
 */
export async function renderInequalitiesToPng(
  rawInputs: (string | LinearInequality)[],
  options: InequalityPlotOptions = {}
): Promise<string> {
  const svg = renderInequalitiesToSvg(rawInputs, options);
  if (!svg) return '';
  return await svgStringToPngBase64(svg);
}

/**
 * Tự động phát hiện các bất phương trình trong văn bản câu hỏi Toán 10
 */
export function extractInequalitiesFromText(text: string): string[] {
  if (!text) return [];

  const found: string[] = [];
  // Regex tìm các dòng hoặc biểu thức có x, y và các dấu so sánh
  const pattern = /([+-]?\s*\d*\s*x\s*[+-]?\s*\d*\s*y\s*(?:<=|>=|<|>|\\le|\\ge|\\leq|\\geq|≤|≥)\s*[+-]?\s*\d+)/gi;

  const matches = text.match(pattern);
  if (matches) {
    matches.forEach((m) => {
      const trimmed = m.trim();
      if (!found.includes(trimmed)) found.push(trimmed);
    });
  }

  // Tìm trường hợp đơn lẻ x >= a hoặc y <= b
  const singlePattern = /([xy]\s*(?:<=|>=|<|>|\\le|\\ge|\\leq|\\geq|≤|≥)\s*[+-]?\s*\d+)/gi;
  const singleMatches = text.match(singlePattern);
  if (singleMatches) {
    singleMatches.forEach((m) => {
      const trimmed = m.trim();
      if (!found.includes(trimmed)) found.push(trimmed);
    });
  }

  return found;
}
