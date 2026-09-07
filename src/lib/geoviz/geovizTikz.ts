// ============================================================
// geoviz/geovizTikz.ts — Sinh mã TikZ chuẩn SGK từ Shape2DData
// Tương thích hoàn hảo với Kroki, TeXLive.net, Overleaf và Word export
// ============================================================

import { Shape2DData } from './types';

/**
 * Sinh mã TikZ chuẩn sách giáo khoa Việt Nam từ dữ liệu hình học 2D đã giải tọa độ.
 * Trả về khối mã \begin{tikzpicture}...\end{tikzpicture} sạch sẽ,
 * có thể chèn trực tiếp vào tài liệu TeX hoặc export sang Word/SVG.
 */
export function generateGeovizTikz(shape: Shape2DData): string {
  const lines: string[] = [];

  lines.push('\\begin{tikzpicture}[scale=1.0, line join=round, line cap=round, >=stealth]');

  // --- Tọa độ các điểm ---
  lines.push('  % Tọa độ các điểm chính xác 100%');
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

  // --- Các đường tròn & cung tròn ---
  if (shape.circles && shape.circles.length > 0) {
    lines.push('  % Các đường tròn');
    for (const c of shape.circles) {
      const centerStr = typeof c.center === 'string' ? `(${c.center})` : `(${c.center.x}, ${c.center.y})`;
      if (c.startAngle !== undefined && c.endAngle !== undefined) {
        // Cung tròn / Nửa đường tròn: bắt đầu tại góc startDeg từ tâm
        const startDeg = Math.round((c.startAngle * 180) / Math.PI);
        const endDeg = Math.round((c.endAngle * 180) / Math.PI);
        lines.push(`  \\draw[thick] ([shift=(${startDeg}:${c.radius})]${centerStr}) arc (${startDeg}:${endDeg}:${c.radius});`);
      } else {
        lines.push(`  \\draw[thick] ${centerStr} circle (${c.radius});`);
      }
    }
  }

  // --- Ký hiệu góc vuông ---
  if (shape.rightAngles && shape.rightAngles.length > 0) {
    lines.push('  % Ký hiệu góc vuông');
    for (const ra of shape.rightAngles) {
      if (ra.p1 && ra.p2 && ra.vertex) {
        lines.push(`  \\draw pic[draw, thick, angle radius=3.5mm] {right angle = ${ra.p1}--${ra.vertex}--${ra.p2}};`);
      }
    }
  }

  // --- Đánh dấu và nhãn điểm (bỏ qua các điểm phụ kết thúc bằng _dir, _tmp, _ref) ---
  lines.push('  % Đánh dấu và nhãn điểm');
  const visiblePoints = shape.points.filter(
    (p) => !p.label.includes('_dir') && !p.label.includes('_tmp') && !p.label.includes('_ref')
  );

  for (const p of visiblePoints) {
    const pos = getLabelPosition(p.label, shape);
    lines.push(`  \\fill (${p.label}) circle (1.5pt);`);
    lines.push(`  \\node[${pos}] at (${p.label}) {$${p.label}$};`);
  }

  lines.push('\\end{tikzpicture}');

  return lines.join('\n');
}

/**
 * Tự động xác định vị trí nhãn điểm 8 hướng dựa theo vị trí tương đối
 * so với trọng tâm hình vẽ, tránh nét vẽ đè lên chữ.
 */
function getLabelPosition(label: string, shape: Shape2DData): string {
  const pt = shape.points.find((p) => p.label === label);
  if (!pt) return 'below';

  const allPts = shape.points.filter(
    (p) => !p.label.includes('_dir') && !p.label.includes('_tmp') && !p.label.includes('_ref')
  );
  if (allPts.length < 2) return 'below';

  const cx = allPts.reduce((sum, p) => sum + p.x, 0) / allPts.length;
  const cy = allPts.reduce((sum, p) => sum + p.y, 0) / allPts.length;

  const dx = pt.x - cx;
  const dy = pt.y - cy;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  // Hướng chéo nếu lệch cả 2 chiều
  if (adx > 0.4 && ady > 0.4) {
    const vert = dy > 0 ? 'above' : 'below';
    const horiz = dx > 0 ? 'right' : 'left';
    return `${vert} ${horiz}`;
  }

  if (ady >= adx) {
    return dy >= 0 ? 'above' : 'below';
  } else {
    return dx >= 0 ? 'right' : 'left';
  }
}
