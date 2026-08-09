<script setup lang="ts">
import { ref } from 'vue'

import { fetchOrderChanges } from '@/api/sales/sales-order.api'
import DocTimeline from '@/components/DocTimeline.vue'
import FilterBar from '@/components/FilterBar.vue'
import StatusTag from '@/components/StatusTag.vue'
import { matchDateRange, matchEq, type FilterField } from '@/components/filter-helpers'
import { ORDER_CHANGE_STATUS, ORDER_CHANGE_TYPE, ORDER_TYPE } from '@/components/status-dictionary'
import { useResourceList } from '@/composables/use-resource-list'
import type { OrderChangeRequest } from '@/types/sales.types'

const EXPORT_COLUMNS = [
  { label: '变更单号', value: 'docNo' },
  { label: '原订单号', value: 'orderNo' },
  { label: '订单类型', value: 'orderType' },
  { label: '客户', value: 'customerName' },
  { label: '产品', value: 'productName' },
  { label: '变更类型', value: 'changeType' },
  { label: '来源', value: 'origin' },
  { label: '变更前', value: 'beforeValue' },
  { label: '变更后', value: 'afterValue' },
  { label: '变更原因', value: 'reason' },
  { label: '费用承担', value: 'costOwner' },
  { label: '需重新核价', value: 'needRequote' },
  { label: '需重新审批', value: 'needReapproval' },
  { label: '状态', value: 'status' },
  { label: '业务', value: 'owner' },
  { label: '提交时间', value: 'submittedAt' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'changeType',
    label: '变更类型',
    type: 'select',
    options: Object.entries(ORDER_CHANGE_TYPE).map(([value, label]) => ({ label, value })),
    width: 160,
  },
  {
    key: 'origin',
    label: '变更来源',
    type: 'select',
    options: [
      { label: '客户提出', value: 'customer' },
      { label: '内部提出', value: 'internal' },
    ],
    width: 140,
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: Object.entries(ORDER_CHANGE_STATUS).map(([value, meta]) => ({
      label: meta.label,
      value,
    })),
    width: 140,
  },
  {
    key: 'costOwner',
    label: '费用承担',
    type: 'select',
    options: ['客户承担', '公司承担', '双方分摊', '无额外费用'].map((item) => ({
      label: item,
      value: item,
    })),
    width: 140,
  },
  { key: 'submittedAt', label: '提交日期', type: 'date-range' },
]

const { filtered, loading, keyword, filters, resetFilters, reload } =
  useResourceList<OrderChangeRequest>(
    fetchOrderChanges,
    (row) => [row.docNo, row.orderNo, row.customerName, row.productName, row.drawingNo],
    {
      fields: FILTER_FIELDS,
      predicate: (row, f) =>
        matchEq(row.changeType, f.changeType) &&
        matchEq(row.origin, f.origin) &&
        matchEq(row.status, f.status) &&
        matchEq(row.costOwner, f.costOwner) &&
        matchDateRange(row.submittedAt.slice(0, 10), f.submittedAt),
    },
  )

const detailVisible = ref(false)
const current = ref<OrderChangeRequest | null>(null)

function openDetail(row: OrderChangeRequest): void {
  current.value = row
  detailVisible.value = true
}
</script>

