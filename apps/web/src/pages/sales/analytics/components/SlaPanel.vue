<script setup lang="ts">
import { computed } from 'vue'

import { pct } from './report-format'
import ReportCard from './ReportCard.vue'

import type { CostReports } from '@machining-erp/shared'

const props = defineProps<{ reports: CostReports }>()

const worst = computed(() =>
  [...props.reports.slaNodes].sort((a, b) => b.overdueRate - a.overdueRate).slice(0, 3),
)

const stockAvg = computed(() => {
  const list = props.reports.stockApproval
  return list.reduce((sum, row) => sum + row.hours, 0) / list.length
})

const stockOverdue = computed(
  () => props.reports.stockApproval.filter((row) => row.hours > row.slaHours).length,
)

const maxHours = Math.max(...props.reports.slaNodes.map((row) => row.p90Hours))

function overdueClass(rate: number): string {
  if (rate >= 0.25) {
    return 'is-bad'
  }
  return rate >= 0.12 ? 'is-warn' : 'is-good'
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="审核时效分析（各单据各节点）"
      caliber="口径：节点历时 = 节点完成时间 − 进入时间（doc_timeline 计时字段）；平均值剔除节假日，P90 用于判断长尾。超 SLA 的节点会在工作台推送并升级。"
      wide
      :export-rows="reports.slaNodes"
    >
      <template #extra>
        <span class="head-note">
          最需改善：{{ worst.map((row) => `${row.doc}·${row.node}`).join('、') }}
        </span>
      </template>

      <el-table :data="reports.slaNodes" size="small" style="width: 100%">
        <el-table-column prop="doc" label="单据" width="105">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.doc }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="node" label="审核节点" min-width="230" />
        <el-table-column prop="owner" label="责任部门" width="150" />
        <el-table-column label="平均（h）" width="105" align="right">
          <template #default="{ row }">{{ row.avgHours.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="P90（h）" width="100" align="right">
          <template #default="{ row }">{{ row.p90Hours.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="SLA（h）" width="95" align="right">
          <template #default="{ row }">{{ row.slaHours }}</template>
        </el-table-column>
        <el-table-column label="平均 vs SLA" min-width="260">
          <template #default="{ row }">
            <div class="bar">
              <span class="bar__track">
                <i class="bar__fill" :class="{ 'is-over': row.avgHours > row.slaHours }" :style="{ width: `${(row.avgHours / maxHours) * 100}%` }" />
                <i class="bar__sla" :style="{ left: `${(row.slaHours / maxHours) * 100}%` }" />
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="超期率" width="95" align="right">
          <template #default="{ row }">
            <b :class="overdueClass(row.overdueRate)">{{ pct(row.overdueRate) }}</b>
          </template>
        </el-table-column>
      </el-table>

      <p class="note">
        竖线为 SLA 位置，横条为平均历时，越过竖线即平均超期。核价、低毛利会签与备料订单总经办审批是三个主要堵点。
      </p>
    </ReportCard>

    <ReportCard
      title="备料订单总经办审批时效"
      caliber="备料订单占用公司资金且无客户订单支撑，须总经办审批。SLA 24 小时，逐单列示提交与批准时间，超时需说明原因。"
      wide
      :export-rows="reports.stockApproval"
    >
      <template #extra>
        <span class="head-note">
          平均 {{ stockAvg.toFixed(1) }} 小时 · 超 SLA {{ stockOverdue }} / {{ reports.stockApproval.length }} 单
        </span>
      </template>

      <el-table :data="reports.stockApproval" size="small" style="width: 100%">
        <el-table-column prop="docNo" label="备料单号" width="180" />
        <el-table-column prop="productName" label="产品" min-width="200" />
        <el-table-column label="数量" width="95" align="right">
          <template #default="{ row }">{{ row.qty.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="占用资金（万）" width="130" align="right">
          <template #default="{ row }">{{ row.amount.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column prop="submittedAt" label="提交时间" width="150" />
        <el-table-column prop="approvedAt" label="批准时间" width="150" />
        <el-table-column label="历时" width="110" align="right">
          <template #default="{ row }">
            <b :class="row.hours > row.slaHours ? 'is-bad' : 'is-good'">{{ row.hours.toFixed(1) }} h</b>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.hours > row.slaHours ? 'danger' : 'success'">
              {{ row.hours > row.slaHours ? '超 SLA' : '达标' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="approver" label="审批人" width="140" />
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

.head-note {
  font-size: 12.5px;
  color: var(--wfx-text-muted);
}

.bar__track {
  position: relative;
  display: block;
  height: 12px;
  background: var(--viz-grid);
  border-radius: 4px;
}

.bar__fill {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
  border-radius: 4px;
}

.bar__fill.is-over {
  background: var(--el-color-danger);
}

.bar__sla {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 16px;
  background: var(--wfx-text-strong);
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

.is-good {
  color: var(--el-color-success);
}
</style>
