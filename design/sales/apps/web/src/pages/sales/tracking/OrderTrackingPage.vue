<script setup lang="ts">
import { ref } from 'vue'

import StageProgressBar from './components/StageProgressBar.vue'
import TrackDetailDrawer from './components/TrackDetailDrawer.vue'
import { stageCounts } from './stage-progress'
import { fetchOrderTrackings } from '@/api/sales/order-tracking.api'
import FilterBar from '@/components/FilterBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { ORDER_TYPE } from '@/components/status-dictionary'
import { matchDateRange, matchEq, type FilterField } from '@/components/filter-helpers'
import { useResourceList } from '@/composables/use-resource-list'
import type { OrderTracking } from '@/types/sales.types'

const RISK: Record<string, { label: string; type: 'success' | 'warning' | 'danger' }> = {
  normal: { label: '正常', type: 'success' },
  due: { label: '临期风险', type: 'warning' },
  late: { label: '已延期', type: 'danger' },
}

const EXPORT_COLUMNS = [
  { label: '订单号', value: 'orderNo' },
  { label: '订单类型', value: 'orderType' },
  { label: '客户', value: 'customerName' },
  { label: '产品', value: 'productName' },
  { label: '图号', value: 'drawingNo' },
  { label: '批次', value: 'batchNo' },
  { label: '数量', value: 'quantity' },
  { label: '当前环节', value: 'currentStage' },
  { label: '已完成环节', value: 'doneCount' },
  { label: '总环节', value: 'totalCount' },
  { label: '客户交期', value: 'deliveryDate' },
  { label: '交付风险', value: 'risk' },
  { label: '风险说明', value: 'riskNote' },
  { label: '数据更新', value: 'updatedAt' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'customerName',
    label: '客户',
    type: 'select',
    options: [
      { label: '香港宏晟精密（代生产）', value: '香港宏晟精密（代生产）' },
      { label: 'Brenner Maschinenbau GmbH', value: 'Brenner Maschinenbau GmbH' },
      { label: 'Radex Instruments Inc.', value: 'Radex Instruments Inc.' },
    ],
    width: 200,
  },
  {
    key: 'orderType',
    label: '订单类型',
    type: 'select',
    options: [
      { label: '正式业务订单', value: 'formal' },
      { label: '模具订单', value: 'mold' },
      { label: '样品订单', value: 'sample' },
      { label: '备料订单', value: 'stock' },
    ],
    width: 150,
  },
  {
    key: 'phase',
    label: '当前阶段',
    type: 'select',
    options: [
      { label: '计划与采购', value: '计划与采购' },
      { label: '来料与检验', value: '来料与检验' },
      { label: '机加工', value: '机加工' },
      { label: '后处理与委外', value: '后处理与委外' },
      { label: '交付入库', value: '交付入库' },
    ],
    width: 160,
  },
  {
    key: 'risk',
    label: '交付风险',
    type: 'select',
    options: [
      { label: '正常', value: 'normal' },
      { label: '临期风险', value: 'due' },
      { label: '已延期', value: 'late' },
    ],
    width: 140,
  },
  { key: 'deliveryDate', label: '客户交期', type: 'date-range' },
]

function currentPhase(row: OrderTracking): string {
  return row.stages.find((stage) => stage.status === 'active' || stage.status === 'blocked')?.phase ??
    row.stages[row.stages.length - 1].phase
}

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<OrderTracking>(
  fetchOrderTrackings,
  (row) => [row.orderNo, row.customerName, row.productName, row.drawingNo, row.batchNo],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.customerName, f.customerName) &&
      matchEq(row.orderType, f.orderType) &&
      matchEq(currentPhase(row), f.phase) &&
      matchEq(row.risk, f.risk) &&
      matchDateRange(row.deliveryDate, f.deliveryDate),
  },
)

const detailVisible = ref(false)
const current = ref<OrderTracking | null>(null)
const view = ref<'bar' | 'table'>('bar')

/** 行尾汇总：当前环节的「完成数 / 工单数」，与圈内口径一致 */
function currentCount(row: OrderTracking): { done: number; total: number } {
  const active = row.stages.find((stage) => stage.status === 'active' || stage.status === 'blocked')
  return stageCounts(active ?? row.stages[row.stages.length - 1], row.quantity)
}

function openDetail(row: OrderTracking): void {
  current.value = row
  detailVisible.value = true
}

function progress(row: OrderTracking): number {
  return Math.round((row.doneCount / row.totalCount) * 100)
}
</script>

