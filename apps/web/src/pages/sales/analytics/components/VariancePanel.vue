<script setup lang="ts">
import { computed, ref } from 'vue'

import { levelTag, pct, signedPct } from './report-format'
import ReportCard from './ReportCard.vue'

import type { CostReports } from '@machining-erp/shared'

const props = defineProps<{ reports: CostReports }>()

const DIMENSIONS = ['产品', '材质', '报价工程师'] as const
const dimension = ref<(typeof DIMENSIONS)[number]>('产品')

const drillRows = computed(() => props.reports.drill.filter((row) => row.dimension === dimension.value))

const alertCount = computed(() => props.reports.drill.filter((row) => row.level === 'alert').length)

const LEVEL_LABEL: Record<string, string> = { ok: '正常', watch: '预警', alert: '报警' }

const STATUS_TAG: Record<string, 'info' | 'success' | 'danger'> = {
  待确认: 'info',
  已采纳: 'success',
  已驳回: 'danger',
}

function gapClass(value: number): string {
  if (value >= props.reports.threshold.alert) {
    return 'is-alert'
  }
  if (value >= props.reports.threshold.warn) {
    return 'is-warn'
  }
  return value < 0 ? 'is-good' : ''
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="报价成本偏差分析 · 材料 / 加工时间 / 工艺"
      caliber="口径：实际成本取生产订单的工序报工、领料与委外对账，报价成本取核价单同工序预估值；领用备料的订单按加权平均成本参与计算。"
      wide
      :export-rows="reports.elementVariance"
    >
      <template #extra>
        <span class="head-note">
          阈值 ±{{ pct(reports.threshold.warn, 0) }} 预警 / ±{{ pct(reports.threshold.alert, 0) }} 报警 ·
          当前 {{ alertCount }} 项报警
        </span>
      </template>

      <div class="elem">
        <div v-for="row in reports.elementVariance" :key="row.element" class="elem__card">
          <div class="elem__head">
            <span class="elem__name">{{ row.element }}</span>
            <el-tag size="small" :type="row.gapRate >= reports.threshold.alert ? 'danger' : 'warning'">
              {{ signedPct(row.gapRate) }}
            </el-tag>
          </div>
          <div class="elem__bars">
            <div class="elem__bar-row">
              <span class="elem__label">报价</span>
              <span class="elem__track">
                <i class="elem__bar is-quoted" :style="{ width: `${(row.quoted / row.actual) * 100}%` }" />
              </span>
              <b>{{ row.quoted.toFixed(1) }}</b>
            </div>
            <div class="elem__bar-row">
              <span class="elem__label">实际</span>
              <span class="elem__track"><i class="elem__bar is-actual" style="width: 100%" /></span>
              <b>{{ row.actual.toFixed(1) }}</b>
            </div>
          </div>
          <p class="elem__meta">
            占报价成本 {{ pct(row.share) }} · 覆盖 {{ row.orders }} 张成交订单（单位：元/件加权）
          </p>
          <p class="elem__reason">{{ row.mainReason }}</p>
        </div>
      </div>
    </ReportCard>

    <ReportCard
      title="偏差下钻：按产品 / 材质 / 报价工程师"
      caliber="同一批成交订单按维度重新归集，定位偏差是产品设计问题、材料问题，还是报价假设问题。"
      wide
    
      :export-rows="drillRows"
    >
      <template #extra>
        <el-radio-group v-model="dimension" size="small">
          <el-radio-button v-for="item in DIMENSIONS" :key="item" :value="item">{{ item }}</el-radio-button>
        </el-radio-group>
      </template>

      <el-table :data="drillRows" size="small" style="width: 100%">
        <el-table-column prop="name" :label="dimension" min-width="190" />
        <el-table-column prop="orders" label="订单数" width="85" align="right" />
        <el-table-column label="材料偏差" width="105" align="right">
          <template #default="{ row }">
            <span :class="gapClass(row.materialGap)">{{ signedPct(row.materialGap) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="加工时间偏差" width="120" align="right">
          <template #default="{ row }">
            <span :class="gapClass(row.timeGap)">{{ signedPct(row.timeGap) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="工艺偏差" width="105" align="right">
          <template #default="{ row }">
            <span :class="gapClass(row.processGap)">{{ signedPct(row.processGap) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="综合偏差" width="105" align="right">
          <template #default="{ row }">
            <b :class="gapClass(row.totalGap)">{{ signedPct(row.totalGap) }}</b>
          </template>
        </el-table-column>
        <el-table-column label="判定" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="levelTag(row.level)">{{ LEVEL_LABEL[row.level] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="action" label="修正动作" min-width="320" />
      </el-table>
    </ReportCard>

    <ReportCard
      title="工序级偏差排行"
      caliber="把所有成交订单的工序成本行汇总，按偏差率排序，直接指向要修正的那一道工序。"
      :export-rows="reports.operationVariance"
    >
      <el-table :data="reports.operationVariance" size="small" style="width: 100%">
        <el-table-column prop="operation" label="工序" min-width="140" />
        <el-table-column prop="element" label="分项" width="95" />
        <el-table-column prop="orders" label="订单" width="70" align="right" />
        <el-table-column label="报价" width="80" align="right">
          <template #default="{ row }">{{ row.quoted.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="实际" width="80" align="right">
          <template #default="{ row }">{{ row.actual.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="偏差率" width="95" align="right">
          <template #default="{ row }">
            <b :class="gapClass(row.gapRate)">{{ signedPct(row.gapRate) }}</b>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="主要原因" min-width="220" />
      </el-table>
    </ReportCard>

    <ReportCard
      title="成本参考值修正（偏差反馈闭环）"
      caliber="偏差分析的输出直接写回报价用的成本参考值：损耗率、机台工时、委外单价、分摊基数。采纳后新报价自动取新值。"
      :export-rows="reports.costRef"
    >
      <el-table :data="reports.costRef" size="small" style="width: 100%">
        <el-table-column prop="item" label="参考值项目" min-width="160" />
        <el-table-column prop="scope" label="适用范围" min-width="150" />
        <el-table-column prop="current" label="现值" width="130" />
        <el-table-column label="建议值" width="180">
          <template #default="{ row }">
            <b class="suggest">{{ row.suggested }}</b>
          </template>
        </el-table-column>
        <el-table-column prop="basis" label="依据" min-width="260" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="STATUS_TAG[row.status]">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <p class="note">{{ reports.threshold.note }}</p>
    </ReportCard>
  </div>
</template>

<style scoped>
.report-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.head-note {
  font-size: 12.5px;
  color: var(--wfx-text-muted);
}

.elem {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.elem__card {
  padding: 12px 14px;
  background: var(--wfx-surface-alt);
  border-radius: 6px;
}

.elem__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.elem__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.elem__bars {
  margin: 12px 0 8px;
}

.elem__bar-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 3px 0;
}

.elem__label {
  width: 32px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.elem__track {
  flex: 1;
  height: 10px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 3px;
}

.elem__bar {
  display: block;
  height: 100%;
}

.elem__bar.is-quoted {
  background: var(--viz-series-1);
}

.elem__bar.is-actual {
  background: var(--viz-series-2);
}

.elem__bar-row b {
  width: 46px;
  font-size: 12.5px;
  text-align: right;
  color: var(--wfx-text-strong);
}

.elem__meta {
  margin: 0;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.elem__reason {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--wfx-text);
}

.suggest {
  color: var(--wfx-navy);
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

.is-alert {
  font-weight: 700;
  color: var(--el-color-danger);
}

.is-warn {
  color: var(--el-color-warning);
}

.is-good {
  color: var(--el-color-success);
}

@media (max-width: 1400px) {
  .elem {
    grid-template-columns: 1fr;
  }
}
</style>
