<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'

import { fetchQuoteChanges } from '@/api/sales/quotation.api'
import DocTimeline from '@/components/DocTimeline.vue'
import { usePermission } from '@/composables/use-permission'
import { exportNotes, exportSheet, type ExportColumn } from '@/utils/export-excel'

import type { QuoteChangeRequest, QuotationTier } from '@/types/sales.types'

const { canHandleQuoteChange, role } = usePermission()

const rows = ref<QuoteChangeRequest[]>([])
const loading = ref(false)
const detailVisible = ref(false)
const current = ref<QuoteChangeRequest | null>(null)

const pending = computed(() => rows.value.filter((row) => row.status === 'reviewing').length)

const RESULT: Record<string, { label: string; type: 'success' | 'danger' | 'warning' }> = {
  accepted: { label: '已接受（已改成本分析）', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' },
}

const EXPORT_COLUMNS: Array<ExportColumn<Record<string, unknown>>> = [
  { label: '修改申请单号', value: 'docNo' },
  { label: '原报价单号', value: 'quotationNo' },
  { label: '客户', value: 'customerName' },
  { label: '产品', value: 'productName' },
  { label: '图号', value: 'drawingNo' },
  { label: '原价格', value: 'beforeText' },
  { label: '申请价格', value: 'afterText' },
  { label: '币种', value: 'currency' },
  { label: '申请理由', value: 'reason' },
  { label: '客户依据', value: 'evidence' },
  { label: '业务', value: 'applicant' },
  { label: '提交时间', value: 'submittedAt' },
  { label: '报价工程师', value: 'engineer' },
  { label: '处理结果', value: 'resultText' },
  { label: '驳回理由', value: 'rejectReason' },
  { label: '新成本分析单', value: 'newCostAnalysisNo' },
]

function tierText(tiers: QuotationTier[]): string {
  return tiers.map((tier) => `${tier.quantity}件/${tier.unitPrice}`).join('，')
}

function drop(tiers: QuotationTier[], after: QuotationTier[]): string {
  const from = Number(tiers[tiers.length - 1]?.unitPrice ?? '0')
  const to = Number(after[after.length - 1]?.unitPrice ?? '0')
  if (!from) {
    return '—'
  }
  return `${(((to - from) / from) * 100).toFixed(1)}%`
}

function openDetail(row: QuoteChangeRequest): void {
  current.value = row
  detailVisible.value = true
}

function onExport(): void {
  exportSheet(
    {
      name: '报价单修改申请',
      columns: EXPORT_COLUMNS,
      rows: rows.value.map((row) => ({
        ...row,
        beforeText: tierText(row.beforeTiers),
        afterText: tierText(row.afterTiers),
        resultText: row.result ? RESULT[row.result].label : '处理中',
      })) as unknown as Record<string, unknown>[],
      notes: exportNotes('报价单修改申请（QRC）', [
        '流程：业务直接提交修改后的价格 → 报价工程师改成本分析后接受，或驳回并填写驳回理由。',
      ]),
    },
    '报价单修改申请',
  )
}

function guard(): boolean {
  if (canHandleQuoteChange.value) {
    return true
  }
  ElMessage.error(`当前角色「${role.value.name}」无权处理报价修改申请，只有报价工程师可以改成本分析或驳回`)
  return false
}

function accept(row: QuoteChangeRequest): void {
  if (!guard()) {
    return
  }
  ElMessage.success(`已按新价格重做成本分析并回写 ${row.quotationNo}，报价单自动升版`)
}

async function reject(row: QuoteChangeRequest): Promise<void> {
  if (!guard()) {
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('驳回理由（必填，将同步给业务与业务经理）', '驳回改价申请', {
      inputType: 'textarea',
      inputPlaceholder: '例如：该价格对应毛利低于阈值，且平面度要求导致的二次光刀工时无法压缩……',
      inputValidator: (text: string) => (text && text.trim().length >= 10 ? true : '驳回理由不得少于 10 个字'),
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
    })
    ElMessage.success(`已驳回 ${row.docNo}，理由已回填：${String(value).slice(0, 20)}…`)
  } catch {
    // 用户取消
  }
}

onMounted(async () => {
  loading.value = true
  try {
    rows.value = await fetchQuoteChanges()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <el-alert
      class="rule-alert"
      type="info"
      :closable="false"
      show-icon
      title="报价单修改申请（QRC）：业务提新价，报价工程师改成本分析或驳回"
      description="业务不直接改报价单，而是提交修改后的价格与理由；报价工程师复核成本分析后，要么按新价重做成本分析并回写（报价单升版），要么驳回并填写驳回理由（不少于 10 个字，同步业务与业务经理）。成本分析始终只由报价工程师维护。"
    />

    <el-card shadow="never">
      <div class="toolbar">
        <span class="toolbar__total">
          共 {{ rows.length }} 条 · 待报价工程师处理 <b>{{ pending }}</b> 条
        </span>
        <el-button size="small" @click="onExport">导出 Excel</el-button>
      </div>

      <el-table v-loading="loading" :data="rows" style="width: 100%" @row-click="openDetail">
        <el-table-column prop="docNo" label="修改申请单号" width="180">
          <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
        </el-table-column>
        <el-table-column prop="quotationNo" label="原报价单" width="175" />
        <el-table-column prop="customerName" label="客户" min-width="150" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品" min-width="130" show-overflow-tooltip />
        <el-table-column label="原价格 → 申请价格" min-width="250">
          <template #default="{ row }">
            <span class="before">{{ tierText(row.beforeTiers) }}</span>
            <span class="after">→ {{ tierText(row.afterTiers) }} {{ row.currency }}</span>
          </template>
        </el-table-column>
        <el-table-column label="降幅" width="80" align="right">
          <template #default="{ row }">
            <b class="is-bad">{{ drop(row.beforeTiers, row.afterTiers) }}</b>
          </template>
        </el-table-column>
        <el-table-column prop="applicant" label="业务" width="80" />
        <el-table-column label="处理结果" width="185">
          <template #default="{ row }">
            <el-tag v-if="row.result" size="small" :type="RESULT[row.result].type">
              {{ RESULT[row.result].label }}
            </el-tag>
            <el-tag v-else size="small" type="warning">待报价工程师处理</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <template v-if="!row.result">
              <el-button link type="primary" :disabled="!canHandleQuoteChange" @click.stop="accept(row)">
                改成本分析
              </el-button>
              <el-button link type="danger" :disabled="!canHandleQuoteChange" @click.stop="reject(row)">
                驳回
              </el-button>
            </template>
            <span v-else class="muted">已完成</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="720px" :title="current?.docNo">
      <template v-if="current">
        <el-alert
          v-if="current.result === 'rejected'"
          class="drawer-alert"
          type="error"
          :closable="false"
          show-icon
          title="报价工程师已驳回本次改价"
          :description="current.rejectReason"
        />
        <el-alert
          v-else-if="current.result === 'accepted'"
          class="drawer-alert"
          type="success"
          :closable="false"
          show-icon
          title="已按新价格重做成本分析"
          :description="`新成本分析单 ${current.newCostAnalysisNo}，新毛利率 ${((current.newMarginRate ?? 0) * 100).toFixed(1)}%，原报价单已升版。`"
        />

        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="原报价单">{{ current.quotationNo }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ current.customerName }}</el-descriptions-item>
          <el-descriptions-item label="产品">{{ current.productName }}</el-descriptions-item>
          <el-descriptions-item label="图号">{{ current.drawingNo }}</el-descriptions-item>
          <el-descriptions-item label="原价格" :span="2">
            {{ tierText(current.beforeTiers) }} {{ current.currency }}
          </el-descriptions-item>
          <el-descriptions-item label="业务申请价格" :span="2">
            <b class="after-value">{{ tierText(current.afterTiers) }} {{ current.currency }}</b>
          </el-descriptions-item>
          <el-descriptions-item label="申请理由" :span="2">{{ current.reason }}</el-descriptions-item>
          <el-descriptions-item label="客户依据" :span="2">
            {{ current.evidence ?? '未提供' }}
          </el-descriptions-item>
          <el-descriptions-item label="申请业务">{{ current.applicant }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ current.submittedAt }}</el-descriptions-item>
          <el-descriptions-item label="报价工程师">{{ current.engineer ?? '待分派' }}</el-descriptions-item>
          <el-descriptions-item label="处理时间">{{ current.handledAt ?? '—' }}</el-descriptions-item>
        </el-descriptions>

        <DocTimeline class="drawer-timeline" title="QRC 节点计时" :nodes="current.timeline" />
      </template>

      <template #footer>
        <template v-if="current && !current.result">
          <el-button type="danger" :disabled="!canHandleQuoteChange" @click="reject(current)">
            驳回并填写理由
          </el-button>
          <el-button type="primary" :disabled="!canHandleQuoteChange" @click="accept(current)">
            改成本分析并接受
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

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 12px;
  font-size: 12.5px;
  color: var(--wfx-text-muted);
  border-bottom: 1px solid var(--wfx-border);
}

.toolbar__total b {
  color: var(--wfx-orange);
}

.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
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
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.is-bad {
  color: var(--el-color-danger);
}

.drawer-alert {
  margin-bottom: 16px;
}

.drawer-timeline {
  margin-top: 18px;
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
