<script setup lang="ts">
import { Download, RefreshLeft, Search } from '@element-plus/icons-vue'
import { computed } from 'vue'

import { activeFilterCount, type FilterField, type FilterValues } from './filter-helpers'
import { exportNotes, exportSheet, type ExportColumn } from '@/utils/export-excel'

const props = defineProps<{
  modelValue: FilterValues
  fields: FilterField[]
  keyword: string
  keywordPlaceholder: string
  /** 结果条数，展示在右侧 */
  total: number
  /** 传入即在右侧显示「导出 Excel」，导出的是当前筛选后的结果 */
  exportName?: string
  /** 列定义：{ label, value } 中 value 为字段名 */
  exportColumns?: Array<{ label: string; value: string; width?: number }>
  exportRows?: readonly unknown[]
}>()

const emit = defineEmits<{
  'update:modelValue': [FilterValues]
  'update:keyword': [string]
  reset: []
  search: []
}>()

const activeCount = computed(() => activeFilterCount(props.modelValue) + (props.keyword ? 1 : 0))

function update(key: string, value: unknown): void {
  emit('update:modelValue', { ...props.modelValue, [key]: value as FilterValues[string] })
}

const canExport = computed(
  () => Boolean(props.exportName && props.exportColumns?.length && props.exportRows),
)

/** 导出当前筛选结果，并把生效的筛选条件写进表头说明，保证导出件可追溯 */
function onExport(): void {
  if (!canExport.value) {
    return
  }
  const conditions = props.fields
    .map((field) => describe(field))
    .filter(Boolean)
    .join('；')
  exportSheet(
    {
      name: props.exportName as string,
      columns: (props.exportColumns ?? []) as Array<ExportColumn<Record<string, unknown>>>,
      rows: (props.exportRows ?? []) as Record<string, unknown>[],
      notes: exportNotes(props.exportName as string, [
        `筛选条件：${props.keyword ? `关键词「${props.keyword}」；` : ''}${conditions || '无'}`,
        `导出条数：${props.exportRows?.length ?? 0}`,
      ]),
    },
    props.exportName as string,
  )
}

function describe(field: FilterField): string {
  const value = props.modelValue[field.key]
  if (!value || (Array.isArray(value) && !value.filter(Boolean).length)) {
    return ''
  }
  return `${field.label}=${Array.isArray(value) ? value.filter(Boolean).join('~') : value}`
}

function widthOf(field: FilterField): string {
  if (field.width) {
    return `${field.width}px`
  }
  return field.type === 'date-range' ? '260px' : field.type === 'number-range' ? '190px' : '170px'
}
</script>

<template>
  <section class="filter-bar">
    <div class="filter-bar__fields">
      <el-input
        :model-value="keyword"
        :prefix-icon="Search"
        :placeholder="keywordPlaceholder"
        clearable
        style="width: 260px"
        @update:model-value="emit('update:keyword', $event)"
      />

      <template v-for="field in fields" :key="field.key">
        <el-select
          v-if="field.type === 'select'"
          :model-value="modelValue[field.key]"
          :placeholder="field.label"
          clearable
          :style="{ width: widthOf(field) }"
          @update:model-value="update(field.key, $event)"
        >
          <el-option v-for="item in field.options" :key="item.value" v-bind="item" />
        </el-select>

        <el-input
          v-else-if="field.type === 'input'"
          :model-value="modelValue[field.key]"
          :placeholder="field.placeholder ?? field.label"
          clearable
          :style="{ width: widthOf(field) }"
          @update:model-value="update(field.key, $event)"
        />

        <el-date-picker
          v-else-if="field.type === 'date-range'"
          :model-value="modelValue[field.key]"
          type="daterange"
          range-separator="至"
          :start-placeholder="`${field.label}起`"
          :end-placeholder="`${field.label}止`"
          value-format="YYYY-MM-DD"
          unlink-panels
          :style="{ width: widthOf(field) }"
          @update:model-value="update(field.key, $event ?? ['', ''])"
        />

        <div v-else class="filter-bar__range" :style="{ width: widthOf(field) }">
          <el-input
            :model-value="(modelValue[field.key] as string[])?.[0]"
            :placeholder="`${field.label}下限`"
            @update:model-value="
              update(field.key, [$event, (modelValue[field.key] as string[])?.[1] ?? ''])
            "
          />
          <span class="filter-bar__tilde">~</span>
          <el-input
            :model-value="(modelValue[field.key] as string[])?.[1]"
            :placeholder="'上限'"
            @update:model-value="
              update(field.key, [(modelValue[field.key] as string[])?.[0] ?? '', $event])
            "
          />
        </div>
      </template>

      <el-button type="primary" :icon="Search" @click="emit('search')">查询</el-button>
      <el-button :icon="RefreshLeft" @click="emit('reset')">重置</el-button>
    </div>

    <div class="filter-bar__meta">
      <span v-if="activeCount" class="filter-bar__active">已启用 {{ activeCount }} 个筛选条件</span>
      <span class="filter-bar__total">共 {{ total }} 条</span>
      <el-button v-if="canExport" :icon="Download" size="small" @click="onExport">
        导出 Excel
      </el-button>
      <slot name="extra" />
    </div>
  </section>
</template>

<style scoped>
.filter-bar {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--wfx-border);
}

.filter-bar__fields {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.filter-bar__range {
  display: flex;
  gap: 4px;
  align-items: center;
}

.filter-bar__tilde {
  color: var(--wfx-text-muted);
}

.filter-bar__meta {
  display: flex;
  flex: none;
  gap: 14px;
  align-items: center;
  padding-top: 6px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.filter-bar__active {
  color: var(--wfx-orange);
}

.filter-bar__total {
  font-weight: 600;
  color: var(--wfx-text);
}
</style>
