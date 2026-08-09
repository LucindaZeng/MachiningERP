<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'

import { fetchShipments, submitTailPlan } from '@/api/sales/shipment.api'
import DocTimeline from '@/components/DocTimeline.vue'
import { matchDateRange, matchEq, type FilterField } from '@/components/filter-helpers'
import FilterBar from '@/components/FilterBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import { SHIPMENT_STATUS, TAIL_PLAN } from '@/components/status-dictionary'
import StatusTag from '@/components/StatusTag.vue'
import { useResourceList } from '@/composables/use-resource-list'

import type { Shipment } from '@/types/sales.types'

const EXPORT_COLUMNS = [
  { label: '发货单号', value: 'docNo' },
  { label: '关联订单', value: 'orderNo' },
  { label: '客户', value: 'customerName' },
  { label: '产品', value: 'productName' },
  { label: '订单数量', value: 'orderQty' },
  { label: '本次发货', value: 'shipQty' },
  { label: '尾数', value: 'tailQty' },
  { label: '尾数处理', value: 'tailPlan' },
  { label: '发货日期', value: 'shippedAt' },
  { label: '状态', value: 'status' },
  { label: '业务', value: 'owner' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '待出库', value: 'planned' },
      { label: '已包装', value: 'packed' },
      { label: '已发货', value: 'shipped' },
      { label: '已签收', value: 'signed' },
      { label: '已开票', value: 'invoiced' },
    ],
    width: 140,
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
    key: 'hasTail',
    label: '尾数',
    type: 'select',
    options: [
      { label: '存在尾数', value: 'yes' },
      { label: '无尾数', value: 'no' },
    ],
    width: 130,
  },
  {
    key: 'tailPlan',
    label: '尾数方案',
    type: 'select',
    options: [
      { label: '返工补交', value: 'rework' },
      { label: '入库待后续', value: 'stock' },
      { label: '直接入库', value: 'direct-stock' },
      { label: '报废', value: 'scrap' },
    ],
    width: 150,
  },
  { key: 'shippedAt', label: '发货日期', type: 'date-range' },
]

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<Shipment>(
  fetchShipments, (row) => [
  row.docNo,
  row.orderNo,
  row.customerName,
  row.productName,
  row.batchNo,
],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.status, f.status) &&
      matchEq(row.customerName, f.customerName) &&
      matchEq(Number(row.tailQty) > 0 ? 'yes' : 'no', f.hasTail) &&
      matchEq(row.tailPlan, f.tailPlan) &&
      matchDateRange(row.shippedAt, f.shippedAt),
  },
)

const detailVisible = ref(false)
const tailVisible = ref(false)
const current = ref<Shipment | null>(null)
const tailChoice = ref('rework')

function openDetail(row: Shipment): void {
  current.value = row
  detailVisible.value = true
}

function openTailPlan(row: Shipment): void {
  current.value = row
  tailChoice.value = row.tailPlan ?? 'rework'
  tailVisible.value = true
}

async function confirmTailPlan(): Promise<void> {
  if (!current.value) {
    return
  }
  await submitTailPlan(current.value.docNo, tailChoice.value)
  tailVisible.value = false
  await reload()
  ElMessage.success('尾数处理方案已提交，结案时将做数量平衡校验')
}
</script>

