// ============================================================
// geoviz/geoSolver.ts — Máy Giải Tọa độ Hình học 2D Chính Xác
// Sao chép và điều chỉnh từ remix-geoviz-studio-V3/src/lib/geoSolver.ts
// Giải tọa độ tất cả điểm bằng giải tích thuần túy, chạy trong trình duyệt
// ============================================================

import { Point2D, Circle2D, Segment2D, RightAngle2D, Shape2DData } from './types';
import { GeoConstraintGraph, GeoConstraint } from './geoConstraints';

interface SolvedCircle {
  label: string;
  centerPoint: Point2D;
  radius: number;
  startAngle?: number;
  endAngle?: number;
}

/**
 * Giải toàn bộ đồ thị ràng buộc hình học, trả về Shape2DData với tọa độ chính xác 100%.
 */
export function solveGeometryGraph(graph: GeoConstraintGraph): Shape2DData {
  const pointsMap = new Map<string, Point2D>();
  const circlesMap = new Map<string, SolvedCircle>();

  // 1. Khởi tạo các điểm tự do (free_points)
  if (graph.free_points) {
    for (const [label, coords] of Object.entries(graph.free_points)) {
      if (Array.isArray(coords) && coords.length >= 2) {
        pointsMap.set(label, {
          label,
          x: Math.round(coords[0] * 1000) / 1000,
          y: Math.round(coords[1] * 1000) / 1000,
        });
      }
    }
  }

  // 2. Xử lý các định nghĩa đường tròn tường minh (graph.circles)
  if (graph.circles) {
    for (const cDef of graph.circles) {
      if (cDef.label && cDef.center_label) {
        const centerPt = pointsMap.get(cDef.center_label);
        if (centerPt) {
          let r = cDef.radius;
          if (!r && cDef.through_point) {
            const pt = pointsMap.get(cDef.through_point);
            if (pt) r = Math.hypot(pt.x - centerPt.x, pt.y - centerPt.y);
          }
          if (!r && cDef.p1) {
            const pt = pointsMap.get(cDef.p1);
            if (pt) r = Math.hypot(pt.x - centerPt.x, pt.y - centerPt.y);
          }
          if (r && r > 0) {
            circlesMap.set(cDef.label, { label: cDef.label, centerPoint: centerPt, radius: r });
          }
        }
      }
    }
  }

  // 3. Giải lặp đa vòng (tối đa 15 vòng) để giải quyết phụ thuộc dây chuyền
  const maxPasses = 15;
  const constraints = graph.constraints || [];
  const solvedIndices = new Set<number>();

  for (let pass = 0; pass < maxPasses; pass++) {
    let progress = false;
    for (let i = 0; i < constraints.length; i++) {
      if (solvedIndices.has(i)) continue;
      const c = constraints[i];
      const success = applyConstraint(c, pointsMap, circlesMap);
      if (success) { solvedIndices.add(i); progress = true; }
    }
    // Kiểm tra lại graph.circles sau mỗi vòng (tâm có thể được giải sau)
    if (graph.circles) {
      for (const cDef of graph.circles) {
        if (!circlesMap.has(cDef.label) && cDef.center_label) {
          const centerPt = pointsMap.get(cDef.center_label);
          if (centerPt) {
            let r = cDef.radius;
            if (!r && cDef.through_point) {
              const pt = pointsMap.get(cDef.through_point);
              if (pt) r = Math.hypot(pt.x - centerPt.x, pt.y - centerPt.y);
            }
            if (r && r > 0) {
              circlesMap.set(cDef.label, { label: cDef.label, centerPoint: centerPt, radius: r });
              progress = true;
            }
          }
        }
      }
    }
    if (!progress) break;
  }

  // 4. Lắp ráp kết quả Shape2DData
  const points = Array.from(pointsMap.values());
  const circles: Circle2D[] = [];

  for (const solvedCircle of circlesMap.values()) {
    const circlePush: Circle2D = {
      center: solvedCircle.centerPoint.label,
      radius: Math.round(solvedCircle.radius * 1000) / 1000,
      label: `(${solvedCircle.centerPoint.label}; ${Math.round(solvedCircle.radius * 100) / 100})`,
    };
    if (solvedCircle.startAngle !== undefined) circlePush.startAngle = solvedCircle.startAngle;
    if (solvedCircle.endAngle !== undefined) circlePush.endAngle = solvedCircle.endAngle;
    circles.push(circlePush);
  }

  // Lắp ráp segments (có loại trùng)
  const segmentKeySet = new Set<string>();
  const segments: Segment2D[] = [];

  const addSegment = (from: string, to: string, style: 'solid' | 'dashed' = 'solid', label?: string) => {
    if (!from || !to || from === to) return;
    if (!pointsMap.has(from) || !pointsMap.has(to)) return;
    const key1 = `${from}-${to}`;
    const key2 = `${to}-${from}`;
    if (segmentKeySet.has(key1) || segmentKeySet.has(key2)) return;
    segmentKeySet.add(key1);
    segments.push({ from, to, style, label });
  };

  if (graph.segments) {
    for (const seg of graph.segments) {
      if (seg.from && seg.to) {
        addSegment(seg.from, seg.to, seg.style === 'dashed' ? 'dashed' : 'solid', seg.label);
      }
    }
  }

  // Lắp ráp rightAngles
  const raKeySet = new Set<string>();
  const rightAngles: RightAngle2D[] = [];

  const addRightAngle = (vertex: string, p1?: string, p2?: string) => {
    if (!vertex || !pointsMap.has(vertex)) return;
    const key = `${vertex}:${p1 || ''}:${p2 || ''}`;
    if (raKeySet.has(key)) return;
    raKeySet.add(key);
    rightAngles.push({ vertex, p1, p2 });
  };

  if (graph.right_angles) {
    for (const ra of graph.right_angles) {
      if (ra.vertex) addRightAngle(ra.vertex, ra.p1, ra.p2);
    }
  }

  // 5. Tự động bổ sung góc vuông và đoạn thẳng từ ràng buộc
  for (const c of constraints) {
    if (c.type === 'line_intersection') {
      addSegment(c.l2_p2, c.point, 'solid');
      addSegment(c.l1_p1, c.point, 'solid');
    } else if (c.type === 'line_circle_second_intersection') {
      addSegment(c.line_p1, c.point, 'solid');
      addSegment(c.line_p2, c.point, 'solid');
    } else if (c.type === 'circle_parallel_chord') {
      addSegment(c.start_point, c.point, 'dashed');
    } else if (c.type === 'tangent_line_intersection') {
      addSegment(c.tangent_at, c.point, 'solid');
      addSegment(c.line_p1, c.point, 'solid');
      addSegment(c.line_p2, c.point, 'solid');
      const circleObj = circlesMap.get(c.circle_label);
      if (circleObj) {
        addSegment(circleObj.centerPoint.label, c.tangent_at, 'dashed');
        addRightAngle(c.tangent_at, c.point, circleObj.centerPoint.label);
      }
    } else if (c.type === 'tangent_from_point') {
      addSegment(c.from_point, c.tangent_point, 'solid');
      const circleObj = circlesMap.get(c.circle_label);
      if (circleObj) {
        addSegment(circleObj.centerPoint.label, c.tangent_point, 'dashed');
        addRightAngle(c.tangent_point, c.from_point, circleObj.centerPoint.label);
      }
    } else if (c.type === 'perpendicular_foot') {
      addSegment(c.from, c.foot, 'solid');
      addRightAngle(c.foot, c.from, c.line_p1);
    } else if (c.type === 'circumcircle' || c.type === 'circle_from_3_points') {
      addSegment(c.p1, c.p2, 'solid');
      addSegment(c.p2, c.p3, 'solid');
      addSegment(c.p3, c.p1, 'solid');
    } else if (c.type === 'semicircle') {
      addSegment(c.p1, c.p2, 'solid');
    }
  }

  return {
    type: 'composite',
    title: graph.title || 'Hình học phẳng 2D',
    points,
    circles,
    segments,
    rightAngles,
    labels: graph.labels || {},
  };
}

