<script setup lang="ts">
import ReportCard from './ReportCard.vue'

import type { SalesReports } from '@/api/mock/sales/analytics-reports.fixture'

const props = defineProps<{ reports: SalesReports }>()

const maxFunnel = props.reports.quoteFunnel[0].count
const maxLost = Math.max(...props.reports.lostReasons.map((row) => row.count))

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="报价台账 / 报价漏斗"
      caliber="近 90 天：询价 → 已核价 → 已报出 → 客户确认 → 转订单，逐级转化率；核价与报价均以最终版本去重。"
      wide
    
      :export-rows="reports.quoteFunnel"
    >
      <div class="funnel">
        <div v-for="(row, index) in reports.quoteFunnel" :key="row.stage" class="funnel__row">
          <span class="funnel__stage">{{ row.stage }}</span>
          <div class="funnel__track">
            <span class="funnel__bar" :style="{ width: `${(row.count / maxFunnel) * 100}%` }" />
          </div>
          <b class="funnel__count">{{ row.count }}</b>
          <span class="funnel__rate">
            {{
              index === 0
                ? '—'
                : `环比 ${pct(row.count / reports.quoteFunnel[index - 1].count)}`
            }}
          </span>
          <span class="funnel__hint">{{ row.hint }}</span>
        </div>
      </div>
    </ReportCard>

    <ReportCard
      title="报价成交率 · 按业务员"
      caliber="成交率 = 客户确认的报价数 / 已报出报价数；平均毛利为报价核算口径。"
      :export-rows="reports.quoteByOwner"
    >
      <el-table :data="reports.quoteByOwner" size="small" style="width: 100%">
        <el-table-column prop="name" label="业务员" width="100" />
        <el-table-column prop="quoted" label="已报出" width="80" align="right" />
        <el-table-column prop="won" label="成交" width="70" align="right" />
        <el-table-column label="成交率" width="90" align="right">
          <template #default="{ row }">{{ pct(row.rate) }}</template>
        </el-table-column>
        <el-table-column label="平均报价毛利" align="right">
          <template #default="{ row }">{{ pct(row.avgMargin) }}</template>
        </el-table-column>
      </el-table>
    </ReportCard>

    <ReportCard
      title="报价成交率 · 按材质"
      caliber="用于判断哪类材质的报价竞争力最强，结合毛利决定接单取舍。"
      :export-rows="reports.quoteByMaterial"
    >
      <el-table :data="reports.quoteByMaterial" size="small" style="width: 100%">
        <el-table-column prop="name" label="材质" min-width="150" />
        <el-table-column prop="quoted" label="已报出" width="80" align="right" />
        <el-table-column prop="won" label="成交" width="70" align="right" />
        <el-table-column label="成交率" width="90" align="right">
          <template #default="{ row }">{{ pct(row.rate) }}</template>
        </el-table-column>
        <el-table-column label="平均毛利" width="90" align="right">
          <template #default="{ row }">{{ pct(row.avgMargin) }}</template>
        </el-table-column>
      </el-table>
    </ReportCard>

    <ReportCard
      title="未成交原因分布"
      caliber="报价关闭时必须选择标准原因，金额为该报价的预计订单额（万元）。"
      :export-rows="reports.lostReasons"
    >
      <ul class="reason">
        <li v-for="row in reports.lostReasons" :key="row.reason">
          <div class="reason__head">
            <span>{{ row.reason }}</span>
            <b>{{ row.count }} 单 · {{ row.amount }} 万</b>
          </div>
          <div class="reason__track">
            <span class="reason__bar" :style="{ width: `${(row.count / maxLost) * 100}%` }" />
          </div>
        </li>
      </ul>
    </ReportCard>

    <ReportCard
      title="报价周期表（含超时预警）"
      caliber="核价用时 + 审核用时 = 询价到报出总历时；SLA 48 小时，超时标红并升级业务经理。"
      :export-rows="reports.quoteCycle"
    >
      <el-table :data="reports.quoteCycle" size="small" style="width: 100%">
        <el-table-column prop="docNo" label="报价单号" width="165" />
        <el-table-column prop="customer" label="客户" min-width="130" show-overflow-tooltip />
        <el-table-column label="核价用时" width="95" align="right">
          <template #default="{ row }">{{ row.costingHours }}h</template>
        </el-table-column>
        <el-table-column label="审核用时" width="95" align="right">
          <template #default="{ row }">{{ row.approvalHours }}h</template>
        </el-table-column>
        <el-table-column label="总历时" width="100" align="right">
          <template #default="{ row }">
            <span :class="row.overdue ? 'is-bad' : ''">{{ row.totalHours }}h</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.overdue ? 'danger' : 'success'" size="small">
              {{ row.overdue ? '超时' : '按时' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </ReportCard>

    <ReportCard
      title="报价成本偏差表（CNC 关键表）"
      caliber="报价时预估单件成本 vs 工序级实际成本；偏差为正说明报价低估，必须回头修正工时与刀具假设。"
      wide
      :export-rows="reports.costVariance"
    >
      <el-table :data="reports.costVariance" size="small" style="width: 100%">
        <el-table-column prop="productName" label="产品" min-width="160" />
        <el-table-column prop="drawingNo" label="图号" width="120" />
        <el-table-column label="报价预估成本" width="120" align="right">
          <template #default="{ row }">{{ row.quotedCost }}</template>
        </el-table-column>
        <el-table-column label="实际成本" width="110" align="right">
          <template #default="{ row }">{{ row.actualCost }}</template>
        </el-table-column>
        <el-table-column label="偏差" width="100" align="right">
          <template #default="{ row }">
            <span :class="row.gapRate > 0 ? 'is-bad' : 'is-good'">
              {{ row.gapRate > 0 ? '+' : '' }}{{ (row.gapRate * 100).toFixed(1) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="mainReason" label="主要偏差原因" min-width="320" />
      </el-table>
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

.funnel__row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
}

.funnel__stage {
  width: 90px;
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.funnel__track {
  width: 300px;
  height: 12px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 4px;
}

.funnel__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
  border-radius: 4px;
}

.funnel__count {
  width: 50px;
  font-size: 15px;
  text-align: right;
  color: var(--wfx-text-strong);
}

.funnel__rate {
  width: 110px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.funnel__hint {
  flex: 1;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.reason {
  margin: 0;
  padding: 0;
  list-style: none;
}

.reason li {
  padding: 7px 0;
}

.reason__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wfx-text);
}

.reason__track {
  height: 8px;
  margin-top: 5px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 4px;
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
