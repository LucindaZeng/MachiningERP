<script setup lang="ts">
import { computed } from 'vue'

import type { OrderTracking, TrackStage } from '@/types/sales.types'

const props = defineProps<{ modelValue: boolean; tracking: OrderTracking | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const RISK: Record<string, { label: string; type: 'success' | 'warning' | 'danger' }> = {
  normal: { label: '正常', type: 'success' },
  due: { label: '临期风险', type: 'warning' },
  late: { label: '已延期', type: 'danger' },
}

const STAGE_STATE: Record<string, { label: string; color: string }> = {
  done: { label: '已完成', color: '#67c23a' },
  active: { label: '进行中', color: '#0b357b' },
  blocked: { label: '受阻', color: '#f56c6c' },
  pending: { label: '未开始', color: '#c0c4cc' },
}

/** 详情按阶段分组展示 */
const groupedStages = computed(() => {
  const groups: Array<{ phase: string; stages: TrackStage[] }> = []
  for (const stage of props.tracking?.stages ?? []) {
    const last = groups[groups.length - 1]
    if (last && last.phase === stage.phase) {
      last.stages.push(stage)
    } else {
      groups.push({ phase: stage.phase, stages: [stage] })
    }
  }
  return groups
})
</script>

<template>
  <el-drawer v-model="visible" size="760px" :title="`订单追踪 · ${tracking?.orderNo ?? ''}`">
    <template v-if="tracking">
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="客户">{{ tracking.customerName }}</el-descriptions-item>
        <el-descriptions-item label="产品">{{ tracking.productName }}</el-descriptions-item>
        <el-descriptions-item label="图号">{{ tracking.drawingNo }}</el-descriptions-item>
        <el-descriptions-item label="数量">{{ tracking.quantity }}</el-descriptions-item>
        <el-descriptions-item label="批次">{{ tracking.batchNo }}</el-descriptions-item>
        <el-descriptions-item label="客户交期">{{ tracking.deliveryDate }}</el-descriptions-item>
        <el-descriptions-item label="当前环节">{{ tracking.currentStage }}</el-descriptions-item>
        <el-descriptions-item label="进度">
          {{ tracking.doneCount }} / {{ tracking.totalCount }}
        </el-descriptions-item>
        <el-descriptions-item label="数据更新">{{ tracking.updatedAt }}</el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="tracking.riskNote"
        class="drawer-alert"
        :type="tracking.risk === 'late' ? 'error' : 'warning'"
        :closable="false"
        show-icon
        :title="RISK[tracking.risk].label"
        :description="tracking.riskNote"
      />

      <div v-for="group in groupedStages" :key="group.phase" class="phase">
        <p class="phase__title">{{ group.phase }}</p>

        <div
          v-for="stage in group.stages"
          :key="stage.seq"
          class="stage"
          :class="`is-${stage.status}`"
        >
          <div class="stage__marker">
            <span class="stage__dot" :style="{ background: STAGE_STATE[stage.status].color }" />
            <span class="stage__seq">{{ stage.seq }}</span>
          </div>

          <div class="stage__body">
            <div class="stage__head">
              <span class="stage__name">{{ stage.name }}</span>
              <span class="stage__dept">{{ stage.dept }}</span>
              <span class="stage__state" :style="{ color: STAGE_STATE[stage.status].color }">
                {{ STAGE_STATE[stage.status].label }}
              </span>
            </div>

            <p class="stage__meta">
              <template v-if="stage.actualStart">开始 {{ stage.actualStart }}</template>
              <template v-if="stage.actualEnd"> · 完成 {{ stage.actualEnd }}</template>
              <template v-if="stage.plannedStart && !stage.actualStart">
                计划开始 {{ stage.plannedStart }}
              </template>
              <template v-if="stage.dwellHours"> · 停留 {{ stage.dwellHours }} 小时</template>
            </p>

            <p v-if="stage.qtyIn" class="stage__qty">
              投入 {{ stage.qtyIn }}
              <template v-if="stage.qtyOk"> · 合格 {{ stage.qtyOk }}</template>
              <template v-if="stage.qtyNg">
                · <span class="stage__ng">不良 {{ stage.qtyNg }}</span>
              </template>
            </p>

            <p v-if="stage.remark" class="stage__remark">{{ stage.remark }}</p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <template v-if="tracking">
        <el-button>通知 PMC 催办</el-button>
        <el-button type="primary">推送进度给客户</el-button>
      </template>
    </template>
  </el-drawer>
</template>

<style scoped>
.drawer-alert {
  margin-top: 16px;
}

.phase {
  margin-top: 22px;
}

.phase__title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--wfx-navy);
  letter-spacing: 1px;
}

.stage {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed var(--wfx-border);
}

.stage:last-child {
  border-bottom: none;
}

.stage__marker {
  display: flex;
  flex: none;
  gap: 8px;
  align-items: center;
  width: 46px;
}

.stage__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.stage__seq {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.stage__body {
  flex: 1;
}

.stage__head {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.stage__name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.stage__dept {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.stage__state {
  margin-left: auto;
  font-size: 12px;
}

.stage__meta,
.stage__qty {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.stage__ng {
  color: var(--el-color-danger);
}

.stage__remark {
  margin: 6px 0 0;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--wfx-text);
  background: var(--wfx-surface-alt);
  border-left: 3px solid var(--wfx-orange);
  border-radius: 4px;
}

.stage.is-blocked .stage__name {
  color: var(--el-color-danger);
}
</style>
