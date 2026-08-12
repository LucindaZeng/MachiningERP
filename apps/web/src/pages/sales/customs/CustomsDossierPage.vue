<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'



import { fetchDownloadUrl } from '@/api/file-preview.api'
import {
  DOC_KIND_BY_TEMPLATE,
  fetchCustomsDossier,
  fetchCustomsDossiers,
  generateCustomsDocument,
} from '@/api/sales/customs.api'
import FilePreviewDialog from '@/components/FilePreviewDialog.vue'
import { matchEq, matchText, type FilterField } from '@/components/filter-helpers'
import FilterBar from '@/components/FilterBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import { CUSTOMS_STATUS } from '@/components/status-dictionary'
import StatusTag from '@/components/StatusTag.vue'
import { useCustomsFlow } from '@/composables/use-customs-flow'
import { useFilePreview } from '@/composables/use-file-preview'
import { useResourceList } from '@/composables/use-resource-list'

import CustomsCorrectDialog from './components/CustomsCorrectDialog.vue'
import CustomsCreateDialog from './components/CustomsCreateDialog.vue'
import CustomsDossierDrawer from './components/CustomsDossierDrawer.vue'

import type { CustomsDossier } from '@/types/sales.types'



const EXPORT_COLUMNS = [
  { label: '报关单号', value: 'docNo' },
  { label: '关联发货单', value: 'shipmentNo' },
  { label: '客户', value: 'customerName' },
  { label: '贸易条件', value: 'incoterm' },
  { label: '目的国', value: 'destination' },
  { label: '状态', value: 'status' },
  { label: '业务', value: 'owner' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '草稿', value: 'draft' },
      { label: '关务复核中', value: 'checking' },
      { label: '资料已生成', value: 'generated' },
      { label: '已申报', value: 'declared' },
      { label: '已放行', value: 'released' },
    ],
    width: 150,
  },
  { key: 'incoterm', label: '贸易术语', type: 'input', placeholder: '如 FOB / CIF', width: 140 },
  {
    key: 'complete',
    label: '要素齐套',
    type: 'select',
    options: [
      { label: '已齐套', value: 'yes' },
      { label: '有缺项', value: 'no' },
    ],
    width: 140,
  },
  { key: 'hsCode', label: 'HS 编码', type: 'input', placeholder: 'HS 编码', width: 150 },
  { key: 'destination', label: '目的地', type: 'input', placeholder: '目的地关键词', width: 160 },
]

const { filtered, loading, keyword, filters, resetFilters, reload } = useResourceList<CustomsDossier>(
  fetchCustomsDossiers,
  (row) => [row.docNo, row.shipmentNo, row.customerName, row.hsCode, row.goodsNameCn],
  {
    fields: FILTER_FIELDS,
    predicate: (row, f) =>
      matchEq(row.status, f.status) &&
      matchText(row.incoterm, f.incoterm) &&
      matchEq(row.missingFields.length ? 'no' : 'yes', f.complete) &&
      matchText(row.hsCode, f.hsCode) &&
      matchText(row.destination, f.destination),
  },
)

const detailVisible = ref(false)
const createVisible = ref(false)
const correctVisible = ref(false)
const current = ref<CustomsDossier | null>(null)
const generating = ref(false)
const filePreview = useFilePreview()
const flow = useCustomsFlow()

/**
 * 打开详情时**再取一次单条**。
 *
 * 列表里那一份可能已经放了几分钟，而每个流转动作都要带 `versionLock` 出去——
 * 拿旧版本号去申报，换来的是一句「已被他人修改」，而其实没有别人。
 * 取不到就先用列表那份顶上：详情照样能看，动作失败时服务端还会再拦一次。
 */
async function openDetail(row: CustomsDossier): Promise<void> {
  current.value = row
  detailVisible.value = true
  try {
    current.value = await fetchCustomsDossier(row.id)
  } catch {
    // 保持列表里那份，不打断查看
  }
}

/**
 * 每个流转动作回来的都是**新的记录**，必须立刻换掉手里那份——
 * 否则下一个动作会带着过期的 versionLock 出去，用户看到的是
 * 「已被他人修改」，其实是自己上一步没刷新。列表同步重取。
 */
async function apply(action: Promise<CustomsDossier | null>): Promise<void> {
  const updated = await action
  if (!updated) return
  current.value = updated
  await reload()
}

/**
 * 逐份出具。**永远是追加**——每调一次得到该文件的新版本，旧版原样留着。
 * 数据包必须最后出：它引用商业发票、装箱单与合同，缺一份服务端会拒绝。
 * 形式发票按需出具（预付／信用证客户），不在整包生成里。
 */
