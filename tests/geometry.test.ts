import {
  flatten,
  frameAt,
  nearestT,
  outlinePath,
  widthAt,
  totalLength,
  renderSpec,
  centerPath,
} from "../src/features/taper/lib/geometry";
import type { Shape, Node } from "../src/shared/types";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log("  ok  -", name);
  } else {
    failures++;
    console.error("FAIL  -", name, detail);
  }
}
function approx(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function node(x: number, y: number): Node {
  return { x, y, in: { x: x - 20, y }, out: { x: x + 20, y } };
}
function straightShape(): Shape {
  return {
    id: "s",
    name: "s",
    nodes: [node(0, 0), node(100, 0), node(200, 0)],
    closed: false,
    fill: "none",
    stroke: "#000000",
    width: 10,
    opacity: 1,
    taper: [
      { t: 0, left: 5, right: 5 },
      { t: 1, left: 5, right: 5 },
    ],
  };
}
/** Mirror of the app's reversePath, expressed on plain data. */
function reverse(s: Shape): Shape {
  const r: Shape = JSON.parse(JSON.stringify(s));
  r.nodes = r.nodes
    .slice()
    .reverse()
    .map((n) => ({ x: n.x, y: n.y, in: { ...n.out }, out: { ...n.in } }));
  // Stored side labels are swapped; the flipped tangent does the geometric
  // mirror, together yielding the same visual boundary.
  r.taper = r.taper!.map((w) => ({ t: 1 - w.t, left: w.right, right: w.left }));
  return r;
}
function points(d: string): [number, number][] {
  return d
    .match(/-?\d+(\.\d+)?/g)!
    .map(Number)
    .reduce(
      (acc: [number, number][], _v, i, arr) =>
        i % 2 === 0 ? [...acc, [arr[i], arr[i + 1]]] : acc,
      [],
    );
}
function hausdorff(a: string, b: string): number {
  const A = points(a);
  const B = points(b);
  const gap = (P: [number, number][], Q: [number, number][]) =>
    Math.max(
      ...P.map((p) =>
        Math.min(...Q.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))),
      ),
    );
  return Math.max(gap(A, B), gap(B, A));
}

console.log("arc-length anchoring");
{
  const s = straightShape();
  const samples = flatten(s);
  const L = totalLength(samples);
  check("total length ~200", approx(L, 200, 1e-3), String(L));
  const mid = frameAt(samples, 0.5)!;
  check("frame t=.5 at x~100", approx(mid.x, 100, 0.6), `${mid.x}`);
  check(
    "tangent points +X",
    approx(mid.tx, 1, 1e-3) && approx(mid.ty, 0, 1e-3),
  );
  check(
    "normal points +Y (left side up)",
    approx(mid.nx, 0, 1e-3) && approx(mid.ny, 1, 1e-3),
  );
  const hit = nearestT(samples, { x: 140, y: 37 })!;
  check(
    "nearestT tracks arc progress",
    approx(hit.t, 0.7, 0.02),
    String(hit.t),
  );
}

console.log("asymmetric sides and direction semantics");
{
  const s = straightShape();
  s.taper = [
    { t: 0, left: 8, right: 2 },
    { t: 1, left: 8, right: 2 },
  ];
  const w = widthAt(s, 0.5);
  check("interpolated widths", approx(w.left, 8) && approx(w.right, 2));
  const f = frameAt(flatten(s), 0.5)!;
  check("left edge on +normal", approx(f.y + f.ny * 8, 8, 1e-3));
  check("right edge on -normal", approx(f.y - f.ny * 2, -2, 1e-3));
}

console.log("no infinite spikes on hairpin / sharp cusp");
{
  const a = node(0, 0);
  const b = node(100, 0);
  const c = node(0, 0);
  const s: Shape = {
    id: "fold",
    name: "fold",
    nodes: [a, b, c],
    closed: false,
    fill: "none",
    stroke: "#000000",
    width: 20,
    opacity: 1,
    taper: [
      { t: 0, left: 10, right: 10 },
      { t: 1, left: 10, right: 10 },
    ],
  };
  const nums = outlinePath(s)
    .match(/-?\d+(\.\d+)?/g)!
    .map(Number);
  check(
    "all outline coordinates finite",
    nums.every((n) => Number.isFinite(n)),
  );
  const maxAbs = Math.max(...nums.map((n) => Math.abs(n)));
  check("no runaway spike beyond bounded miter", maxAbs < 400, `max=${maxAbs}`);
}

