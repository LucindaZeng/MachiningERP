<script setup lang="ts">
import { ref } from 'vue'

import { fetchSalesReturns } from '@/api/sales/sales-return.api'
import DocTimeline from '@/components/DocTimeline.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { DISPOSITION, RESPONSIBILITY, RETURN_STATUS } from '@/components/status-dictionary'
import FilterBar from '@/components/FilterBar.vue'
import { matchDateRange, matchEq, type FilterField } from '@/components/filter-helpers'
import { useResourceList } from '@/composables/use-resource-list'
import type { SalesReturn } from '@/types/sales.types'

const EXPORT_COLUMNS = [
  { label: '退货单号', value: 'docNo' },
  { label: '客户', value: 'customerName' },
  { label: '关联发货单', value: 'shipmentNo' },
  { label: '产品', value: 'productName' },
  { label: '数量', value: 'quantity' },
  { label: '退货原因', value: 'reason' },
  { label: '责任归属', value: 'responsibility' },
  { label: '处置方案', value: 'disposal' },
  { label: '状态', value: 'status' },
  { label: '业务', value: 'owner' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '已登记', value: 'registered' },
      { label: '品质判定中', value: 'quality-judging' },
      { label: '处置审批中', value: 'disposition' },
      { label: '执行中', value: 'executing' },
      { label: '已结案', value: 'closed' },
    ],
    width: 150,
  },
  {
    key: 'responsibility',
    label: '责任归属',
    type: 'select',
    options: [
      { label: '公司责任', value: 'company' },
      { label: '客户责任', value: 'customer' },
      { label: '供应商责任', value: 'supplier' },
      { label: '待判定', value: 'undecided' },
    ],
    width: 150,
  },
  {
    key: 'disposition',
    label: '处置方式',
    type: 'select',
    options: [
      { label: '退款', value: 'refund' },
      { label: '补货', value: 'replacement' },
      { label: '返工重交', value: 'rework' },
      { label: '让步接收', value: 'concession' },
      { label: '报废', value: 'scrap' },
      { label: '待定', value: 'undecided' },
    ],
    width: 150,
  },
  {
    key: 'needFinanceApproval',
    label: '财务审批',
    type: 'select',
    options: [
      { label: '需财务审批', value: 'true' },
      { label: '无需财务审批', value: 'false' },
    ],
    width: 160,
  },
  { key: 'complaintAt', label: '客诉日期', type: 'date-range' },
]

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<SalesReturn>(
  fetchSalesReturns, (row) => [
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
      matchEq(row.responsibility, f.responsibility) &&
      matchEq(row.disposition, f.disposition) &&
      matchEq(row.needFinanceApproval, f.needFinanceApproval) &&
      matchDateRange(row.complaintAt, f.complaintAt),
  },
)

const detailVisible = ref(false)
const current = ref<SalesReturn | null>(null)

function openDetail(row: SalesReturn): void {
  current.value = row
  detailVisible.value = true
}
</script>

