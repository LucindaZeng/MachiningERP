<script setup lang="ts">
import { reactive, ref } from 'vue'

import { fetchEngineeringChanges } from '@/api/sales/ecn.api'
import DocTimeline from '@/components/DocTimeline.vue'
import DraftToolbar from '@/components/DraftToolbar.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { ECN_CHANGE_TYPE, ECN_STATUS } from '@/components/status-dictionary'
import FilterBar from '@/components/FilterBar.vue'
import { matchEq, type FilterField } from '@/components/filter-helpers'
import { useFormDraft } from '@/composables/use-form-draft'
import { useResourceList } from '@/composables/use-resource-list'
import type { EngineeringChange } from '@/types/sales.types'

const EXPORT_COLUMNS = [
  { label: '变更单号', value: 'docNo' },
  { label: '客户', value: 'customerName' },
  { label: '关联订单', value: 'orderNo' },
  { label: '产品', value: 'productName' },
  { label: '图号', value: 'drawingNo' },
  { label: '变更前', value: 'beforeValue' },
  { label: '变更后', value: 'afterValue' },
  { label: '状态', value: 'status' },
  { label: '责任人', value: 'owner' },
  { label: '提交时间', value: 'submittedAt' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'changeType',
    label: '变更类型',
    type: 'select',
    options: [
      { label: '图纸版本', value: 'drawing' },
      { label: '材料牌号', value: 'material' },
      { label: '表面处理', value: 'surface' },
      { label: '工艺 / 工序', value: 'process' },
      { label: '数量', value: 'quantity' },
      { label: '交期', value: 'delivery' },
    ],
    width: 150,
  },
  {
    key: 'origin',
    label: '变更来源',
    type: 'select',
    options: [
      { label: '客户要求', value: 'customer' },
      { label: '内部发起', value: 'internal' },
    ],
    width: 140,
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '草稿', value: 'draft' },
      { label: '工程评估中', value: 'assessing' },
      { label: '会签中', value: 'reviewing' },
      { label: '已批准', value: 'approved' },
      { label: '执行中', value: 'executing' },
    ],
    width: 140,
  },
  {
    key: 'urgent',
    label: '紧急度',
    type: 'select',
    options: [
      { label: '加急', value: 'true' },
      { label: '普通', value: 'false' },
    ],
    width: 120,
  },
  {
    key: 'needRequote',
    label: '是否重新核价',
    type: 'select',
    options: [
      { label: '触发重新核价', value: 'true' },
      { label: '不影响价格', value: 'false' },
    ],
    width: 170,
  },
]

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<EngineeringChange>(
  fetchEngineeringChanges,
  (row) => [row.docNo, row.customerName, row.productName, row.drawingNo],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.changeType, f.changeType) &&
      matchEq(row.origin, f.origin) &&
      matchEq(row.status, f.status) &&
      matchEq(row.urgent, f.urgent) &&
      matchEq(row.needRequote, f.needRequote),
  },
)

const detailVisible = ref(false)
const createVisible = ref(false)
const current = ref<EngineeringChange | null>(null)

/** 新建 ECN 表单（草稿可保存 / 调用 / 删除） */
const createForm = reactive({
  customerCode: '',
  orderNo: '',
  product: '',
  drawingNo: '',
  changeType: 'drawing',
  origin: 'customer',
  urgent: false,
  beforeValue: '',
  afterValue: '',
  reason: '',
})

const {
  drafts,
  lastSavedAt,
  save: saveDraft,
  load: loadDraft,
  remove: removeDraft,
} = useFormDraft('ecn-create', createForm)

function openDetail(row: EngineeringChange): void {
  current.value = row
  detailVisible.value = true
}
</script>

