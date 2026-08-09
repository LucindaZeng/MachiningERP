<script setup lang="ts">
import { computed, ref } from 'vue'

import { fetchInvoiceRequests } from '@/api/sales/invoice.api'
import DocTimeline from '@/components/DocTimeline.vue'
import { matchDateRange, matchEq, type FilterField } from '@/components/filter-helpers'
import FilterBar from '@/components/FilterBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import { DOC_STATUS, INVOICE_TYPE } from '@/components/status-dictionary'
import StatusTag from '@/components/StatusTag.vue'
import { useResourceList } from '@/composables/use-resource-list'

import type { InvoiceRequest } from '@/types/sales.types'

const EXPORT_COLUMNS = [
  { label: '发票申请单号', value: 'docNo' },
  { label: '客户编码', value: 'customerCode' },
  { label: '客户', value: 'customerName' },
  { label: '发票类型', value: 'invoiceType' },
  { label: '关联对账单', value: 'statementNo' },
  { label: '不含税金额', value: 'amountExTax' },
  { label: '税额', value: 'taxAmount' },
  { label: '价税合计', value: 'amountIncTax' },
  { label: '币种', value: 'currency' },
  { label: '发票抬头', value: 'title' },
  { label: '税号', value: 'taxNo' },
  { label: '交付方式', value: 'deliveryMethod' },
  { label: '交付对象', value: 'deliveryTarget' },
  { label: '发票号', value: 'invoiceNo' },
  { label: '开票时间', value: 'issuedAt' },
  { label: '预计回款日', value: 'expectedPaymentDate' },
  { label: '状态', value: 'status' },
  { label: '业务', value: 'owner' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'customerName',
    label: '客户',
    type: 'select',
    options: [
      { label: '苏州明泰自动化', value: '苏州明泰自动化' },
      { label: '香港宏晟精密（代生产）', value: '香港宏晟精密（代生产）' },
      { label: '东莞德信电子', value: '东莞德信电子' },
      { label: 'Brenner Maschinenbau GmbH', value: 'Brenner Maschinenbau GmbH' },
    ],
    width: 200,
  },
  {
    key: 'invoiceType',
    label: '发票类型',
    type: 'select',
    options: Object.entries(INVOICE_TYPE).map(([value, label]) => ({ label, value })),
    width: 180,
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '待复核', value: 'submitted' },
      { label: '财务开票中', value: 'reviewing' },
      { label: '已开票交付', value: 'completed' },
    ],
    width: 140,
  },
  {
    key: 'amountMatched',
    label: '金额一致性',
    type: 'select',
    options: [
      { label: '三方一致', value: 'yes' },
      { label: '存在差异（阻断）', value: 'no' },
    ],
    width: 160,
  },
  { key: 'submittedAt', label: '提交日期', type: 'date-range' },
]

const { filtered, loading, keyword, filters, resetFilters, reload } =
  useResourceList<InvoiceRequest>(
    fetchInvoiceRequests,
    (row) => [row.docNo, row.customerName, row.title, row.invoiceNo ?? '', row.statementNo ?? ''],
    {
      fields: FILTER_FIELDS,
      predicate: (row, f) =>
        matchEq(row.customerName, f.customerName) &&
        matchEq(row.invoiceType, f.invoiceType) &&
        matchEq(row.status, f.status) &&
        matchEq(row.amountMatched ? 'yes' : 'no', f.amountMatched) &&
        matchDateRange(row.submittedAt.slice(0, 10), f.submittedAt),
    },
  )

const blocked = computed(() => filtered.value.filter((row) => !row.amountMatched).length)

const detailVisible = ref(false)
const current = ref<InvoiceRequest | null>(null)

function openDetail(row: InvoiceRequest): void {
  current.value = row
  detailVisible.value = true
}
</script>

