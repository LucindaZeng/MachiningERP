<script setup lang="ts">
import SparkLine from '@/components/charts/SparkLine.vue'

import ReportCard from './ReportCard.vue'

import type { SalesReports } from '@/api/mock/sales/analytics-reports.fixture'

defineProps<{ reports: SalesReports }>()

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function priceValues(row: SalesReports['priceTrend'][number]): number[] {
  return row.history.map((item) => item.price)
}

function priceUp(row: SalesReports['priceTrend'][number]): boolean {
  return row.history[row.history.length - 1].price > row.history[0].price
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="产品毛利排名"
      caliber="按产品汇总订单额与实际毛利率，并对照报价毛利；差距大的产品需结合成本偏差表回头修正报价。"
      wide
      :export-rows="reports.productMargin"
    >
      <el-table :data="reports.productMargin" size="small" style="width: 100%">
        <el-table-column prop="productName" label="产品" min-width="180" />
        <el-table-column prop="drawingNo" label="图号" width="130" />
        <el-table-column label="订单额（万）" width="120" align="right">
          <template #default="{ row }">{{ row.amount.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="报价毛利" width="110" align="right">
          <template #default="{ row }">{{ pct(row.quotedMargin) }}</template>
        </el-table-column>
        <el-table-column label="实际毛利" width="110" align="right">
          <template #default="{ row }">
            <span :class="row.margin < row.quotedMargin ? 'is-bad' : 'is-good'">
              {{ pct(row.margin) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="差距" width="100" align="right">
          <template #default="{ row }">
            <span :class="row.margin < row.quotedMargin ? 'is-bad' : 'is-good'">
              {{ ((row.margin - row.quotedMargin) * 100).toFixed(1) }}pt
            </span>
          </template>
        </el-table-column>
        <el-table-column label="结论" min-width="200">
          <template #default="{ row }">
            {{
              row.margin < 0.15
                ? '亏损风险，建议提价或退出'
                : row.margin < row.quotedMargin
                  ? '实际低于报价，需修正工时假设'
                  : '达标'
            }}
          </template>
        </el-table-column>
      </el-table>
    </ReportCard>

    <ReportCard
      title="材质维度分析"
      caliber="按材质统计订单额占比与同比变化（万元），支撑材料采购与库存策略。"
      :export-rows="reports.materialMix"
    >
      <ul class="mix">
        <li v-for="row in reports.materialMix" :key="row.name">
          <div class="mix__head">
            <span>{{ row.name }}</span>
            <b>{{ row.value.toFixed(1) }} 万 · {{ pct(row.share) }}</b>
          </div>
          <div class="mix__track">
            <span class="mix__bar" :style="{ width: `${row.share * 100}%` }" />
          </div>
          <span class="mix__trend" :class="row.trend.startsWith('-') ? 'is-bad' : 'is-good'">
            同比 {{ row.trend }}
          </span>
        </li>
      </ul>
    </ReportCard>

    <ReportCard
      title="工艺产能需求趋势"
      caliber="按工艺统计机时需求（小时）与同比变化，反过来支撑设备投资决策。"
      :export-rows="reports.processMix"
    >
      <ul class="mix">
        <li v-for="row in reports.processMix" :key="row.name">
          <div class="mix__head">
            <span>{{ row.name }}</span>
            <b>{{ row.value }} 小时 · {{ pct(row.share) }}</b>
          </div>
          <div class="mix__track">
            <span class="mix__bar is-alt" :style="{ width: `${row.share * 100}%` }" />
          </div>
          <span class="mix__trend" :class="row.trend.startsWith('-') ? 'is-bad' : 'is-good'">
            同比 {{ row.trend }}
          </span>
        </li>
      </ul>
      <p class="note">
        四轴 / 五轴机时同比 +31.5%，若维持该增速，现有 2 台四轴将在 Q4 成为瓶颈，需评估增购。
      </p>
    </ReportCard>

    <ReportCard
      title="价格趋势表（对照原材料波动）"
      caliber="同一产品历次报价 / 成交价变化，与对应材料的月涨跌对照，判断是否需要调价。"
      wide
      :export-rows="reports.priceTrend"
    >
      <el-table :data="reports.priceTrend" size="small" style="width: 100%">
        <el-table-column prop="productName" label="产品" min-width="160" />
        <el-table-column prop="drawingNo" label="图号" width="120" />
        <el-table-column label="历次价格" width="230">
          <template #default="{ row }">
            <span v-for="point in row.history" :key="point.date" class="price-point">
              {{ point.date }} · {{ point.price }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="走势" width="110">
          <template #default="{ row }">
            <SparkLine :values="priceValues(row)" :positive="priceUp(row)" />
          </template>
        </el-table-column>
        <el-table-column label="材料月涨跌" width="120" align="right">
          <template #default="{ row }">
            <span class="is-bad">+{{ (row.materialChange * 100).toFixed(1) }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="suggestion" label="调价建议" min-width="300" />
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

.mix {
  margin: 0;
  padding: 0;
  list-style: none;
}

.mix li {
  padding: 8px 0;
}

.mix__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wfx-text);
}

.mix__track {
  height: 10px;
  margin: 5px 0 3px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 4px;
}

.mix__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
  border-radius: 4px;
}

.mix__bar.is-alt {
  background: var(--viz-series-3);
}

.mix__trend {
  font-size: 11.5px;
}

.price-point {
  display: block;
  font-size: 12px;
  color: var(--wfx-text);
}

.note {
  margin: 12px 0 0;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.7;
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

@media (max-width: 1500px) {
  .report-grid {
    grid-template-columns: 1fr;
  }
}
</style>
