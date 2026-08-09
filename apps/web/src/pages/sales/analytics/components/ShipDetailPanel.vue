<script setup lang="ts">
import { pct } from './report-format'
import ReportCard from './ReportCard.vue'

import type { MarketReports } from '@/api/mock/sales/analytics-market.fixture'

const props = defineProps<{ reports: MarketReports }>()

const maxShare = Math.max(...props.reports.shipBlockers.map((row) => row.share))

const TAIL_TAG: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
  '补做（客户要求足额）': 'warning',
  分批出货: 'info',
  '尾数取消（在允收范围）': 'success',
  待定: 'danger',
}
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="部分出货与尾数处理"
      caliber="订单未一次出清即入表。尾数四条路径：补做、分批出货、尾数取消（允收范围内）、转下一批次；路径必须在出货单关单前确定。"
      wide
      :export-rows="reports.partialShip"
    >
      <el-table :data="reports.partialShip" size="small" style="width: 100%">
        <el-table-column prop="orderNo" label="订单号" width="170" />
        <el-table-column prop="customer" label="客户" min-width="170" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="160" show-overflow-tooltip />
        <el-table-column label="订单量" width="90" align="right">
          <template #default="{ row }">{{ row.orderQty.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="已出" width="90" align="right">
          <template #default="{ row }">{{ row.shippedQty.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="出货进度" width="170">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.round((row.shippedQty / row.orderQty) * 100)"
              :stroke-width="10"
            />
          </template>
        </el-table-column>
        <el-table-column label="尾数" width="85" align="right">
          <template #default="{ row }">
            <b class="is-warn">{{ row.remainQty.toLocaleString() }}</b>
          </template>
        </el-table-column>
        <el-table-column label="尾数路径" width="185">
          <template #default="{ row }">
            <el-tag size="small" :type="TAIL_TAG[row.tailPath] ?? 'info'">{{ row.tailPath }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="dueDate" label="交期" width="105" />
        <el-table-column prop="note" label="说明" min-width="280" />
      </el-table>
    </ReportCard>

    <ReportCard
      title="出货阻断原因分析"
      caliber="统计「已完工待出货」到实际出货之间的阻断原因、影响数量与平均延误天数，责任部门用于月度改善考核。"
      wide
      :export-rows="reports.shipBlockers"
    >
      <div class="blockers">
        <div class="blockers__chart">
          <div v-for="row in reports.shipBlockers" :key="row.reason" class="blockers__row">
            <span class="blockers__reason">{{ row.reason }}</span>
            <span class="blockers__track">
              <i class="blockers__bar" :style="{ width: `${(row.share / maxShare) * 100}%` }" />
            </span>
            <b class="blockers__share">{{ pct(row.share) }}</b>
          </div>
        </div>

        <el-table :data="reports.shipBlockers" size="small" style="width: 100%">
          <el-table-column prop="reason" label="阻断原因" min-width="230" />
          <el-table-column prop="count" label="次数" width="75" align="right" />
          <el-table-column label="影响数量" width="105" align="right">
            <template #default="{ row }">{{ row.qtyAffected.toLocaleString() }}</template>
          </el-table-column>
          <el-table-column label="平均延误" width="100" align="right">
            <template #default="{ row }">
              <b :class="row.avgDelayDays >= 3 ? 'is-bad' : ''">{{ row.avgDelayDays }} 天</b>
            </template>
          </el-table-column>
          <el-table-column prop="owner" label="责任部门" width="110" />
        </el-table>
      </div>

      <p class="note">
        报关资料未齐套居首（28.1%），且完全由业务部自行掌控——箱单、发票、产地证的模板化与前置准备
        可直接消除近三成的出货延误，是本季度业务部改善优先级第一项。
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

.blockers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
  align-items: start;
}

.blockers__row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
}

.blockers__reason {
  width: 250px;
  font-size: 12.5px;
  color: var(--wfx-text);
}

.blockers__track {
  flex: 1;
  height: 12px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 4px;
}

.blockers__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-2);
}

.blockers__share {
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

.is-warn {
  color: var(--el-color-warning);
}

@media (max-width: 1500px) {
  .blockers {
    grid-template-columns: 1fr;
  }
}
</style>
