<script setup lang="ts">
import { computed } from "vue";
import { active } from "../model/active";
import { style } from "../model/style";
import { colors } from "../lib/colors";
import {
  enableVariableAction,
  disableVariable,
  removeStop,
  setSide,
  reversePath,
  setExpanded,
  setQuality,
  isVariable,
  shapeQuality,
} from "../../taper";
import type { WidthStop } from "../../../shared/types";

const stops = computed(() =>
  active.value && active.value.taper
    ? [...active.value.taper].sort((a, b) => a.t - b.t)
    : [],
);
function pct(w: WidthStop) {
  return Math.round(w.t * 100) + "%";
}
</script>
<template>
  <aside>
    <h3>Design <span>•••</span></h3>
    <template v-if="active"
      ><h4>APPEARANCE</h4>
      <label
        >Fill
        <input
          aria-label="Fill"
          type="color"
          :value="active.fill === 'none' ? '#ffffff' : active.fill"
          @input="style('fill', ($event.target as HTMLInputElement).value)"
      /></label>
      <div class="swatches">
        <button
          v-for="c in colors"
          :style="{ background: c }"
          @click="style('fill', c)"
        ></button>
      </div>
      <label
        >Stroke
        <input
          aria-label="Stroke"
          type="color"
          :value="active.stroke"
          @input="
            style('stroke', ($event.target as HTMLInputElement).value)
          " /></label
      ><label
        >Weight
        <input
          type="number"
          min="0"
          max="30"
          :value="active.width"
          @input="
            style('width', +($event.target as HTMLInputElement).value)
          " /></label
      ><label
        >Opacity
        <input
          aria-label="Opacity"
          type="range"
          min="0"
          max="1"
          step=".01"
          :value="active.opacity"
          @input="style('opacity', +($event.target as HTMLInputElement).value)"
      /></label>
      <h4>VARIABLE WIDTH</h4>
      <p v-if="!isVariable(active)">
        A uniform stroke. Enable width stops to vary the weight along the path.
      </p>
      <button
        v-if="!isVariable(active)"
        class="block-btn"
        data-testid="enable-taper"
        @click="enableVariableAction(active)"
      >
        Enable variable width
      </button>
      <template v-else>
        <p>
          Stops are anchored to curve progress, so they follow the path when
          nodes move. Left / right are measured from the direction of travel.
        </p>
        <div class="stop" v-for="w in stops" :key="w.t">
          <span class="stop-pos">{{ pct(w) }}</span>
          <label
            >L
            <input
              type="number"
              min="0"
              step="0.5"
              :value="Math.round(w.left * 10) / 10"
              @input="
                setSide(
                  active,
                  w.t,
                  'left',
                  +($event.target as HTMLInputElement).value,
                )
              "
          /></label>
          <label
            >R
            <input
              type="number"
              min="0"
              step="0.5"
              :value="Math.round(w.right * 10) / 10"
              @input="
                setSide(
                  active,
                  w.t,
                  'right',
                  +($event.target as HTMLInputElement).value,
                )
              "
          /></label>
          <button
            class="stop-del"
            data-testid="remove-stop"
            :disabled="stops.length <= 2"
            @click="removeStop(active, w.t)"
          >
            ✕
          </button>
        </div>
        <label
          >Outline detail
          <input
            type="range"
            min="4"
            max="48"
            step="1"
            :value="shapeQuality(active)"
            @input="
              setQuality(active, +($event.target as HTMLInputElement).value)
            "
        /></label>
        <p class="hint">
          Higher detail gives a smoother expanded outline but more points.
        </p>
        <button class="block-btn" @click="reversePath(active)">
          Reverse path direction
        </button>
        <label class="inline"
          >Expand to filled outline
          <input
            type="checkbox"
            :checked="!!active.expanded"
            data-testid="expand-toggle"
            @change="
              setExpanded(active, ($event.target as HTMLInputElement).checked)
            "
        /></label>
        <button class="block-btn" @click="disableVariable(active)">
          Back to uniform stroke
        </button>
      </template>
      <h4>PATH DETAILS</h4>
      <p>{{ active.nodes.length }} anchor points</p>
      <label
        >Closed path
        <input
          type="checkbox"
          :checked="active.closed"
          @change="
            style('closed', ($event.target as HTMLInputElement).checked)
          " /></label
    ></template>
    <p v-else>Select an object to edit its appearance.</p>
    <div class="tip">
      ✦ Make room for ideas.<br /><small
        >Every great shape starts with a point.</small
      >
    </div>
  </aside>
</template>
