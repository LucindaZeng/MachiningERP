<script setup lang="ts">
import { CircleCheckFilled, Clock } from '@element-plus/icons-vue'
import { computed, reactive, ref } from 'vue'

import { fetchBomRequests } from '@/api/sales/bom-request.api'
import DocTimeline from '@/components/DocTimeline.vue'
import DraftToolbar from '@/components/DraftToolbar.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { BOM_REQUEST_STATUS } from '@/components/status-dictionary'
import FilterBar from '@/components/FilterBar.vue'
import { matchDateRange, matchEq, type FilterField } from '@/components/filter-helpers'
import { useFormDraft } from '@/composables/use-form-draft'
import { useResourceList } from '@/composables/use-resource-list'
import type { BomRequest } from '@/types/sales.types'

/** 正式量产建「品号」，模具建「模具编号」 */
function codeLabel(row: BomRequest): string {
  return row.productionType === 'mold' ? '模具编号' : '品号'
}

const EXPORT_COLUMNS = [
  { label: '申请单号', value: 'docNo' },
  { label: '客户', value: 'customerName' },
  { label: '产品', value: 'productName' },
  { label: '图号', value: 'drawingNo' },
  { label: '版本', value: 'drawingVersion' },
  { label: '材料', value: 'material' },
  { label: '表面处理', value: 'surfaceTreatment' },
  { label: '数量', value: 'quantity' },
  { label: '目标交期', value: 'targetDeliveryDate' },
  { label: '品号 / 模具编号', value: 'productCode' },
  { label: '状态', value: 'status' },
  { label: '业务', value: 'owner' },
  { label: '提交时间', value: 'submittedAt' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '待工程领取', value: 'submitted' },
      { label: '工程处理中', value: 'claimed' },
      { label: '已退回补充', value: 'returned' },
      { label: 'BOM 已完成', value: 'bom-done' },
      { label: '已下单', value: 'ordered' },
    ],
    width: 150,
  },
  {
    key: 'productionType',
    label: '申请用途',
    type: 'select',
    options: [
      { label: '正式量产（建品号）', value: 'batch' },
      { label: '模具（建模具编号）', value: 'mold' },
    ],
    width: 175,
  },
  {
    key: 'bomReady',
    label: 'BOM 可下单',
    type: 'select',
    options: [
      { label: 'BOM 已完成', value: 'true' },
      { label: 'BOM 未完成', value: 'false' },
    ],
    width: 150,
  },
  {
    key: 'programReady',
    label: '程序可开工',
    type: 'select',
    options: [
      { label: '程序已完成', value: 'true' },
      { label: '程序未完成', value: 'false' },
    ],
    width: 150,
  },
  { key: 'targetDeliveryDate', label: '目标交期', type: 'date-range' },
]

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<BomRequest>(
  fetchBomRequests, (row) => [
  row.docNo,
  row.customerName,
  row.productName,
  row.drawingNo,
],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.status, f.status) &&
      matchEq(row.productionType, f.productionType) &&
      matchEq(row.bomReady, f.bomReady) &&
      matchEq(row.programReady, f.programReady) &&
      matchDateRange(row.targetDeliveryDate, f.targetDeliveryDate),
  },
)

const detailVisible = ref(false)
const createVisible = ref(false)

/** 新建 BOM 申请表单（草稿可保存 / 调用 / 删除） */
const createForm = reactive({
  customerCode: '',
  quotationNo: '',
  customerPoNo: '',
  product: '',
  quantity: '',
  material: '',
  inspection: '',
  targetDeliveryDate: '',
})

const {
  drafts,
  lastSavedAt,
  save: saveDraft,
  load: loadDraft,
  remove: removeDraft,
} = useFormDraft('bom-request-create', createForm)
const current = ref<BomRequest | null>(null)

const orderable = computed(() => current.value?.bomReady && current.value?.programReady)

function openDetail(row: BomRequest): void {
  current.value = row
  detailVisible.value = true
}
</script>

