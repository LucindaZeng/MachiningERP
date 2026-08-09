<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'

import { fetchHistoricalQuotes } from '@/api/sales/quotation.api'
import {
  matchDateRange,
  matchEq,
  matchNumberRange,
  matchText,
  type FilterField,
} from '@/components/filter-helpers'
import FilterBar from '@/components/FilterBar.vue'
import { useResourceList } from '@/composables/use-resource-list'

import HistoricalQuoteDetail from './HistoricalQuoteDetail.vue'

import type { HistoricalQuote } from '@/types/sales.types'

const OUTCOME: Record<string, { label: string; type: 'success' | 'info' | 'warning' }> = {
  won: { label: '已成交', type: 'success' },
  lost: { label: '未成交', type: 'info' },
  expired: { label: '已失效', type: 'warning' },
}

const EXPORT_COLUMNS = [
  { label: '报价单号', value: 'docNo' },
  { label: '报价日期', value: 'quotedAt' },
  { label: '客户', value: 'customerName' },
  { label: '产品', value: 'productName' },
  { label: '图号', value: 'drawingNo' },
  { label: '材料', value: 'material' },
  { label: '表面处理', value: 'surfaceTreatment' },
  { label: '数量', value: 'quantity' },
  { label: '单价', value: 'unitPrice' },
  { label: '币种', value: 'currency' },
  { label: '报价毛利率', value: 'marginRate' },
  { label: '实际毛利率', value: 'actualMarginRate' },
  { label: '成交结果', value: 'outcome' },
  { label: '关联订单', value: 'orderNo' },
  { label: '成本分析单', value: 'costAnalysisNo' },
  { label: '报价单位成本', value: 'quotedUnitCost' },
  { label: '实际单位成本', value: 'actualUnitCost' },
  { label: '业务', value: 'owner' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'customerName',
    label: '客户',
    type: 'select',
    options: [
      { label: '香港宏晟精密（代生产）', value: '香港宏晟精密（代生产）' },
      { label: 'Brenner Maschinenbau GmbH', value: 'Brenner Maschinenbau GmbH' },
      { label: '苏州明泰自动化', value: '苏州明泰自动化' },
      { label: 'Radex Instruments Inc.', value: 'Radex Instruments Inc.' },
      { label: '东莞德信电子', value: '东莞德信电子' },
      { label: '深圳兆丰医疗', value: '深圳兆丰医疗' },
    ],
    width: 200,
  },
  { key: 'drawingNo', label: '图号', type: 'input', placeholder: '图号，支持模糊', width: 150 },
  {
    key: 'material',
    label: '材料',
    type: 'select',
    options: [
      { label: '6061-T6 铝合金', value: '6061-T6 铝合金' },
      { label: '6063-T5 铝合金', value: '6063-T5 铝合金' },
      { label: '7075-T651 铝合金', value: '7075-T651 铝合金' },
      { label: '304 不锈钢', value: '304 不锈钢' },
      { label: '316L 不锈钢', value: '316L 不锈钢' },
      { label: '45# 钢', value: '45# 钢' },
      { label: 'TC4 钛合金', value: 'TC4 钛合金' },
    ],
    width: 170,
  },
  {
    key: 'surfaceTreatment',
    label: '表面处理',
    type: 'input',
    placeholder: '表面处理关键词',
    width: 150,
  },
  {
    key: 'outcome',
    label: '成交结果',
    type: 'select',
    options: [
      { label: '已成交', value: 'won' },
      { label: '未成交', value: 'lost' },
      { label: '已失效', value: 'expired' },
    ],
    width: 130,
  },
  { key: 'quotedAt', label: '报价日期', type: 'date-range' },
  { key: 'quantity', label: '数量', type: 'number-range', width: 180 },
  { key: 'unitPrice', label: '单价', type: 'number-range', width: 180 },
]

const { filtered, loading, keyword, filters, resetFilters, reload } =
  useResourceList<HistoricalQuote>(
    fetchHistoricalQuotes,
    (row) => [row.docNo, row.customerName, row.productName, row.drawingNo, row.material],
    {
      fields: FILTER_FIELDS,
      predicate: (row, f) =>
        matchEq(row.customerName, f.customerName) &&
        matchText(row.drawingNo, f.drawingNo) &&
        matchEq(row.material, f.material) &&
        matchText(row.surfaceTreatment, f.surfaceTreatment) &&
        matchEq(row.outcome, f.outcome) &&
        matchDateRange(row.quotedAt, f.quotedAt) &&
        matchNumberRange(row.quantity, f.quantity) &&
        matchNumberRange(row.unitPrice, f.unitPrice),
    },
  )

const wonRate = computed(() => {
  const won = filtered.value.filter((row) => row.outcome === 'won').length
  return filtered.value.length ? ((won / filtered.value.length) * 100).toFixed(1) : '0.0'
})

