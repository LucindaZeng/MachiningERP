<script setup lang="ts">
import { Download } from '@element-plus/icons-vue'
import { computed } from 'vue'

import { exportNotes, exportSheet } from '@/utils/export-excel'

import { FIELD_LABELS } from './report-fields'



const props = defineProps<{
  title: string
  caliber: string
  wide?: boolean
  /** 传入数据行即在卡片右上角出现下载按钮；列头按字段名映射中文 */
  exportRows?: readonly unknown[]
}>()

const canExport = computed(() => Boolean(props.exportRows?.length))

/** 列由首行的字段自动推导，字段中文名取自共享映射表，未收录的直接用字段名 */
function onExport(): void {
  const rows = (props.exportRows ?? []) as Array<Record<string, unknown>>
  if (!rows.length) {
    return
  }
  const keys = Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== 'object')
  exportSheet(
    {
      name: props.title,
      columns: keys.map((key) => ({ label: FIELD_LABELS[key] ?? key, value: key })),
      rows,
      notes: exportNotes(props.title, [`口径：${props.caliber}`]),
    },
    props.title,
  )
}
</script>

<template>
  <el-card shadow="never" class="report-card" :class="{ 'is-wide': wide }">
    <template #header>
      <div class="report-card__head">
        <span class="report-card__title">{{ title }}</span>
        <div class="report-card__actions">
          <slot name="extra" />
          <el-button
            v-if="canExport"
            link
            type="primary"
            size="small"
            :icon="Download"
            @click="onExport"
          >
            下载
          </el-button>
        </div>
      </div>
      <p class="report-card__caliber">{{ caliber }}</p>
    </template>

    <slot />
  </el-card>
</template>

<style scoped>
.report-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.report-card__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.report-card__actions {
  display: flex;
  gap: 12px;
  align-items: baseline;
}

.report-card__caliber {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--wfx-text-muted);
}

.report-card.is-wide {
  grid-column: 1 / -1;
}
</style>
