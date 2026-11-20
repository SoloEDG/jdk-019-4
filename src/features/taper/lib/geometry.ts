import type { Node, Point, Shape, WidthStop } from "../../../shared/types";

/**
 * Variable-width stroke geometry.
 *
 * Design notes:
 * - Every width stop is located by an arc-length fraction `t` of the whole
 *   path, so moving/adding/deleting nodes never re-binds a stop to a node
 *   index; it keeps sitting at the same curve progress.
 * - The offset outline is built as one polygon from flattened samples.
 *   Miter joins are clamped (and switch to bevel) so sharp turns, hairpin
 *   folds and cusps can never emit an infinitely long spike.
 * - "left/right" follow the direction of travel along the path. Reversing
 *   the path remaps `t -> 1-t` and swaps the sides, keeping the visual
 *   result identical while the named sides stay direction-correct.
 */

export interface Sample {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  t: number;
  s: number;
}
export interface Frame {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
}

const DEFAULT_QUALITY = 16;
const MIN_QUALITY = 4;
const MAX_QUALITY = 48;
/** Miter length as a multiple of the half-width before we switch to bevel. */
const MITER_LIMIT = 4;
const ROUND_CAP_STEPS = 7;

export function shapeQuality(s: Shape): number {
  const q = s.quality ?? DEFAULT_QUALITY;
  return Math.max(MIN_QUALITY, Math.min(MAX_QUALITY, Math.round(q)));
}
export function isVariable(s: Shape): boolean {
  return !!s.taper && s.taper.length > 0;
}

function cubic(a: Node, b: Node, u: number): Point {
  const p0 = a,
    p1 = a.out,
    p2 = b.in,
    p3 = b;
  const mu = 1 - u;
  const mu2 = mu * mu,
    u2 = u * u;
  return {
    x:
      mu2 * mu * p0.x + 3 * mu2 * u * p1.x + 3 * mu * u2 * p2.x + u2 * u * p3.x,
    y:
      mu2 * mu * p0.y + 3 * mu2 * u * p1.y + 3 * mu * u2 * p2.y + u2 * u * p3.y,
  };
}
function cubicDerivative(a: Node, b: Node, u: number): Point {
  const p0 = a,
    p1 = a.out,
    p2 = b.in,
    p3 = b;
  const mu = 1 - u;
  return {
    x:
      3 * mu * mu * (p1.x - p0.x) +
      6 * mu * u * (p2.x - p1.x) +
      3 * u * u * (p3.x - p2.x),
    y:
      3 * mu * mu * (p1.y - p0.y) +
      6 * mu * u * (p2.y - p1.y) +
      3 * u * u * (p3.y - p2.y),
  };
}

/** Each cubic segment, wrapping around for closed paths. */
function segments(s: Shape): [Node, Node][] {
  const n = s.nodes;
  const out: [Node, Node][] = [];
  if (n.length < 2) return out;
  const span = n.length - 1 + (s.closed ? 1 : 0);
  for (let i = 0; i < span; i++) out.push([n[i], n[(i + 1) % n.length]]);
  return out;
}

/** Flatten the path into evenly parameterized samples with arc lengths. */
export function flatten(s: Shape): Sample[] {
  const segs = segments(s);
  if (!segs.length) return [];
  const steps = shapeQuality(s);
  const out: Sample[] = [];
  let sAcc = 0;
  let prev: Point | null = null;
  let tIndex = 0;
  const totalCells = segs.length * steps;
  for (const [a, b] of segs) {
    for (let k = 0; k < steps; k++) {
      const u = k / steps;
      const p = cubic(a, b, u);
      const d = cubicDerivative(a, b, u);
      if (prev) sAcc += Math.hypot(p.x - prev.x, p.y - prev.y);
      const len = Math.hypot(d.x, d.y) || 1;
      out.push({
        x: p.x,
        y: p.y,
        tx: d.x / len,
        ty: d.y / len,
        // Normal = tangent rotated 90° counter-clockwise (points "left").
        nx: -d.y / len,
        ny: d.x / len,
        t: tIndex / totalCells,
        s: sAcc,
      });
      prev = p;
      tIndex++;
    }
  }
  // Final point at u = 1.
  const last = segs[segs.length - 1];
  const pEnd = cubic(last[0], last[1], 1);
  const dEnd = cubicDerivative(last[0], last[1], 1);
  if (prev) sAcc += Math.hypot(pEnd.x - prev.x, pEnd.y - prev.y);
  const lenEnd = Math.hypot(dEnd.x, dEnd.y) || 1;
  out.push({
    x: pEnd.x,
    y: pEnd.y,
    tx: dEnd.x / lenEnd,
    ty: dEnd.y / lenEnd,
    nx: -dEnd.y / lenEnd,
    ny: dEnd.x / lenEnd,
    t: 1,
    s: sAcc,
  });
  return out;
}

export function totalLength(samples: Sample[]): number {
  return samples.length ? samples[samples.length - 1].s : 0;
}

