<script setup lang="ts">
import { computed } from 'vue'

import type { FunnelStage } from '@machining-erp/shared'

const props = defineProps<{ stages: FunnelStage[] }>()

const max = computed(() => props.stages[0]?.value ?? 1)

function stepRate(index: number): string {
  if (index === 0) {
    return '—'
  }
  const prev = props.stages[index - 1].value
  return prev ? `${((props.stages[index].value / prev) * 100).toFixed(1)}%` : '—'
}
</script>

<template>
  <ul class="funnel">
    <li v-for="(stage, index) in stages" :key="stage.label">
      <div class="funnel__head">
        <span class="funnel__label">{{ stage.label }}</span>
        <b class="funnel__value">{{ stage.value }}</b>
        <span class="funnel__rate">环比上一环节 {{ stepRate(index) }}</span>
      </div>
      <div class="funnel__track">
        <span class="funnel__bar" :style="{ width: `${(stage.value / max) * 100}%` }" />
      </div>
      <p class="funnel__hint">{{ stage.hint }}</p>
    </li>
  </ul>
</template>

<style scoped>
.funnel {
  margin: 0;
  padding: 0;
  list-style: none;
}

.funnel li {
  padding: 9px 0;
}

.funnel__head {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.funnel__label {
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.funnel__value {
  font-size: 15px;
  color: var(--wfx-text-strong);
}

.funnel__rate {
  margin-left: auto;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.funnel__track {
  height: 12px;
  margin: 6px 0 4px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 4px;
}

.funnel__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
  border-radius: 4px;
}

.funnel__hint {
  margin: 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}
</style>