async function generateAll(): Promise<void> {
  const dossier = current.value
  if (!dossier) return

  generating.value = true
  try {
    let latest = dossier
    for (const doc of dossier.documents) {
      const kind = DOC_KIND_BY_TEMPLATE[doc.templateCode]
      if (!kind || kind === 'PROFORMA_INVOICE') continue
      latest = await generateCustomsDocument(latest.id, latest.versionLock ?? 0, kind)
    }
    current.value = latest
    ElMessage.success('报关资料包已生成，各版本已留汇率快照')
    await reload()
  } catch (error) {
    // 服务端的齐套/前置闸门文案本身就是给业务看的，原样端出去
    ElMessage.error(error instanceof Error ? error.message : '生成失败')
  } finally {
    generating.value = false
  }
}

async function previewDocument(documentId: string): Promise<void> {
  await filePreview.open('customs-document', documentId)
}

/** 下载走 download-url：验权、短时效签名，并逐次留审计。 */
async function downloadDocument(documentId: string): Promise<void> {
  try {
    const view = await fetchDownloadUrl('customs-document', documentId)
    window.open(view.previewUrl, '_blank', 'noopener')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '下载地址获取失败')
  }
}

async function onCorrect(reason: string): Promise<void> {
  if (!current.value) return
  await apply(flow.correct(current.value, reason))
  correctVisible.value = false
}

function onCreated(dossier: CustomsDossier): void {
  void reload()
  current.value = dossier
  detailVisible.value = true
}
</script>

<template>
  <div>
    <PageHeader
      title="报关资料"
      requirement-code="EXP-01 ~ EXP-04"
      subtitle="业务在发货后建档并生成形式发票、商业发票、装箱单、出口合同与报关数据包，由 docgen 按受控模板出文件并留版本与汇率快照；关务岗复核后申报，申报即冻结清单快照。要素缺失时服务端禁止生成。"
    >
      <template #actions>
        <el-button type="primary" @click="createVisible = true">新建报关资料</el-button>
      </template>
    </PageHeader>

    <el-card shadow="never">
      <FilterBar
        v-model="filters"
        v-model:keyword="keyword"
        :fields="FILTER_FIELDS"
        keyword-placeholder="搜索报关单号 / 发货单 / 客户 / HS 编码"
        :total="filtered.length"
        export-name="报关资料"
        :export-columns="EXPORT_COLUMNS"
        :export-rows="filtered"
        @reset="resetFilters"
        @search="reload"
      />

      <el-table v-loading="loading" :data="filtered" style="width: 100%" @row-click="openDetail">
        <el-table-column prop="docNo" label="报关资料号" width="175">
          <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
        </el-table-column>
        <el-table-column prop="shipmentNo" label="发货单" width="175" />
        <el-table-column prop="customerName" label="客户" min-width="150" show-overflow-tooltip />
        <el-table-column prop="goodsNameCn" label="品名" min-width="140" show-overflow-tooltip />
        <el-table-column prop="hsCode" label="HS 编码" width="115" />
        <el-table-column prop="incoterm" label="贸易术语" width="110" />
        <el-table-column label="金额" width="130" align="right">
          <template #default="{ row }">
            {{ row.totalAmount.amount }} {{ row.totalAmount.currency }}
          </template>
        </el-table-column>
        <el-table-column label="要素齐套" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.missingFields.length" type="danger" size="small">
              缺 {{ row.missingFields.length }} 项
            </el-tag>
            <el-tag v-else type="success" size="small">已齐套</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申报版本" width="100">
          <template #default="{ row }">
            {{ row.declarationVersion ? `V${row.declarationVersion}` : '未申报' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :dict="CUSTOMS_STATUS" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <CustomsDossierDrawer
      v-model="detailVisible"
      :dossier="current"
      :busy="flow.busy.value"
      :generating="generating"
      @generate="generateAll"
      @submit-review="current && apply(flow.submitReview(current))"
      @approve-review="current && apply(flow.approveReview(current))"
      @return-for-fix="current && apply(flow.returnForFix(current))"
      @declare="current && apply(flow.declare(current))"
      @correct="correctVisible = true"
      @receipt="current && apply(flow.archiveReceipt(current))"
      @release="current && apply(flow.release(current))"
      @preview="previewDocument"
      @download="downloadDocument"
    />

    <CustomsCreateDialog v-model="createVisible" @created="onCreated" />

    <CustomsCorrectDialog
      v-model="correctVisible"
      :busy="flow.busy.value"
      @confirm="onCorrect"
    />

    <FilePreviewDialog
      v-model="filePreview.visible.value"
      :loading="filePreview.loading.value"
      :preview="filePreview.preview.value"
      :unsupported="filePreview.unsupported.value"
      :error-message="filePreview.errorMessage.value"
      @close="filePreview.close"
      @download="filePreview.download"
    />
  </div>
</template>

<style scoped>
.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
