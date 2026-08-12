<script setup lang="ts">
import { computed, ref } from 'vue'

import ReportCard from './ReportCard.vue'

import type { DailyOpsReport, DailyOpsRow } from '@machining-erp/shared'

const props = defineProps<{ report: DailyOpsReport }>()

const RANGES = [
  { value: 7, label: '近 7 天' },
  { value: 14, label: '近 14 天' },
  { value: 30, label: '近 30 天' },
]
const days = ref(14)

const rows = computed<DailyOpsRow[]>(() => props.report.rows.slice(-days.value))

/** 柱状图按「件数」出图：接单与出货是流量、未完成订单是存量，存量单独走折线 */
const maxFlow = computed(() =>
  Math.max(...rows.value.flatMap((row) => [row.receivedQty, row.shippedQty]), 1),
)

const openRange = computed(() => {
  const values = rows.value.map((row) => row.openQty)
  const min = Math.min(...values)
  const max = Math.max(...values)
  return { min: min - (max - min) * 0.4 || 0, max: max + (max - min) * 0.2 || 1 }
})

/** 未完成订单折线：把存量映射到图形高度的 0–100% */
function openTop(row: DailyOpsRow): number {
  const { min, max } = openRange.value
  const ratio = max === min ? 0.5 : (row.openQty - min) / (max - min)
  return 100 - ratio * 100
}

const linePoints = computed(() =>
  rows.value
    .map((row, index) => {
      const x = rows.value.length === 1 ? 50 : (index / (rows.value.length - 1)) * 100
      return `${x},${openTop(row)}`
    })
    .join(' '),
)

const totals = computed(() => {
  const list = rows.value
  const last = list[list.length - 1]
  return {
    receivedOrders: list.reduce((sum, row) => sum + row.receivedOrders, 0),
    receivedQty: list.reduce((sum, row) => sum + row.receivedQty, 0),
    receivedAmount: list.reduce((sum, row) => sum + row.receivedAmount, 0),
    shippedOrders: list.reduce((sum, row) => sum + row.shippedOrders, 0),
    shippedQty: list.reduce((sum, row) => sum + row.shippedQty, 0),
    shippedAmount: list.reduce((sum, row) => sum + row.shippedAmount, 0),
    openOrders: last?.openOrders ?? 0,
    openQty: last?.openQty ?? 0,
    openAmount: last?.openAmount ?? 0,
    workDays: list.filter((row) => row.receivedOrders || row.shippedOrders).length,
  }
})

/** 接单 − 出货 = 未完成订单的净变化，用于判断在手是在累积还是在消化 */
const netFlow = computed(() => totals.value.receivedQty - totals.value.shippedQty)

function short(date: string): string {
  return date.slice(5)
}
</script>