// ============================================================
// applyConstraint — Áp dụng từng ràng buộc hình học
// ============================================================

function applyConstraint(
  c: GeoConstraint,
  pointsMap: Map<string, Point2D>,
  circlesMap: Map<string, SolvedCircle>
): boolean {
  switch (c.type) {
    case 'fixed': {
      pointsMap.set(c.point, { label: c.point, x: Math.round(c.x * 1000) / 1000, y: Math.round(c.y * 1000) / 1000 });
      return true;
    }

    case 'perpendicular_foot': {
      const pFrom = pointsMap.get(c.from);
      const p1 = pointsMap.get(c.line_p1);
      const p2 = pointsMap.get(c.line_p2);
      if (!pFrom || !p1 || !p2) return false;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return false;
      const t = ((pFrom.x - p1.x) * dx + (pFrom.y - p1.y) * dy) / lenSq;
      pointsMap.set(c.foot, { label: c.foot, x: Math.round((p1.x + t * dx) * 1000) / 1000, y: Math.round((p1.y + t * dy) * 1000) / 1000 });
      return true;
    }

    case 'midpoint': {
      const p1 = pointsMap.get(c.p1);
      const p2 = pointsMap.get(c.p2);
      if (!p1 || !p2) return false;
      pointsMap.set(c.mid, { label: c.mid, x: Math.round(((p1.x + p2.x) / 2) * 1000) / 1000, y: Math.round(((p1.y + p2.y) / 2) * 1000) / 1000 });
      return true;
    }

    case 'point_on_line': {
      const p1 = pointsMap.get(c.line_p1);
      const p2 = pointsMap.get(c.line_p2);
      if (!p1 || !p2) return false;
      const t = typeof c.t === 'number' ? c.t : 0.5;
      pointsMap.set(c.point, { label: c.point, x: Math.round((p1.x + t * (p2.x - p1.x)) * 1000) / 1000, y: Math.round((p1.y + t * (p2.y - p1.y)) * 1000) / 1000 });
      return true;
    }

    case 'symmetric_point': {
      const pSource = pointsMap.get(c.source);
      const pCenter = pointsMap.get(c.center);
      if (!pSource || !pCenter) return false;
      pointsMap.set(c.point, { label: c.point, x: Math.round((2 * pCenter.x - pSource.x) * 1000) / 1000, y: Math.round((2 * pCenter.y - pSource.y) * 1000) / 1000 });
      return true;
    }

    case 'line_intersection': {
      const p1 = pointsMap.get(c.l1_p1); const p2 = pointsMap.get(c.l1_p2);
      const p3 = pointsMap.get(c.l2_p1); const p4 = pointsMap.get(c.l2_p2);
      if (!p1 || !p2 || !p3 || !p4) return false;
      const a1 = p2.y - p1.y; const b1 = p1.x - p2.x; const c1 = a1 * p1.x + b1 * p1.y;
      const a2 = p4.y - p3.y; const b2 = p3.x - p4.x; const c2 = a2 * p3.x + b2 * p3.y;
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-9) return false;
      pointsMap.set(c.point, { label: c.point, x: Math.round(((b2 * c1 - b1 * c2) / det) * 1000) / 1000, y: Math.round(((a1 * c2 - a2 * c1) / det) * 1000) / 1000 });
      return true;
    }

    case 'circle_from_diameter': {
      const p1 = pointsMap.get(c.p1); const p2 = pointsMap.get(c.p2);
      if (!p1 || !p2) return false;
      const cx = (p1.x + p2.x) / 2; const cy = (p1.y + p2.y) / 2;
      const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2;
      const centerPoint: Point2D = { label: c.center_label, x: Math.round(cx * 1000) / 1000, y: Math.round(cy * 1000) / 1000 };
      pointsMap.set(c.center_label, centerPoint);
      circlesMap.set(c.circle_label, { label: c.circle_label, centerPoint, radius });
      return true;
    }

    case 'semicircle': {
      const p1 = pointsMap.get(c.p1); const p2 = pointsMap.get(c.p2);
      if (!p1 || !p2) return false;
      const cx = (p1.x + p2.x) / 2; const cy = (p1.y + p2.y) / 2;
      const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2;
      const angleToP2 = Math.atan2(p2.y - cy, p2.x - cx);
      const angleToP1 = Math.atan2(p1.y - cy, p1.x - cx);
      const side = c.side || 'upper';
      const startAngle = side === 'upper' ? angleToP2 : angleToP1;
      const endAngle = side === 'upper' ? angleToP1 : angleToP2;
      const centerPoint: Point2D = { label: c.center_label, x: Math.round(cx * 1000) / 1000, y: Math.round(cy * 1000) / 1000 };
      pointsMap.set(c.center_label, centerPoint);
      circlesMap.set(c.circle_label, { label: c.circle_label, centerPoint, radius, startAngle, endAngle });
      return true;
    }

    case 'circumcircle':
    case 'circle_from_3_points': {
      const p1 = pointsMap.get(c.p1); const p2 = pointsMap.get(c.p2); const p3 = pointsMap.get(c.p3);
      if (!p1 || !p2 || !p3) return false;
      const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
      if (Math.abs(d) < 1e-9) return false;
      const p1Sq = p1.x * p1.x + p1.y * p1.y;
      const p2Sq = p2.x * p2.x + p2.y * p2.y;
      const p3Sq = p3.x * p3.x + p3.y * p3.y;
      const ox = (p1Sq * (p2.y - p3.y) + p2Sq * (p3.y - p1.y) + p3Sq * (p1.y - p2.y)) / d;
      const oy = (p1Sq * (p3.x - p2.x) + p2Sq * (p1.x - p3.x) + p3Sq * (p2.x - p1.x)) / d;
      const radius = Math.hypot(p1.x - ox, p1.y - oy);
      const centerPoint: Point2D = { label: c.center_label, x: Math.round(ox * 1000) / 1000, y: Math.round(oy * 1000) / 1000 };
      pointsMap.set(c.center_label, centerPoint);
      circlesMap.set(c.circle_label, { label: c.circle_label, centerPoint, radius });
      return true;
    }

    case 'circle_from_center_and_point': {
      const pCenter = pointsMap.get(c.center); const pThrough = pointsMap.get(c.through_point);
      if (!pCenter || !pThrough) return false;
      circlesMap.set(c.circle_label, { label: c.circle_label, centerPoint: pCenter, radius: Math.hypot(pThrough.x - pCenter.x, pThrough.y - pCenter.y) });
      return true;
    }

    case 'tangent_line_intersection': {
      const pA = pointsMap.get(c.tangent_at);
      const circle = circlesMap.get(c.circle_label);
      const p1 = pointsMap.get(c.line_p1); const p2 = pointsMap.get(c.line_p2);
      if (!pA || !circle || !p1 || !p2) return false;
      const O = circle.centerPoint;
      const nx = pA.x - O.x; const ny = pA.y - O.y;
      const c1 = nx * pA.x + ny * pA.y;
      const a2 = p2.y - p1.y; const b2 = p1.x - p2.x; const c2 = a2 * p1.x + b2 * p1.y;
      const det = nx * b2 - a2 * ny;
      if (Math.abs(det) < 1e-9) return false;
      pointsMap.set(c.point, { label: c.point, x: Math.round(((b2 * c1 - ny * c2) / det) * 1000) / 1000, y: Math.round(((nx * c2 - a2 * c1) / det) * 1000) / 1000 });
      return true;
    }

    case 'circle_parallel_chord': {
      const pStart = pointsMap.get(c.start_point);
      const circle = circlesMap.get(c.circle_label);
      const p1 = pointsMap.get(c.line_p1); const p2 = pointsMap.get(c.line_p2);
      if (!pStart || !circle || !p1 || !p2) return false;
      const O = circle.centerPoint;
      const dx = p2.x - p1.x; const dy = p2.y - p1.y;
      const a = dx * dx + dy * dy;
      if (a === 0) return false;
      const wx = pStart.x - O.x; const wy = pStart.y - O.y;
      const b = 2 * (wx * dx + wy * dy);
      const t = -b / a;
      pointsMap.set(c.point, { label: c.point, x: Math.round((pStart.x + t * dx) * 1000) / 1000, y: Math.round((pStart.y + t * dy) * 1000) / 1000 });
      return true;
    }

    case 'tangent_from_point': {
      const pFrom = pointsMap.get(c.from_point);
      const circle = circlesMap.get(c.circle_label);
      if (!pFrom || !circle) return false;
      const O = circle.centerPoint; const R = circle.radius;
      const d = Math.hypot(pFrom.x - O.x, pFrom.y - O.y);
      if (d <= R) return false;
      const baseAngle = Math.atan2(pFrom.y - O.y, pFrom.x - O.x);
      const alpha = Math.acos(R / d);
      const T1 = { x: O.x + R * Math.cos(baseAngle + alpha), y: O.y + R * Math.sin(baseAngle + alpha) };
      const T2 = { x: O.x + R * Math.cos(baseAngle - alpha), y: O.y + R * Math.sin(baseAngle - alpha) };
      let chosen = T1;
      if (c.exclude_point) {
        const pEx = pointsMap.get(c.exclude_point);
        if (pEx) { chosen = Math.hypot(T1.x - pEx.x, T1.y - pEx.y) < Math.hypot(T2.x - pEx.x, T2.y - pEx.y) ? T2 : T1; }
      } else if (c.same_side_as && c.ref_line_p1 && c.ref_line_p2) {
        const pRef = pointsMap.get(c.same_side_as);
        const pLine1 = pointsMap.get(c.ref_line_p1);
        const pLine2 = pointsMap.get(c.ref_line_p2);
        if (pRef && pLine1 && pLine2) {
          const sf = (pt: { x: number; y: number }) => (pLine2.x - pLine1.x) * (pt.y - pLine1.y) - (pLine2.y - pLine1.y) * (pt.x - pLine1.x);
          if (sf(pRef) * sf(T1) >= 0) chosen = T1; else chosen = T2;
        }
      }
      pointsMap.set(c.tangent_point, { label: c.tangent_point, x: Math.round(chosen.x * 1000) / 1000, y: Math.round(chosen.y * 1000) / 1000 });
      return true;
    }

    case 'line_circle_second_intersection': {
      const p1 = pointsMap.get(c.line_p1); const p2 = pointsMap.get(c.line_p2);
      const circle = circlesMap.get(c.circle_label);
      if (!p1 || !p2 || !circle) return false;
      const O = circle.centerPoint; const R = circle.radius;
      const dx = p2.x - p1.x; const dy = p2.y - p1.y;
      const wx = p1.x - O.x; const wy = p1.y - O.y;
      const a = dx * dx + dy * dy;
      const b = 2 * (wx * dx + wy * dy);
      const cCoeff = wx * wx + wy * wy - R * R;
      if (a === 0) return false;
      const disc = b * b - 4 * a * cCoeff;
      if (disc < -1e-6) return false;
      const sqrtDisc = Math.sqrt(Math.max(0, disc));
      const t1 = (-b - sqrtDisc) / (2 * a); const t2 = (-b + sqrtDisc) / (2 * a);
      const Q1 = { x: p1.x + t1 * dx, y: p1.y + t1 * dy };
      const Q2 = { x: p1.x + t2 * dx, y: p1.y + t2 * dy };
      let chosen = Q2;
      const pKnown = c.known_point ? pointsMap.get(c.known_point) : null;
      if (pKnown) { chosen = Math.hypot(Q1.x - pKnown.x, Q1.y - pKnown.y) < Math.hypot(Q2.x - pKnown.x, Q2.y - pKnown.y) ? Q2 : Q1; }
      pointsMap.set(c.point, { label: c.point, x: Math.round(chosen.x * 1000) / 1000, y: Math.round(chosen.y * 1000) / 1000 });
      return true;
    }

    case 'angle_bisector': {
      const pV = pointsMap.get(c.vertex); const pA1 = pointsMap.get(c.arm1); const pA2 = pointsMap.get(c.arm2);
      const pT1 = pointsMap.get(c.target_line_p1); const pT2 = pointsMap.get(c.target_line_p2);
      if (!pV || !pA1 || !pA2 || !pT1 || !pT2) return false;
      const d1 = Math.hypot(pA1.x - pV.x, pA1.y - pV.y); const d2 = Math.hypot(pA2.x - pV.x, pA2.y - pV.y);
      if (d1 === 0 || d2 === 0) return false;
      const bisX = (pA1.x - pV.x) / d1 + (pA2.x - pV.x) / d2;
      const bisY = (pA1.y - pV.y) / d1 + (pA2.y - pV.y) / d2;
      const pV2 = { x: pV.x + bisX, y: pV.y + bisY };
      const a1 = pV2.y - pV.y; const b1 = pV.x - pV2.x; const c1 = a1 * pV.x + b1 * pV.y;
      const a2 = pT2.y - pT1.y; const b2 = pT1.x - pT2.x; const c2 = a2 * pT1.x + b2 * pT1.y;
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-9) return false;
      pointsMap.set(c.point, { label: c.point, x: Math.round(((b2 * c1 - b1 * c2) / det) * 1000) / 1000, y: Math.round(((a1 * c2 - a2 * c1) / det) * 1000) / 1000 });
      return true;
    }

    case 'parallel_point': {
      const pFrom = pointsMap.get(c.from); const p1 = pointsMap.get(c.line_p1); const p2 = pointsMap.get(c.line_p2);
      if (!pFrom || !p1 || !p2) return false;
      const dx = p2.x - p1.x; const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) return false;
      const length = typeof c.length === 'number' ? c.length : dist;
      const scale = length / dist;
      pointsMap.set(c.point, { label: c.point, x: Math.round((pFrom.x + dx * scale) * 1000) / 1000, y: Math.round((pFrom.y + dy * scale) * 1000) / 1000 });
      return true;
    }

    case 'centroid': {
      const p1 = pointsMap.get(c.p1); const p2 = pointsMap.get(c.p2); const p3 = pointsMap.get(c.p3);
      if (!p1 || !p2 || !p3) return false;
      pointsMap.set(c.point, { label: c.point, x: Math.round(((p1.x + p2.x + p3.x) / 3) * 1000) / 1000, y: Math.round(((p1.y + p2.y + p3.y) / 3) * 1000) / 1000 });
      return true;
    }

    case 'orthocenter': {
      const p1 = pointsMap.get(c.p1); const p2 = pointsMap.get(c.p2); const p3 = pointsMap.get(c.p3);
      if (!p1 || !p2 || !p3) return false;
      const a1 = p3.x - p2.x; const b1 = p3.y - p2.y; const c1 = a1 * p1.x + b1 * p1.y;
      const a2 = p3.x - p1.x; const b2 = p3.y - p1.y; const c2 = a2 * p2.x + b2 * p2.y;
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-9) return false;
      pointsMap.set(c.point, { label: c.point, x: Math.round(((b2 * c1 - b1 * c2) / det) * 1000) / 1000, y: Math.round(((a1 * c2 - a2 * c1) / det) * 1000) / 1000 });
      return true;
    }

    case 'incenter': {
      const p1 = pointsMap.get(c.p1); const p2 = pointsMap.get(c.p2); const p3 = pointsMap.get(c.p3);
      if (!p1 || !p2 || !p3) return false;
      const a = Math.hypot(p2.x - p3.x, p2.y - p3.y);
      const b = Math.hypot(p1.x - p3.x, p1.y - p3.y);
      const cLen = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const perimeter = a + b + cLen;
      if (perimeter === 0) return false;
      pointsMap.set(c.point, { label: c.point, x: Math.round(((a * p1.x + b * p2.x + cLen * p3.x) / perimeter) * 1000) / 1000, y: Math.round(((a * p1.y + b * p2.y + cLen * p3.y) / perimeter) * 1000) / 1000 });
      return true;
    }

    default:
      return false;
  }
}
