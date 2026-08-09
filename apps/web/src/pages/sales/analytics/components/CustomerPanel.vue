<script setup lang="ts">
import ReportCard from './ReportCard.vue'

import type { SalesReports } from '@/api/mock/sales/analytics-reports.fixture'

const props = defineProps<{ reports: SalesReports }>()

const maxRank = props.reports.customerRank[0].amount

const RISK: Record<string, { label: string; type: 'success' | 'warning' | 'danger' }> = {
  normal: { label: '正常', type: 'success' },
  watch: { label: '需关注', type: 'warning' },
  churn: { label: '流失预警', type: 'danger' },
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function agingTotal(row: SalesReports['arAging'][number]): number {
  return row.notDue + row.d1to30 + row.d31to60 + row.d61to90 + row.over90
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="客户销售排名 · ABC（帕累托）"
      caliber="按年初至今订单额降序，累计占比 ≤80% 为 A 类、80–95% 为 B 类，其余 C 类；用于识别过度依赖。"
      wide
      :export-rows="reports.customerRank"
    >
      <template #extra>
        <span class="head-total">
          前 3 家贡献 {{ pct(reports.customerRank[2].cumShare) }}
        </span>
      </template>

      <ul class="rank">
        <li v-for="row in reports.customerRank" :key="row.customer">
          <div class="rank__head">
            <el-tag :type="row.grade === 'A' ? 'danger' : row.grade === 'B' ? 'warning' : 'info'" size="small">
              {{ row.grade }}
            </el-tag>
            <span class="rank__name">{{ row.customer }}</span>
            <b>{{ row.amount.toFixed(1) }} 万</b>
            <span class="rank__share">占比 {{ pct(row.share) }} · 累计 {{ pct(row.cumShare) }}</span>
          </div>
          <div class="rank__track">
            <span class="rank__bar" :style="{ width: `${(row.amount / maxRank) * 100}%` }" />
          </div>
        </li>
      </ul>
    </ReportCard>

    <ReportCard
      title="客户毛利分析"
      caliber="实际毛利率 = (订单额 − 工序级实际成本) / 订单额；量大但压价严重的客户会在此暴露。"
      :export-rows="reports.customerMargin"
    >
      <el-table :data="reports.customerMargin" size="small" style="width: 100%">
        <el-table-column prop="customer" label="客户" min-width="150" />
        <el-table-column label="订单额" width="100" align="right">
          <template #default="{ row }">{{ row.amount.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="实际毛利" width="100" align="right">
          <template #default="{ row }">
            <span :class="row.margin < row.target ? 'is-bad' : 'is-good'">{{ pct(row.margin) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="目标" width="90" align="right">
          <template #default="{ row }">{{ pct(row.target) }}</template>
        </el-table-column>
        <el-table-column label="差距" width="90" align="right">
          <template #default="{ row }">
            <span :class="row.margin < row.target ? 'is-bad' : 'is-good'">
              {{ ((row.margin - row.target) * 100).toFixed(1) }}pt
            </span>
          </template>
        </el-table-column>
      </el-table>
    </ReportCard>

    <ReportCard
      title="客户活跃度 / 流失预警"
      caliber="距最近一次下单天数 + 下单频率变化；超过该客户历史平均下单间隔 2 倍即列为流失预警。"
      :export-rows="reports.customerActivity"
    >
      <el-table :data="reports.customerActivity" size="small" style="width: 100%">
        <el-table-column prop="customer" label="客户" min-width="150" />
        <el-table-column prop="lastOrderAt" label="最近下单" width="110" />
        <el-table-column label="已间隔" width="90" align="right">
          <template #default="{ row }">{{ row.daysSince }} 天</template>
        </el-table-column>
        <el-table-column label="频率变化" width="100" align="right">
          <template #default="{ row }">
            <span :class="row.freqChange < 0 ? 'is-bad' : 'is-good'">
              {{ (row.freqChange * 100).toFixed(0) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="RISK[row.risk].type" size="small">{{ RISK[row.risk].label }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </ReportCard>

    <ReportCard
      title="新客户开发表"
      caliber="统计期内首次下单的客户、首单金额与来源渠道，用于评估获客渠道有效性。"
      :export-rows="reports.newCustomers"
    >
      <el-table :data="reports.newCustomers" size="small" style="width: 100%">
        <el-table-column prop="customer" label="客户" min-width="150" />
        <el-table-column prop="firstOrderAt" label="首单日期" width="110" />
        <el-table-column label="首单金额" width="110" align="right">
          <template #default="{ row }">
            {{ row.firstAmount ? `${row.firstAmount.toFixed(1)} 万` : '待首单' }}
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源渠道" min-width="170" />
      </el-table>
    </ReportCard>

    <ReportCard
      title="应收账款账龄表（引用财务口径 · 只读）"
      caliber="数据来自财务部应收台账，业务侧只读；逾期分档为 1–30 / 31–60 / 61–90 / 90 天以上（万元）。"
      wide
      :export-rows="reports.arAging"
    >
      <el-table :data="reports.arAging" size="small" style="width: 100%">
        <el-table-column prop="customer" label="客户" min-width="160" />
        <el-table-column label="未到期" width="110" align="right">
          <template #default="{ row }">{{ row.notDue.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="1–30 天" width="110" align="right">
          <template #default="{ row }">
            <span :class="row.d1to30 ? 'is-bad' : 'muted'">{{ row.d1to30.toFixed(1) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="31–60 天" width="110" align="right">
          <template #default="{ row }">
            <span :class="row.d31to60 ? 'is-bad' : 'muted'">{{ row.d31to60.toFixed(1) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="61–90 天" width="110" align="right">
          <template #default="{ row }">
            <span :class="row.d61to90 ? 'is-bad' : 'muted'">{{ row.d61to90.toFixed(1) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="90 天以上" width="110" align="right">
          <template #default="{ row }">
            <span :class="row.over90 ? 'is-bad' : 'muted'">{{ row.over90.toFixed(1) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="合计" width="110" align="right">
          <template #default="{ row }">
            <b>{{ agingTotal(row).toFixed(1) }}</b>
          </template>
        </el-table-column>
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

.head-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--wfx-navy);
}

.rank {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rank li {
  padding: 8px 0;
}

.rank__head {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.rank__name {
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.rank__head b {
  margin-left: auto;
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.rank__share {
  width: 210px;
  font-size: 12px;
  text-align: right;
  color: var(--wfx-text-muted);
}

.rank__track {
  height: 10px;
  margin-top: 5px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 4px;
}

.rank__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
  border-radius: 4px;
}

.is-bad {
  font-weight: 700;
  color: var(--el-color-danger);
}

.is-good {
  color: var(--el-color-success);
}

.muted {
  color: var(--wfx-text-muted);
}

@media (max-width: 1500px) {
  .report-grid {
    grid-template-columns: 1fr;
  }
}
</style>
