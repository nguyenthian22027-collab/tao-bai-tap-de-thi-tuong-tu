// ============================================================
// geoviz/geovizTikz.ts — Sinh mã TikZ chuẩn SGK từ Shape2DData
// Điều chỉnh từ remix-geoviz-studio-V3/src/lib/geometryMath.ts
// ============================================================

import { Shape2DData } from './types';

/**
 * Sinh mã TikZ chuẩn sách giáo khoa Việt Nam từ dữ liệu hình học 2D đã giải tọa độ.
 * Mã TikZ sinh ra:
 * - Dùng \coordinate cho mọi điểm (không bao giờ viết tọa độ trực tiếp vào lệnh draw)
 * - Đoạn đứt: \draw[dashed, thick]
 * - Đường tròn: \draw[thick] (O) circle (Rcm)
 * - Góc vuông: \draw pic {right angle = A--D--B}
 * - Nhãn điểm: \fill (A) circle (1.5pt); \node[below] at (A) {$A$}
 */
export function generateGeovizTikz(shape: Shape2DData): string {
  const lines: string[] = [];

  lines.push('\\documentclass[border=3pt,tikz]{standalone}');
  lines.push('\\usepackage{amsmath,amssymb}');
  lines.push('\\usetikzlibrary{calc,angles,quotes,patterns,arrows.meta}');
  lines.push('\\begin{document}');
  lines.push('\\begin{tikzpicture}[scale=1.0, line join=round, line cap=round, >=stealth]');

  // --- Tọa độ các điểm ---
  lines.push('  % Tọa độ các điểm');
  for (const p of shape.points) {
    lines.push(`  \\coordinate (${p.label}) at (${p.x}, ${p.y});`);
  }

  // --- Các đoạn thẳng ---
  if (shape.segments && shape.segments.length > 0) {
    lines.push('  % Các đoạn thẳng');
    for (const seg of shape.segments) {
      const isDashed = seg.dashed || seg.style === 'dashed';
      const opt = isDashed ? 'dashed, thick' : 'thick';
      lines.push(`  \\draw[${opt}] (${seg.from}) -- (${seg.to});`);
    }
  }

  // --- Các đường tròn ---
  if (shape.circles && shape.circles.length > 0) {
    lines.push('  % Các đường tròn');
    for (const c of shape.circles) {
      const centerStr = typeof c.center === 'string' ? `(${c.center})` : `(${c.center.x}, ${c.center.y})`;
      if (c.startAngle !== undefined && c.endAngle !== undefined) {
        // Vẽ cung tròn (nửa đường tròn)
        const startDeg = Math.round((c.startAngle * 180) / Math.PI);
        const endDeg = Math.round((c.endAngle * 180) / Math.PI);
        lines.push(`  \\draw[thick] ${centerStr} arc (${startDeg}:${endDeg}:${c.radius}cm);`);
      } else {
        lines.push(`  \\draw[thick] ${centerStr} circle (${c.radius}cm);`);
      }
    }
  }

  // --- Ký hiệu góc vuông ---
  if (shape.rightAngles && shape.rightAngles.length > 0) {
    lines.push('  % Ký hiệu góc vuông');
    for (const ra of shape.rightAngles) {
      if (ra.p1 && ra.p2) {
        lines.push(`  \\draw pic[draw, thick, angle radius=3.5mm] {right angle = ${ra.p1}--${ra.vertex}--${ra.p2}};`);
      }
    }
  }

  // --- Đánh dấu và nhãn điểm ---
  lines.push('  % Đánh dấu và nhãn điểm');
  for (const p of shape.points) {
    const pos = getLabelPosition(p.label, shape);
    lines.push(`  \\fill (${p.label}) circle (1.5pt);`);
    lines.push(`  \\node[${pos}] at (${p.label}) {$${p.label}$};`);
  }

  lines.push('\\end{tikzpicture}');
  lines.push('\\end{document}');

  return lines.join('\n');
}

/**
 * Tự động xác định vị trí nhãn điểm dựa theo tọa độ tương đối.
 * Điểm ở trên → nhãn bên trên, điểm ở dưới → nhãn bên dưới, v.v.
 */
function getLabelPosition(label: string, shape: Shape2DData): string {
  const pt = shape.points.find((p) => p.label === label);
  if (!pt) return 'below';

  // Tính centroid của tất cả điểm
  const allPts = shape.points;
  if (allPts.length < 2) return 'below';
  const cx = allPts.reduce((sum, p) => sum + p.x, 0) / allPts.length;
  const cy = allPts.reduce((sum, p) => sum + p.y, 0) / allPts.length;

  const dx = pt.x - cx;
  const dy = pt.y - cy;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (ady > adx) {
    return dy > 0 ? 'above' : 'below';
  } else {
    return dx > 0 ? 'right' : 'left';
  }
}
