<script setup lang="ts">
import { computed } from 'vue'

import { pct } from './report-format'
import ReportCard from './ReportCard.vue'

import type { MarketReports } from '@machining-erp/shared'

const props = defineProps<{ reports: MarketReports }>()

const totalLoss = computed(() =>
  props.reports.rmaResponsibility.reduce((sum, row) => sum + row.lossAmount, 0),
)

const recoverable = computed(() =>
  props.reports.rmaResponsibility
    .filter((row) => row.responsibility.includes('委外') || row.responsibility.includes('来料') || row.responsibility.includes('客户'))
    .reduce((sum, row) => sum + row.lossAmount, 0),
)
</script>

<template>
  <ReportCard
    title="退货质量分析 · 责任归属与损失金额"
    caliber="口径：责任由品质部 8D 结论判定；损失金额含返工工时、报废材料与运费。可向委外 / 供应商 / 客户追偿的部分单独统计，并在对账单中抵扣。"
    wide
      :export-rows="reports.rmaResponsibility"
    >
    <template #extra>
      <span class="head-total">
        损失合计 {{ totalLoss.toFixed(1) }} 万 · 可追偿 {{ recoverable.toFixed(1) }} 万
      </span>
    </template>

    <el-table :data="reports.rmaResponsibility" size="small" style="width: 100%">
      <el-table-column prop="responsibility" label="责任归属" min-width="220" />
      <el-table-column prop="batches" label="批次" width="80" align="right" />
      <el-table-column label="数量" width="95" align="right">
        <template #default="{ row }">{{ row.quantity.toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="损失金额（万）" width="130" align="right">
        <template #default="{ row }">
          <b class="is-bad">{{ row.lossAmount.toFixed(1) }}</b>
        </template>
      </el-table-column>
      <el-table-column label="占比" width="190">
        <template #default="{ row }">
          <div class="share">
            <span class="share__track">
              <i class="share__bar" :style="{ width: `${row.share * 100}%` }" />
            </span>
            <em>{{ pct(row.share) }}</em>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="handled" label="处置与追偿" min-width="330" />
    </el-table>

    <p class="note">
      本厂加工不良占 46.8%，其中尺寸类问题集中在精铣与走心两道工序——与报价成本偏差分析中工时超支最严重的工序一致，
      说明「工时假设偏乐观 → 赶工 → 品质不良 → 返工损失」是同一条因果链，需在成本参考值与作业标准上一并修正。
    </p>
  </ReportCard>
</template>

<style scoped>
.head-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--wfx-navy);
}

.share {
  display: flex;
  gap: 8px;
  align-items: center;
}

.share__track {
  flex: 1;
  height: 10px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 3px;
}

.share__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-2);
}

.share em {
  width: 46px;
  font-size: 11.5px;
  font-style: normal;
  text-align: right;
  color: var(--wfx-text-muted);
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
</style>