<template>
  <div>
    <PageHeader
      title="退货管理"
      requirement-code="RMA-01 ~ RMA-05"
      subtitle="业务登记客诉与退货，品质判定责任归属，处置方案按金额与类型分级审批；涉及退款、补货、召回或高额索赔时由财务与总经办审批。"
    >
      <template #actions>
        <el-button type="primary">登记客诉 / 退货</el-button>
      </template>
    </PageHeader>

    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索退货单 / 订单号 / 客户 / 批次"
        :total="filtered.length"
        export-name="退货管理"
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
                本单退货明细（共 {{ row.lines?.length ?? 1 }} 项）——一张退货单可以退多项产品
              </p>
              <el-table :data="row.lines ?? []" size="small" border style="width: 100%">
                <el-table-column prop="seq" label="#" width="46" align="center" />
                <el-table-column prop="productName" label="产品" min-width="160" />
                <el-table-column prop="drawingNo" label="图号" width="130" />
                <el-table-column prop="batchNo" label="批次" width="130" />
                <el-table-column prop="returnQty" label="退货数量" width="100" align="right" />
                <el-table-column prop="reason" label="退货原因" min-width="180" />
                <el-table-column prop="amount" label="金额" width="110" align="right" />
              </el-table>
              <el-empty v-if="!row.lines?.length" :image-size="50" description="本单为单产品退货" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="docNo" label="退货单号" width="175">
          <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="160" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="130" show-overflow-tooltip />
        <el-table-column prop="batchNo" label="批次号" width="110" />
        <el-table-column prop="returnQty" label="退货数" width="80" align="right" />
        <el-table-column prop="reason" label="退货原因" min-width="170" show-overflow-tooltip />
        <el-table-column label="责任归属" width="100">
          <template #default="{ row }">
            <StatusTag :dict="RESPONSIBILITY" :value="row.responsibility" />
          </template>
        </el-table-column>
        <el-table-column label="处置方式" width="100">
          <template #default="{ row }">{{ DISPOSITION[row.disposition] }}</template>
        </el-table-column>
        <el-table-column label="金额" width="120" align="right">
          <template #default="{ row }">{{ row.amount.amount }} {{ row.amount.currency }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :dict="RETURN_STATUS" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="640px" :title="current?.docNo">
      <template v-if="current">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="原订单">{{ current.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="原发货单">{{ current.shipmentNo }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ current.customerName }}</el-descriptions-item>
          <el-descriptions-item label="产品">{{ current.productName }}</el-descriptions-item>
          <el-descriptions-item label="批次号">{{ current.batchNo }}</el-descriptions-item>
          <el-descriptions-item label="退货数量">{{ current.returnQty }}</el-descriptions-item>
          <el-descriptions-item label="客诉时间">{{ current.complaintAt }}</el-descriptions-item>
          <el-descriptions-item label="首次响应">
            {{ current.respondedAt ?? '未响应' }}
          </el-descriptions-item>
          <el-descriptions-item label="8D 报告">{{ current.eightDNo ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="涉及金额">
            {{ current.amount.amount }} {{ current.amount.currency }}
          </el-descriptions-item>
          <el-descriptions-item label="退货原因" :span="2">{{ current.reason }}</el-descriptions-item>
        </el-descriptions>

        <div class="judge">
          <div class="judge__item">
            <span>责任归属</span>
            <StatusTag :dict="RESPONSIBILITY" :value="current.responsibility" size="default" />
            <em>由品质部判定，涉及委外时需追溯同批外发</em>
          </div>
          <div class="judge__item">
            <span>处置方式</span>
            <b>{{ DISPOSITION[current.disposition] }}</b>
            <em>公司责任的返工不产生对客户的额外应收，供应商责任按无偿返工归集损失</em>
          </div>
        </div>

        <el-alert
          v-if="current.needFinanceApproval"
          class="drawer-alert"
          type="warning"
          :closable="false"
          show-icon
          title="该处置涉及退款 / 让步，需财务与总经办审批"
          description="按控制矩阵，退款、补货、召回或高额索赔必须升级审批，审批记录含前后值与电子签名。"
        />

        <DocTimeline class="drawer-timeline" title="客诉处理节点计时" :nodes="current.timeline" />

      </template>

      <template #footer>
        <template v-if="current">
            <el-button>关联 8D 报告</el-button>
            <el-button type="primary">提交处置方案</el-button>
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

.judge {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 18px;
}

.judge__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  background: var(--wfx-surface-alt);
  border-radius: var(--wfx-radius-md);
}

.judge__item span {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.judge__item b {
  font-size: 16px;
  color: var(--wfx-navy);
}

.judge__item em {
  font-size: 11.5px;
  font-style: normal;
  line-height: 1.6;
  color: var(--wfx-text-muted);
}

.drawer-alert,
.drawer-timeline {
  margin-top: 18px;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