<template>
  <div>
    <PageHeader
      title="出货管理"
      requirement-code="SHP-01 ~ SHP-06"
      subtitle="全检合格并包装完成为 T1，之后继续监测发货、客户签收、开票与回款直至商业关闭。合格数、包装数、订单需求数与差异在同一界面比对，尾数按四路径处理。"
    >
      <template #actions>
        <el-button>导出送货单</el-button>
        <el-button type="primary">生成发货通知</el-button>
      </template>
    </PageHeader>

    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索发货单 / 订单号 / 客户 / 批次"
        :total="filtered.length"
        export-name="出货管理"
        :export-columns="EXPORT_COLUMNS"
        :export-rows="filtered"
        @reset="resetFilters"
        @search="reload"
      />

      <el-table v-loading="loading" :data="filtered" style="width: 100%" @row-click="openDetail">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="lines">
              <p class="lines__title">
                本单产品明细（共 {{ row.lines?.length ?? 1 }} 项）——一张发货单可以发多项产品
              </p>
              <el-table :data="row.lines ?? []" size="small" border style="width: 100%">
                <el-table-column prop="seq" label="#" width="46" align="center" />
                <el-table-column prop="productName" label="产品" min-width="160" />
                <el-table-column prop="drawingNo" label="图号" width="130" />
                <el-table-column prop="itemCode" label="品号" width="150" />
                <el-table-column prop="batchNo" label="批次" width="120" />
                <el-table-column prop="orderedQty" label="订单数" width="90" align="right" />
                <el-table-column prop="shippedQty" label="本次发货" width="100" align="right" />
                <el-table-column prop="tailQty" label="尾数" width="80" align="right" />
                <el-table-column prop="amount" label="金额" width="110" align="right" />
              </el-table>
              <el-empty v-if="!row.lines?.length" :image-size="50" description="本单为单产品出货" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="docNo" label="发货单号" width="175">
          <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
        </el-table-column>
        <el-table-column prop="orderNo" label="订单号" width="165" />
        <el-table-column prop="customerName" label="客户" min-width="160" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="140" show-overflow-tooltip />
        <el-table-column prop="batchNo" label="批次号" width="110" />
        <el-table-column label="需求 / 合格 / 包装 / 已发" width="200" align="center">
          <template #default="{ row }">
            <span class="qty">{{ row.orderedQty }}</span>
            <span class="qty">{{ row.qualifiedQty }}</span>
            <span class="qty">{{ row.packedQty }}</span>
            <span class="qty">{{ row.shippedQty }}</span>
          </template>
        </el-table-column>
        <el-table-column label="尾数" width="130">
          <template #default="{ row }">
            <template v-if="Number(row.tailQty) > 0">
              <b class="tail">{{ row.tailQty }}</b>
              <el-tag v-if="row.tailPlan" size="small" effect="plain" class="tail-tag">
                {{ TAIL_PLAN[row.tailPlan] }}
              </el-tag>
            </template>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <StatusTag :dict="SHIPMENT_STATUS" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
            <el-button
              link
              type="primary"
              :disabled="Number(row.tailQty) === 0"
              @click.stop="openTailPlan(row)"
            >
              尾数处理
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="640px" :title="current?.docNo">
      <template v-if="current">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="订单号">{{ current.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ current.customerName }}</el-descriptions-item>
          <el-descriptions-item label="产品">{{ current.productName }}</el-descriptions-item>
          <el-descriptions-item label="批次号">{{ current.batchNo }}</el-descriptions-item>
          <el-descriptions-item label="承运商">{{ current.carrier ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="运单号">{{ current.trackingNo ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="包装完成">{{ current.packedAt ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="发货时间">{{ current.shippedAt ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="签收时间">{{ current.signedAt ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="发票号">{{ current.invoiceNo ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="金额" :span="2">
            {{ current.amount.amount }} {{ current.amount.currency }}
          </el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-if="Number(current.tailQty) > 0"
          class="drawer-alert"
          type="warning"
          :closable="false"
          show-icon
          :title="`存在尾数 ${current.tailQty} 件，当前方案：${current.tailPlan ? TAIL_PLAN[current.tailPlan] : '未选择'}`"
          description="尾数处理默认 SLA 7 天、尾数库存保留 90 天（参数待 ADR 确认后由系统配置下发）。结案时执行数量平衡校验。"
        />

        <DocTimeline class="drawer-timeline" title="出运节点计时" :nodes="current.timeline" />
      </template>
    </el-drawer>

    <el-dialog v-model="tailVisible" title="尾数处理" width="480px">
      <p class="tail-dialog__hint">
        {{ current?.docNo }} 尾数 {{ current?.tailQty }} 件，请选择处理路径：
      </p>
      <el-radio-group v-model="tailChoice" class="tail-dialog__group">
        <el-radio value="rework">返工补交（拆返工子订单，重新核算重复工序成本）</el-radio>
        <el-radio value="stock">入库待后续订单（占用尾数库存，保留期满转呆滞）</el-radio>
        <el-radio value="direct-stock">直接入库（客户已确认不再补交）</el-radio>
        <el-radio value="scrap">报废（需品质与财务确认损失归属）</el-radio>
      </el-radio-group>

      <template #footer>
        <el-button @click="tailVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmTailPlan">确认方案</el-button>
      </template>
    </el-dialog>
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

.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
}

.qty {
  display: inline-block;
  min-width: 42px;
  font-size: 12.5px;
  text-align: center;
}

.tail {
  color: var(--el-color-danger);
}

.tail-tag {
  margin-left: 6px;
}

.muted {
  color: var(--wfx-text-muted);
}

.drawer-alert,
.drawer-timeline {
  margin-top: 18px;
}

.tail-dialog__hint {
  margin: 0 0 12px;
  font-size: 13px;
}

.tail-dialog__group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
