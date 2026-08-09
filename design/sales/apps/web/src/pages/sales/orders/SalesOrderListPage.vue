<script setup lang="ts">
import OrderChangePanel from './components/OrderChangePanel.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import HkPriceBreakdown from './components/HkPriceBreakdown.vue'
import { fetchSalesOrders } from '@/api/sales/sales-order.api'
import DocTimeline from '@/components/DocTimeline.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { CHARGE_MODE, DOC_STATUS, ORDER_TYPE } from '@/components/status-dictionary'
import FilterBar from '@/components/FilterBar.vue'
import { usePermission } from '@/composables/use-permission'
import { matchDateRange, matchEq, type FilterField } from '@/components/filter-helpers'
import { useResourceList } from '@/composables/use-resource-list'
import type { SalesOrder } from '@/types/sales.types'

const router = useRouter()
const { canViewHkPrice } = usePermission()

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
  {
    key: 'hkApplied',
    label: 'HK 70%',
    type: 'select',
    options: [
      { label: '已应用 70%', value: 'true' },
      { label: '未应用', value: 'false' },
    ],
    width: 140,
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
      matchEq(row.hk.applied, f.hkApplied) &&
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

        <el-table :data="filtered" v-loading="loading" style="width: 100%" @row-click="openDetail">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="lines">
                <p class="lines__title">
                  本单产品明细（共 {{ row.lines?.length ?? 1 }} 项）——一张订单可以下多项产品
                </p>
                <el-table :data="row.lines ?? []" size="small" border style="width: 100%">
                  <el-table-column prop="seq" label="#" width="46" align="center" />
                  <el-table-column prop="productName" label="产品" min-width="170" />
                  <el-table-column prop="drawingNo" label="图号" width="130" />
                  <el-table-column prop="itemCode" label="品号" width="150" />
                  <el-table-column prop="quantity" label="数量" width="90" align="right" />
                  <el-table-column prop="unitPrice" label="单价" width="100" align="right" />
                  <el-table-column prop="amount" label="金额" width="110" align="right" />
                  <el-table-column prop="deliveryDate" label="行交期" width="115" />
                  <el-table-column prop="remark" label="备注" min-width="180" />
                </el-table>
                <el-empty v-if="!row.lines?.length" :image-size="50" description="本单为单产品订单" />
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="docNo" label="订单号" width="170">
            <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
          </el-table-column>
          <el-table-column label="订单类型" width="120">
            <template #default="{ row }"><StatusTag :dict="ORDER_TYPE" :value="row.orderType" /></template>
          </el-table-column>
          <el-table-column label="收费方式" width="130">
            <template #default="{ row }">{{ CHARGE_MODE[row.chargeMode] }}</template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户" min-width="150" show-overflow-tooltip />
          <el-table-column label="产品 / 品号" min-width="165" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="product-name">{{ row.productName }}</span>
              <span v-if="row.itemCode" class="item-code">{{ row.itemCode }}</span>
              <span v-else class="no-code">无品号（{{ row.drawingNo }}）</span>
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="80" align="right" />
          <el-table-column label="单价" width="130" align="right">
            <template #default="{ row }">
              <span>{{ row.unitPrice }} {{ row.currency }}</span>
              <el-tag
                v-if="row.hk.applied && canViewHkPrice"
                size="small"
                type="warning"
                effect="plain"
                class="hk-tag"
              >
                ×0.7
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="120" align="right">
            <template #default="{ row }">{{ row.amount }}</template>
          </el-table-column>
          <el-table-column label="备料领用" width="150">
            <template #default="{ row }">
              <template v-if="row.stockLink">
                <span class="stock-used">领用 {{ row.stockLink.usedQty }} 件</span>
                <span class="stock-cost">均本 {{ row.stockLink.blendedUnitCost }}</span>
              </template>
              <span v-else-if="row.orderType === 'stock'" class="stock-self">
                入库 {{ row.stockedQty ?? 0 }} / {{ row.quantity }}
              </span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="deliveryDate" label="客户交期" width="110" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }"><StatusTag :dict="DOC_STATUS" :value="row.status" /></template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      </el-tab-pane>

      <el-tab-pane label="订单修改申请（ORC）" name="change">
        <OrderChangePanel v-if="tab === 'change'" />
      </el-tab-pane>
    </el-tabs>

    <el-drawer v-model="detailVisible" size="720px" :title="current?.docNo">
      <template v-if="current">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="客户">{{ current.customerName }}</el-descriptions-item>
          <el-descriptions-item label="客户原始订单">
            {{ current.customerPoNo ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="订单类型">
            <StatusTag :dict="ORDER_TYPE" :value="current.orderType" />
          </el-descriptions-item>
          <el-descriptions-item label="收费方式">
            {{ CHARGE_MODE[current.chargeMode] }}
          </el-descriptions-item>
          <el-descriptions-item label="产品">{{ current.productName }}</el-descriptions-item>
          <el-descriptions-item label="图号">{{ current.drawingNo }}</el-descriptions-item>
          <el-descriptions-item :label="current.orderType === 'mold' ? '模具编号' : '品号'">
            <span v-if="current.itemCode" class="item-code-inline">{{ current.itemCode }}</span>
            <span v-else class="no-code">
              样品订单无品号，仅以图号 + 样品单号标识（转量产时才由工程建立品号与 BOM）
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="数量">{{ current.quantity }}</el-descriptions-item>
          <el-descriptions-item label="客户交期">{{ current.deliveryDate }}</el-descriptions-item>
          <el-descriptions-item label="关联报价">
            {{ current.quotationNo ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="税率">
            {{ (current.taxRate * 100).toFixed(0) }}%
          </el-descriptions-item>
          <el-descriptions-item v-if="current.costOwner" label="费用承担方" :span="2">
            {{ current.costOwner }}
          </el-descriptions-item>
          <el-descriptions-item v-if="current.freeReason" label="免费 / 减免原因" :span="2">
            {{ current.freeReason }}
          </el-descriptions-item>
          <el-descriptions-item v-if="current.estimatedCost" label="预计成本" :span="2">
            {{ current.estimatedCost }} {{ current.currency }}
            <span class="muted">（免费不等于无成本，仍全额核算）</span>
          </el-descriptions-item>
        </el-descriptions>

        <template v-if="current.stockLink">
          <h3 class="drawer-title">备料领用与加权平均成本</h3>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="关联备料订单">
              {{ current.stockLink.stockOrderNo }}
            </el-descriptions-item>
            <el-descriptions-item label="领用数量">
              {{ current.stockLink.usedQty }} 件 × {{ current.stockLink.stockUnitCost }} 元
            </el-descriptions-item>
            <el-descriptions-item label="新投产">
              {{ current.stockLink.produceQty }} 件 × {{ current.stockLink.produceUnitCost }} 元
            </el-descriptions-item>
            <el-descriptions-item label="加权平均单件成本" :span="3">
              <b class="blended">{{ current.stockLink.blendedUnitCost }} {{ current.currency }}</b>
              <span class="muted">
                （{{ current.stockLink.stockUnitCost }}×{{ current.stockLink.usedQty }} +
                {{ current.stockLink.produceUnitCost }}×{{ current.stockLink.produceQty }}）÷
                {{ current.quantity }}
              </span>
            </el-descriptions-item>
          </el-descriptions>
        </template>

        <el-alert
          v-if="current.orderType === 'stock'"
          class="drawer-alert"
          type="success"
          :closable="false"
          show-icon
          :title="`备料订单：已入库 ${current.stockedQty ?? 0} / ${current.quantity} 件`"
          description="备料订单不向客户交货，完工全部入库即视为订单完成；库存余量可被后续正式订单领用。"
        />

        <h3 class="drawer-title">价格计算</h3>
        <HkPriceBreakdown :hk="current.hk" :currency="current.currency" :quantity="current.quantity" />

        <el-alert
          v-if="current.reviewRounds > 1"
          class="drawer-alert"
          type="info"
          :closable="false"
          show-icon
          :title="`该订单经历 ${current.reviewRounds} 轮送审，历次耗时已累计计入总历时`"
        />

        <DocTimeline class="drawer-timeline" title="审批链与节点计时（T0 起）" :nodes="current.timeline" />

      </template>

      <template #footer>
        <template v-if="current">
            <el-button>导出订单审核单</el-button>
            <el-button type="primary">发起跨部门评审</el-button>
        </template>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.lines {
  padding: 10px 16px 14px;
  background: var(--wfx-surface-alt);
}

.lines__title {
  margin: 0 0 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.order-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: 600;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}

.toolbar__hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.product-name {
  display: block;
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.item-code {
  display: block;
  font-size: 11.5px;
  color: var(--el-color-success);
}

.item-code-inline {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--el-color-success);
}

.no-code {
  display: block;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
}

.hk-tag {
  margin-left: 6px;
}

.muted {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.stock-used {
  display: block;
  font-size: 12.5px;
  color: var(--el-color-success);
}

.stock-cost,
.stock-self {
  display: block;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.blended {
  margin-right: 8px;
  font-size: 15px;
  color: var(--el-color-success);
}

.drawer-title {
  margin: 22px 0 10px;
  font-size: 14px;
  color: var(--wfx-text-strong);
}

.drawer-alert,
.drawer-timeline {
  margin-top: 18px;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
