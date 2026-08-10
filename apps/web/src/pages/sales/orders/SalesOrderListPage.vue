<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { fetchSalesOrders } from '@/api/sales/sales-order.api'
import { matchDateRange, matchEq, type FilterField } from '@/components/filter-helpers'
import FilterBar from '@/components/FilterBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useResourceList } from '@/composables/use-resource-list'

import OrderChangePanel from './components/OrderChangePanel.vue'
import SalesOrderDetailDrawer from './components/SalesOrderDetailDrawer.vue'
import SalesOrderTable from './components/SalesOrderTable.vue'

import type { SalesOrder } from '@/types/sales.types'

const router = useRouter()

const EXPORT_COLUMNS = [
  { label: '订单号', value: 'docNo' },
  { label: '订单类型', value: 'orderType' },
  { label: '收费方式', value: 'chargeMode' },
  { label: '客户编码', value: 'customerCode' },
  { label: '客户', value: 'customerName' },
  { label: '产品', value: 'productName' },
  { label: '图号', value: 'drawingNo' },
  { label: '品号 / 模具编号', value: 'itemCode' },
  { label: '数量', value: 'quantity' },
  { label: '单价', value: 'unitPrice' },
  { label: '币种', value: 'currency' },
  { label: '金额', value: 'amount' },
  { label: '客户交期', value: 'deliveryDate' },
  { label: '关联报价', value: 'quotationNo' },
  { label: '客户原始订单', value: 'customerPoNo' },
  { label: '状态', value: 'status' },
  { label: '业务', value: 'owner' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'orderType',
    label: '订单类型',
    type: 'select',
    options: [
      { label: '正式业务订单', value: 'formal' },
      { label: '模具订单', value: 'mold' },
      { label: '样品订单', value: 'sample' },
      { label: '备料订单', value: 'stock' },
    ],
    width: 150,
  },
  {
    key: 'chargeMode',
    label: '收费方式',
    type: 'select',
    options: [
      { label: '收费', value: 'charged' },
      { label: '免费', value: 'free' },
      { label: '部分收费', value: 'partial' },
      { label: '递延分摊', value: 'deferred' },
      { label: '押金返还', value: 'deposit' },
    ],
    width: 150,
  },
  {
    key: 'customerName',
    label: '客户',
    type: 'select',
    options: [
      { label: '香港宏晟精密（代生产）', value: '香港宏晟精密（代生产）' },
      { label: 'Brenner Maschinenbau GmbH', value: 'Brenner Maschinenbau GmbH' },
      { label: '苏州明泰自动化', value: '苏州明泰自动化' },
      { label: 'Radex Instruments Inc.', value: 'Radex Instruments Inc.' },
    ],
    width: 200,
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '草稿', value: 'draft' },
      { label: '已提交', value: 'submitted' },
      { label: '审核中', value: 'reviewing' },
      { label: '已批准', value: 'approved' },
      { label: '执行中', value: 'executing' },
    ],
    width: 130,
  },
  { key: 'deliveryDate', label: '客户交期', type: 'date-range' },
]

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<SalesOrder>(
  fetchSalesOrders, (row) => [
  row.docNo,
  row.customerName,
  row.productName,
  row.customerPoNo ?? '',
],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.orderType, f.orderType) &&
      matchEq(row.chargeMode, f.chargeMode) &&
      matchEq(row.customerName, f.customerName) &&
      matchEq(row.status, f.status) &&
      matchDateRange(row.deliveryDate, f.deliveryDate),
  },
)

const detailVisible = ref(false)
const current = ref<SalesOrder | null>(null)
const tab = ref('list')

function openDetail(row: SalesOrder): void {
  current.value = row
  detailVisible.value = true
}
</script>

<template>
  <div>
    <PageHeader
      title="订单管理"
      requirement-code="ORD-01 ~ ORD-04"
      subtitle="建单提交（T0）→ 业务经理审核 → 财务审核 → 跨部门订单评审。订单类型与收费方式相互独立；正式业务订单强制收费，零价、缺原始订单或缺核价一律阻断提交。下单后要改数量、交期、单价、包装或取消订单，走本页「订单修改申请」；改图纸、材料、表面处理走 ECN 申请。"
    >
      <template #actions>
        <el-button @click="tab = 'change'">订单修改申请</el-button>
        <el-button type="primary" @click="router.push('/sales/orders/create')">新建订单</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="tab" class="order-tabs">
      <el-tab-pane label="订单列表" name="list">
      <el-card shadow="never">
        <FilterBar
          v-model="filters"
          v-model:keyword="keyword"
          :fields="FILTER_FIELDS"
          keyword-placeholder="搜索订单号 / 客户 / 产品 / 客户 PO"
          :total="filtered.length"
          export-name="订单列表"
          :export-columns="EXPORT_COLUMNS"
          :export-rows="filtered"
          @reset="resetFilters"
          @search="reload"
        />

        <SalesOrderTable :rows="filtered" :loading="loading" @detail="openDetail" />
      </el-card>
      </el-tab-pane>

      <el-tab-pane label="订单修改申请（ORC）" name="change">
        <OrderChangePanel v-if="tab === 'change'" />
      </el-tab-pane>
    </el-tabs>

    <SalesOrderDetailDrawer v-model="detailVisible" :order="current" />
  </div>
</template>

<style scoped>
.order-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: 600;
}
</style>