<template>
  <div>
    <PageHeader
      title="订单追踪"
      requirement-code="TRK-01 ~ TRK-23"
      subtitle="以工单进度条呈现：一张订单一行，23 个环节从左到右依次点亮。每个环节圈内显示「完成数 / 工单数」（如 58 / 100，上为该环节合格数、下为投入数），灰圈未开始、蓝圈进行中、绿圈已完成、红角标为受阻。鼠标悬停看该环节的责任部门、起止时间、投入/合格/不良数量与停留时长。"
    >
      <template #actions>
        <el-tag type="info" effect="plain">可见范围：业务部 · 总经办 · PMC</el-tag>
        <el-radio-group v-model="view" size="default">
          <el-radio-button value="bar">工单进度条</el-radio-button>
          <el-radio-button value="table">明细表</el-radio-button>
        </el-radio-group>
        <el-button type="primary">导出追踪报表</el-button>
      </template>
    </PageHeader>

    <el-card shadow="never">
      <div v-if="view === 'bar'" class="legend">
        <span><i class="legend__dot is-pending" />未开始</span>
        <span><i class="legend__dot is-active" />进行中（圈内为「完成数 / 工单数」，如 58 / 100）</span>
        <span><i class="legend__dot is-done" />已完成</span>
        <span><i class="legend__dot is-blocked" />受阻 / 异常</span>
        <span class="legend__hint">点击任一环节或整行可展开 23 个环节的完整明细</span>
      </div>

      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索订单号 / 客户 / 产品 / 图号 / 批次"
        :total="filtered.length"
        export-name="订单追踪"
        :export-columns="EXPORT_COLUMNS"
        :export-rows="filtered"
        @reset="resetFilters"
        @search="reload"
      />

      <div v-if="view === 'bar'" v-loading="loading" class="board">
        <article v-for="row in filtered" :key="row.id" class="wo" @click="openDetail(row)">
          <header class="wo__head">
            <span class="wo__no">{{ row.orderNo }}</span>
            <StatusTag :dict="ORDER_TYPE" :value="row.orderType" />
            <span class="wo__text">{{ row.customerName }}</span>
            <span class="wo__text">{{ row.productName }} · {{ row.drawingNo }}</span>
            <span class="wo__text">批次 {{ row.batchNo }} · {{ row.quantity }} 件</span>
            <span class="wo__text">交期 {{ row.deliveryDate }}</span>
            <el-tag :type="RISK[row.risk].type" size="small">{{ RISK[row.risk].label }}</el-tag>
            <span class="wo__spacer" />
            <span class="wo__stage">当前：{{ row.currentStage }}</span>
            <b class="wo__pct">{{ currentCount(row).done }} / {{ currentCount(row).total }}</b>
            <span class="wo__count">
              本环节完成 / 工单数 · 已过 {{ row.doneCount }} / {{ row.totalCount }} 环节
            </span>
          </header>

          <StageProgressBar :stages="row.stages" :order-qty="row.quantity" @select="openDetail(row)" />

          <p v-if="row.riskNote" class="wo__note" :class="{ 'is-late': row.risk === 'late' }">
            {{ row.riskNote }}
          </p>
        </article>

        <el-empty v-if="!filtered.length && !loading" description="没有符合条件的工单" />
      </div>

      <el-table
        v-else
        :data="filtered"
        v-loading="loading"
        style="width: 100%"
        @row-click="openDetail"
      >
        <el-table-column prop="orderNo" label="订单号" width="170">
          <template #default="{ row }"><span class="doc-no">{{ row.orderNo }}</span></template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="{ row }"><StatusTag :dict="ORDER_TYPE" :value="row.orderType" /></template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="160" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="140" show-overflow-tooltip />
        <el-table-column prop="batchNo" label="批次" width="110" />
        <el-table-column prop="quantity" label="数量" width="80" align="right" />
        <el-table-column label="当前环节" min-width="180">
          <template #default="{ row }">
            <span class="stage-name">{{ row.currentStage }}</span>
            <span class="stage-phase">{{ currentPhase(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="190">
          <template #default="{ row }">
            <el-progress
              :percentage="progress(row)"
              :stroke-width="12"
              :status="row.risk === 'late' ? 'exception' : undefined"
            />
            <span class="stage-count">{{ row.doneCount }} / {{ row.totalCount }} 环节</span>
          </template>
        </el-table-column>
        <el-table-column prop="deliveryDate" label="客户交期" width="110" />
        <el-table-column label="风险" width="110">
          <template #default="{ row }">
            <el-tag :type="RISK[row.risk].type" size="small">{{ RISK[row.risk].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row)">追踪</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <TrackDetailDrawer v-model="detailVisible" :tracking="current" />
  </div>
</template>

<style scoped>
.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
}




















.legend {
  display: flex;
  gap: 20px;
  align-items: center;
  padding-bottom: 12px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--wfx-text-muted);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.legend__dot {
  display: inline-block;
  width: 11px;
  height: 11px;
  margin-right: 6px;
  vertical-align: -1px;
  border: 1.5px solid var(--el-border-color);
  border-radius: 50%;
}

.legend__dot.is-active {
  background: var(--wfx-navy);
  border-color: var(--wfx-navy);
}

.legend__dot.is-done {
  background: var(--el-color-success);
  border-color: var(--el-color-success);
}

.legend__dot.is-blocked {
  background: var(--wfx-navy);
  border-color: var(--el-color-danger);
  box-shadow: 0 0 0 2px rgb(245 108 108 / 35%);
}

.legend__hint {
  margin-left: auto;
}

.board {
  min-height: 120px;
  margin-top: 6px;
}

.wo {
  padding: 12px 14px 10px;
  margin-bottom: 12px;
  cursor: pointer;
  background: var(--wfx-surface);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.wo:hover {
  border-color: var(--wfx-navy);
  box-shadow: 0 2px 10px rgb(11 53 123 / 8%);
}

.wo__head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.wo__no {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wfx-navy);
}

.wo__text {
  font-size: 12.5px;
  color: var(--wfx-text-muted);
}

.wo__spacer {
  flex: 1;
}

.wo__stage {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.wo__pct {
  font-size: 16px;
  color: var(--wfx-navy);
}

.wo__count {
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.wo__note {
  margin: 4px 0 0;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--wfx-text-muted);
  background: var(--wfx-surface-alt);
  border-left: 3px solid var(--wfx-orange);
  border-radius: 4px;
}

.wo__note.is-late {
  color: var(--el-color-danger);
  border-left-color: var(--el-color-danger);
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
