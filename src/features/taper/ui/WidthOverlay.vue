<script setup lang="ts">
import { computed } from "vue";
import { beginEdit } from "../../drawing";
import { doc } from "../../../shared/document";
import type { Point, Shape, WidthStop } from "../../../shared/types";
import { flatten, frameAt, isVariable, outlinePath } from "../lib/geometry";
import { moveStop, resizeStop } from "../model/taper";

interface StopView {
  stop: WidthStop;
  cx: number;
  cy: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}

const selectedShapes = computed(() =>
  doc.shapes.filter((s) => doc.selected.includes(s.id)),
);

const views = computed(() => {
  const out: { shape: Shape; outline: string; stops: StopView[] }[] = [];
  for (const s of selectedShapes.value) {
    if (!isVariable(s)) continue;
    const samples = flatten(s);
    const stops: StopView[] = [];
    for (const stop of s.taper ?? []) {
      const f = frameAt(samples, stop.t);
      if (!f) continue;
      stops.push({
        stop,
        cx: f.x,
        cy: f.y,
        lx: f.x + f.nx * stop.left,
        ly: f.y + f.ny * stop.left,
        rx: f.x - f.nx * stop.right,
        ry: f.y - f.ny * stop.right,
      });
    }
    out.push({ shape: s, outline: outlinePath(s), stops });
  }
  return out;
});

function dragStop(e: PointerEvent, s: Shape, stop: WidthStop) {
  e.stopPropagation();
  beginEdit();
  const svg = (e.target as SVGElement).ownerSVGElement!;
  const f = (ev: PointerEvent) => {
    const p = toLocal(ev, svg);
    moveStop(s, stop, p);
  };
  window.addEventListener("pointermove", f);
  window.addEventListener(
    "pointerup",
    () => window.removeEventListener("pointermove", f),
    { once: true },
  );
}
function dragEdge(
  e: PointerEvent,
  s: Shape,
  stop: WidthStop,
  side: "left" | "right",
) {
  e.stopPropagation();
  beginEdit();
  const svg = (e.target as SVGElement).ownerSVGElement!;
  const f = (ev: PointerEvent) => resizeStop(s, stop, side, toLocal(ev, svg));
  window.addEventListener("pointermove", f);
  window.addEventListener(
    "pointerup",
    () => window.removeEventListener("pointermove", f),
    { once: true },
  );
}
function toLocal(e: PointerEvent, svg: SVGSVGElement): Point {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
    svg.getScreenCTM()!.inverse(),
  );
  return { x: p.x, y: p.y };
}
</script>
<template>
  <g v-for="v in views" :key="v.shape.id">
    <path
      :d="v.outline"
      fill="none"
      stroke="#8055df"
      stroke-dasharray="3 3"
      stroke-width="1"
      opacity="0.55"
    />
    <g v-for="sv in v.stops" :key="sv.stop.t">
      <line
        :x1="sv.lx"
        :y1="sv.ly"
        :x2="sv.rx"
        :y2="sv.ry"
        stroke="#8055df"
        stroke-width="1"
      />
      <circle
        :cx="sv.lx"
        :cy="sv.ly"
        r="4"
        fill="#fff"
        stroke="#8055df"
        data-testid="width-left"
        @pointerdown="dragEdge($event, v.shape, sv.stop, 'left')"
      />
      <circle
        :cx="sv.rx"
        :cy="sv.ry"
        r="4"
        fill="#fff"
        stroke="#8055df"
        data-testid="width-right"
        @pointerdown="dragEdge($event, v.shape, sv.stop, 'right')"
      />
      <rect
        :x="sv.cx - 4"
        :y="sv.cy - 4"
        width="8"
        height="8"
        fill="#8055df"
        stroke="#fff"
        data-testid="width-stop"
        @pointerdown="dragStop($event, v.shape, sv.stop)"
      />
    </g>
  </g>
</template>
