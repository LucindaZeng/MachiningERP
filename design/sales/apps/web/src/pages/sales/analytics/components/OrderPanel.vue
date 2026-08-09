<script setup lang="ts">
import ReportCard from './ReportCard.vue'
import type { SalesReports } from '@/api/mock/sales/analytics-reports.fixture'

const props = defineProps<{ reports: SalesReports }>()

const backlogTotal = props.reports.backlog.reduce((sum, row) => sum + row.amount, 0)
const maxBacklog = Math.max(...props.reports.backlog.map((row) => row.amount))
const maxTrend = Math.max(...props.reports.orderTrend.map((row) => row.amount))
const mixTotal = props.reports.orderMix.reduce((sum, row) => sum + row.amount, 0)

const MIX_COLORS = [
  'var(--viz-series-1)',
  'var(--viz-series-2)',
  'var(--viz-series-3)',
  '#8a93a6',
]

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="在手订单表（Backlog）"
      caliber="未交付订单额按客户交期分桶，是排产与现金流预测的基础；含已批准未开工与在制订单。"
      :export-rows="reports.backlog"
    >
      <template #extra>
        <span class="head-total">合计 {{ backlogTotal.toFixed(1) }} 万元</span>
      </template>

      <ul class="bars">
        <li v-for="row in reports.backlog" :key="row.bucket">
          <div class="bars__head">
            <span>{{ row.bucket }}</span>
            <b>{{ row.amount.toFixed(1) }} 万 · {{ row.orders }} 单</b>
          </div>
          <div class="bars__track">
            <span class="bars__bar" :style="{ width: `${(row.amount / maxBacklog) * 100}%` }" />
          </div>
          <p v-if="row.hint" class="bars__hint">{{ row.hint }}</p>
        </li>
      </ul>
    </ReportCard>

    <ReportCard
      title="订单结构分析"
      caliber="正式 / 模具 / 样品 / 备料四类订单占比；备料订单不产生客户应收，金额按预计生产成本列示。"
    
      :export-rows="reports.orderMix"
    >
      <div class="mix-bar">
        <span
          v-for="(row, index) in reports.orderMix"
          :key="row.type"
          :style="{ width: `${(row.amount / mixTotal) * 100}%`, background: MIX_COLORS[index] }"
        />
      </div>
      <ul class="mix-legend">
        <li v-for="(row, index) in reports.orderMix" :key="row.type">
          <i :style="{ background: MIX_COLORS[index] }" />
          <span>{{ row.type }}</span>
          <b>{{ row.count }} 单 · {{ row.amount.toFixed(1) }} 万</b>
        </li>
      </ul>

      <div class="conversion">
        <div>
          <span>样品转批量转化率</span>
          <b>{{ pct(reports.sampleConversion.rate) }}</b>
        </div>
        <p>
          近 6 个月打样 {{ reports.sampleConversion.samples }} 单，其中
          {{ reports.sampleConversion.converted }} 单转为量产，带来后续订单
          {{ reports.sampleConversion.amount }} 万元。
        </p>
      </div>
    </ReportCard>

    <ReportCard
      title="订单趋势表（同比 / 环比）"
      caliber="按月统计订单额与订单数，同比对上年同月、环比对上月；口径为业务经理审核通过的合同应收金额。"
      wide
      :export-rows="reports.orderTrend"
    >
      <div class="trend">
        <div v-for="row in reports.orderTrend" :key="row.month" class="trend__col">
          <span class="trend__value">{{ row.amount.toFixed(1) }}</span>
          <div class="trend__bar-wrap">
            <span class="trend__bar" :style="{ height: `${(row.amount / maxTrend) * 100}%` }" />
          </div>
          <span class="trend__month">{{ row.month.slice(2) }}</span>
          <span class="trend__meta">{{ row.count }} 单</span>
          <span class="trend__meta" :class="row.yoy > 0 ? 'is-good' : 'is-bad'">
            同比 {{ row.yoy > 0 ? '+' : '' }}{{ (row.yoy * 100).toFixed(1) }}%
          </span>
          <span class="trend__meta" :class="row.mom > 0 ? 'is-good' : 'is-bad'">
            环比 {{ row.mom > 0 ? '+' : '' }}{{ (row.mom * 100).toFixed(1) }}%
          </span>
        </div>
      </div>
    </ReportCard>

    <ReportCard
      title="准交率分析"
      caliber="准交 = 实际发货日 ≤ 客户交期；受控暂停不扣减。按客户统计延期单数与准交率。"
      :export-rows="reports.onTime"
    >
      <el-table :data="reports.onTime" size="small" style="width: 100%">
        <el-table-column prop="customer" label="客户" min-width="160" />
        <el-table-column prop="total" label="交付单数" width="100" align="right" />
        <el-table-column prop="late" label="延期" width="80" align="right">
          <template #default="{ row }">
            <span :class="row.late ? 'is-bad' : ''">{{ row.late }}</span>
          </template>
        </el-table-column>
        <el-table-column label="准交率" width="110" align="right">
          <template #default="{ row }">
            <span :class="row.rate < 0.9 ? 'is-bad' : 'is-good'">{{ pct(row.rate) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </ReportCard>

    <ReportCard
      title="延期原因归类"
      caliber="延期单关闭时必须选择标准原因，用于区分生产、来料与图纸变更责任。"
      :export-rows="reports.lateReasons"
    >
      <ul class="reason">
        <li v-for="row in reports.lateReasons" :key="row.reason">
          <div class="reason__head">
            <span>{{ row.reason }}</span>
            <b>{{ row.count }} 单 · {{ pct(row.share) }}</b>
          </div>
          <div class="reason__track">
            <span class="reason__bar" :style="{ width: `${row.share * 100}%` }" />
          </div>
        </li>
      </ul>
    </ReportCard>
  </div>
</template>

<style scoped>
.report-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}

.head-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--wfx-navy);
}

