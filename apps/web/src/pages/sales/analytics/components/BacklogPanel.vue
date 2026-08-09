<script setup lang="ts">
import { computed, ref } from 'vue'

import { levelTag, pct } from './report-format'
import ReportCard from './ReportCard.vue'

import type { OrderExtraReports } from '@/api/mock/sales/analytics-order.fixture'

const props = defineProps<{ reports: OrderExtraReports }>()

const DIMS = [
  { value: 'customer', label: '按客户' },
  { value: 'product', label: '按产品' },
]
const dim = ref('customer')

const dimRows = computed(() =>
  dim.value === 'customer' ? props.reports.backlogCustomer : props.reports.backlogProduct,
)

const totalBacklog = computed(() =>
  props.reports.backlogMonth.reduce((sum, row) => sum + row.amount, 0),
)

const lateCount = computed(() => props.reports.backlogAlerts.filter((row) => row.level === 'late').length)

const maxAmount = Math.max(...props.reports.backlogMonth.map((row) => row.amount))

const RISK_LABEL: Record<string, string> = { ok: '产能可承接', tight: '产能吃紧', over: '产能超载' }

const sampleTotal = computed(() =>
  props.reports.sampleCycle.reduce((sum, row) => sum + row.samples, 0),
)
const sampleWon = computed(() =>
  props.reports.sampleCycle.reduce((sum, row) => sum + row.converted, 0),
)
</script>