/** Position and oriented frame at an arc-length fraction t (0..1). */
export function frameAt(samples: Sample[], t: number): Frame | null {
  if (!samples.length) return null;
  const total = totalLength(samples);
  if (!total) {
    const q = samples[0];
    return { x: q.x, y: q.y, tx: q.tx, ty: q.ty, nx: q.nx, ny: q.ny };
  }
  const target = Math.max(0, Math.min(1, t)) * total;
  let lo = 0,
    hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].s < target) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const a = samples[i - 1],
    b = samples[i];
  const span = b.s - a.s;
  const f = span ? (target - a.s) / span : 0;
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    tx: a.tx + (b.tx - a.tx) * f,
    ty: a.ty + (b.ty - a.ty) * f,
    nx: a.nx + (b.nx - a.nx) * f,
    ny: a.ny + (b.ny - a.ny) * f,
  };
}

/** Half-width on each side at arc-length fraction t. */
export function widthAt(s: Shape, t: number): { left: number; right: number } {
  const base = Math.max(0, s.width) / 2;
  const stops = s.taper ?? [];
  if (!stops.length) return { left: base, right: base };
  const ordered = [...stops].sort((a, b) => a.t - b.t);
  const x = Math.max(0, Math.min(1, t));
  let p0: WidthStop, p1: WidthStop;
  if (s.closed) {
    // Periodic interpolation around the loop.
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const ext: WidthStop[] = [
      { ...last, t: last.t - 1 },
      ...ordered,
      { ...first, t: first.t + 1 },
    ];
    let idx = 0;
    while (idx < ext.length - 1 && ext[idx + 1].t < x) idx++;
    p0 = ext[idx];
    p1 = ext[Math.min(idx + 1, ext.length - 1)];
  } else {
    if (x <= ordered[0].t) {
      const q = ordered[0];
      return { left: q.left, right: q.right };
    }
    if (x >= ordered[ordered.length - 1].t) {
      const q = ordered[ordered.length - 1];
      return { left: q.left, right: q.right };
    }
    let idx = 0;
    while (idx < ordered.length - 1 && ordered[idx + 1].t < x) idx++;
    p0 = ordered[idx];
    p1 = ordered[idx + 1];
  }
  const span = p1.t - p0.t;
  const f = span ? (x - p0.t) / span : 0;
  return {
    left: Math.max(0, p0.left + (p1.left - p0.left) * f),
    right: Math.max(0, p0.right + (p1.right - p0.right) * f),
  };
}

/** Nearest point on the flattened path to a pointer; returns arc fraction. */
export function nearestT(
  samples: Sample[],
  p: Point,
): { t: number; dist: number; point: Point } | null {
  if (!samples.length) return null;
  let best = {
    t: 0,
    dist: Infinity,
    point: { x: samples[0].x, y: samples[0].y },
  };
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i],
      b = samples[i + 1];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let f = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
    f = Math.max(0, Math.min(1, f));
    const qx = a.x + dx * f,
      qy = a.y + dy * f;
    const dist = Math.hypot(p.x - qx, p.y - qy);
    if (dist < best.dist) {
      best = {
        t: a.t + (b.t - a.t) * f,
        dist,
        point: { x: qx, y: qy },
      };
    }
  }
  return best;
}

interface SidePoint {
  x: number;
  y: number;
}

/**
 * Offset one side. `side` is +1 for the left (normal direction) and -1 for
 * the right. Adjacent runs are joined with a clamped miter that falls back
 * to a bevel, which guarantees no unbounded spike at corners or hairpins.
 */
function offsetSide(samples: Sample[], s: Shape, side: 1 | -1): SidePoint[] {
  const closed = s.closed;
  const n = samples.length;
  const ring: SidePoint[] = [];
  for (let i = 0; i < n; i++) {
    const smp = samples[i];
    const w = widthAt(s, smp.t)[side === 1 ? "left" : "right"];
    ring.push({ x: smp.x + side * smp.nx * w, y: smp.y + side * smp.ny * w });
  }
  if (!closed) return ring;

  const pts: SidePoint[] = [];
  const count = n - 1; // number of unique samples around the loop
  for (let i = 0; i < count; i++) {
    const prev = samples[(i - 1 + count) % count];
    const cur = samples[i];
    const next = samples[(i + 1) % count];
    const w = widthAt(s, cur.t)[side === 1 ? "left" : "right"];
    const dot = prev.tx * next.tx + prev.ty * next.ty;
    // Hairpin / fold: bevel instead of miter.
    if (dot < -0.94) {
      pts.push(ring[i]);
      continue;
    }
    // Intersect the two offset run lines in miter form.
    const pA = ring[(i - 1 + count) % count],
      pB = ring[i];
    const pC = ring[i],
      pD = ring[(i + 1) % count];
    const r1x = pB.x - pA.x,
      r1y = pB.y - pA.y;
    const r2x = pD.x - pC.x,
      r2y = pD.y - pC.y;
    const cross = r1x * r2y - r1y * r2x;
    if (Math.abs(cross) < 1e-9) {
      pts.push(pB);
      continue;
    }
    const k = ((pC.x - pA.x) * r2y - (pC.y - pA.y) * r2x) / cross;
    const mx = pA.x + r1x * k,
      my = pA.y + r1y * k;
    // Clamp the miter reach to the miter limit; beyond it, bevel.
    const reach = Math.hypot(mx - cur.x, my - cur.y);
    if (reach > w * MITER_LIMIT + 1e-6) {
      pts.push(pB);
    } else {
      pts.push({ x: mx, y: my });
    }
  }
  return pts;
}