.bars,
.mix-legend,
.reason {
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars li {
  padding: 7px 0;
}

.bars__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wfx-text);
}

.bars__track,
.reason__track {
  height: 10px;
  margin-top: 5px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 4px;
}

.bars__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
  border-radius: 4px;
}

.bars__hint {
  margin: 4px 0 0;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.mix-bar {
  display: flex;
  gap: 2px;
  height: 22px;
  overflow: hidden;
  border-radius: 4px;
}

.mix-legend li {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
}

.mix-legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.mix-legend b {
  margin-left: auto;
  color: var(--wfx-text-strong);
}

.conversion {
  padding: 12px 14px;
  margin-top: 12px;
  background: var(--wfx-surface-alt);
  border-radius: var(--wfx-radius-md);
}

.conversion div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.conversion span {
  font-size: 13px;
  color: var(--wfx-text);
}

.conversion b {
  font-size: 20px;
  color: var(--wfx-navy);
}

.conversion p {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--wfx-text-muted);
}

.trend {
  display: flex;
  gap: 18px;
  align-items: flex-end;
  padding-top: 8px;
}

.trend__col {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.trend__value {
  font-size: 13px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.trend__bar-wrap {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 130px;
}

.trend__bar {
  width: 100%;
  background: var(--viz-series-1);
  border-radius: 4px 4px 0 0;
}

.trend__month {
  font-size: 12px;
  color: var(--wfx-text);
}

.trend__meta {
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.reason li {
  padding: 7px 0;
}

.reason__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 13px;
}

.reason__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-2);
  border-radius: 4px;
}

.is-bad {
  font-weight: 700;
  color: var(--el-color-danger);
}

.is-good {
  color: var(--el-color-success);
}

@media (max-width: 1500px) {
  .report-grid {
    grid-template-columns: 1fr;
  }
}
</style>