console.log("closed path miter stays bounded on a spike cusp");
{
  const pts = [
    { x: 0, y: 0 },
    { x: 100, y: 1 },
    { x: 100, y: -1 },
  ];
  const nodes = pts.map((p) => ({
    x: p.x,
    y: p.y,
    in: { x: p.x - 10, y: p.y },
    out: { x: p.x + 10, y: p.y },
  }));
  const s: Shape = {
    id: "tri",
    name: "tri",
    nodes,
    closed: true,
    fill: "none",
    stroke: "#000000",
    width: 30,
    opacity: 1,
    taper: [
      { t: 0, left: 15, right: 15 },
      { t: 1, left: 15, right: 15 },
    ],
  };
  const nums = outlinePath(s)
    .match(/-?\d+(\.\d+)?/g)!
    .map(Number);
  check(
    "closed outline finite",
    nums.every((n) => Number.isFinite(n)),
  );
  const maxAbs = Math.max(...nums.map((n) => Math.abs(n)));
  check("closed miter clamped", maxAbs < 180, `max=${maxAbs}`);
}

console.log("reverse keeps visual outline, swaps named sides");
{
  const s = straightShape();
  s.taper = [
    { t: 0, left: 8, right: 2 },
    { t: 0.5, left: 6, right: 4 },
    { t: 1, left: 2, right: 8 },
  ];
  const h = hausdorff(outlinePath(s), outlinePath(reverse(s)));
  check(
    "reversed outline is the same visual boundary",
    h < 0.05,
    `hausdorff=${h}`,
  );
  // The physical start after reversal is the old end; labels stay correct.
  const wStart = widthAt(reverse(s), 0);
  check(
    "old end width now sits at reversed start",
    approx(wStart.left, 8) && approx(wStart.right, 2),
  );

  const sym = straightShape();
  const hSym = hausdorff(outlinePath(sym), outlinePath(reverse(sym)));
  check(
    "symmetric outline is exactly reversal-invariant",
    hSym < 0.05,
    `hausdorff=${hSym}`,
  );
}

console.log("node move keeps stop at curve progress, not node index");
{
  const s = straightShape();
  s.taper = [
    { t: 0, left: 5, right: 5 },
    { t: 0.25, left: 9, right: 1 },
    { t: 1, left: 5, right: 5 },
  ];
  const before = frameAt(flatten(s), 0.25)!;
  s.nodes.forEach((n) => {
    n.y += 50;
    n.in.y += 50;
    n.out.y += 50;
  });
  const after = frameAt(flatten(s), 0.25)!;
  check(
    "stop progress survives node move",
    approx(after.x, before.x, 1) && approx(after.y, before.y + 50, 1),
  );
  check(
    "width still attached at same progress",
    approx(widthAt(s, 0.25).left, 9),
  );
}

console.log("render/export parity");
{
  const uniform = straightShape();
  uniform.taper = [];
  const ru = renderSpec(uniform);
  check(
    "uniform renders as stroked centerline",
    !ru.asFill && ru.strokeWidth === 10 && ru.d === centerPath(uniform),
  );
  const variable = straightShape();
  const rv = renderSpec(variable);
  check(
    "variable renders as filled outline",
    rv.asFill && rv.fill === variable.stroke && rv.stroke === "none",
  );
  const expanded = straightShape();
  expanded.taper = [];
  expanded.expanded = true;
  const re = renderSpec(expanded);
  check(
    "expanded uniform becomes a fill outline",
    re.asFill && re.d.length > 0,
  );
}

console.log("closed periodic width interpolation");
{
  const s = straightShape();
  s.closed = true;
  s.taper = [
    { t: 0.1, left: 2, right: 2 },
    { t: 0.9, left: 10, right: 10 },
  ];
  const w0 = widthAt(s, 0);
  const wMid = widthAt(s, 0.95);
  check(
    "periodic wrap finite",
    Number.isFinite(w0.left) && Number.isFinite(wMid.left),
  );
  check(
    "wrap interpolation between .9 and .1",
    wMid.left > 2 && wMid.left < 10,
    String(wMid.left),
  );
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll geometry checks passed");
