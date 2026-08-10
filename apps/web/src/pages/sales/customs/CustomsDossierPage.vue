<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'

import { fetchCustomsDossiers, renderCustomsDocument } from '@/api/sales/customs.api'
import { matchEq, matchText, type FilterField } from '@/components/filter-helpers'
import FilterBar from '@/components/FilterBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import { CUSTOMS_STATUS } from '@/components/status-dictionary'
import StatusTag from '@/components/StatusTag.vue'
import { useResourceList } from '@/composables/use-resource-list'

import type { CustomsDossier } from '@/types/sales.types'

const EXPORT_COLUMNS = [
  { label: '报关单号', value: 'docNo' },
  { label: '关联发货单', value: 'shipmentNo' },
  { label: '客户', value: 'customerName' },
  { label: '贸易条件', value: 'tradeTerm' },
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
const current = ref<CustomsDossier | null>(null)
const generating = ref(false)

const canGenerate = computed(() => (current.value?.missingFields.length ?? 0) === 0)

function openDetail(row: CustomsDossier): void {
  current.value = row
  detailVisible.value = true
}

async function generateAll(): Promise<void> {
  if (!current.value) {
    return
  }
  generating.value = true
  try {
    for (const doc of current.value.documents) {
      const result = await renderCustomsDocument(doc.templateCode)
      doc.version = result.version
      doc.generatedAt = result.generatedAt
    }
    current.value.status = 'generated'
    ElMessage.success('报关资料包已生成，已留版本快照并送关务复核')
    await reload()
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="报关资料"
      requirement-code="EXP-01 ~ EXP-04"
      subtitle="业务在发货后生成形式发票、装箱单、报关单要素与出口合同，由 docgen 统一出文件并留版本快照，关务岗复核后申报。要素缺失时禁止生成。"
    >
      <template #actions>
        <el-button type="primary">新建报关资料</el-button>
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

    <el-drawer v-model="detailVisible" size="680px" :title="current?.docNo">
      <template v-if="current">
        <el-alert
          v-if="current.missingFields.length"
          class="drawer-alert"
          type="error"
          :closable="false"
          show-icon
          title="要素未齐套，禁止生成资料包"
          :description="`缺失字段：${current.missingFields.join('、')}`"
        />

        <h3 class="drawer-title">商品与贸易要素</h3>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="关联订单">{{ current.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="关联发货单">{{ current.shipmentNo }}</el-descriptions-item>
          <el-descriptions-item label="中文品名">{{ current.goodsNameCn }}</el-descriptions-item>
          <el-descriptions-item label="英文品名">{{ current.goodsNameEn }}</el-descriptions-item>
          <el-descriptions-item label="HS 编码">{{ current.hsCode }}</el-descriptions-item>
          <el-descriptions-item label="贸易方式">{{ current.tradeMode }}</el-descriptions-item>
          <el-descriptions-item label="数量 / 单位">
            {{ current.quantity }} {{ current.unit }}
          </el-descriptions-item>
          <el-descriptions-item label="件数">{{ current.packages }}</el-descriptions-item>
          <el-descriptions-item label="净重 / 毛重（KG）">
            {{ current.netWeight }} / {{ current.grossWeight }}
          </el-descriptions-item>
          <el-descriptions-item label="单价">
            {{ current.unitPrice }} {{ current.totalAmount.currency }}
          </el-descriptions-item>
          <el-descriptions-item label="总金额">
            {{ current.totalAmount.amount }} {{ current.totalAmount.currency }}
          </el-descriptions-item>
          <el-descriptions-item label="汇率">{{ current.exchangeRate }}</el-descriptions-item>
          <el-descriptions-item label="贸易术语">{{ current.incoterm }}</el-descriptions-item>
          <el-descriptions-item label="启运港">{{ current.portOfLoading }}</el-descriptions-item>
          <el-descriptions-item label="目的地" :span="2">{{ current.destination }}</el-descriptions-item>
          <el-descriptions-item label="关务复核" :span="2">
            {{ current.checkedBy ?? '未复核' }}
          </el-descriptions-item>
        </el-descriptions>

        <h3 class="drawer-title">系统生成文件</h3>
        <el-table :data="current.documents" size="small" border>
          <el-table-column prop="templateCode" label="模板编码" width="100" />
          <el-table-column prop="name" label="文件" min-width="220">
            <template #default="{ row }">
              <el-icon class="doc-icon"><Document /></el-icon>{{ row.name }}
            </template>
          </el-table-column>
          <el-table-column prop="version" label="版本" width="70" />
          <el-table-column label="生成时间" width="150">
            <template #default="{ row }">{{ row.generatedAt ?? '未生成' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button link type="primary" :disabled="!row.generatedAt">下载</el-button>
            </template>
          </el-table-column>
        </el-table>

        <p class="drawer-note">
          文件统一由 docgen 出（POST /documents/&#123;templateCode&#125;/render），返回受权限控制的短时效下载链接，
          每次生成留版本快照；香港代生产订单沿用既有外贸规则，关务复核不可跳过。
        </p>

      </template>

      <template #footer>
        <template v-if="current">
            <el-button>送关务复核</el-button>
            <el-button
              type="primary"
              :loading="generating"
              :disabled="!canGenerate"
              @click="generateAll"
            >
              生成报关资料包
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

.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
}

.drawer-title {
  margin: 22px 0 10px;
  font-size: 14px;
  color: var(--wfx-text-strong);
}

.drawer-alert {
  margin-bottom: 8px;
}

.doc-icon {
  margin-right: 6px;
  color: var(--wfx-navy);
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
