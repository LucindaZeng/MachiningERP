<script setup lang="ts">
import ReportCard from './ReportCard.vue'

import type { SalesReports } from '@/api/mock/sales/analytics-reports.fixture'

const props = defineProps<{ reports: SalesReports }>()

const totalBatches = props.reports.rmaStats.reduce((sum, row) => sum + row.batches, 0)
const totalAmount = props.reports.rmaStats.reduce((sum, row) => sum + row.amount, 0)
const maxShare = Math.max(...props.reports.rmaStats.map((row) => row.share))

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="RMA 统计表"
      caliber="按退货原因统计批次数、数量与金额（万元）；原因取品质判定结论，责任归属另见退货管理。"
      wide
      :export-rows="reports.rmaStats"
    >
      <template #extra>
        <span class="head-total">
          合计 {{ totalBatches }} 批 · {{ totalAmount.toFixed(1) }} 万元
        </span>
      </template>

      <div class="rma">
        <div class="rma__chart">
          <div v-for="row in reports.rmaStats" :key="row.reason" class="rma__row">
            <span class="rma__reason">{{ row.reason }}</span>
            <div class="rma__track">
              <span class="rma__bar" :style="{ width: `${(row.share / maxShare) * 100}%` }" />
            </div>
            <b class="rma__share">{{ pct(row.share) }}</b>
          </div>
        </div>

        <el-table :data="reports.rmaStats" size="small" style="width: 100%">
          <el-table-column prop="reason" label="退货原因" min-width="200" />
          <el-table-column prop="batches" label="批次" width="80" align="right" />
          <el-table-column prop="quantity" label="数量" width="90" align="right" />
          <el-table-column label="金额（万）" width="110" align="right">
            <template #default="{ row }">{{ row.amount.toFixed(1) }}</template>
          </el-table-column>
          <el-table-column label="占比" width="90" align="right">
            <template #default="{ row }">{{ pct(row.share) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </ReportCard>

    <ReportCard
      title="重复问题客户表"
      caliber="同一客户 + 同一产品在 6 个月内出现 2 次及以上客诉即入表；重复问题必须进 8D 并复盘报价与工艺假设。"
      wide
      :export-rows="reports.repeatIssues"
    >
      <el-table :data="reports.repeatIssues" size="small" style="width: 100%">
        <el-table-column prop="customer" label="客户" min-width="160" />
        <el-table-column prop="productName" label="产品" min-width="150" />
        <el-table-column label="发生次数" width="110" align="right">
          <template #default="{ row }">
            <b class="is-bad">{{ row.times }}</b>
          </template>
        </el-table-column>
        <el-table-column prop="lastAt" label="最近一次" width="120" />
        <el-table-column prop="status" label="当前处置状态" min-width="320" />
      </el-table>

      <p class="note">
        重复问题会同时推送品质部与业务经理；连续三次同类问题需由总经办组织复盘，
        并回写到报价成本假设（如去毛刺工时、委外表处单价）。
      </p>
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

.rma {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}

.rma__row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
}

.rma__reason {
  width: 190px;
  font-size: 12.5px;
  color: var(--wfx-text);
}

.rma__track {
  flex: 1;
  height: 12px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 4px;
}

.rma__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-2);
  border-radius: 4px;
}

.rma__share {
  width: 56px;
  font-size: 13px;
  text-align: right;
  color: var(--wfx-text-strong);
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

.is-bad {
  color: var(--el-color-danger);
}

@media (max-width: 1500px) {
  .rma {
    grid-template-columns: 1fr;
  }
}
</style>