<template>
  <div>
    <PageHeader
      title="BOM 申请"
      requirement-code="ENG-02 / ENG-05"
      subtitle="业务把已确认的客户资料提交工程建品号、BOM 与工艺路线。只受理正式量产产品（建品号）与模具（建模具编号）；样品订单既无 BOM 也无品号，备料订单引用已有品号、不新建。必须关联客户原始资料与已确认报价；工程退回时记录退回等待时间。回传结果分「BOM 可下单」与「程序可开工」两个状态，不合并显示。"
    >
      <template #actions>
        <el-button type="primary" @click="createVisible = true">新建 BOM 申请</el-button>
      </template>
    </PageHeader>

    <el-alert
      class="scope-alert"
      type="info"
      :closable="false"
      show-icon
      title="样品既没有 BOM，也没有品号"
      description="品号（产品编码）只发给正式订单的产品。样品按客户来图编制临时工艺路线试做，不建品号、不建 BOM、不做程序可开工确认，全程只以「图号 + 样品单号」标识。样品转量产时才由业务提交 BOM 申请，此时工程才建立品号、BOM 与工艺路线，并回填对应样品单号。模具订单建的是模具编号，不是品号；备料订单不新建品号，必须引用已量产产品的既有品号。"
    />

    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索申请单号 / 客户 / 产品 / 图号"
        :total="filtered.length"
        export-name="BOM 申请"
        :export-columns="EXPORT_COLUMNS"
        :export-rows="filtered"
        @reset="resetFilters"
        @search="reload"
      />

      <el-table :data="filtered" v-loading="loading" style="width: 100%" @row-click="openDetail">
        <el-table-column prop="docNo" label="申请单号" width="180">
          <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="160" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="140" show-overflow-tooltip />
        <el-table-column label="图号 / 版本" width="140">
          <template #default="{ row }">{{ row.drawingNo }} · {{ row.drawingVersion }}</template>
        </el-table-column>
        <el-table-column label="申请用途" width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" :type="row.productionType === 'mold' ? 'warning' : 'primary'">
              {{ row.productionType === 'mold' ? '模具编号' : '正式量产品号' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="品号" width="145">
          <template #default="{ row }">
            <span v-if="row.productCode" class="item-code">{{ row.productCode }}</span>
            <span v-else class="muted">待工程建立</span>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" align="right" />
        <el-table-column prop="targetDeliveryDate" label="目标交期" width="110" />
        <el-table-column label="BOM 可下单" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.bomReady ? 'success' : 'info'" size="small" effect="light">
              {{ row.bomReady ? '已完成' : '未完成' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="程序可开工" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.programReady ? 'success' : 'info'" size="small" effect="light">
              {{ row.programReady ? '已完成' : '未完成' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <StatusTag :dict="BOM_REQUEST_STATUS" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="660px" :title="current?.docNo">
      <template v-if="current">
        <div class="dual-status">
          <div class="dual-status__item" :class="{ 'is-done': current.bomReady }">
            <el-icon><component :is="current.bomReady ? CircleCheckFilled : Clock" /></el-icon>
            <div>
              <p class="dual-status__title">BOM 可下单</p>
              <p class="dual-status__desc">
                {{ current.bomReady ? `${codeLabel(current)} ${current.productCode}，BOM 版本已发布` : `${codeLabel(current)}与 BOM 尚未建立` }}
              </p>
            </div>
          </div>
          <div class="dual-status__item" :class="{ 'is-done': current.programReady }">
            <el-icon><component :is="current.programReady ? CircleCheckFilled : Clock" /></el-icon>
            <div>
              <p class="dual-status__title">程序可开工</p>
              <p class="dual-status__desc">
                {{ current.programReady ? '工艺路线与 CNC 程序均已就绪' : '工艺路线或程序未完成，不得按「全部工程完成」处理' }}
              </p>
            </div>
          </div>
        </div>

        <el-alert
          v-if="current.bomReady && !current.programReady"
          class="drawer-alert"
          type="warning"
          :closable="false"
          show-icon
          title="BOM 已完成但程序未完成"
          description="可以建单，但不得据此承诺开工日；程序未完成时按控制矩阵不得显示为全部工程完成。"
        />

        <el-alert
          v-if="current.status === 'returned'"
          class="drawer-alert"
          type="error"
          :closable="false"
          show-icon
          :title="`工程已退回，退回等待累计 ${current.returnedHours} 小时`"
          description="补齐资料后重提会建立新的处理轮次，总历时从首次提交连续计算。"
        />

        <h3 class="drawer-title">申请内容</h3>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="客户">{{ current.customerName }}</el-descriptions-item>
          <el-descriptions-item label="关联报价">{{ current.quotationNo ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="客户原始订单">
            {{ current.customerPoNo ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="产品">{{ current.productName }}</el-descriptions-item>
          <el-descriptions-item label="图号 / 版本">
            {{ current.drawingNo }} · {{ current.drawingVersion }}
          </el-descriptions-item>
          <el-descriptions-item label="材料">{{ current.material }}</el-descriptions-item>
          <el-descriptions-item label="表面处理">{{ current.surfaceTreatment }}</el-descriptions-item>
          <el-descriptions-item label="检验要求">{{ current.inspection }}</el-descriptions-item>
          <el-descriptions-item label="包装要求">{{ current.packing }}</el-descriptions-item>
          <el-descriptions-item label="数量 / 申请用途">
            {{ current.quantity }} · {{ current.productionType === 'mold' ? '模具（建模具编号）' : '正式量产（建品号）' }}
          </el-descriptions-item>
          <el-descriptions-item label="目标交期">
            {{ current.targetDeliveryDate }}
          </el-descriptions-item>
          <el-descriptions-item :label="codeLabel(current)">
            <span v-if="current.productCode" class="item-code">{{ current.productCode }}</span>
            <span v-else class="muted">待工程建立</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="current.fromSampleNo" label="由样品转量产" :span="2">
            {{ current.fromSampleNo }}
            <span class="muted">（样品本身无品号，转量产时才建立；试做工时与实际成本一并带入首次量产的成本参考值）</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="current.specialRequirement" label="特殊要求" :span="2">
            {{ current.specialRequirement }}
          </el-descriptions-item>
        </el-descriptions>

        <DocTimeline class="drawer-timeline" title="工程处理节点计时" :nodes="current.timeline" />
      </template>

      <template #footer>
        <template v-if="current">
          <el-button>催办工程</el-button>
          <el-button type="primary" :disabled="!orderable">据此建单</el-button>
        </template>
      </template>
    </el-drawer>

    <el-dialog v-model="createVisible" title="新建 BOM 申请（ENG-02）" width="620px">
      <el-alert
        class="create-alert"
        type="info"
        :closable="false"
        show-icon
        title="必须关联客户原始资料与已确认报价"
        description="同图号 / 同版本重复申请会被系统识别并提示；资料缺失时工程会退回并计入退回等待时间。"
      />
      <el-form label-width="110px">
        <el-form-item label="客户" required>
          <el-select v-model="createForm.customerCode" placeholder="选择客户" style="width: 100%">
            <el-option label="C-HK-002 · 香港宏晟精密" value="C-HK-002" />
            <el-option label="C-CN-004 · 苏州明泰自动化" value="C-CN-004" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联报价" required>
          <el-input v-model="createForm.quotationNo" placeholder="如 QT-20260727-0042" />
        </el-form-item>
        <el-form-item label="客户原始订单">
          <el-input v-model="createForm.customerPoNo" placeholder="选填，正式订单前必须补齐" />
        </el-form-item>
        <el-form-item label="产品 / 图号" required>
          <el-input v-model="createForm.product" placeholder="产品名称 + 图号 + 版本" />
        </el-form-item>
        <el-form-item label="数量 / 属性" required>
          <el-input v-model="createForm.quantity" placeholder="本次量产数量" />
        </el-form-item>
        <el-form-item label="材料 / 表处" required>
          <el-input v-model="createForm.material" placeholder="材料牌号 + 表面处理" />
        </el-form-item>
        <el-form-item label="检验 / 包装">
          <el-input v-model="createForm.inspection" placeholder="检验标准与包装方式" />
        </el-form-item>
        <el-form-item label="目标交期" required>
          <el-date-picker
            v-model="createForm.targetDeliveryDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="图纸附件" required>
          <el-button>上传客户图纸 / 3D 模型</el-button>
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
            <el-button type="primary" @click="createVisible = false">提交工程</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.item-code {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--el-color-success);
}

.muted {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

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

.dual-status {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.dual-status__item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px;
  color: var(--wfx-text-muted);
  background: var(--wfx-surface-alt);
  border: 1px solid var(--wfx-border);
  border-radius: var(--wfx-radius-md);
}

.dual-status__item.is-done {
  color: var(--el-color-success);
  background: #f2f9ef;
  border-color: #d3e9c9;
}

.dual-status__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.dual-status__desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--wfx-text-muted);
}

.drawer-title {
  margin: 22px 0 10px;
  font-size: 14px;
  color: var(--wfx-text-strong);
}

.drawer-alert,
.drawer-timeline {
  margin-top: 16px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.create-alert {
  margin-bottom: 18px;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
