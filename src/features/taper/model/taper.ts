import { beginEdit } from "../../drawing";
import type { Point, Shape, WidthStop } from "../../../shared/types";
import { flatten, frameAt, nearestT, widthAt } from "../lib/geometry";

function clampT(s: Shape, t: number): number {
  if (s.closed) return ((t % 1) + 1) % 1;
  return Math.max(0, Math.min(1, t));
}

/** Turn a uniform stroke into a variable-width one with end/start stops.
 *  Pure mutation: callers open the history entry (beginEdit) themselves. */
export function enableVariable(s: Shape) {
  if (s.taper && s.taper.length) return;
  const half = Math.max(0, s.width) / 2;
  s.taper = [
    { t: 0, left: half, right: half },
    { t: 1, left: half, right: half },
  ];
}

/** UI action: open an undo entry, then convert to variable width. */
export function enableVariableAction(s: Shape) {
  beginEdit();
  enableVariable(s);
}

export function disableVariable(s: Shape) {
  beginEdit();
  s.taper = [];
  s.expanded = false;
}

/** Add (or reuse) a width stop at the curve progress nearest the pointer. */
export function addStopAt(s: Shape, p: Point): WidthStop | undefined {
  const samples = flatten(s);
  const hit = nearestT(samples, p);
  if (!hit) return;
  if (!s.taper) s.taper = [];
  const t = clampT(s, hit.t);
  const existing = s.taper!.find((w) => Math.abs(w.t - t) < 0.01);
  if (existing) return existing;
  const w = widthAt(s, t);
  const stop: WidthStop = { t, left: w.left, right: w.right };
  s.taper!.push(stop);
  s.taper!.sort((a, b) => a.t - b.t);
  return stop;
}

export function removeStop(s: Shape, t: number) {
  if (!s.taper) return;
  beginEdit();
  s.taper = s.taper.filter((w) => Math.abs(w.t - t) > 1e-6);
}

export function setSide(
  s: Shape,
  t: number,
  side: "left" | "right",
  v: number,
) {
  const stop = s.taper?.find((w) => Math.abs(w.t - t) < 1e-6);
  if (!stop) return;
  beginEdit();
  stop[side] = Math.max(0, v);
}

/** Drag a stop along the path: it follows arc-length progress, not nodes. */
export function moveStop(s: Shape, stop: WidthStop, p: Point) {
  const hit = nearestT(flatten(s), p);
  if (!hit) return;
  stop.t = clampT(s, hit.t);
}

/** Drag the left/right edge handle; keeps the stop anchored at its progress. */
export function resizeStop(
  s: Shape,
  stop: WidthStop,
  side: "left" | "right",
  p: Point,
) {
  const frame = frameAt(flatten(s), stop.t);
  if (!frame) return;
  const d = (p.x - frame.x) * frame.nx + (p.y - frame.y) * frame.ny;
  // Left side sits on +normal, right side on -normal.
  stop[side] = Math.max(0, side === "left" ? d : -d);
}

/**
 * Reverse the centerline direction.
 * Progress is remapped t -> 1-t (periodic for closed loops) so every stop
 * stays on the same physical curve point. Reversing the nodes flips the
 * geometric normal, which already mirrors the two sides; swapping the stored
 * left/right labels on top keeps each label pointing at its original screen
 * side. The combined result is an identical visual outline (verified by the
 * geometry tests) with direction-correct left/right semantics.
 */
export function reversePath(s: Shape) {
  beginEdit();
  if (s.taper?.length) {
    s.taper = s.taper.map((w) => ({
      t: s.closed ? (1 - w.t) % 1 : clampT(s, 1 - w.t),
      left: w.right,
      right: w.left,
    }));
    s.taper.sort((a, b) => a.t - b.t);
  }
  // Reverse node order and mirror each handle.
  const nodes = s.nodes
    .slice()
    .reverse()
    .map((n) => ({
      x: n.x,
      y: n.y,
      in: { ...n.out },
      out: { ...n.in },
    }));
  s.nodes = nodes;
}

export function setExpanded(s: Shape, value: boolean) {
  beginEdit();
  if (value && (!s.taper || !s.taper.length)) enableVariable(s);
  s.expanded = value;
}

export function setQuality(s: Shape, q: number) {
  beginEdit();
  s.quality = Math.max(4, Math.min(48, Math.round(q)));
}
