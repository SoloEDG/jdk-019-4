import type { Shape } from "../../../shared/types";
import { renderSpec } from "../../taper/lib/geometry";

export function serialize(shapes: Shape[]) {
  let content = "",
    group: string | undefined;
  shapes.forEach((s, i) => {
    if (s.group !== group) {
      if (group) content += "</g>";
      group = s.group;
      if (group) content += `<g id="group-${group}-${i}">`;
    }
    const spec = renderSpec(s);
    content += `<path d="${spec.d}" fill="${spec.fill}" stroke="${spec.stroke}"${
      spec.strokeWidth ? ` stroke-width="${spec.strokeWidth}"` : ""
    } opacity="${s.opacity}"/>`;
  });
  if (group) content += "</g>";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">${content}</svg>`;
}
