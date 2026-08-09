<script setup lang="ts">
import { onMounted, ref } from 'vue'

import BacklogPanel from './components/BacklogPanel.vue'
import ChurnPanel from './components/ChurnPanel.vue'
import CustomerPanel from './components/CustomerPanel.vue'
import DailyOpsPanel from './components/DailyOpsPanel.vue'
import DeliveryPanel from './components/DeliveryPanel.vue'
import OrderPanel from './components/OrderPanel.vue'
import OverviewPanel from './components/OverviewPanel.vue'
import ProcessPanel from './components/ProcessPanel.vue'
import ProductPanel from './components/ProductPanel.vue'
import QualityPanel from './components/QualityPanel.vue'
import QuotePanel from './components/QuotePanel.vue'
import RmaBlamePanel from './components/RmaBlamePanel.vue'
import ShipDetailPanel from './components/ShipDetailPanel.vue'
import SlaPanel from './components/SlaPanel.vue'
import StockPanel from './components/StockPanel.vue'
import VariancePanel from './components/VariancePanel.vue'
import {
  fetchCostReports,
  fetchDailyOps,
  fetchMarketReports,
  fetchOrderExtraReports,
  fetchSalesAnalytics,
  fetchSalesReports,
} from '@/api/sales/analytics.api'
import type { CostReports } from '@/api/mock/sales/analytics-cost.fixture'
import type { MarketReports } from '@/api/mock/sales/analytics-market.fixture'
import type { OrderExtraReports } from '@/api/mock/sales/analytics-order.fixture'
import type { SalesAnalytics } from '@/api/mock/sales/analytics.fixture'
import type { SalesReports } from '@/api/mock/sales/analytics-reports.fixture'
import type { DailyOpsReport } from '@/api/mock/sales/daily-ops.fixture'
import PageHeader from '@/components/PageHeader.vue'
import { FIELD_LABELS } from './components/report-fields'
import { exportNotes, exportWorkbook } from '@/utils/export-excel'

const loading = ref(false)
const data = ref<SalesAnalytics | null>(null)
const reports = ref<SalesReports | null>(null)
const cost = ref<CostReports | null>(null)
const orderExtra = ref<OrderExtraReports | null>(null)
const market = ref<MarketReports | null>(null)
const dailyOps = ref<DailyOpsReport | null>(null)
const range = ref('12m')
const showTable = ref(false)
const activeTab = ref('overview')

const RANGES = [
  { value: '3m', label: '近 3 个月' },
  { value: '6m', label: '近 6 个月' },
  { value: '12m', label: '近 12 个月' },
]

/** 一次导出全部报表：每张报表一个工作表，列头按字段映射中文 */
function exportAll(): void {
  const sources: Array<[string, unknown]> = [
    ...Object.entries(reports.value ?? {}),
    ...Object.entries(cost.value ?? {}),
    ...Object.entries(orderExtra.value ?? {}),
    ...Object.entries(market.value ?? {}),
    ['dailyOps', dailyOps.value?.rows ?? []],
  ]
  const specs = sources
    .filter(([, value]) => Array.isArray(value) && value.length)
    .map(([key, value]) => {
      const rows = value as Array<Record<string, unknown>>
      const keys = Object.keys(rows[0]).filter((field) => typeof rows[0][field] !== 'object')
      return {
        name: key,
        columns: keys.map((field) => ({ label: FIELD_LABELS[field] ?? field, value: field })),
        rows,
        notes: exportNotes(`业务部数据分析 · ${key}`),
      }
    })
  exportWorkbook(specs as never, '业务部数据分析全量报表')
}

onMounted(async () => {
  loading.value = true
  try {
    data.value = await fetchSalesAnalytics()
    reports.value = await fetchSalesReports()
    cost.value = await fetchCostReports()
    orderExtra.value = await fetchOrderExtraReports()
    market.value = await fetchMarketReports()
    dailyOps.value = await fetchDailyOps()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading">
    <PageHeader
      title="数据分析"
      requirement-code="BI"
      subtitle="业务部经营分析，含每日接单量 / 出货量 / 未完成订单存量，覆盖报价、成本偏差、订单、在手与样品、备料、客户、产品与工艺、出货与回款、质量与客诉、审核时效共十类 33 张报表。所有指标可追溯到源单据与数据截止时间，敏感成本字段按角色裁剪。"
    >
      <template #actions>
        <el-radio-group v-model="range" size="default">
          <el-radio-button v-for="item in RANGES" :key="item.value" :value="item.value">
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
        <el-button v-if="activeTab === 'overview'" @click="showTable = !showTable">
          {{ showTable ? '隐藏数据表' : '查看数据表' }}
        </el-button>
        <el-button type="primary" @click="exportAll">导出全部报表</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab" class="analytics-tabs">
      <el-tab-pane label="经营总览" name="overview">
        <template v-if="activeTab === 'overview'">
          <DailyOpsPanel v-if="dailyOps" class="stacked" :report="dailyOps" />
          <OverviewPanel v-if="data" :data="data" :show-table="showTable" />
        </template>
      </el-tab-pane>
      <el-tab-pane label="报价类" name="quote">
        <QuotePanel v-if="reports && activeTab === 'quote'" :reports="reports" />
      </el-tab-pane>
      <el-tab-pane label="报价成本偏差" name="variance">
        <VariancePanel v-if="cost && activeTab === 'variance'" :reports="cost" />
      </el-tab-pane>
      <el-tab-pane label="订单类" name="order">
        <OrderPanel v-if="reports && activeTab === 'order'" :reports="reports" />
      </el-tab-pane>
      <el-tab-pane label="在手订单与样品" name="backlog">
        <BacklogPanel v-if="orderExtra && activeTab === 'backlog'" :reports="orderExtra" />
      </el-tab-pane>
      <el-tab-pane label="备料分析" name="stock">
        <StockPanel v-if="orderExtra && activeTab === 'stock'" :reports="orderExtra" />
      </el-tab-pane>
      <el-tab-pane label="客户类" name="customer">
        <template v-if="activeTab === 'customer'">
          <ChurnPanel v-if="market" class="stacked" :reports="market" />
          <CustomerPanel v-if="reports" :reports="reports" />
        </template>
      </el-tab-pane>
      <el-tab-pane label="产品与工艺" name="product">
        <template v-if="activeTab === 'product'">
          <ProcessPanel v-if="market" class="stacked" :reports="market" />
          <ProductPanel v-if="reports" :reports="reports" />
        </template>
      </el-tab-pane>
      <el-tab-pane label="出货与回款" name="delivery">
        <template v-if="activeTab === 'delivery'">
          <DeliveryPanel v-if="reports" class="stacked" :reports="reports" />
          <ShipDetailPanel v-if="market" :reports="market" />
        </template>
      </el-tab-pane>
      <el-tab-pane label="质量与客诉" name="quality">
        <template v-if="activeTab === 'quality'">
          <QualityPanel v-if="reports" class="stacked" :reports="reports" />
          <RmaBlamePanel v-if="market" :reports="market" />
        </template>
      </el-tab-pane>
      <el-tab-pane label="审核时效" name="sla">
        <SlaPanel v-if="cost && activeTab === 'sla'" :reports="cost" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.analytics-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.analytics-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: 600;
}

.stacked {
  margin-bottom: 16px;
}
</style>
