<script setup lang="ts">
import { Download, WarnTriangleFilled } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { exportQuotations } from './quote-export'
import { fetchQuotations } from '@/api/sales/quotation.api'
import DocTimeline from '@/components/DocTimeline.vue'
import FilterBar from '@/components/FilterBar.vue'
import StatusTag from '@/components/StatusTag.vue'
import { DOC_STATUS } from '@/components/status-dictionary'
import {
  matchDateRange,
  matchEq,
  matchNumberRange,
  type FilterField,
} from '@/components/filter-helpers'
import { useResourceList } from '@/composables/use-resource-list'
import type { Quotation } from '@/types/sales.types'

const router = useRouter()

const STAGE: Record<string, { label: string; type: 'info' | 'warning' | 'primary' | 'success' }> = {
  applied: { label: '待工程师补齐', type: 'warning' },
  costing: { label: '核价中', type: 'primary' },
  quoted: { label: '已报出', type: 'info' },
  confirmed: { label: '客户已确认', type: 'success' },
}

const selected = ref<Quotation[]>([])

function onSelectionChange(rows: Quotation[]): void {
  selected.value = rows
}

/** 多选合并导出：把选中的多份报价合并到同一张报价表 */
function exportSelected(): void {
  if (!selected.value.length) {
    return
  }
  exportQuotations(selected.value, selected.value.length > 1)
}

function exportAll(): void {
  exportQuotations(filtered.value, true)
}

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
      { label: '已提交', value: 'submitted' },
      { label: '审核中', value: 'reviewing' },
      { label: '已批准', value: 'approved' },
    ],
    width: 130,
  },
  {
    key: 'owner',
    label: '业务员',
    type: 'select',
    options: [
      { label: '罗晓琳', value: '罗晓琳' },
      { label: '陈志强', value: '陈志强' },
    ],
    width: 120,
  },
  {
    key: 'costLinked',
    label: '成本分析',
    type: 'select',
    options: [
      { label: '已关联成本分析', value: 'yes' },
      { label: '未关联成本分析', value: 'no' },
    ],
    width: 160,
  },
  { key: 'inquiryAt', label: '询价日期', type: 'date-range' },
  { key: 'marginRate', label: '毛利率%', type: 'number-range', width: 180 },
]

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<Quotation>(
  fetchQuotations,
  (row) => [row.docNo, row.customerName, row.productName, row.drawingNo],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.customerName, f.customerName) &&
      matchEq(row.status, f.status) &&
      matchEq(row.owner, f.owner) &&
      matchEq(row.costAnalysisNo ? 'yes' : 'no', f.costLinked) &&
      matchDateRange(row.inquiryAt, f.inquiryAt) &&
      matchNumberRange(row.grossMarginRate * 100, f.marginRate),
  },
)

const detailVisible = ref(false)
const current = ref<Quotation | null>(null)

/** 强制关联成本分析：未关联的报价单不允许提交审批 */
const costMissing = computed(() => Boolean(current.value) && !current.value?.costAnalysisNo)
const missingCount = computed(() => filtered.value.filter((row) => !row.costAnalysisNo).length)

function openDetail(row: Quotation): void {
  current.value = row
  detailVisible.value = true
}

function marginClass(rate: number): string {
  return rate < 0.18 ? 'is-low' : ''
}

function goCostAnalysis(): void {
  void router.push('/sales/quotations?tab=cost')
}
</script>

