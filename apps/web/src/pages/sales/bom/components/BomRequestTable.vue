<script setup lang="ts">
import { fetchBomRequests } from '@/api/sales/bom-request.api'
import { matchDateRange, matchEq, type FilterField } from '@/components/filter-helpers'
import FilterBar from '@/components/FilterBar.vue'
import { BOM_REQUEST_STATUS } from '@/components/status-dictionary'
import StatusTag from '@/components/StatusTag.vue'
import { useResourceList } from '@/composables/use-resource-list'

import type { BomRequest } from '@/types/sales.types'

/**
 * 列表自带取数与筛选（筛选字段与导出列同属列表关注点，不外泄给页面）；
 * 选中哪一单要由页面决定后续动作，因此只向上抛 detail 事件，自己不持有抽屉状态。
 */
const emit = defineEmits<{ detail: [BomRequest] }>()

const EXPORT_COLUMNS = [
  { label: '申请单号', value: 'docNo' },
  { label: '客户', value: 'customerName' },
  { label: '产品', value: 'productName' },
  { label: '图号', value: 'drawingNo' },
  { label: '版本', value: 'drawingVersion' },
  { label: '材料', value: 'material' },
  { label: '表面处理', value: 'surfaceTreatment' },
  { label: '数量', value: 'quantity' },
  { label: '目标交期', value: 'targetDeliveryDate' },
  { label: '品号 / 模具编号', value: 'productCode' },
  { label: '状态', value: 'status' },
  { label: '业务', value: 'owner' },
  { label: '提交时间', value: 'submittedAt' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '待工程领取', value: 'submitted' },
      { label: '工程处理中', value: 'claimed' },
      { label: '已退回补充', value: 'returned' },
      { label: 'BOM 已完成', value: 'bom-done' },
      { label: '已下单', value: 'ordered' },
    ],
    width: 150,
  },
  {
    key: 'productionType',
    label: '申请用途',
    type: 'select',
    options: [
      { label: '正式量产（建品号）', value: 'batch' },
      { label: '模具（建模具编号）', value: 'mold' },
    ],
    width: 175,
  },
  {
    key: 'bomReady',
    label: 'BOM 可下单',
    type: 'select',
    options: [
      { label: 'BOM 已完成', value: 'true' },
      { label: 'BOM 未完成', value: 'false' },
    ],
    width: 150,
  },
  {
    key: 'programReady',
    label: '程序可开工',
    type: 'select',
    options: [
      { label: '程序已完成', value: 'true' },
      { label: '程序未完成', value: 'false' },
    ],
    width: 150,
  },
  { key: 'targetDeliveryDate', label: '目标交期', type: 'date-range' },
]

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<BomRequest>(
  fetchBomRequests, (row) => [
  row.docNo,
  row.customerName,
  row.productName,
  row.drawingNo,
],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.status, f.status) &&
      matchEq(row.productionType, f.productionType) &&
      matchEq(row.bomReady, f.bomReady) &&
      matchEq(row.programReady, f.programReady) &&
      matchDateRange(row.targetDeliveryDate, f.targetDeliveryDate),
  },
)

function openDetail(row: BomRequest): void {
  emit('detail', row)
}
</script>

<template>
  <el-card shadow="never">
    <FilterBar
      v-model="filters"
      v-model:keyword="keyword"
      :fields="FILTER_FIELDS"
      keyword-placeholder="搜索申请单号 / 客户 / 产品 / 图号"
      :total="filtered.length"
      export-name="BOM 申请"
      :export-columns="EXPORT_COLUMNS"
      :export-rows="filtered"
      @reset="resetFilters"
      @search="reload"
    />

    <el-table v-loading="loading" :data="filtered" style="width: 100%" @row-click="openDetail">
      <el-table-column prop="docNo" label="申请单号" width="180">
        <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
      </el-table-column>
      <el-table-column prop="customerName" label="客户" min-width="160" show-overflow-tooltip />
      <el-table-column prop="productName" label="产品" min-width="140" show-overflow-tooltip />
      <el-table-column label="图号 / 版本" width="140">
        <template #default="{ row }">{{ row.drawingNo }} · {{ row.drawingVersion }}</template>
      </el-table-column>
      <el-table-column label="申请用途" width="110">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="row.productionType === 'mold' ? 'warning' : 'primary'">
            {{ row.productionType === 'mold' ? '模具编号' : '正式量产品号' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="品号" width="145">
        <template #default="{ row }">
          <span v-if="row.productCode" class="item-code">{{ row.productCode }}</span>
          <span v-else class="muted">待工程建立</span>
        </template>
      </el-table-column>
      <el-table-column prop="quantity" label="数量" width="80" align="right" />
      <el-table-column prop="targetDeliveryDate" label="目标交期" width="110" />
      <el-table-column label="BOM 可下单" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="row.bomReady ? 'success' : 'info'" size="small" effect="light">
            {{ row.bomReady ? '已完成' : '未完成' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="程序可开工" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="row.programReady ? 'success' : 'info'" size="small" effect="light">
            {{ row.programReady ? '已完成' : '未完成' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <StatusTag :dict="BOM_REQUEST_STATUS" :value="row.status" />
        </template>
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

.item-code {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--el-color-success);
}

.muted {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