const avgMargin = computed(() => {
  if (!filtered.value.length) {
    return '0.0'
  }
  const sum = filtered.value.reduce((acc, row) => acc + row.marginRate, 0)
  return ((sum / filtered.value.length) * 100).toFixed(1)
})

const detailVisible = ref(false)
const current = ref<HistoricalQuote | null>(null)

const tracedCount = computed(() => filtered.value.filter((row) => row.operationCosts?.length).length)

function openDetail(row: HistoricalQuote): void {
  current.value = row
  detailVisible.value = true
}

function reuse(row: HistoricalQuote): void {
  ElMessage.success(`已引用 ${row.docNo} 的产品、工艺与成本结构，新建报价将带出对应成本分析模板`)
}

function gap(row: HistoricalQuote): string {
  if (row.actualMarginRate === undefined) {
    return '—'
  }
  const value = (row.actualMarginRate - row.marginRate) * 100
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}pt`
}
</script>

<template>
  <div>
    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索报价单号 / 客户 / 产品 / 图号 / 材料"
        :total="filtered.length"
        export-name="历史报价"
        :export-columns="EXPORT_COLUMNS"
        :export-rows="filtered"
        @reset="resetFilters"
        @search="reload"
      >
        <template #extra>
          <span>成交率 {{ wonRate }}%</span>
          <span>平均报价毛利 {{ avgMargin }}%</span>
          <span>可回溯工序成本 {{ tracedCount }} 单</span>
        </template>
      </FilterBar>

      <el-table v-loading="loading" :data="filtered" style="width: 100%">
        <el-table-column prop="docNo" label="报价单号" width="175">
          <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
        </el-table-column>
        <el-table-column prop="quotedAt" label="报价日期" width="110" />
        <el-table-column prop="customerName" label="客户" min-width="170" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="150" show-overflow-tooltip />
        <el-table-column prop="drawingNo" label="图号" width="110" />
        <el-table-column prop="material" label="材料" width="130" show-overflow-tooltip />
        <el-table-column prop="surfaceTreatment" label="表面处理" width="120" show-overflow-tooltip />
        <el-table-column prop="quantity" label="数量" width="80" align="right" />
        <el-table-column label="单价" width="110" align="right">
          <template #default="{ row }">{{ row.unitPrice }} {{ row.currency }}</template>
        </el-table-column>
        <el-table-column label="报价毛利" width="90" align="right">
          <template #default="{ row }">{{ (row.marginRate * 100).toFixed(1) }}%</template>
        </el-table-column>
        <el-table-column label="实际毛利" width="90" align="right">
          <template #default="{ row }">
            {{ row.actualMarginRate === undefined ? '—' : (row.actualMarginRate * 100).toFixed(1) + '%' }}
          </template>
        </el-table-column>
        <el-table-column label="差异" width="80" align="right">
          <template #default="{ row }">
            <span :class="row.actualMarginRate < row.marginRate ? 'is-down' : 'is-up'">
              {{ gap(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="成交结果" width="100">
          <template #default="{ row }">
            <el-tag :type="OUTCOME[row.outcome].type" size="small">
              {{ OUTCOME[row.outcome].label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="成本分析" width="185">
          <template #default="{ row }">
            <span class="cost-no">{{ row.costAnalysisNo }}</span>
            <el-tag
              v-if="row.operationCosts?.length"
              class="trace-tag"
              size="small"
              type="success"
              effect="plain"
            >
              工序级
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="175">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情 / 回溯</el-button>
            <el-button link type="primary" @click="reuse(row)">引用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <HistoricalQuoteDetail v-model="detailVisible" :quote="current" @reuse="reuse" />

    <p class="panel-note">
      历史报价用于相似产品比价与议价参考：报价毛利与实际毛利的差异反映核价准确度，差异为负说明实际成本高于核价假设，
      新报价应据此调整。点开「详情 / 回溯」可查看当时的报价、当时的成本分析，以及按每一道工序独立核算的实际成本回溯
      （含转入 / 转出累计、标准与实际工时、偏差原因）。引用历史报价新建时会一并带出其成本分析结构，仍需重新核价并生成新的成本分析单。
    </p>
  </div>
</template>

<style scoped>
.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
}

.cost-no {
  font-size: 12.5px;
  color: var(--el-color-success);
}

.trace-tag {
  margin-left: 6px;
}

.is-up {
  color: var(--el-color-success);
}

.is-down {
  color: var(--el-color-danger);
}

.panel-note {
  margin: 16px 0 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--wfx-text-muted);
  background: var(--wfx-surface-alt);
  border-left: 3px solid var(--wfx-orange);
  border-radius: 4px;
}
</style>
