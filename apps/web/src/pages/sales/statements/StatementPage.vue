<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'

import { fetchStatements } from '@/api/sales/statement.api'
import { matchDateRange, matchEq, type FilterField } from '@/components/filter-helpers'
import FilterBar from '@/components/FilterBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import { STATEMENT_STATUS } from '@/components/status-dictionary'
import StatusTag from '@/components/StatusTag.vue'
import { useResourceList } from '@/composables/use-resource-list'

import type { Statement } from '@/types/sales.types'

const EXPORT_COLUMNS = [
  { label: '对账单号', value: 'docNo' },
  { label: '客户', value: 'customerName' },
  { label: '客户编码', value: 'customerCode' },
  { label: '对账期间起', value: 'periodFrom' },
  { label: '对账期间止', value: 'periodTo' },
  { label: '期初余额', value: 'openingBalance' },
  { label: '本期发货', value: 'shippedAmount' },
  { label: '本期开票', value: 'invoicedAmount' },
  { label: '本期回款', value: 'receivedAmount' },
  { label: '退货折让', value: 'returnAmount' },
  { label: '期末应收', value: 'closingBalance' },
  { label: '对账差异', value: 'differenceAmount' },
  { label: '其中逾期', value: 'overdueAmount' },
  { label: '状态', value: 'status' },
  { label: '业务', value: 'owner' },
]

const FILTER_FIELDS: FilterField[] = [
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
      { label: '已发出待确认', value: 'sent' },
      { label: '客户已确认', value: 'confirmed' },
      { label: '有差异待处理', value: 'disputed' },
      { label: '已结清', value: 'settled' },
    ],
    width: 160,
  },
  {
    key: 'hasDifference',
    label: '对账差异',
    type: 'select',
    options: [
      { label: '有差异', value: 'yes' },
      { label: '无差异', value: 'no' },
    ],
    width: 140,
  },
  {
    key: 'hasOverdue',
    label: '逾期',
    type: 'select',
    options: [
      { label: '有逾期', value: 'yes' },
      { label: '无逾期', value: 'no' },
    ],
    width: 130,
  },
  { key: 'periodTo', label: '对账期间', type: 'date-range' },
]

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<Statement>(
  fetchStatements,
  (row) => [row.docNo, row.customerName, row.customerCode],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.customerName, f.customerName) &&
      matchEq(row.status, f.status) &&
      matchEq(Number(row.differenceAmount) !== 0 ? 'yes' : 'no', f.hasDifference) &&
      matchEq(Number(row.overdueAmount) > 0 ? 'yes' : 'no', f.hasOverdue) &&
      matchDateRange(row.periodTo, f.periodTo),
  },
)

const detailVisible = ref(false)
const current = ref<Statement | null>(null)

const unmatchedCount = computed(
  () => current.value?.lines.filter((line) => !line.matched).length ?? 0,
)

const totalDifference = computed(() =>
  filtered.value.reduce((sum, row) => sum + Math.abs(Number(row.differenceAmount)), 0).toFixed(2),
)

function openDetail(row: Statement): void {
  current.value = row
  detailVisible.value = true
}

function sendStatement(): void {
  ElMessage.success('对账单已生成 PDF 并推送至客户门户，等待客户在线确认（每次生成留版本快照）')
}
</script>

