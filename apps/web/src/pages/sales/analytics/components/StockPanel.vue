<script setup lang="ts">
import { levelTag, pct } from './report-format'
import ReportCard from './ReportCard.vue'

import type { OrderExtraReports } from '@machining-erp/shared'

const props = defineProps<{ reports: OrderExtraReports }>()

const STATUS_TAG: Record<string, 'warning' | 'success' | 'info'> = {
  生产中: 'warning',
  已入库: 'success',
  已耗尽: 'info',
}

const maxAging = Math.max(...props.reports.stockAging.map((row) => row.amount))

function blendedFormula(row: OrderExtraReports['stockConsume'][number]): string {
  if (row.produceQty === 0) {
    return `全部领用备料，单件 ${row.stockUnitCost.toFixed(2)}`
  }
  const total = row.usedQty + row.produceQty
  return `(${row.stockUnitCost.toFixed(2)}×${row.usedQty} + ${row.produceUnitCost.toFixed(2)}×${row.produceQty}) / ${total} = ${row.blendedUnitCost.toFixed(2)}`
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="备料订单完工入库进度"
      caliber="备料订单不向客户交货，产品全部入库即视为订单完成；入库进度 = 已入库数量 / 计划数量。"
      wide
      :export-rows="reports.stockProgress"
    >
      <el-table :data="reports.stockProgress" size="small" style="width: 100%">
        <el-table-column prop="docNo" label="备料单号" width="175" />
        <el-table-column prop="productName" label="产品" min-width="140" />
        <el-table-column prop="drawingNo" label="图号" width="120" />
        <el-table-column label="计划" width="90" align="right">
          <template #default="{ row }">{{ row.planQty.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="完工" width="90" align="right">
          <template #default="{ row }">{{ row.finishedQty.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="已入库" width="95" align="right">
          <template #default="{ row }">{{ row.stockedQty.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="入库进度" width="190">
          <template #default="{ row }">
            <el-progress :percentage="Math.round(row.rate * 100)" :stroke-width="10" />
          </template>
        </el-table-column>
        <el-table-column prop="eta" label="预计完成" width="115" />
        <el-table-column label="状态" width="95">
          <template #default="{ row }">
            <el-tag size="small" :type="STATUS_TAG[row.status]">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </ReportCard>

    <ReportCard
      title="备料库龄分布与资金占用"
      caliber="库龄自入库日起算；占用资金 = 已入库未领用数量 × 备料单件生产成本。超 90 天进入呆滞并需在月度经营会说明处置方案。"
      :export-rows="reports.stockAging"
    >
      <div class="capital">
        <div class="capital__item">
          <span>占用资金</span>
          <b>{{ reports.stockCapital.totalAmount.toFixed(1) }} 万</b>
        </div>
        <div class="capital__item">
          <span>其中呆滞</span>
          <b class="is-bad">{{ reports.stockCapital.idleAmount.toFixed(1) }} 万</b>
        </div>
        <div class="capital__item">
          <span>平均周转</span>
          <b>{{ reports.stockCapital.turnoverDays }} 天</b>
        </div>
      </div>

      <div class="aging">
        <div v-for="row in reports.stockAging" :key="row.bucket" class="aging__row">
          <span class="aging__label">{{ row.bucket }}</span>
          <span class="aging__track">
            <i
              class="aging__bar"
              :class="{ 'is-idle': row.bucket.startsWith('＞') }"
              :style="{ width: `${(row.amount / maxAging) * 100}%` }"
            />
          </span>
          <span class="aging__meta">
            {{ row.batches }} 批 · {{ row.quantity.toLocaleString() }} 件 ·
            {{ row.amount.toFixed(1) }} 万（{{ pct(row.share) }}）
          </span>
        </div>
      </div>

      <p class="note">{{ reports.stockCapital.note }}</p>
    </ReportCard>

    <ReportCard
      title="呆滞预警"
      caliber="库龄超 90 天，或对应图号已发生 ECN / 客户预测下调时触发；呆滞备料须给出消化、改制或报废结论。"
      :export-rows="reports.stockIdle"
    >
      <el-table :data="reports.stockIdle" size="small" style="width: 100%">
        <el-table-column prop="stockNo" label="备料单号" width="175" />
        <el-table-column prop="productName" label="产品" min-width="150" />
        <el-table-column label="余量" width="85" align="right">
          <template #default="{ row }">{{ row.remainingQty.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="库龄" width="85" align="right">
          <template #default="{ row }">
            <b :class="row.level === 'idle' ? 'is-bad' : 'is-warn'">{{ row.ageDays }} 天</b>
          </template>
        </el-table-column>
        <el-table-column label="占用（万）" width="105" align="right">
          <template #default="{ row }">{{ row.amount.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="等级" width="85">
          <template #default="{ row }">
            <el-tag size="small" :type="levelTag(row.level)">
              {{ row.level === 'idle' ? '呆滞' : '观察' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="suggestion" label="处置建议" min-width="300" />
      </el-table>
    </ReportCard>

    <ReportCard
      title="备料消耗履历与加权平均成本"
      caliber="正式订单领用备料时按「(备料单价×领用数 + 新投产单价×投产数) / 订单数量」计算该订单的加权平均生产成本，并写入成本回溯。"
      wide
      :export-rows="reports.stockConsume"
    >
      <el-table :data="reports.stockConsume" size="small" style="width: 100%">
        <el-table-column prop="date" label="领用日期" width="110" />
        <el-table-column prop="stockNo" label="备料单号" width="175" />
        <el-table-column prop="orderNo" label="正式订单" width="175" />
        <el-table-column label="领用 / 单价" width="130" align="right">
          <template #default="{ row }">
            {{ row.usedQty.toLocaleString() }} × {{ row.stockUnitCost.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column label="新投产 / 单价" width="140" align="right">
          <template #default="{ row }">
            {{ row.produceQty === 0 ? '—' : `${row.produceQty.toLocaleString()} × ${row.produceUnitCost.toFixed(2)}` }}
          </template>
        </el-table-column>
        <el-table-column label="加权平均" width="105" align="right">
          <template #default="{ row }">
            <b class="blended">{{ row.blendedUnitCost.toFixed(2) }}</b>
          </template>
        </el-table-column>
        <el-table-column label="计算式" min-width="330">
          <template #default="{ row }">
            <span class="formula">{{ blendedFormula(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="剩余" width="90" align="right">
          <template #default="{ row }">{{ row.remaining.toLocaleString() }}</template>
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

.capital {
  display: flex;
  gap: 26px;
  padding-bottom: 12px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.capital__item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.capital__item span {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.capital__item b {
  font-size: 20px;
  color: var(--wfx-navy);
}

.aging__row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 7px 0;
}

.aging__label {
  width: 84px;
  font-size: 12.5px;
  color: var(--wfx-text);
}

.aging__track {
  flex: 1;
  height: 11px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 4px;
}

.aging__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
}

.aging__bar.is-idle {
  background: var(--el-color-danger);
}

.aging__meta {
  width: 250px;
  font-size: 11.5px;
  text-align: right;
  color: var(--wfx-text-muted);
}

.blended {
  color: var(--wfx-navy);
}

.formula {
  font-size: 12px;
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

.is-warn {
  color: var(--el-color-warning);
}

@media (max-width: 1500px) {
  .report-grid {
    grid-template-columns: 1fr;
  }
}
</style>
