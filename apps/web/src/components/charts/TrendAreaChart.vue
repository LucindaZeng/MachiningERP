<script setup lang="ts">
import { computed, ref } from 'vue'

import type { TrendPoint } from '@machining-erp/shared'

const props = defineProps<{ points: TrendPoint[]; unit: string }>()

const W = 1180
const H = 250
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

const hovered = ref<number | null>(null)

const max = computed(() => Math.max(...props.points.map((p) => p.amount)) * 1.12)

const coords = computed(() =>
  props.points.map((point, index) => ({
    ...point,
    x:
      PAD.left +
      (index * (W - PAD.left - PAD.right)) / Math.max(props.points.length - 1, 1),
    y: H - PAD.bottom - (point.amount / max.value) * (H - PAD.top - PAD.bottom),
  })),
)

const linePath = computed(() =>
  coords.value.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' '),
)

const areaPath = computed(
  () =>
    `${linePath.value} L${coords.value[coords.value.length - 1].x.toFixed(1)} ${H - PAD.bottom} ` +
    `L${coords.value[0].x.toFixed(1)} ${H - PAD.bottom} Z`,
)

const ticks = computed(() => {
  const step = max.value / 3
  return [0, 1, 2, 3].map((i) => ({
    value: step * i,
    y: H - PAD.bottom - (step * i * (H - PAD.top - PAD.bottom)) / max.value,
  }))
})

/** 只直接标注最新点与峰值，不给每个点都写数字 */
const peakIndex = computed(() =>
  props.points.reduce((best, p, i) => (p.amount > props.points[best].amount ? i : best), 0),
)

function onMove(event: MouseEvent): void {
  const rect = (event.currentTarget as SVGElement).getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * W
  let nearest = 0
  coords.value.forEach((c, i) => {
    if (Math.abs(c.x - x) < Math.abs(coords.value[nearest].x - x)) {
      nearest = i
    }
  })
  hovered.value = nearest
}
</script>

<template>
  <figure class="chart">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="chart__svg"
      role="img"
      aria-label="月度订单额趋势"
      @mousemove="onMove"
      @mouseleave="hovered = null"
    >
      <line
        v-for="tick in ticks"
        :key="tick.value"
        :x1="PAD.left"
        :x2="W - PAD.right"
        :y1="tick.y"
        :y2="tick.y"
        stroke="var(--viz-grid)"
        stroke-width="1"
      />
      <text
        v-for="tick in ticks"
        :key="`t${tick.value}`"
        :x="PAD.left - 8"
        :y="tick.y + 4"
        text-anchor="end"
        class="chart__tick"
      >
        {{ tick.value.toFixed(0) }}
      </text>

      <path :d="areaPath" fill="var(--viz-series-1)" opacity="0.12" />
      <path :d="linePath" fill="none" stroke="var(--viz-series-1)" stroke-width="2" />

      <template v-for="(c, i) in coords" :key="c.label">
        <circle
          v-if="i === peakIndex || i === coords.length - 1 || hovered === i"
          :cx="c.x"
          :cy="c.y"
          r="5"
          fill="var(--viz-series-1)"
          stroke="#fff"
          stroke-width="2"
        />
        <text
          v-if="i === peakIndex || i === coords.length - 1"
          :x="c.x"
          :y="c.y - 12"
          text-anchor="middle"
          class="chart__value"
        >
          {{ c.amount.toFixed(1) }}
        </text>
      </template>

      <line
        v-if="hovered !== null"
        :x1="coords[hovered].x"
        :x2="coords[hovered].x"
        :y1="PAD.top"
        :y2="H - PAD.bottom"
        stroke="var(--viz-axis)"
        stroke-width="1"
        stroke-dasharray="3 3"
      />

      <text
        v-for="(c, i) in coords"
        :key="`x${c.label}`"
        :x="c.x"
        :y="H - 8"
        text-anchor="middle"
        class="chart__tick"
      >
        {{ i % 2 === 0 ? c.label.slice(2) : '' }}
      </text>
    </svg>

    <div
      v-if="hovered !== null"
      class="chart__tooltip"
      :style="{ left: `${(coords[hovered].x / W) * 100}%` }"
    >
      <b>{{ points[hovered].label }}</b>
      <span>订单额 {{ points[hovered].amount.toFixed(1) }} {{ unit }}</span>
      <span>订单数 {{ points[hovered].orders }} 张</span>
    </div>

    <figcaption class="chart__caption">
      单位：{{ unit }} · 口径：业务经理审核通过的订单按合同应收金额计入，含模具与样品订单
    </figcaption>
  </figure>
</template>

<style scoped>
.chart {
  position: relative;
  margin: 0;
}

.chart__svg {
  display: block;
  width: 100%;
  height: auto;
}

.chart__tick {
  font-size: 11px;
  fill: var(--viz-axis);
}

.chart__value {
  font-size: 12px;
  font-weight: 700;
  fill: var(--wfx-text-strong);
}

.chart__tooltip {
  position: absolute;
  top: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--wfx-text);
  pointer-events: none;
  background: #fff;
  border: 1px solid var(--wfx-border);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgb(11 53 123 / 12%);
  transform: translateX(-50%);
}

.chart__tooltip b {
  color: var(--wfx-text-strong);
}

.chart__caption {
  margin-top: 8px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}
</style>
