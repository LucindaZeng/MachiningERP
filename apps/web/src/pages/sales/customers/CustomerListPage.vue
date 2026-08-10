<script setup lang="ts">
import { Lock } from '@element-plus/icons-vue'
import { INVOICE_TYPE_LABELS, PAYMENT_TERM_LABELS } from '@machining-erp/shared'
import { computed, ref } from 'vue'

import { fetchCustomers } from '@/api/sales/customer.api'
import { matchEq, matchNumberRange, type FilterField } from '@/components/filter-helpers'
import FilterBar from '@/components/FilterBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import { CUSTOMER_STATUS } from '@/components/status-dictionary'
import StatusTag from '@/components/StatusTag.vue'
import { useResourceList } from '@/composables/use-resource-list'

import type { Customer } from '@/types/sales.types'

const EXPORT_COLUMNS = [
  { label: '客户编码', value: 'code' },
  { label: '客户名称', value: 'name' },
  { label: '简称', value: 'shortName' },
  { label: '国家 / 地区', value: 'country' },
  { label: '等级', value: 'level' },
  { label: '业务担当', value: 'ownerName' },
  { label: '状态', value: 'status' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'country',
    label: '国家 / 地区',
    type: 'select',
    options: [
      { label: '中国', value: '中国' },
      { label: '中国香港', value: '中国香港' },
      { label: '德国', value: '德国' },
      { label: '美国', value: '美国' },
    ],
    width: 150,
  },
  {
    key: 'level',
    label: '客户等级',
    type: 'select',
    options: [
      { label: 'A 类战略客户', value: 'A 类战略客户' },
      { label: 'B 类客户', value: 'B 类客户' },
      { label: '待评级', value: '待评级' },
    ],
    width: 150,
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '已生效', value: 'ACTIVE' },
      { label: '待审批', value: 'PENDING' },
      { label: '已停用', value: 'SUSPENDED' },
    ],
    width: 130,
  },
  {
    key: 'overdue',
    label: '逾期应收',
    type: 'select',
    options: [
      { label: '有逾期', value: 'yes' },
      { label: '无逾期', value: 'no' },
    ],
    width: 130,
  },
  { key: 'creditUsage', label: '信用占用%', type: 'number-range', width: 190 },
]

/** 表格插槽的 row 是 any，先收窄成契约类型，再取付款条件的中文文案 */
function paymentTermLabel(row: Customer): string {
  return PAYMENT_TERM_LABELS[row.paymentTerm]
}

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<Customer>(
  fetchCustomers, (row) => [
  row.code,
  row.name,
  row.shortName,
  row.country,
],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.country, f.country) &&
      matchEq(row.level ?? undefined, f.level) &&
      matchEq(row.status, f.status) &&
      matchEq(Number(row.finance.overdueAmount.amount) > 0 ? 'yes' : 'no', f.overdue) &&
      matchNumberRange(
        Number(row.finance.creditLimit.amount)
          ? (Number(row.finance.creditUsed.amount) / Number(row.finance.creditLimit.amount)) * 100
          : 0,
        f.creditUsage,
      ),
  },
)

const detailVisible = ref(false)
const current = ref<Customer | null>(null)

/** 当前登录角色，决定审批按钮可用性（接后端后由 identity 模块下发） */
const currentUser = { name: '罗晓琳', userCode: 'WFX-2018-0042' }

const creditUsageRate = computed(() => {
  const limit = Number(current.value?.finance.creditLimit.amount ?? '0')
  const used = Number(current.value?.finance.creditUsed.amount ?? '0')
  return limit ? used / limit : 0
})

/** createdBy 存的是用户编码，不是姓名，所以按编码比对 */
const cannotSelfApprove = computed(() => current.value?.createdBy === currentUser.userCode)

/** 预付比例只有付款条件①有值，其余付款条件下不显示这一行 */
const depositText = computed(() => {
  const ratio = current.value?.depositRatio
  return ratio == null ? '' : `${(ratio * 100).toFixed(0)}%`
})

function openDetail(row: Customer): void {
  current.value = row
  detailVisible.value = true
}
</script>