<template>
  <div>
    <el-alert
      v-if="missingCount"
      class="rule-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="`${missingCount} 份报价单未关联成本分析，无法提交审批`"
      description="按核价规则，每一份报价单必须关联一份成本分析（核价单）后才能送审；未关联的单据在列表中标红。"
    />

    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索报价单号 / 客户 / 产品 / 图号"
        :total="filtered.length"
        @reset="resetFilters"
        @search="reload"
      >
        <template #extra>
          <el-button size="small" :disabled="!selected.length" @click="exportSelected">
            合并导出所选（{{ selected.length }}）
          </el-button>
          <el-button size="small" :icon="Download" @click="exportAll">导出 Excel</el-button>
        </template>
      </FilterBar>

      <el-table
        :data="filtered"
        v-loading="loading"
        style="width: 100%"
        @row-click="openDetail"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="42" />
        <el-table-column prop="docNo" label="报价单号" width="180">
          <template #default="{ row }">
            <span class="doc-no">{{ row.docNo }}</span>
            <el-tag size="small" effect="plain" class="version-tag">{{ row.version }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="阶段" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="STAGE[row.stage].type">{{ STAGE[row.stage].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="130" show-overflow-tooltip />
        <el-table-column label="图纸" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.drawing" size="small" type="success" effect="plain">已上传</el-tag>
            <el-tag v-else size="small" type="danger">
              <el-icon><WarnTriangleFilled /></el-icon> 缺图纸
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="图号 / 版本" width="130">
          <template #default="{ row }">{{ row.drawingNo }} · {{ row.drawingVersion }}</template>
        </el-table-column>
        <el-table-column label="阶梯价" min-width="150">
          <template #default="{ row }">
            <span v-for="tier in row.tiers" :key="tier.quantity" class="tier">
              {{ tier.quantity }}件 / {{ tier.unitPrice }}
            </span>
            <span class="currency">{{ row.currency }}</span>
          </template>
        </el-table-column>
        <el-table-column label="毛利率" width="85">
          <template #default="{ row }">
            <span :class="marginClass(row.grossMarginRate)">
              {{ (row.grossMarginRate * 100).toFixed(1) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="成本分析" width="150">
          <template #default="{ row }">
            <span v-if="row.costAnalysisNo" class="cost-no">{{ row.costAnalysisNo }}</span>
            <el-tag v-else type="danger" size="small" effect="light">
              <el-icon><WarnTriangleFilled /></el-icon> 未关联
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="validUntil" label="有效期至" width="105" />
        <el-table-column label="状态" width="85">
          <template #default="{ row }"><StatusTag :dict="DOC_STATUS" :value="row.status" /></template>
        </el-table-column>
        <el-table-column prop="owner" label="业务员" width="85" />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
            <el-button link type="primary" @click.stop="goCostAnalysis">核价</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="640px" :title="current?.docNo">
      <template v-if="current">
        <el-alert
          v-if="current.stage === 'applied'"
          class="drawer-alert"
          type="warning"
          :closable="false"
          show-icon
          title="业务已提交报价申请，等待报价工程师补齐资料"
          description="本单目前只有业务提供的图纸与数量；材料牌号、表面处理、工艺路线、成本分析与单价由报价工程师填写后才能报出。"
        />

        <el-alert
          v-if="costMissing"
          class="drawer-alert"
          type="error"
          :closable="false"
          show-icon
          title="未关联成本分析，禁止提交审批"
          description="请先在「成本核算」页签完成核价并保存版本，系统会自动回写核价单号后方可送审。"
        />

        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="客户">{{ current.customerName }}</el-descriptions-item>
          <el-descriptions-item label="客户编码">{{ current.customerCode }}</el-descriptions-item>
          <el-descriptions-item label="产品">{{ current.productName }}</el-descriptions-item>
          <el-descriptions-item label="图号 / 版本">
            {{ current.drawingNo }} · {{ current.drawingVersion }}
          </el-descriptions-item>
          <el-descriptions-item label="材料">{{ current.material }}</el-descriptions-item>
          <el-descriptions-item label="表面处理">{{ current.surfaceTreatment }}</el-descriptions-item>
          <el-descriptions-item label="贸易条件">{{ current.tradeTerm }}</el-descriptions-item>
          <el-descriptions-item label="目标交期">
            {{ current.targetDeliveryDays }} 天
          </el-descriptions-item>
          <el-descriptions-item label="报价版本">{{ current.version }}</el-descriptions-item>
          <el-descriptions-item label="阶段">
            <el-tag size="small" :type="STAGE[current.stage].type">
              {{ STAGE[current.stage].label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="申请业务 / 报价工程师">
            {{ current.applicant }} / {{ current.engineer ?? '待分派' }}
          </el-descriptions-item>
          <el-descriptions-item label="数量口径">
            {{ current.quantityMode === 'tier' ? '阶梯数量' : '单一数量' }}
          </el-descriptions-item>
          <el-descriptions-item label="图纸（强制）" :span="2">
            <template v-if="current.drawing">
              <b class="drawing">{{ current.drawing.fileName }}</b>
              <span class="muted">
                　{{ current.drawing.version }} · {{ current.drawing.uploadedBy }} 于
                {{ current.drawing.uploadedAt }} 上传
              </span>
              <div class="dist">
                分发至：
                <el-tag
                  v-for="target in current.drawing.distributedTo"
                  :key="target"
                  size="small"
                  effect="plain"
                  class="dist__tag"
                >
                  {{ target }}
                </el-tag>
              </div>
            </template>
            <el-tag v-else type="danger" size="small">未上传图纸，禁止送审</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="客户确认版本">
            {{ current.confirmedVersion ?? '未确认' }}
          </el-descriptions-item>
          <el-descriptions-item label="关联成本分析" :span="2">
            <span v-if="current.costAnalysisNo" class="cost-no">{{ current.costAnalysisNo }}</span>
            <el-tag v-else type="danger" size="small">未关联（必填）</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <h3 class="drawer-title">阶梯报价</h3>
        <el-table :data="current.tiers" size="small" border>
          <el-table-column prop="quantity" label="数量（件）" />
          <el-table-column label="单价">
            <template #default="{ row }">{{ row.unitPrice }} {{ current?.currency }}</template>
          </el-table-column>
        </el-table>

        <el-alert
          v-if="current.grossMarginRate < 0.18"
          class="drawer-alert"
          type="warning"
          :closable="false"
          show-icon
          title="毛利低于阈值，送审将触发会签"
          description="按控制矩阵，低毛利报价需业务、工程、PMC、财务会签后由总经办批准。"
        />

        <DocTimeline class="drawer-timeline" title="节点计时（T0 起）" :nodes="current.timeline" />
      </template>

      <template #footer>
        <template v-if="current">
          <el-button v-if="costMissing" type="warning" @click="goCostAnalysis">去核价</el-button>
          <el-button :disabled="costMissing">生成报价单 PDF</el-button>
          <el-button @click="exportQuotations([current], false)">导出 Excel</el-button>
          <el-button type="primary" :disabled="costMissing">提交审批</el-button>
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

.version-tag {
  margin-left: 6px;
}

.tier {
  margin-right: 10px;
  font-size: 12.5px;
}

.currency {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.cost-no {
  font-size: 12.5px;
  color: var(--el-color-success);
}

.drawing {
  color: var(--wfx-navy);
}

.muted {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.dist {
  margin-top: 4px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.dist__tag {
  margin-right: 6px;
}

.is-low {
  font-weight: 700;
  color: var(--el-color-danger);
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