<template>
  <div>
    <PageHeader
      title="发票申请"
      requirement-code="INV-01 ~ INV-04"
      subtitle="业务按已签收的出货单发起发票申请 → 系统校验出货单 / 对账单 / 发票三方金额一致 → 财务开票并回写发票号 → 交付客户并进入应收账龄。三方金额不一致一律阻断开票，差异必须先在对账单处理完毕。"
    >
      <template #actions>
        <el-button type="primary">新建发票申请</el-button>
      </template>
    </PageHeader>

    <el-alert
      v-if="blocked"
      class="rule-alert"
      type="error"
      :closable="false"
      show-icon
      :title="`${blocked} 张发票申请因金额不一致被阻断`"
      description="出货金额、对账单金额与申请开票金额必须完全一致。存在差异时请先在「对账单」完成差异挂账、红字或折让处理，再回到本页重新提交，避免开票后再作废红冲。"
    />

    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索申请单号 / 客户 / 抬头 / 发票号 / 对账单号"
        :total="filtered.length"
        export-name="发票申请"
        :export-columns="EXPORT_COLUMNS"
        :export-rows="filtered"
        @reset="resetFilters"
        @search="reload"
      />

      <el-table v-loading="loading" :data="filtered" style="width: 100%" @row-click="openDetail">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="lines">
              <p class="lines__title">开票明细（按出货单逐行归集，共 {{ row.lines.length }} 行）</p>
              <el-table :data="row.lines" size="small" border style="width: 100%">
                <el-table-column prop="seq" label="#" width="46" align="center" />
                <el-table-column prop="shipmentNo" label="关联出货单" width="180" />
                <el-table-column prop="productName" label="产品" min-width="160" />
                <el-table-column prop="drawingNo" label="图号" width="130" />
                <el-table-column prop="quantity" label="数量" width="90" align="right" />
                <el-table-column prop="unitPrice" label="单价" width="100" align="right" />
                <el-table-column prop="amount" label="金额" width="110" align="right" />
                <el-table-column label="税率" width="80" align="right">
                  <template #default="{ row: line }">{{ (line.taxRate * 100).toFixed(0) }}%</template>
                </el-table-column>
                <el-table-column prop="taxAmount" label="税额" width="110" align="right" />
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="docNo" label="申请单号" width="175">
          <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="160" show-overflow-tooltip />
        <el-table-column label="发票类型" width="150">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ INVOICE_TYPE[row.invoiceType] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="statementNo" label="关联对账单" width="175">
          <template #default="{ row }">{{ row.statementNo ?? '按出货单单开' }}</template>
        </el-table-column>
        <el-table-column label="价税合计" width="130" align="right">
          <template #default="{ row }">
            <b class="amount">{{ row.amountIncTax }}</b>
            <span class="currency">{{ row.currency }}</span>
          </template>
        </el-table-column>
        <el-table-column label="金额一致性" width="130">
          <template #default="{ row }">
            <el-tag :type="row.amountMatched ? 'success' : 'danger'" size="small">
              {{ row.amountMatched ? '三方一致' : '存在差异' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="invoiceNo" label="发票号" width="165">
          <template #default="{ row }">
            <span v-if="row.invoiceNo" class="invoice-no">{{ row.invoiceNo }}</span>
            <span v-else class="muted">未开票</span>
          </template>
        </el-table-column>
        <el-table-column prop="expectedPaymentDate" label="预计回款" width="110" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }"><StatusTag :dict="DOC_STATUS" :value="row.status" /></template>
        </el-table-column>
        <el-table-column prop="owner" label="业务" width="80" />
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="760px" :title="current?.docNo">
      <template v-if="current">
        <el-alert
          v-if="!current.amountMatched"
          class="drawer-alert"
          type="error"
          :closable="false"
          show-icon
          title="金额三方不一致，禁止提交财务开票"
          :description="current.matchNote"
        />
        <el-alert
          v-else
          class="drawer-alert"
          type="success"
          :closable="false"
          show-icon
          title="出货单 / 对账单 / 发票三方金额一致"
          :description="current.matchNote"
        />

        <h3 class="drawer-title">开票信息</h3>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="客户">{{ current.customerName }}</el-descriptions-item>
          <el-descriptions-item label="客户编码">{{ current.customerCode }}</el-descriptions-item>
          <el-descriptions-item label="发票抬头" :span="2">{{ current.title }}</el-descriptions-item>
          <el-descriptions-item label="纳税人识别号">{{ current.taxNo }}</el-descriptions-item>
          <el-descriptions-item label="发票类型">
            {{ INVOICE_TYPE[current.invoiceType] }}
          </el-descriptions-item>
          <el-descriptions-item label="开户行及账号" :span="2">
            {{ current.bankAccount ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="地址电话" :span="2">
            {{ current.address ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="交付方式">{{ current.deliveryMethod }}</el-descriptions-item>
          <el-descriptions-item label="交付对象">{{ current.deliveryTarget }}</el-descriptions-item>
        </el-descriptions>

        <h3 class="drawer-title">金额</h3>
        <div class="amounts">
          <div class="amounts__item">
            <span>不含税金额</span>
            <b>{{ current.amountExTax }}</b>
          </div>
          <span class="amounts__op">+</span>
          <div class="amounts__item">
            <span>税额</span>
            <b>{{ current.taxAmount }}</b>
          </div>
          <span class="amounts__op">=</span>
          <div class="amounts__item is-final">
            <span>价税合计</span>
            <b>{{ current.amountIncTax }} {{ current.currency }}</b>
          </div>
          <div class="amounts__item">
            <span>预计回款日</span>
            <b>{{ current.expectedPaymentDate }}</b>
          </div>
        </div>

        <h3 class="drawer-title">开票明细</h3>
        <el-table :data="current.lines" size="small" border style="width: 100%">
          <el-table-column prop="shipmentNo" label="关联出货单" width="180" />
          <el-table-column prop="productName" label="产品" min-width="150" />
          <el-table-column prop="quantity" label="数量" width="90" align="right" />
          <el-table-column prop="unitPrice" label="单价" width="100" align="right" />
          <el-table-column prop="amount" label="金额" width="110" align="right" />
          <el-table-column prop="taxAmount" label="税额" width="110" align="right" />
        </el-table>

        <DocTimeline class="drawer-timeline" title="INV 节点计时" :nodes="current.timeline" />
      </template>

      <template #footer>
        <template v-if="current">
          <el-button>打印申请单</el-button>
          <el-button type="primary" :disabled="!current.amountMatched || current.status === 'completed'">
            提交财务开票
          </el-button>
        </template>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.rule-alert {
  margin-bottom: 14px;
}

.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
}

.amount {
  color: var(--wfx-navy);
}

.currency {
  margin-left: 4px;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.invoice-no {
  font-size: 12.5px;
  color: var(--el-color-success);
}

.muted {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

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

.drawer-title {
  margin: 22px 0 10px;
  font-size: 14px;
  color: var(--wfx-text-strong);
}

.drawer-alert {
  margin-bottom: 16px;
}

.drawer-timeline {
  margin-top: 18px;
}

.amounts {
  display: flex;
  gap: 18px;
  align-items: center;
  padding: 12px 14px;
  background: var(--wfx-surface-alt);
  border-radius: 6px;
}

.amounts__item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.amounts__item span {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.amounts__item b {
  font-size: 17px;
  color: var(--wfx-text-strong);
}

.amounts__item.is-final b {
  color: var(--wfx-navy);
}

.amounts__op {
  font-size: 16px;
  color: var(--wfx-text-muted);
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
