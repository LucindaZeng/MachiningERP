<script setup lang="ts">
import { computed } from 'vue'

import ReportCard from './ReportCard.vue'

import type { SalesReports } from '@/api/mock/sales/analytics-reports.fixture'

const props = defineProps<{ reports: SalesReports }>()

const maxPlan = Math.max(...props.reports.shipmentAchieve.map((row) => row.planned))

const uninvoiced = computed(() =>
  props.reports.invoiceReceivable
    .filter((row) => !row.invoiced)
    .reduce((sum, row) => sum + row.amount, 0),
)

const unreceived = computed(() =>
  props.reports.invoiceReceivable
    .filter((row) => row.invoiced && !row.received)
    .reduce((sum, row) => sum + row.amount, 0),
)

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="出货达成表"
      caliber="出货计划 vs 实际出货额（万元），按月统计；计划取 PMC 周 / 月交货计划，实际取已发货单金额。"
      wide
      :export-rows="reports.shipmentAchieve"
    >
      <div class="achieve">
        <div v-for="row in reports.shipmentAchieve" :key="row.month" class="achieve__col">
          <div class="achieve__bars">
            <span class="achieve__plan" :style="{ height: `${(row.planned / maxPlan) * 100}%` }" />
            <span class="achieve__actual" :style="{ height: `${(row.actual / maxPlan) * 100}%` }" />
          </div>
          <span class="achieve__month">{{ row.month.slice(2) }}</span>
          <span class="achieve__rate" :class="row.rate < 0.95 ? 'is-bad' : 'is-good'">
            {{ pct(row.rate) }}
          </span>
          <span class="achieve__meta">{{ row.actual.toFixed(1) }} / {{ row.planned.toFixed(1) }}</span>
        </div>
      </div>

      <div class="legend">
        <span><i class="legend__plan" />计划</span>
        <span><i class="legend__actual" />实际</span>
        <span class="legend__note">
          7 月达成率 92.6%，缺口主要来自探头支架报关未齐套与模具签收延迟。
        </span>
      </div>
    </ReportCard>

    <ReportCard
      title="开票与回款对照表"
      caliber="出货未开票、开票未回款清单；账龄自出货日起算，超账期进入逾期应收并预警业务与财务。"
      wide
      :export-rows="reports.invoiceReceivable"
    >
      <template #extra>
        <span class="head-total">
          出货未开票 {{ uninvoiced.toFixed(1) }} 万 · 开票未回款 {{ unreceived.toFixed(1) }} 万
        </span>
      </template>

      <el-table :data="reports.invoiceReceivable" size="small" style="width: 100%">
        <el-table-column prop="docNo" label="发货单" width="180" />
        <el-table-column prop="customer" label="客户" min-width="150" />
        <el-table-column prop="shippedAt" label="出货日期" width="110" />
        <el-table-column label="金额（万）" width="110" align="right">
          <template #default="{ row }">{{ row.amount.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="开票" width="100">
          <template #default="{ row }">
            <el-tag :type="row.invoiced ? 'success' : 'warning'" size="small">
              {{ row.invoiced ? '已开票' : '未开票' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="回款" width="100">
          <template #default="{ row }">
            <el-tag :type="row.received ? 'success' : 'info'" size="small">
              {{ row.received ? '已回款' : '未回款' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="账龄" width="90" align="right">
          <template #default="{ row }">
            <span :class="row.ageDays > 20 && !row.received ? 'is-bad' : ''">
              {{ row.ageDays }} 天
            </span>
          </template>
        </el-table-column>
        <el-table-column label="待办" min-width="220">
          <template #default="{ row }">
            {{
              !row.invoiced
                ? '客户签收单回传后开票'
                : row.received
                  ? '已结清'
                  : '在账期内，跟踪回款计划'
            }}
          </template>
        </el-table-column>
      </el-table>
    </ReportCard>
  </div>
</template>

<style scoped>
.report-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.head-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--wfx-navy);
}

.achieve {
  display: flex;
  gap: 26px;
  align-items: flex-end;
  padding-top: 6px;
}

.achieve__col {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.achieve__bars {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  width: 100%;
  height: 140px;
}

.achieve__plan,
.achieve__actual {
  flex: 1;
  border-radius: 4px 4px 0 0;
}

.achieve__plan {
  background: var(--viz-grid);
}

.achieve__actual {
  background: var(--viz-series-1);
}

.achieve__month {
  font-size: 12px;
  color: var(--wfx-text);
}

.achieve__rate {
  font-size: 13px;
  font-weight: 700;
}

.achieve__meta {
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.legend {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-top: 14px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 5px;
  border-radius: 2px;
}

.legend__plan {
  background: var(--viz-grid);
}

.legend__actual {
  background: var(--viz-series-1);
}

.legend__note {
  margin-left: auto;
}

.is-bad {
  font-weight: 700;
  color: var(--el-color-danger);
}

.is-good {
  color: var(--el-color-success);
}
</style>
