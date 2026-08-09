<script setup lang="ts">
import { Check, Close } from '@element-plus/icons-vue'

import { stageCounts } from '../stage-progress'
import type { TrackStage } from '@/types/sales.types'

const props = defineProps<{ stages: TrackStage[]; orderQty: string }>()
const emit = defineEmits<{ select: [TrackStage] }>()

function counts(stage: TrackStage): { done: number; total: number } {
  return stageCounts(stage, props.orderQty)
}

function tip(stage: TrackStage): string {
  const count = counts(stage)
  const parts = [`${stage.seq}. ${stage.name}`, stage.dept, `完成 ${count.done} / 工单 ${count.total} 件`]
  if (stage.actualStart) {
    parts.push(`开始 ${stage.actualStart}`)
  }
  if (stage.actualEnd) {
    parts.push(`完成 ${stage.actualEnd}`)
  }
  if (stage.qtyIn) {
    parts.push(`投入 ${stage.qtyIn}${stage.qtyOk ? ` · 合格 ${stage.qtyOk}` : ''}${stage.qtyNg ? ` · 不良 ${stage.qtyNg}` : ''}`)
  }
  if (stage.dwellHours) {
    parts.push(`停留 ${stage.dwellHours} 小时`)
  }
  if (stage.remark) {
    parts.push(stage.remark)
  }
  return parts.join('\n')
}
</script>

<template>
  <div class="bar">
    <div
      v-for="(stage, index) in stages"
      :key="stage.seq"
      class="bar__item"
      :class="`is-${stage.status}`"
    >
      <span v-if="index > 0" class="bar__link" />

      <el-tooltip :content="tip(stage)" placement="top" :show-after="120">
        <button type="button" class="bar__node" @click.stop="emit('select', stage)">
          <span class="bar__done">{{ counts(stage).done }}</span>
          <span class="bar__rule" />
          <span class="bar__total">{{ counts(stage).total }}</span>
          <el-icon v-if="stage.status === 'done'" class="bar__check"><Check /></el-icon>
          <span v-if="stage.status === 'blocked'" class="bar__badge">
            <el-icon><Close /></el-icon>
          </span>
        </button>
      </el-tooltip>

      <span class="bar__label">{{ stage.shortName }}</span>
    </div>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  padding: 6px 2px 2px;
  overflow-x: auto;
}

.bar__item {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  width: 56px;
}

.bar__link {
  position: absolute;
  top: 21px;
  right: 50%;
  left: -50%;
  border-top: 1px dashed var(--el-border-color);
}

.bar__node {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  cursor: pointer;
  background: var(--wfx-surface);
  border: 1.5px solid var(--el-border-color);
  border-radius: 50%;
  transition: transform 0.12s ease;
}

.bar__node:hover {
  transform: scale(1.08);
}

.bar__done,
.bar__total {
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--el-text-color-placeholder);
}

.bar__rule {
  width: 22px;
  height: 1px;
  background: var(--el-border-color);
}

.bar__check {
  position: absolute;
  right: -2px;
  bottom: -2px;
  font-size: 11px;
  color: var(--el-color-success);
  background: var(--wfx-surface);
  border-radius: 50%;
}

.bar__label {
  margin-top: 5px;
  font-size: 11px;
  line-height: 1.3;
  color: var(--wfx-text-muted);
  text-align: center;
  white-space: nowrap;
}

/* 已完成：实心绿 */
.is-done .bar__node {
  background: var(--el-color-success);
  border-color: var(--el-color-success);
}

.is-done .bar__done,
.is-done .bar__total {
  color: #fff;
}

.is-done .bar__rule {
  background: rgb(255 255 255 / 60%);
}

.is-done .bar__label {
  color: var(--wfx-text);
}

.is-done .bar__link {
  border-top-color: var(--el-color-success);
}

/* 进行中：实心蓝 + 白字百分比 */
.is-active .bar__node {
  background: var(--wfx-navy);
  border-color: var(--wfx-navy);
}

.is-active .bar__done,
.is-active .bar__total {
  color: #fff;
}

.is-active .bar__rule {
  background: rgb(255 255 255 / 60%);
}

.is-active .bar__label {
  font-weight: 600;
  color: var(--wfx-navy);
}

/* 受阻：蓝底 + 右上角红角标 */
.is-blocked .bar__node {
  background: var(--wfx-navy);
  border-color: var(--el-color-danger);
}

.is-blocked .bar__done,
.is-blocked .bar__total {
  color: #fff;
}

.is-blocked .bar__rule {
  background: rgb(255 255 255 / 60%);
}

.is-blocked .bar__label {
  font-weight: 600;
  color: var(--el-color-danger);
}

.bar__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  font-size: 9px;
  color: #fff;
  background: var(--el-color-danger);
  border-radius: 50%;
}
</style>
