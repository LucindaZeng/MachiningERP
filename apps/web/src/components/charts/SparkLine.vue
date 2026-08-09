<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ values: number[]; positive?: boolean }>()

const W = 96
const H = 26

const path = computed(() => {
  const min = Math.min(...props.values)
  const max = Math.max(...props.values)
  const span = max - min || 1
  return props.values
    .map((value, index) => {
      const x = (index * W) / Math.max(props.values.length - 1, 1)
      const y = H - 3 - ((value - min) / span) * (H - 6)
      return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="spark" role="img" aria-label="近 30 日走势">
    <path
      :d="path"
      fill="none"
      :stroke="positive ? 'var(--el-color-danger)' : 'var(--viz-series-1)'"
      stroke-width="1.5"
    />
  </svg>
</template>

<style scoped>
.spark {
  display: block;
  width: 96px;
  height: 26px;
}
</style>