<template>
  <div class="report-grid">
    <ReportCard
      title="订单结构分析（五类订单）"
      caliber="按订单类型统计数量、金额与结构占比。备料订单不向客户交货、无客户售价，毛利在被正式订单领用时才实现，因此不参与毛利统计。"
      wide
      :export-rows="reports.orderType5"
    >
      <el-table :data="reports.orderType5" size="small" style="width: 100%">
        <el-table-column prop="type" label="订单类型" width="120">
          <template #default="{ row }"><b>{{ row.type }}</b></template>
        </el-table-column>
        <el-table-column prop="count" label="张数" width="80" align="right" />
        <el-table-column label="数量（件）" width="110" align="right">
          <template #default="{ row }">{{ row.quantity.toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="金额（万）" width="110" align="right">
          <template #default="{ row }">{{ row.amount.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="结构占比" width="180">
          <template #default="{ row }">
            <div class="share">
              <span class="share__track">
                <i class="share__bar" :style="{ width: `${row.share * 100}%` }" />
              </span>
              <em>{{ pct(row.share) }}</em>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="毛利率" width="95" align="right">
          <template #default="{ row }">
            {{ row.marginRate === null ? '不适用' : pct(row.marginRate) }}
          </template>
        </el-table-column>
        <el-table-column prop="note" label="口径说明" min-width="300" />
      </el-table>
    </ReportCard>

    <ReportCard
      title="在手订单 Backlog（按交期月份）"
      caliber="口径：已评审通过、尚未全部出货的订单未交金额，按承诺交期落月；产能负荷 = 该月需求机时 / 可用机时。"
      wide
      :export-rows="reports.backlogMonth"
    >
      <template #extra>
        <span class="head-note">在手合计 {{ totalBacklog.toFixed(1) }} 万元</span>
      </template>

      <div class="months">
        <div v-for="row in reports.backlogMonth" :key="row.month" class="months__col">
          <span class="months__amount">{{ row.amount.toFixed(0) }}</span>
          <div class="months__bar-wrap">
            <span class="months__bar" :class="`is-${row.risk}`" :style="{ height: `${(row.amount / maxAmount) * 100}%` }" />
          </div>
          <span class="months__label">{{ row.month }}</span>
          <span class="months__meta">{{ row.orders }} 单 · {{ row.quantity.toLocaleString() }} 件</span>
          <el-tag size="small" :type="levelTag(row.risk)">负荷 {{ pct(row.capacityLoad, 0) }}</el-tag>
          <span class="months__risk">{{ RISK_LABEL[row.risk] }}</span>
        </div>
      </div>

      <p class="note">
        10 月负荷 108%，超出可用机时，需提前与客户协商分批或外协；四轴机时是主要瓶颈（见产品与工艺页签）。
      </p>
    </ReportCard>

    <ReportCard
      title="在手订单结构（按客户 / 按产品）"
      caliber="同一批在手订单换维度归集，识别集中度风险；最近交期用于判断哪一个客户先到期。"
    
      :export-rows="dimRows"
    >
      <template #extra>
        <el-radio-group v-model="dim" size="small">
          <el-radio-button v-for="item in DIMS" :key="item.value" :value="item.value">
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
      </template>

      <el-table :data="dimRows" size="small" style="width: 100%">
        <el-table-column prop="name" :label="dim === 'customer' ? '客户' : '产品'" min-width="200" />
        <el-table-column prop="orders" label="在手单数" width="100" align="right" />
        <el-table-column label="未交金额（万）" width="130" align="right">
          <template #default="{ row }">{{ row.amount.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column label="占比" width="150">
          <template #default="{ row }">
            <div class="share">
              <span class="share__track">
                <i class="share__bar" :style="{ width: `${row.share * 100}%` }" />
              </span>
              <em>{{ pct(row.share) }}</em>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="nearestDue" label="最近交期" width="110" />
      </el-table>
    </ReportCard>

    <ReportCard
      title="临期与逾期预警"
      caliber="剩余天数 ≤7 天进入临期、＜0 进入逾期；当前停留节点取订单追踪的实时节点，责任人为业务担当。"
      :export-rows="reports.backlogAlerts"
    >
      <template #extra>
        <span class="head-note is-bad">逾期 {{ lateCount }} 单</span>
      </template>

      <el-table :data="reports.backlogAlerts" size="small" style="width: 100%">
        <el-table-column prop="orderNo" label="订单号" width="170" />
        <el-table-column prop="customer" label="客户" min-width="160" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="150" show-overflow-tooltip />
        <el-table-column prop="dueDate" label="交期" width="105" />
        <el-table-column label="剩余" width="90" align="right">
          <template #default="{ row }">
            <b :class="row.level === 'late' ? 'is-bad' : 'is-warn'">
              {{ row.daysLeft < 0 ? `逾期 ${-row.daysLeft} 天` : `${row.daysLeft} 天` }}
            </b>
          </template>
        </el-table-column>
        <el-table-column prop="stage" label="当前节点" min-width="150" />
        <el-table-column prop="owner" label="业务" width="80" />
        <el-table-column prop="action" label="处置动作" min-width="280" />
      </el-table>
    </ReportCard>

    <ReportCard
      title="样品转化率"
      caliber="转化定义：样品订单出货后 180 天内产生同图号正式订单即计入转化；转化周期自样品出货日起算。"
      wide
      :export-rows="reports.sampleCharge"
    >
      <template #extra>
        <span class="head-note">
          近 6 个月 {{ sampleTotal }} 单样品 · 转化 {{ sampleWon }} 单 ·
          {{ pct(sampleWon / sampleTotal) }}
        </span>
      </template>

      <div class="sample">
        <div class="sample__cycle">
          <div v-for="row in reports.sampleCycle" :key="row.month" class="sample__col">
            <span class="sample__rate">{{ pct(row.rate, 0) }}</span>
            <div class="sample__bar-wrap">
              <span class="sample__bar" :style="{ height: `${row.rate * 100}%` }" />
            </div>
            <span class="sample__month">{{ row.month.slice(2) }}</span>
            <span class="sample__meta">{{ row.converted }}/{{ row.samples }}</span>
            <span class="sample__meta">{{ row.avgDays }} 天</span>
          </div>
        </div>

        <el-table :data="reports.sampleCharge" size="small" style="width: 100%">
          <el-table-column prop="mode" label="样品类型" width="110" />
          <el-table-column prop="samples" label="样品数" width="85" align="right" />
          <el-table-column prop="converted" label="转化" width="75" align="right" />
          <el-table-column label="转化率" width="95" align="right">
            <template #default="{ row }">
              <b :class="row.rate > 0.4 ? 'is-good' : 'is-bad'">{{ pct(row.rate) }}</b>
            </template>
          </el-table-column>
          <el-table-column label="平均收费（万）" width="130" align="right">
            <template #default="{ row }">{{ row.avgAmount.toFixed(1) }}</template>
          </el-table-column>
          <el-table-column prop="note" label="结论" min-width="260" />
        </el-table>
      </div>
    </ReportCard>

    <ReportCard
      title="长期未转化样品清单"
      caliber="样品出货超 90 天仍未产生正式订单即入表；超 180 天建议关闭机会并回收样品成本。"
      wide
      :export-rows="reports.samplePending"
    >
      <el-table :data="reports.samplePending" size="small" style="width: 100%">
        <el-table-column prop="docNo" label="样品单号" width="165" />
        <el-table-column prop="customer" label="客户" min-width="160" />
        <el-table-column prop="productName" label="产品" min-width="180" />
        <el-table-column prop="sampleAt" label="送样日期" width="105" />
        <el-table-column label="已过天数" width="100" align="right">
          <template #default="{ row }">
            <b :class="row.daysSince > 180 ? 'is-bad' : 'is-warn'">{{ row.daysSince }}</b>
          </template>
        </el-table-column>
        <el-table-column label="收费" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.charged ? 'success' : 'info'">
              {{ row.charged ? '收费' : '免费' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastFollow" label="最近跟进" min-width="230" />
        <el-table-column prop="suggestion" label="建议" min-width="250" />
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

.share {
  display: flex;
  gap: 8px;
  align-items: center;
}

.share__track {
  flex: 1;
  height: 9px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 3px;
}

.share__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
}

.share em {
  width: 46px;
  font-size: 11.5px;
  font-style: normal;
  text-align: right;
  color: var(--wfx-text-muted);
}

.months {
  display: flex;
  gap: 22px;
  align-items: flex-end;
}

.months__col {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.months__amount {
  font-size: 13px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.months__bar-wrap {
  display: flex;
  align-items: flex-end;
  width: 56px;
  height: 130px;
}

.months__bar {
  width: 100%;
  background: var(--viz-series-1);
  border-radius: 4px 4px 0 0;
}

.months__bar.is-tight {
  background: var(--viz-series-2);
}

.months__bar.is-over {
  background: var(--el-color-danger);
}

.months__label {
  font-size: 12.5px;
  color: var(--wfx-text);
}

.months__meta,
.months__risk {
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.sample {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 22px;
  align-items: start;
}

.sample__cycle {
  display: flex;
  gap: 14px;
  align-items: flex-end;
}

.sample__col {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.sample__rate {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.sample__bar-wrap {
  display: flex;
  align-items: flex-end;
  width: 34px;
  height: 110px;
}

.sample__bar {
  width: 100%;
  background: var(--viz-series-3);
  border-radius: 4px 4px 0 0;
}

.sample__month,
.sample__meta {
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.note {
  margin: 16px 0 0;
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

@media (max-width: 1500px) {
  .sample {
    grid-template-columns: 1fr;
  }
}
</style>