<template>
  <div>
    <PageHeader
      title="客户信息管理"
      requirement-code="ENG-01"
      subtitle="业务建档、财务维护信用与开票字段。疑似重复客户直接阻断创建；银行、税务、信用字段按角色隔离；业务不能审批本人创建的客户。"
    >
      <template #actions>
        <el-button type="primary">新建客户</el-button>
      </template>
    </PageHeader>

    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索客户编码 / 名称 / 国家地区"
        :total="filtered.length"
        export-name="客户信息"
        :export-columns="EXPORT_COLUMNS"
        :export-rows="filtered"
        @reset="resetFilters"
        @search="reload"
      />

      <el-table v-loading="loading" :data="filtered" style="width: 100%" @row-click="openDetail">
        <el-table-column prop="code" label="客户编码" width="110" />
        <el-table-column prop="name" label="客户名称" min-width="230" show-overflow-tooltip />
        <el-table-column prop="country" label="国家 / 地区" width="100" />
        <el-table-column prop="level" label="等级" width="110" />
        <el-table-column label="付款条件" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ paymentTermLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="信用占用" width="150">
          <template #default="{ row }">
            <el-progress
              :percentage="
                Math.min(
                  100,
                  Number(row.finance.creditLimit.amount) === 0
                    ? 0
                    : (Number(row.finance.creditUsed.amount) /
                        Number(row.finance.creditLimit.amount)) *
                        100,
                )
              "
              :stroke-width="10"
              :show-text="false"
              :status="
                Number(row.finance.overdueAmount.amount) > 0
                  ? 'exception'
                  : undefined
              "
            />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <StatusTag :dict="CUSTOMER_STATUS" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="680px" :title="current?.name">
      <template v-if="current">
        <h3 class="drawer-title">业务维护字段</h3>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="客户编码">{{ current.code }}</el-descriptions-item>
          <el-descriptions-item label="简称">{{ current.shortName }}</el-descriptions-item>
          <el-descriptions-item label="国家 / 地区">{{ current.country }}</el-descriptions-item>
          <el-descriptions-item label="客户等级">{{ current.level }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ current.ownerName }}</el-descriptions-item>
          <el-descriptions-item label="电话">{{ current.ownerPhone }}</el-descriptions-item>
          <el-descriptions-item label="邮箱" :span="2">{{ current.ownerEmail }}</el-descriptions-item>
          <el-descriptions-item label="开票地址" :span="2">
            {{ current.invoiceAddress }}
          </el-descriptions-item>
          <el-descriptions-item label="贸易条件">{{ current.tradeTerm }}</el-descriptions-item>
          <el-descriptions-item label="结算币种">{{ current.currency }}</el-descriptions-item>
          <el-descriptions-item label="发票类型">
            {{ INVOICE_TYPE_LABELS[current.invoiceType] }}
          </el-descriptions-item>
          <el-descriptions-item label="结算方式">
            {{ current.settlement === 'CASH' ? '现金' : '承兑' }}
          </el-descriptions-item>
          <el-descriptions-item label="付款条件" :span="2">
            {{ PAYMENT_TERM_LABELS[current.paymentTerm] }}
            <template v-if="depositText">（预付 {{ depositText }}）</template>
          </el-descriptions-item>
        </el-descriptions>

        <h3 class="drawer-title">
          财务维护字段
          <el-tag size="small" type="info" effect="plain">
            <el-icon><Lock /></el-icon> 业务角色只读 · 银行与税号已脱敏
          </el-tag>
        </h3>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="税号">{{ current.finance.taxNo }}</el-descriptions-item>
          <el-descriptions-item label="开户行">{{ current.finance.bankName }}</el-descriptions-item>
          <el-descriptions-item label="银行账号" :span="2">
            {{ current.finance.bankAccount }}
          </el-descriptions-item>
          <el-descriptions-item label="信用额度">
            {{ current.finance.creditLimit.amount }} {{ current.finance.creditLimit.currency }}
          </el-descriptions-item>
          <el-descriptions-item label="已占用">
            {{ current.finance.creditUsed.amount }}（{{ (creditUsageRate * 100).toFixed(1) }}%）
          </el-descriptions-item>
          <el-descriptions-item label="账期">{{ current.finance.arDays }} 天</el-descriptions-item>
          <el-descriptions-item label="逾期金额">
            <span :class="{ 'is-danger': Number(current.finance.overdueAmount.amount) > 0 }">
              {{ current.finance.overdueAmount.amount }}
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-if="creditUsageRate > 0.9"
          class="drawer-alert"
          type="error"
          :closable="false"
          show-icon
          title="信用占用超过 90%，新订单财务审核将被阻断"
          description="需先催收逾期款或由财务批准临时额度，超阈值例外由总经办批准。"
        />

        <el-alert
          v-if="cannotSelfApprove && current.status === 'PENDING'"
          class="drawer-alert"
          type="warning"
          :closable="false"
          show-icon
          title="职责分离：本人创建的客户不能由本人审批"
          description="该客户由你创建，审批按钮已禁用，请提交业务经理与财务审核。"
        />

      </template>

      <template #footer>
        <template v-if="current">
            <el-button>查看变更审计</el-button>
            <el-button
              type="primary"
              :disabled="cannotSelfApprove || current.status !== 'PENDING'"
            >
              提交审批
            </el-button>
        </template>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
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

.drawer-title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 22px 0 10px;
  font-size: 14px;
  color: var(--wfx-text-strong);
}

.drawer-title:first-child {
  margin-top: 0;
}

.is-danger {
  font-weight: 700;
  color: var(--el-color-danger);
}

.drawer-alert {
  margin-top: 16px;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
