// ============================================================
// geoviz/geoConstraints.ts — Schema ràng buộc hình học 2D
// Sao chép và điều chỉnh từ remix-geoviz-studio-V3/src/lib/geoConstraints.ts
// ============================================================

export interface FixedConstraint {
  type: 'fixed';
  point: string;
  x: number;
  y: number;
}

export interface PerpendicularFootConstraint {
  type: 'perpendicular_foot';
  foot: string;
  from: string;
  line_p1: string;
  line_p2: string;
}

export interface MidpointConstraint {
  type: 'midpoint';
  mid: string;
  p1: string;
  p2: string;
}

export interface PointOnLineConstraint {
  type: 'point_on_line';
  point: string;
  line_p1: string;
  line_p2: string;
  t: number;
}

export interface SymmetricPointConstraint {
  type: 'symmetric_point';
  point: string;
  source: string;
  center: string;
}

export interface LineIntersectionConstraint {
  type: 'line_intersection';
  point: string;
  l1_p1: string;
  l1_p2: string;
  l2_p1: string;
  l2_p2: string;
}

export interface CircleFromDiameterConstraint {
  type: 'circle_from_diameter';
  circle_label: string;
  center_label: string;
  p1: string;
  p2: string;
}

export interface SemicircleConstraint {
  type: 'semicircle';
  circle_label: string;
  center_label: string;
  p1: string;
  p2: string;
  side?: 'upper' | 'lower';
}

export interface CircumcircleConstraint {
  type: 'circumcircle' | 'circle_from_3_points';
  circle_label: string;
  center_label: string;
  p1: string;
  p2: string;
  p3: string;
}

export interface CircleFromCenterAndPointConstraint {
  type: 'circle_from_center_and_point';
  circle_label: string;
  center: string;
  through_point: string;
}

export interface TangentFromPointConstraint {
  type: 'tangent_from_point';
  tangent_point: string;
  from_point: string;
  circle_label: string;
  same_side_as?: string;
  ref_line_p1?: string;
  ref_line_p2?: string;
  exclude_point?: string;
}

export interface TangentLineIntersectionConstraint {
  type: 'tangent_line_intersection';
  point: string;
  tangent_at: string;
  circle_label: string;
  line_p1: string;
  line_p2: string;
}

export interface CircleParallelChordConstraint {
  type: 'circle_parallel_chord';
  point: string;
  start_point: string;
  circle_label: string;
  line_p1: string;
  line_p2: string;
}

export interface LineCircleSecondIntersectionConstraint {
  type: 'line_circle_second_intersection';
  point: string;
  line_p1: string;
  line_p2: string;
  circle_label: string;
  known_point?: string;
}

export interface AngleBisectorConstraint {
  type: 'angle_bisector';
  point: string;
  vertex: string;
  arm1: string;
  arm2: string;
  target_line_p1: string;
  target_line_p2: string;
}

export interface ParallelPointConstraint {
  type: 'parallel_point';
  point: string;
  from: string;
  line_p1: string;
  line_p2: string;
  length?: number;
}

export interface CentroidConstraint {
  type: 'centroid';
  point: string;
  p1: string;
  p2: string;
  p3: string;
}

export interface OrthocenterConstraint {
  type: 'orthocenter';
  point: string;
  p1: string;
  p2: string;
  p3: string;
}

export interface IncenterConstraint {
  type: 'incenter';
  point: string;
  p1: string;
  p2: string;
  p3: string;
}

export type GeoConstraint =
  | FixedConstraint
  | PerpendicularFootConstraint
  | MidpointConstraint
  | PointOnLineConstraint
  | SymmetricPointConstraint
  | LineIntersectionConstraint
  | CircleFromDiameterConstraint
  | SemicircleConstraint
  | CircumcircleConstraint
  | CircleFromCenterAndPointConstraint
  | TangentFromPointConstraint
  | TangentLineIntersectionConstraint
  | CircleParallelChordConstraint
  | LineCircleSecondIntersectionConstraint
  | AngleBisectorConstraint
  | ParallelPointConstraint
  | CentroidConstraint
  | OrthocenterConstraint
  | IncenterConstraint;

export interface GeoCircleDef {
  label: string;
  center_label: string;
  radius?: number;
  through_point?: string;
  p1?: string;
  p2?: string;
  p3?: string;
}

export interface GeoConstraintGraph {
  title?: string;
  free_points?: Record<string, [number, number]>;
  constraints: GeoConstraint[];
  circles?: GeoCircleDef[];
  segments?: Array<{ from: string; to: string; style?: 'solid' | 'dashed'; label?: string }>;
  right_angles?: Array<{ vertex: string; p1?: string; p2?: string }>;
  labels?: Record<string, string>;
}
