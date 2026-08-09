<script setup lang="ts">
import { computed } from 'vue'

import type { ShareItem } from '@/api/mock/sales/analytics.fixture'

const props = defineProps<{ items: ShareItem[]; unit: string }>()

const total = computed(() => props.items.reduce((sum, item) => sum + item.value, 0))

/** 分类色按固定顺序取用，不循环、不按大小重新配色 */
const COLORS = ['var(--viz-series-1)', 'var(--viz-series-2)', 'var(--viz-series-3)']

function share(value: number): number {
  return total.value ? (value / total.value) * 100 : 0
}
</script>

<template>
  <div class="share">
    <div class="share__bar">
      <span
        v-for="(item, index) in items"
        :key="item.key"
        class="share__segment"
        :style="{ width: `${share(item.value)}%`, background: COLORS[index] }"
        :title="`${item.label} ${share(item.value).toFixed(1)}%`"
      />
    </div>

    <ul class="share__legend">
      <li v-for="(item, index) in items" :key="item.key">
        <i :style="{ background: COLORS[index] }" aria-hidden="true"></i>
        <span class="share__label">{{ item.label }}</span>
        <b class="share__value">{{ share(item.value).toFixed(1) }}%</b>
        <em class="share__amount">{{ item.value.toFixed(1) }} {{ unit }}</em>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.share__bar {
  display: flex;
  gap: 2px;
  height: 26px;
  overflow: hidden;
  border-radius: 4px;
}

.share__segment {
  display: block;
  height: 100%;
}

.share__legend {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.share__legend li {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 7px 0;
  border-bottom: 1px dashed var(--wfx-border);
}

.share__legend li:last-child {
  border-bottom: none;
}

.share__legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.share__label {
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.share__value {
  margin-left: auto;
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.share__amount {
  min-width: 96px;
  font-size: 12px;
  font-style: normal;
  text-align: right;
  color: var(--wfx-text-muted);
}
</style>