function fmt(v: number): string {
  return Math.round(v * 100) / 100 + "";
}
function ringToPath(pts: SidePoint[], closed: boolean): string {
  if (!pts.length) return "";
  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++)
    d += ` L ${fmt(pts[i].x)} ${fmt(pts[i].y)}`;
  return d + (closed ? " Z" : "");
}

/**
 * Build the filled outline path string for a (variable-width) shape.
 * Returns "" when there is not enough geometry.
 */
export function outlinePath(s: Shape): string {
  const samples = flatten(s);
  if (samples.length < 2) return "";
  const closed = s.closed;
  const left = offsetSide(samples, s, 1);
  const right = offsetSide(samples, s, -1);
  if (!left.length || !right.length) return "";

  if (closed) {
    const all = left.concat(right.slice().reverse());
    return ringToPath(all, true);
  }

  // Open path: left edge forward, round end cap, right edge backward,
  // round start cap — one closed polygon.
  const start = samples[0];
  const end = samples[samples.length - 1];
  // Semicircular cap built from the two concrete edge points and the
  // outward direction. Everything is expressed in absolute coordinates, so
  // the identical physical cap is produced regardless of path direction:
  // reversing flips both tangent and normal and leaves these values intact.
  const capPts = (
    smp: Sample,
    leftEdge: SidePoint,
    rightEdge: SidePoint,
    outward: 1 | -1,
  ): SidePoint[] => {
    const cx = (leftEdge.x + rightEdge.x) / 2;
    const cy = (leftEdge.y + rightEdge.y) / 2;
    const radius =
      Math.hypot(leftEdge.x - rightEdge.x, leftEdge.y - rightEdge.y) / 2;
    const ox = outward * smp.tx,
      oy = outward * smp.ty;
    // Unit vector from the cap center toward the left edge.
    let ex = (leftEdge.x - cx) / (radius || 1);
    let ey = (leftEdge.y - cy) / (radius || 1);
    const el = Math.hypot(ex, ey) || 1;
    ex /= el;
    ey /= el;
    const arc: SidePoint[] = [];
    for (let k = 0; k <= ROUND_CAP_STEPS; k++) {
      const ang = (k / ROUND_CAP_STEPS) * Math.PI;
      // Start at the right edge (ang=0 -> -edge axis), sweep over the
      // outward tip, finish at the left edge.
      const ca = Math.cos(ang),
        sa = Math.sin(ang);
      arc.push({
        x: cx - radius * ex * ca + radius * ox * sa,
        y: cy - radius * ey * ca + radius * oy * sa,
      });
    }
    return arc;
  };

  const startL = left[0],
    startR = right[0];
  const endL = left[left.length - 1],
    endR = right[right.length - 1];
  let d = `M ${fmt(left[0].x)} ${fmt(left[0].y)}`;
  for (let i = 1; i < left.length; i++)
    d += ` L ${fmt(left[i].x)} ${fmt(left[i].y)}`;
  for (const c of capPts(end, endL, endR, 1)) d += ` L ${fmt(c.x)} ${fmt(c.y)}`;
  for (let i = right.length - 1; i >= 0; i--)
    d += ` L ${fmt(right[i].x)} ${fmt(right[i].y)}`;
  for (const c of capPts(start, startL, startR, -1))
    d += ` L ${fmt(c.x)} ${fmt(c.y)}`;
  return d + " Z";
}

/** A render descriptor shared by canvas preview and SVG export. */
export interface RenderSpec {
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  asFill: boolean;
}

export function renderSpec(s: Shape): RenderSpec {
  const variable = isVariable(s);
  if (variable || s.expanded) {
    return {
      d: outlinePath(s),
      fill: s.stroke,
      stroke: "none",
      strokeWidth: 0,
      asFill: true,
    };
  }
  return {
    d: centerPath(s),
    fill: s.fill,
    stroke: s.stroke,
    strokeWidth: s.width,
    asFill: false,
  };
}

/** The original centerline path, kept editable regardless of expansion. */
export function centerPath(s: Shape): string {
  if (!s.nodes.length) return "";
  let d = `M ${s.nodes[0].x} ${s.nodes[0].y}`;
  const n = s.nodes;
  for (let i = 1; i < n.length + (s.closed ? 1 : 0); i++) {
    const a = n[i - 1],
      b = n[i % n.length];
    d += ` C ${a.out.x} ${a.out.y} ${b.in.x} ${b.in.y} ${b.x} ${b.y}`;
  }
  return d + (s.closed ? " Z" : "");
}