<template>
  <div>
    <PageHeader
      title="ECN 申请（工程变更）"
      requirement-code="ECN-01 ~ ECN-05"
      subtitle="ECN 只受理产品本身的变更：改图纸、改材料、改表面处理，以及随之必须同步的工艺路线。改图强制联动改工艺路线，未同步禁止发布新版本；中途改工序只对指定批次版本生效；影响价格或交期的变更同时触发重新核价与订单重新审批。"
    >
      <template #actions>
        <el-button type="primary" @click="createVisible = true">新建 ECN 申请</el-button>
      </template>
    </PageHeader>

    <el-alert
      class="scope-alert"
      type="warning"
      :closable="false"
      show-icon
      title="改数量 / 改交期 / 改价格不走 ECN"
      description="ECN = 产品变更（图纸、材料、表面处理、工艺路线）。数量、交期、单价、收费方式、收货信息、包装要求与取消订单属于订单信息变更，请到「订单管理 → 订单修改申请（ORC）」提交，避免两条流程互相覆盖。"
    />

    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索 ECN 单号 / 客户 / 产品 / 图号"
        :total="filtered.length"
        export-name="ECN 申请"
        :export-columns="EXPORT_COLUMNS"
        :export-rows="filtered"
        @reset="resetFilters"
        @search="reload"
      />

      <el-table :data="filtered" v-loading="loading" style="width: 100%" @row-click="openDetail">
        <el-table-column prop="docNo" label="ECN 单号" width="175">
          <template #default="{ row }">
            <span class="doc-no">{{ row.docNo }}</span>
            <el-tag v-if="row.urgent" type="danger" size="small" class="urgent">加急</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="160" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="130" show-overflow-tooltip />
        <el-table-column prop="drawingNo" label="图号" width="110" />
        <el-table-column label="变更类型" width="110">
          <template #default="{ row }">{{ ECN_CHANGE_TYPE[row.changeType] }}</template>
        </el-table-column>
        <el-table-column label="来源" width="90">
          <template #default="{ row }">{{ row.origin === 'customer' ? '客户要求' : '内部发起' }}</template>
        </el-table-column>
        <el-table-column prop="orderNo" label="关联订单" width="165">
          <template #default="{ row }">{{ row.orderNo ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="连带动作" min-width="180">
          <template #default="{ row }">
            <el-tag v-if="row.needRequote" size="small" type="warning" effect="plain" class="tag">
              重新核价
            </el-tag>
            <el-tag
              v-if="row.needOrderReapproval"
              size="small"
              type="warning"
              effect="plain"
              class="tag"
            >
              订单重审
            </el-tag>
            <el-tag v-if="!row.routingUpdated" size="small" type="danger" effect="plain" class="tag">
              工艺路线未同步
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }"><StatusTag :dict="ECN_STATUS" :value="row.status" /></template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="700px" :title="current?.docNo">
      <template v-if="current">
        <el-alert
          v-if="current.changeType === 'drawing' && !current.routingUpdated"
          class="drawer-alert"
          type="error"
          :closable="false"
          show-icon
          title="改图未同步修改工艺路线，禁止发布新版本"
          description="按工程变更规则，图纸版本变更必须联动更新工艺路线与相关程序后才能批准发布。"
        />

        <div class="diff">
          <div class="diff__cell">
            <span>变更前</span>
            <p>{{ current.beforeValue }}</p>
          </div>
          <span class="diff__arrow">→</span>
          <div class="diff__cell is-after">
            <span>变更后</span>
            <p>{{ current.afterValue }}</p>
          </div>
        </div>

        <el-descriptions :column="2" border size="small" class="section">
          <el-descriptions-item label="客户">{{ current.customerName }}</el-descriptions-item>
          <el-descriptions-item label="关联订单">{{ current.orderNo ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="产品 / 图号">
            {{ current.productName }} · {{ current.drawingNo }}
          </el-descriptions-item>
          <el-descriptions-item label="变更类型">
            {{ ECN_CHANGE_TYPE[current.changeType] }}
          </el-descriptions-item>
          <el-descriptions-item label="变更来源">
            {{ current.origin === 'customer' ? '客户要求' : '内部发起' }}
          </el-descriptions-item>
          <el-descriptions-item label="生效批次">
            {{ current.effectiveBatch ?? '全部后续批次' }}
          </el-descriptions-item>
          <el-descriptions-item label="变更原因" :span="2">{{ current.reason }}</el-descriptions-item>
        </el-descriptions>

        <h3 class="drawer-title">影响范围评估</h3>
        <el-table :data="current.impacts" size="small" border>
          <el-table-column prop="scope" label="范围" width="110" />
          <el-table-column prop="quantity" label="数量" width="110" />
          <el-table-column prop="amount" label="金额" width="110" align="right" />
          <el-table-column prop="note" label="处置说明" min-width="240" />
        </el-table>

        <div class="consequence">
          <el-tag :type="current.needRequote ? 'warning' : 'info'" effect="light">
            {{ current.needRequote ? '触发重新核价' : '不影响价格' }}
          </el-tag>
          <el-tag :type="current.needOrderReapproval ? 'warning' : 'info'" effect="light">
            {{ current.needOrderReapproval ? '触发订单重新审批' : '订单无需重审' }}
          </el-tag>
          <el-tag :type="current.routingUpdated ? 'success' : 'danger'" effect="light">
            {{ current.routingUpdated ? '工艺路线已同步' : '工艺路线未同步' }}
          </el-tag>
        </div>

        <DocTimeline class="drawer-timeline" title="变更处理节点计时" :nodes="current.timeline" />
      </template>

      <template #footer>
        <template v-if="current">
          <el-button>导出变更通知单</el-button>
          <el-button type="primary" :disabled="current.status === 'draft'">催办工程评估</el-button>
        </template>
      </template>
    </el-drawer>

    <el-dialog v-model="createVisible" title="新建 ECN 申请（ECN-01）" width="640px">
      <el-alert
        class="create-alert"
        type="info"
        :closable="false"
        show-icon
        title="仅受理图纸 / 材料 / 表面处理及随之同步的工艺路线变更"
        description="改图必须由工程同步更新工艺路线后才能发布；中途改工序需指定生效批次版本。若变更影响价格或交期，系统会同时触发重新核价与订单重新审批；纯订单信息变更请改用订单修改申请。"
      />

      <el-form label-width="110px">
        <el-form-item label="客户" required>
          <el-select v-model="createForm.customerCode" placeholder="选择客户" style="width: 100%">
            <el-option label="C-HK-002 · 香港宏晟精密" value="C-HK-002" />
            <el-option label="C-DE-011 · Brenner Maschinenbau" value="C-DE-011" />
            <el-option label="C-CN-004 · 苏州明泰自动化" value="C-CN-004" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联订单">
          <el-input v-model="createForm.orderNo" placeholder="如 SO-20260726-0113，可留空" />
        </el-form-item>
        <el-form-item label="产品 / 图号" required>
          <el-input v-model="createForm.product" placeholder="产品名称" />
        </el-form-item>
        <el-form-item label="图号" required>
          <el-input v-model="createForm.drawingNo" placeholder="如 HS-4471-A" />
        </el-form-item>
        <el-form-item label="变更类型" required>
          <el-select v-model="createForm.changeType" style="width: 100%">
            <el-option
              v-for="(label, value) in ECN_CHANGE_TYPE"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="变更来源">
          <el-radio-group v-model="createForm.origin">
            <el-radio value="customer">客户要求</el-radio>
            <el-radio value="internal">内部发起</el-radio>
          </el-radio-group>
          <el-checkbox v-model="createForm.urgent" class="urgent-check">加急</el-checkbox>
        </el-form-item>
        <el-form-item label="变更前" required>
          <el-input v-model="createForm.beforeValue" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="变更后" required>
          <el-input v-model="createForm.afterValue" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="变更原因" required>
          <el-input v-model="createForm.reason" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <DraftToolbar
            :drafts="drafts"
            :last-saved-at="lastSavedAt"
            @save="saveDraft"
            @load="loadDraft"
            @remove="removeDraft"
          />
          <div>
            <el-button @click="createVisible = false">取消</el-button>
            <el-button type="primary" @click="createVisible = false">提交工程评估</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.scope-alert {
  margin-bottom: 14px;
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

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.create-alert {
  margin-bottom: 18px;
}

.urgent-check {
  margin-left: 16px;
}

.urgent,
.tag {
  margin-left: 6px;
}

.diff {
  display: flex;
  gap: 12px;
  align-items: center;
}

.diff__cell {
  flex: 1;
  padding: 12px 14px;
  background: var(--wfx-surface-alt);
  border: 1px solid var(--wfx-border);
  border-radius: var(--wfx-radius-md);
}

.diff__cell.is-after {
  background: #fff8ec;
  border-color: #f5d8a4;
}

.diff__cell span {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.diff__cell p {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--wfx-text-strong);
}

.diff__arrow {
  font-size: 20px;
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

.consequence {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.drawer-alert,
.drawer-timeline {
  margin-top: 16px;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
