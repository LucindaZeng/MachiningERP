<script setup lang="ts">
import { computed } from 'vue'

import type { RankItem } from '@machining-erp/shared'

const props = defineProps<{ items: RankItem[]; unit: string }>()

const max = computed(() => Math.max(...props.items.map((item) => item.value)))
</script>

<template>
  <ul class="rank">
    <li v-for="item in items" :key="item.label">
      <div class="rank__head">
        <span class="rank__label">{{ item.label }}</span>
        <b class="rank__value">{{ item.value.toFixed(1) }} {{ unit }}</b>
      </div>
      <div class="rank__track">
        <span class="rank__bar" :style="{ width: `${(item.value / max) * 100}%` }" />
      </div>
      <p class="rank__hint">{{ item.hint }}</p>
    </li>
  </ul>
</template>

<style scoped>
.rank {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rank li {
  padding: 10px 0;
}

.rank__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.rank__label {
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.rank__value {
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.rank__track {
  height: 10px;
  margin: 6px 0 4px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 4px;
}

.rank__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
  border-radius: 4px;
}

.rank__hint {
  margin: 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}
</style>
