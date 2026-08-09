<script setup lang="ts">
import ReportCard from './ReportCard.vue'
import { pct } from './report-format'
import type { MarketReports } from '@/api/mock/sales/analytics-market.fixture'

const props = defineProps<{ reports: MarketReports }>()

const DIFFICULTY: Record<string, 'success' | 'warning' | 'danger'> = {
  常规: 'success',
  较难: 'warning',
  难加工: 'danger',
}

const maxCell = Math.max(
  ...props.reports.materialProcess.flatMap((row) => [
    row.turning,
    row.milling,
    row.fourAxis,
    row.outsource,
  ]),
)

const COLUMNS = [
  { key: 'turning', label: '车削' },
  { key: 'milling', label: '铣削 / 加工中心' },
  { key: 'fourAxis', label: '四轴 / 五轴' },
  { key: 'outsource', label: '委外表处' },
] as const

function cell(row: MarketReports['materialProcess'][number], key: string): number {
  return row[key as 'turning' | 'milling' | 'fourAxis' | 'outsource']
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="产品 · 材质 · 工艺路线分析"
      caliber="把成交订单按产品归集其材质、完整工艺路线、机时消耗与实际毛利，用于判断哪类产品该接、该调价、该退出。"
      wide
      :export-rows="reports.productProcess"
    >
      <el-table :data="reports.productProcess" size="small" style="width: 100%">
        <el-table-column prop="productName" label="产品" min-width="150" />
        <el-table-column prop="drawingNo" label="图号" width="115" />
        <el-table-column prop="material" label="材质" width="150" />
        <el-table-column prop="processRoute" label="工艺路线" min-width="330" />
        <el-table-column prop="orders" label="订单" width="70" align="right" />
        <el-table-column label="金额（万）" width="105" align="right">
          <template #default="{ row }">{{ row.amount.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="实际毛利" width="100" align="right">
          <template #default="{ row }">
            <b :class="row.marginRate < 0.18 ? 'is-bad' : 'is-good'">{{ pct(row.marginRate) }}</b>
          </template>
        </el-table-column>
        <el-table-column label="机时（h）" width="100" align="right">
          <template #default="{ row }">{{ row.machineHours }}</template>
        </el-table-column>
        <el-table-column label="加工难度" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="DIFFICULTY[row.difficulty]">{{ row.difficulty }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="note" label="结论" min-width="280" />
      </el-table>
    </ReportCard>

    <ReportCard
      title="材质 × 工艺机时矩阵"
      caliber="单位：小时。用于设备投资与工艺能力规划——某材质在某工艺上的机时集中度越高，该工艺越是瓶颈或护城河。"
      wide
      :export-rows="reports.materialProcess"
    >
      <el-table :data="reports.materialProcess" size="small" style="width: 100%">
        <el-table-column prop="material" label="材质" min-width="170" />
        <el-table-column v-for="col in COLUMNS" :key="col.key" :label="col.label" min-width="200">
          <template #default="{ row }">
            <div class="cell">
              <span class="cell__track">
                <i class="cell__bar" :style="{ width: `${(cell(row, col.key) / maxCell) * 100}%` }" />
              </span>
              <em>{{ cell(row, col.key) }}</em>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <p class="note">
        7075-T651 的四轴机时 286 小时，占全部四轴机时的 65%，与光学镜筒订单高度绑定；
        该产品毛利虽高，但产能集中在 2 台四轴设备上，是交期风险与增购决策的核心依据。
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

.cell {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cell__track {
  flex: 1;
  height: 10px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 3px;
}

.cell__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
}

.cell em {
  width: 40px;
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

.is-good {
  color: var(--el-color-success);
}
</style>
