import {
  renderSpec,
  outlinePath,
  isVariable,
} from "../src/features/taper/lib/geometry";
import { serialize } from "../src/features/export/lib/serialize";
import type { Shape, Node } from "../src/shared/types";
let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log("  ok  -", name);
  else {
    failures++;
    console.error("FAIL  -", name, detail);
  }
}
function node(x: number, y: number): Node {
  return { x, y, in: { x: x - 20, y }, out: { x: x + 20, y } };
}
function base(): Shape {
  return {
    id: "a",
    name: "a",
    nodes: [node(0, 0), node(100, 0)],
    closed: false,
    fill: "none",
    stroke: "#112233",
    width: 8,
    opacity: 0.9,
  };
}

console.log("expansion retains centerline + width data (undo support)");
{
  const s = base();
  const before = JSON.stringify({ nodes: s.nodes, width: s.width });
  s.taper = [
    { t: 0, left: 4, right: 4 },
    { t: 1, left: 4, right: 4 },
  ];
  s.expanded = true;
  const spec = renderSpec(s);
  check(
    "expanded renders a fill outline",
    spec.asFill && spec.d.startsWith("M") && spec.fill === "#112233",
  );
  // The original editable geometry is untouched, so an undo snapshot restores it.
  const after = JSON.stringify({ nodes: s.nodes, width: s.width });
  check("centerline and width retained while expanded", before === after);
  check("taper settings retained while expanded", s.taper!.length === 2);
  s.expanded = false;
  check(
    "toggling expansion off keeps the variable-width outline (data preserved)",
    renderSpec(s).asFill && isVariable(s),
  );
  // Clearing taper is what returns to a stroked centerline.
  s.taper = [];
  s.expanded = false;
  check("clearing taper restores stroked centerline", !renderSpec(s).asFill);
}

console.log("export matches preview descriptor");
{
  const uniform = base();
  const variable = base();
  variable.id = "b";
  variable.taper = [
    { t: 0, left: 2, right: 6 },
    { t: 1, left: 6, right: 2 },
  ];
  const svg = serialize([uniform, variable]);
  const u = renderSpec(uniform);
  const v = renderSpec(variable);
  check(
    "uniform exported as stroke",
    svg.includes(`stroke="${u.stroke}"`) && svg.includes('stroke-width="8"'),
  );
  check(
    "variable exported as filled outline, no stroke",
    svg.includes(`fill="${v.fill}"`) && svg.includes('stroke="none"'),
  );
  check("exported outline d equals preview d", svg.includes(v.d));
  check(
    "document is well-formed single svg",
    svg.startsWith("<svg") && svg.endsWith("</svg>"),
  );
}

console.log("zero and degenerate widths are safe");
{
  const s = base();
  s.taper = [
    { t: 0, left: 0, right: 0 },
    { t: 1, left: 0, right: 0 },
  ];
  const d = outlinePath(s);
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  check(
    "zero-width outline finite",
    nums.every((n) => Number.isFinite(n)),
  );
  const lopsided = base();
  lopsided.taper = [
    { t: 0, left: 0, right: 10 },
    { t: 1, left: 10, right: 0 },
  ];
  const d2 = outlinePath(lopsided);
  const n2 = d2.match(/-?\d+(\.\d+)?/g)!.map(Number);
  check(
    "one-sided widths finite",
    n2.every((n) => Number.isFinite(n)),
  );
}

console.log("single-node and empty shapes do not throw");
{
  const one = base();
  one.nodes = [node(0, 0)];
  let threw = false;
  try {
    renderSpec(one);
  } catch {
    threw = true;
  }
  check("single node handled without throwing", !threw);
}

console.log("isVariable flag semantics");
{
  const s = base();
  check("no taper => uniform", !isVariable(s));
  s.taper = [];
  check("empty taper => uniform", !isVariable(s));
  s.taper = [{ t: 0, left: 1, right: 1 }];
  check("present taper => variable", isVariable(s));
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll integration checks passed");