<template>
  <ReportCard
    title="每日经营量：接单 / 出货 / 未完成订单"
    caliber="接单按 ORD-02 审核通过日归集（张数 / 件数 / 金额），出货按实际发货日归集，未完成订单为当日日终存量（已评审通过但尚未全部出货）。接单与出货是当日流量，未完成订单是存量，三者关系为：昨日存量 + 今日接单 − 今日出货 = 今日存量。"
    wide
    :export-rows="rows"
  >
    <template #extra>
      <el-radio-group v-model="days" size="small">
        <el-radio-button v-for="item in RANGES" :key="item.value" :value="item.value">
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>
    </template>

    <div class="kpi">
      <div class="kpi__item">
        <span>区间接单</span>
        <b>{{ totals.receivedQty.toLocaleString() }}<em>件</em></b>
        <span class="kpi__sub">
          {{ totals.receivedOrders }} 张 · {{ totals.receivedAmount.toFixed(1) }} 万元 ·
          日均 {{ Math.round(totals.receivedQty / (totals.workDays || 1)).toLocaleString() }} 件
        </span>
      </div>
      <div class="kpi__item">
        <span>区间出货</span>
        <b>{{ totals.shippedQty.toLocaleString() }}<em>件</em></b>
        <span class="kpi__sub">
          {{ totals.shippedOrders }} 张 · {{ totals.shippedAmount.toFixed(1) }} 万元 ·
          日均 {{ Math.round(totals.shippedQty / (totals.workDays || 1)).toLocaleString() }} 件
        </span>
      </div>
      <div class="kpi__item">
        <span>期末未完成订单</span>
        <b class="is-open">{{ totals.openQty.toLocaleString() }}<em>件</em></b>
        <span class="kpi__sub">
          {{ totals.openOrders }} 张在手 · 未交金额 {{ totals.openAmount.toFixed(1) }} 万元
        </span>
      </div>
      <div class="kpi__item">
        <span>净流入（接单 − 出货）</span>
        <b :class="netFlow > 0 ? 'is-bad' : 'is-good'">
          {{ netFlow > 0 ? '+' : '' }}{{ netFlow.toLocaleString() }}<em>件</em>
        </b>
        <span class="kpi__sub">
          {{ netFlow > 0 ? '在手订单在累积，需关注产能与交期' : '在手订单在消化，产出快于接单' }}
        </span>
      </div>
    </div>

    <div class="chart">
      <svg class="chart__line" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline :points="linePoints" />
      </svg>

      <div class="chart__cols">
        <div v-for="row in rows" :key="row.date" class="col">
          <div class="col__bars">
            <span
              class="col__bar is-received"
              :style="{ height: `${(row.receivedQty / maxFlow) * 100}%` }"
              :title="`${row.date} 接单 ${row.receivedQty} 件`"
            />
            <span
              class="col__bar is-shipped"
              :style="{ height: `${(row.shippedQty / maxFlow) * 100}%` }"
              :title="`${row.date} 出货 ${row.shippedQty} 件`"
            />
          </div>
          <span class="col__date">{{ short(row.date) }}</span>
        </div>
      </div>
    </div>

    <div class="legend">
      <span><i class="dot is-received" />当日接单（件）</span>
      <span><i class="dot is-shipped" />当日出货（件）</span>
      <span><i class="dot is-open" />未完成订单存量（件，右侧折线）</span>
      <span class="legend__hint">周日不排产，接单与出货为 0；存量当日保持不变。</span>
    </div>

    <el-table :data="rows" size="small" border style="width: 100%" class="table">
      <el-table-column prop="date" label="日期" width="110" fixed />
      <el-table-column label="接单" align="center">
        <el-table-column prop="receivedOrders" label="张数" width="80" align="right" />
        <el-table-column label="件数" width="100" align="right">
          <template #default="{ row }">{{ row.receivedQty.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="金额（万）" width="110" align="right">
          <template #default="{ row }">{{ row.receivedAmount.toFixed(1) }}</template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="出货" align="center">
        <el-table-column prop="shippedOrders" label="张数" width="80" align="right" />
        <el-table-column label="件数" width="100" align="right">
          <template #default="{ row }">{{ row.shippedQty.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="金额（万）" width="110" align="right">
          <template #default="{ row }">{{ row.shippedAmount.toFixed(1) }}</template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="未完成订单（日终存量）" align="center">
        <el-table-column prop="openOrders" label="张数" width="80" align="right" />
        <el-table-column label="未交件数" width="110" align="right">
          <template #default="{ row }">
            <b class="is-open">{{ row.openQty.toLocaleString() }}</b>
          </template>
        </el-table-column>
        <el-table-column label="未交金额（万）" width="130" align="right">
          <template #default="{ row }">{{ row.openAmount.toFixed(1) }}</template>
        </el-table-column>
      </el-table-column>
    </el-table>

    <p class="note">{{ report.caliber }}　数据截止 {{ report.updatedAt }}。</p>
  </ReportCard>
</template>

<style scoped>
.kpi {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.kpi__item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 14px;
  background: var(--wfx-surface-alt);
  border-radius: 6px;
}

.kpi__item > span:first-child {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.kpi__item b {
  font-size: 22px;
  color: var(--wfx-navy);
}

.kpi__item b em {
  margin-left: 3px;
  font-size: 12px;
  font-style: normal;
  color: var(--wfx-text-muted);
}

.kpi__sub {
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--wfx-text-muted);
}

.chart {
  position: relative;
  height: 180px;
}

.chart__cols {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 8px;
  align-items: flex-end;
  height: 100%;
}

.col {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.col__bars {
  display: flex;
  flex: 1;
  gap: 3px;
  align-items: flex-end;
  width: 100%;
}

.col__bar {
  flex: 1;
  min-height: 1px;
  border-radius: 3px 3px 0 0;
}

.col__bar.is-received {
  background: var(--viz-series-1);
  opacity: 0.9;
}

.col__bar.is-shipped {
  background: var(--viz-series-2);
  opacity: 0.9;
}

.col__date {
  font-size: 11px;
  color: var(--wfx-text-muted);
}

.chart__line {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  /* SVG 是替换元素，只给 left/right 不会被拉伸，必须显式给宽度 */
  width: 100%;
  height: calc(100% - 20px);
  overflow: visible;
  pointer-events: none;
}

.chart__line polyline {
  fill: none;
  stroke: var(--viz-series-3);
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.legend {
  display: flex;
  gap: 20px;
  align-items: center;
  margin: 14px 0 16px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  vertical-align: -1px;
  border-radius: 2px;
}

.dot.is-received {
  background: var(--viz-series-1);
}

.dot.is-shipped {
  background: var(--viz-series-2);
}

.dot.is-open {
  background: var(--viz-series-3);
}

.legend__hint {
  margin-left: auto;
}

.table {
  margin-top: 4px;
}

.is-open {
  color: var(--viz-series-3);
}

.is-bad {
  color: var(--el-color-danger);
}

.is-good {
  color: var(--el-color-success);
}

.note {
  margin: 14px 0 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--wfx-text-muted);
  background: var(--wfx-surface-alt);
  border-left: 3px solid var(--wfx-orange);
  border-radius: 4px;
}

@media (max-width: 1500px) {
  .kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