<template>
  <div>
    <PageHeader
      title="客户对账单"
      requirement-code="STM-01 ~ STM-05"
      subtitle="按客户与期间汇总发货、开票、回款与退货折让：期末余额 = 期初 + 本期发货 − 回款 − 退货折让。差异非零必须写明原因并挂账；客户确认后进入财务收款流程，金额口径与财务应收保持一致。"
    >
      <template #actions>
        <el-button>批量生成本期对账单</el-button>
        <el-button type="primary" @click="sendStatement">发送至客户门户</el-button>
      </template>
    </PageHeader>

    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索对账单号 / 客户 / 客户编码"
        :total="filtered.length"
        export-name="客户对账单"
        :export-columns="EXPORT_COLUMNS"
        :export-rows="filtered"
        @reset="resetFilters"
        @search="reload"
      >
        <template #extra>
          <span>差异合计 {{ totalDifference }}</span>
        </template>
      </FilterBar>

      <el-table v-loading="loading" :data="filtered" style="width: 100%" @row-click="openDetail">
        <el-table-column prop="docNo" label="对账单号" width="175">
          <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="170" show-overflow-tooltip />
        <el-table-column label="对账期间" width="185">
          <template #default="{ row }">{{ row.periodFrom }} ~ {{ row.periodTo }}</template>
        </el-table-column>
        <el-table-column label="期初" width="115" align="right">
          <template #default="{ row }">{{ row.openingBalance }}</template>
        </el-table-column>
        <el-table-column label="本期发货" width="115" align="right">
          <template #default="{ row }">{{ row.shippedAmount }}</template>
        </el-table-column>
        <el-table-column label="本期回款" width="115" align="right">
          <template #default="{ row }">{{ row.receivedAmount }}</template>
        </el-table-column>
        <el-table-column label="期末应收" width="130" align="right">
          <template #default="{ row }">
            <b class="balance">{{ row.closingBalance }}</b>
            <span class="currency">{{ row.currency }}</span>
          </template>
        </el-table-column>
        <el-table-column label="差异" width="110" align="right">
          <template #default="{ row }">
            <span :class="Number(row.differenceAmount) !== 0 ? 'is-diff' : 'muted'">
              {{ row.differenceAmount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="逾期" width="110" align="right">
          <template #default="{ row }">
            <span :class="Number(row.overdueAmount) > 0 ? 'is-diff' : 'muted'">
              {{ row.overdueAmount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <StatusTag :dict="STATEMENT_STATUS" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row)">明细</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="820px" :title="current?.docNo">
      <template v-if="current">
        <el-alert
          v-if="Number(current.differenceAmount) !== 0"
          class="drawer-alert"
          type="error"
          :closable="false"
          show-icon
          :title="`存在对账差异 ${current.differenceAmount} ${current.currency}，${unmatchedCount} 行未核对`"
          :description="current.differenceNote"
        />

        <div class="balance-flow">
          <div class="balance-flow__cell">
            <span>期初余额</span>
            <b>{{ current.openingBalance }}</b>
          </div>
          <span class="balance-flow__op">+</span>
          <div class="balance-flow__cell">
            <span>本期发货</span>
            <b>{{ current.shippedAmount }}</b>
            <em>已开票 {{ current.invoicedAmount }}</em>
          </div>
          <span class="balance-flow__op">−</span>
          <div class="balance-flow__cell">
            <span>本期回款</span>
            <b>{{ current.receivedAmount }}</b>
          </div>
          <span class="balance-flow__op">−</span>
          <div class="balance-flow__cell">
            <span>退货折让</span>
            <b>{{ current.returnAmount }}</b>
          </div>
          <span class="balance-flow__op">=</span>
          <div class="balance-flow__cell is-final">
            <span>期末应收</span>
            <b>{{ current.closingBalance }}</b>
            <em>{{ current.currency }}</em>
          </div>
        </div>

        <el-descriptions :column="3" border size="small" class="section">
          <el-descriptions-item label="客户">{{ current.customerName }}</el-descriptions-item>
          <el-descriptions-item label="客户编码">{{ current.customerCode }}</el-descriptions-item>
          <el-descriptions-item label="业务员">{{ current.owner }}</el-descriptions-item>
          <el-descriptions-item label="发出时间">{{ current.sentAt ?? '未发出' }}</el-descriptions-item>
          <el-descriptions-item label="客户确认">
            {{ current.confirmedAt ?? '未确认' }}
          </el-descriptions-item>
          <el-descriptions-item label="其中逾期">
            <span :class="Number(current.overdueAmount) > 0 ? 'is-diff' : ''">
              {{ current.overdueAmount }} {{ current.currency }}
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <h3 class="drawer-title">对账明细</h3>
        <el-table :data="current.lines" size="small" border>
          <el-table-column prop="date" label="日期" width="105" />
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column prop="docNo" label="单号" width="180" />
          <el-table-column prop="productName" label="产品" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.productName ?? '—' }}</template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="80" align="right">
            <template #default="{ row }">{{ row.quantity ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="金额" width="120" align="right">
            <template #default="{ row }">
              <span :class="Number(row.amount) < 0 ? 'is-credit' : ''">{{ row.amount }}</span>
            </template>
          </el-table-column>
          <el-table-column label="核对" width="90">
            <template #default="{ row }">
              <el-tag :type="row.matched ? 'success' : 'danger'" size="small" effect="light">
                {{ row.matched ? '已核对' : '未核对' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
        </el-table>

        <p class="drawer-note">
          对账单由 docgen 统一生成 PDF 并留版本快照，可推送至客户门户在线确认；客户确认后金额锁定，
          差异行需先由业务与财务处理（红字发票、折让或挂账）再重新出单，不允许直接改写已确认对账单。
        </p>
      </template>

      <template #footer>
        <template v-if="current">
          <el-button>导出对账单 PDF</el-button>
          <el-button
            type="primary"
            :disabled="Number(current.differenceAmount) !== 0"
            @click="sendStatement"
          >
            发送客户确认
          </el-button>
        </template>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
}

.balance {
  font-size: 14px;
  color: var(--wfx-navy);
}

.currency {
  margin-left: 4px;
  font-size: 11px;
  color: var(--wfx-text-muted);
}

.muted {
  color: var(--wfx-text-muted);
}

.is-diff {
  font-weight: 700;
  color: var(--el-color-danger);
}

.is-credit {
  color: var(--el-color-success);
}

.drawer-alert {
  margin-bottom: 16px;
}

.balance-flow {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 14px;
  background: var(--wfx-surface-alt);
  border: 1px solid var(--wfx-border);
  border-radius: var(--wfx-radius-md);
}

.balance-flow__cell {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid var(--wfx-border);
  border-radius: 8px;
}

.balance-flow__cell span {
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.balance-flow__cell b {
  font-size: 16px;
  color: var(--wfx-text-strong);
}

.balance-flow__cell em {
  font-size: 11px;
  font-style: normal;
  color: var(--wfx-text-muted);
}

.balance-flow__cell.is-final b {
  color: var(--wfx-navy);
}

.balance-flow__op {
  font-size: 16px;
  font-weight: 700;
  color: var(--wfx-text-muted);
}

.section {
  margin-top: 18px;
}

.drawer-title {
  margin: 22px 0 10px;
  font-size: 14px;
  color: var(--wfx-text-strong);
}

.drawer-note {
  margin: 14px 0 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--wfx-text-muted);
  background: var(--wfx-surface-alt);
  border-left: 3px solid var(--wfx-orange);
  border-radius: 4px;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
