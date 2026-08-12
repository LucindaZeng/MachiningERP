<script setup lang="ts">
import { fetchEngineeringChanges } from '@/api/sales/ecn.api'
import { matchEq, type FilterField } from '@/components/filter-helpers'
import FilterBar from '@/components/FilterBar.vue'
import { ECN_CHANGE_TYPE, ECN_STATUS } from '@/components/status-dictionary'
import StatusTag from '@/components/StatusTag.vue'
import { useResourceList } from '@/composables/use-resource-list'

import type { EngineeringChange } from '@/types/sales.types'

/**
 * 列表自带取数与筛选（筛选字段与导出列同属列表关注点，不外泄给页面）；
 * 选中哪一单要由页面决定后续动作，因此只向上抛 detail 事件，自己不持有抽屉状态。
 */
const emit = defineEmits<{ detail: [EngineeringChange] }>()

const EXPORT_COLUMNS = [
  { label: '变更单号', value: 'docNo' },
  { label: '客户', value: 'customerName' },
  { label: '关联订单', value: 'orderNo' },
  { label: '产品', value: 'productName' },
  { label: '图号', value: 'drawingNo' },
  { label: '变更前', value: 'beforeValue' },
  { label: '变更后', value: 'afterValue' },
  { label: '状态', value: 'status' },
  { label: '责任人', value: 'owner' },
  { label: '提交时间', value: 'submittedAt' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'changeType',
    label: '变更类型',
    type: 'select',
    options: [
      { label: '图纸版本', value: 'drawing' },
      { label: '材料牌号', value: 'material' },
      { label: '表面处理', value: 'surface' },
      { label: '工艺 / 工序', value: 'process' },
      { label: '数量', value: 'quantity' },
      { label: '交期', value: 'delivery' },
    ],
    width: 150,
  },
  {
    key: 'origin',
    label: '变更来源',
    type: 'select',
    options: [
      { label: '客户要求', value: 'customer' },
      { label: '内部发起', value: 'internal' },
    ],
    width: 140,
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '草稿', value: 'draft' },
      { label: '工程评估中', value: 'assessing' },
      { label: '会签中', value: 'reviewing' },
      { label: '已批准', value: 'approved' },
      { label: '执行中', value: 'executing' },
    ],
    width: 140,
  },
  {
    key: 'urgent',
    label: '紧急度',
    type: 'select',
    options: [
      { label: '加急', value: 'true' },
      { label: '普通', value: 'false' },
    ],
    width: 120,
  },
  {
    key: 'needRequote',
    label: '是否重新核价',
    type: 'select',
    options: [
      { label: '触发重新核价', value: 'true' },
      { label: '不影响价格', value: 'false' },
    ],
    width: 170,
  },
]

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<EngineeringChange>(
  fetchEngineeringChanges,
  (row) => [row.docNo, row.customerName, row.productName, row.drawingNo],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.changeType, f.changeType) &&
      matchEq(row.origin, f.origin) &&
      matchEq(row.status, f.status) &&
      matchEq(row.urgent, f.urgent) &&
      matchEq(row.needRequote, f.needRequote),
  },
)

function openDetail(row: EngineeringChange): void {
  emit('detail', row)
}

/** 页面在流转动作之后要刷新列表——把 reload 暴露出去，避免再造一套事件。 */
defineExpose({ reload })
</script>

<template>
  <el-card shadow="never">
    <FilterBar
      v-model="filters"
      v-model:keyword="keyword"
      :fields="FILTER_FIELDS"
      keyword-placeholder="搜索 ECN 单号 / 客户 / 产品 / 图号"
      :total="filtered.length"
      export-name="ECN 申请"
      :export-columns="EXPORT_COLUMNS"
      :export-rows="filtered"
      @reset="resetFilters"
      @search="reload"
    />

    <el-table v-loading="loading" :data="filtered" style="width: 100%" @row-click="openDetail">
      <el-table-column prop="docNo" label="ECN 单号" width="175">
        <template #default="{ row }">
          <span class="doc-no">{{ row.docNo }}</span>
          <el-tag v-if="row.urgent" type="danger" size="small" class="urgent">加急</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="customerName" label="客户" min-width="160" show-overflow-tooltip />
      <el-table-column prop="productName" label="产品" min-width="130" show-overflow-tooltip />
      <el-table-column prop="drawingNo" label="图号" width="110" />
      <el-table-column label="变更类型" width="110">
        <template #default="{ row }">{{ ECN_CHANGE_TYPE[row.changeType] }}</template>
      </el-table-column>
      <el-table-column label="来源" width="90">
        <template #default="{ row }">{{ row.origin === 'customer' ? '客户要求' : '内部发起' }}</template>
      </el-table-column>
      <el-table-column prop="orderNo" label="关联订单" width="165">
        <template #default="{ row }">{{ row.orderNo ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="连带动作" min-width="180">
        <template #default="{ row }">
          <el-tag v-if="row.needRequote" size="small" type="warning" effect="plain" class="tag">
            重新核价
          </el-tag>
          <el-tag
            v-if="row.needOrderReapproval"
            size="small"
            type="warning"
            effect="plain"
            class="tag"
          >
            订单重审
          </el-tag>
          <el-tag v-if="!row.routingUpdated" size="small" type="danger" effect="plain" class="tag">
            工艺路线未同步
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }"><StatusTag :dict="ECN_STATUS" :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="操作" width="80">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<style scoped>
.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
}

.urgent,
.tag {
  margin-left: 6px;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