<template>
  <div>
    <el-alert
      class="rule-alert"
      type="info"
      :closable="false"
      show-icon
      title="订单修改申请（ORC）：价格与下单产品不可修改"
      description="可改：数量、交期、收货信息、包装要求、取消订单。不可改：① 价格——改价必须走「报价管理 → 报价单修改申请（QRC）」，由报价工程师改成本分析后重新报价并回写订单；② 下单产品——换产品等于换一张订单，须取消原单重下；改图纸 / 材料 / 表面处理属于产品变更，走「ECN 申请」。这样价格与产品定义始终只有一个出口，不会被两条流程各改一次。"
    />

    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索变更单号 / 订单号 / 客户 / 产品 / 图号"
        :total="filtered.length"
        export-name="订单修改申请"
        :export-columns="EXPORT_COLUMNS"
        :export-rows="filtered"
        @reset="resetFilters"
        @search="reload"
      />

      <el-table :data="filtered" v-loading="loading" style="width: 100%" @row-click="openDetail">
        <el-table-column prop="docNo" label="变更单号" width="168">
          <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
        </el-table-column>
        <el-table-column label="原订单" width="185">
          <template #default="{ row }">
            <span class="order-no">{{ row.orderNo }}</span>
            <StatusTag :dict="ORDER_TYPE" :value="row.orderType" />
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="130" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="115" show-overflow-tooltip />
        <el-table-column label="变更类型" width="112">
          <template #default="{ row }">
            <el-tag size="small" :type="row.changeType === 'cancel' ? 'danger' : 'primary'" effect="plain">
              {{ ORDER_CHANGE_TYPE[row.changeType] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="82">
          <template #default="{ row }">{{ row.origin === 'customer' ? '客户提出' : '内部提出' }}</template>
        </el-table-column>
        <el-table-column label="变更内容" min-width="215">
          <template #default="{ row }">
            <span class="before">{{ row.beforeValue }}</span>
            <span class="after">→ {{ row.afterValue }}</span>
          </template>
        </el-table-column>
        <el-table-column label="重新核价" width="92">
          <template #default="{ row }">
            <el-tag v-if="row.needRequote" size="small" type="warning">需重核价</el-tag>
            <span v-else class="muted">否</span>
          </template>
        </el-table-column>
        <el-table-column prop="costOwner" label="费用承担" width="100" />
        <el-table-column label="状态" width="95">
          <template #default="{ row }">
            <StatusTag :dict="ORDER_CHANGE_STATUS" :value="row.status" />
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="760px" :title="current?.docNo">
      <template v-if="current">
        <el-alert
          v-if="!current.planSynced"
          class="drawer-alert"
          type="warning"
          :closable="false"
          show-icon
          title="变更尚未同步 PMC 计划"
          description="订单信息变更批准后必须同步 PMC 重排计划与采购，未同步前订单追踪的交期仍按原值预警。"
        />

        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="原订单号">{{ current.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ current.customerName }}</el-descriptions-item>
          <el-descriptions-item label="产品">{{ current.productName }}</el-descriptions-item>
          <el-descriptions-item label="图号">{{ current.drawingNo }}</el-descriptions-item>
          <el-descriptions-item label="变更类型">
            {{ ORDER_CHANGE_TYPE[current.changeType] }}
          </el-descriptions-item>
          <el-descriptions-item label="变更来源">
            {{ current.origin === 'customer' ? '客户提出' : '内部提出' }}
            <el-tag v-if="current.urgent" size="small" type="danger" class="urgent">加急</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="变更前" :span="2">{{ current.beforeValue }}</el-descriptions-item>
          <el-descriptions-item label="变更后" :span="2">
            <b class="after-value">{{ current.afterValue }}</b>
          </el-descriptions-item>
          <el-descriptions-item label="变更原因" :span="2">{{ current.reason }}</el-descriptions-item>
          <el-descriptions-item label="费用承担">{{ current.costOwner }}</el-descriptions-item>
          <el-descriptions-item label="业务担当">{{ current.owner }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ current.submittedAt }}</el-descriptions-item>
          <el-descriptions-item label="是否重新核价">
            {{ current.needRequote ? '是（联动报价与成本分析）' : '否' }}
          </el-descriptions-item>
          <el-descriptions-item label="是否重新审批">
            {{ current.needReapproval ? '是（订单回到 ORD-02 重走审批）' : '否' }}
          </el-descriptions-item>
        </el-descriptions>

        <h3 class="drawer-title">影响范围评估</h3>
        <el-table :data="current.impacts" size="small" border style="width: 100%">
          <el-table-column prop="scope" label="影响范围" width="140" />
          <el-table-column prop="quantity" label="数量" width="130" />
          <el-table-column prop="amount" label="金额" width="120" align="right" />
          <el-table-column prop="note" label="处置说明" min-width="260" />
        </el-table>

        <DocTimeline class="drawer-timeline" title="ORC 节点计时" :nodes="current.timeline" />
      </template>

      <template #footer>
        <template v-if="current">
          <el-button>打印变更通知</el-button>
          <el-button type="primary" :disabled="current.status === 'completed'">
            推进下一节点
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

.order-no {
  display: block;
  font-size: 12.5px;
  color: var(--wfx-text);
}

.before {
  display: block;
  font-size: 12px;
  color: var(--wfx-text-muted);
  text-decoration: line-through;
}

.after {
  display: block;
  font-size: 12.5px;
  color: var(--wfx-text-strong);
}

.after-value {
  color: var(--wfx-navy);
}

.muted {
  color: var(--wfx-text-muted);
}

.urgent {
  margin-left: 8px;
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

.drawer-alert {
  margin-top: 0;
  margin-bottom: 16px;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
