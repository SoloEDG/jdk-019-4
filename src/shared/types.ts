export interface Point {
  x: number;
  y: number;
}
export interface Node extends Point {
  in: Point;
  out: Point;
}
/**
 * A variable-width control stop.
 * t is the position as an arc-length fraction (0..1) of the whole path,
 * measured in the current path direction — never a node index.
 * left / right are half-widths on the two sides of the centerline.
 */
export interface WidthStop {
  t: number;
  left: number;
  right: number;
}
export interface Shape {
  id: string;
  name: string;
  nodes: Node[];
  closed: boolean;
  fill: string;
  stroke: string;
  width: number;
  opacity: number;
  group?: string;
  /** Variable-width stops; absent/empty means a uniform stroke of `width`. */
  taper?: WidthStop[];
  /** When true the shape renders as an expanded filled outline, but the
   *  centerline and all width stops are retained and restored on undo. */
  expanded?: boolean;
  /** Cubic flattening subdivisions per segment (edit precision vs. outline
   *  complexity trade-off). */
  quality?: number;
}
export interface Document {
  shapes: Shape[];
  selected: string[];
  tool: string;
  zoom: number;
}
