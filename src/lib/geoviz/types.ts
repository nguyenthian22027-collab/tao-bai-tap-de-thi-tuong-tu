// ============================================================
// geoviz/types.ts — Kiểu dữ liệu hình học 2D cho GeoViz Engine
// Sao chép và điều chỉnh từ remix-geoviz-studio-V3/src/types.ts
// KHÔNG phụ thuộc vào dự án gốc — module độc lập hoàn toàn
// ============================================================

export type PointLabelPosition =
  | 'auto'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface Point2D {
  label: string;
  x: number;
  y: number;
  color?: string;
  size?: number;
  labelPosition?: PointLabelPosition;
  labelOffsetX?: number;
  labelOffsetY?: number;
}

export type SegmentStyle = 'solid' | 'dashed';

export interface Segment2D {
  from: string;
  to: string;
  style?: SegmentStyle;
  dashed?: boolean;
  color?: string;
  width?: number;
  label?: string;
}

export interface Circle2D {
  /** Center là label của điểm (string) hoặc tọa độ trực tiếp */
  center: string | { x: number; y: number; label: string };
  radius: number;
  label?: string;
  fill?: boolean;
  color?: string;
  fillColor?: string;
  /** Nếu set: chỉ vẽ cung từ startAngle đến endAngle (radian, ngược chiều kim đồng hồ) */
  startAngle?: number;
  endAngle?: number;
}

export interface RightAngle2D {
  vertex: string;
  p1?: string;
  p2?: string;
}

export interface AngleMark2D {
  vertex: string;
  arm1: string;
  arm2: string;
  label?: string;
}

export interface Polygon2D {
  points: string[];
  fill?: boolean;
  fillColor?: string;
  pattern?: string;
  opacity?: number;
}

/**
 * Kết quả đã giải của bộ máy hình học 2D — chứa tất cả thực thể hình học
 * với tọa độ chính xác 100% về mặt toán học.
 */
export interface Shape2DData {
  type?: string;
  title?: string;
  points: Point2D[];
  segments?: Segment2D[];
  circles?: Circle2D[];
  rightAngles?: RightAngle2D[];
  angles?: AngleMark2D[];
  polygons?: Polygon2D[];
  labels?: Record<string, string>;
}
