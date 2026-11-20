import { doc } from "../../../shared/document";
export function seed() {
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4,
      cx = 400 + Math.cos(a) * 100,
      cy = 280 + Math.sin(a) * 100;
    const nodes = Array.from({ length: 4 }, (_, i) => {
      const t = (i * Math.PI) / 2;
      const x = cx + Math.cos(t) * 65,
        y = cy + Math.sin(t) * 65;
      return {
        x,
        y,
        in: { x: x + Math.sin(t) * 36, y: y - Math.cos(t) * 36 },
        out: { x: x - Math.sin(t) * 36, y: y + Math.cos(t) * 36 },
      };
    });
    doc.shapes.push({
      id: "petal" + k,
      name: "Petal " + (k + 1),
      nodes,
      closed: true,
      fill: ["#7850d6", "#a685ed", "#cbb9f4", "#523391"][k % 4],
      stroke: "#ffffff",
      width: 2,
      opacity: 1,
    });
  }
  // Open, variable-width calligraphic stroke with asymmetric sides.
  const strokeNodes = [
    { x: 150, y: 470, in: { x: 120, y: 430 }, out: { x: 200, y: 500 } },
    { x: 330, y: 380, in: { x: 270, y: 430 }, out: { x: 400, y: 330 } },
    { x: 520, y: 430, in: { x: 450, y: 470 }, out: { x: 590, y: 390 } },
    { x: 660, y: 330, in: { x: 620, y: 380 }, out: { x: 700, y: 290 } },
  ];
  doc.shapes.push({
    id: "ribbon",
    name: "Ribbon stroke",
    nodes: strokeNodes,
    closed: false,
    fill: "none",
    stroke: "#e0659c",
    width: 6,
    opacity: 1,
    quality: 20,
    taper: [
      { t: 0, left: 1, right: 1 },
      { t: 0.35, left: 9, right: 3 },
      { t: 0.7, left: 4, right: 10 },
      { t: 1, left: 1.5, right: 1.5 },
    ],
  });
}
