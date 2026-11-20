export { default as WidthOverlay } from "./ui/WidthOverlay.vue";
export {
  enableVariable,
  enableVariableAction,
  disableVariable,
  addStopAt,
  removeStop,
  setSide,
  moveStop,
  resizeStop,
  reversePath,
  setExpanded,
  setQuality,
} from "./model/taper";
export {
  renderSpec,
  centerPath,
  outlinePath,
  flatten,
  frameAt,
  nearestT,
  widthAt,
  isVariable,
  shapeQuality,
} from "./lib/geometry";
export type { RenderSpec, Sample, Frame } from "./lib/geometry";
