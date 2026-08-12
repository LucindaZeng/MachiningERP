<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
import { computed } from 'vue'

import type { CustomsDossier } from '@/types/sales.types'

/**
 * 报关资料详情抽屉。
 *
 * 只负责**把一份资料渲染出来**并把动作 emit 回页面——取数、乐观锁与流转
 * 都在页面那一侧（`useCustomsFlow`）。抽屉自己不调任何接口。
 *
 * 底部按钮按状态给：报关的五个状态各自能做什么是**服务端状态机说了算**，
 * 这里只是提前把做不了的灰掉；点下去服务端还会再判一次。
 */
const props = defineProps<{
  modelValue: boolean
  dossier: CustomsDossier | null
  /** 流转动作进行中 */
  busy: boolean
  /** 出具资料包进行中 */
  generating: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  generate: []
  'submit-review': []
  'approve-review': []
  'return-for-fix': []
  declare: []
  correct: []
  receipt: []
  release: []
  preview: [documentId: string]
  download: [documentId: string]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const dossier = computed(() => props.dossier)
const status = computed(() => props.dossier?.status ?? 'draft')

/**
 * 要素齐套只是**提前把按钮灰掉**；真正拦人的是服务端——
 * 生成端点会自己再查一遍并列出缺了哪些中文标签。
 */
const canGenerate = computed(() => (props.dossier?.missingFields.length ?? 0) === 0)

/** 已申报之后，一切改动都要走带理由的更正。 */
const declared = computed(() => status.value === 'declared' || status.value === 'released')

/** 当前申报版本的清单快照——这一版到底送出去了哪几份文件的哪几版。 */
const currentManifest = computed(
  () =>
    props.dossier?.declarations?.find(
      (item) => item.version === props.dossier?.declarationVersion,
    ) ?? null,
)
</script>

<template>
  <el-drawer v-model="visible" size="720px" :title="dossier?.docNo">
    <template v-if="dossier">
      <el-alert
        v-if="dossier.missingFields.length"
        class="drawer-alert"
        type="error"
        :closable="false"
        show-icon
        title="要素未齐套，禁止生成资料包"
        :description="`缺失字段：${dossier.missingFields.join('、')}（由服务端判定）`"
      />

      <h3 class="drawer-title">商品与贸易要素</h3>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="关联订单">{{ dossier.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="关联发货单">{{ dossier.shipmentNo }}</el-descriptions-item>
        <el-descriptions-item label="中文品名">{{ dossier.goodsNameCn }}</el-descriptions-item>
        <el-descriptions-item label="英文品名">{{ dossier.goodsNameEn }}</el-descriptions-item>
        <el-descriptions-item label="HS 编码">{{ dossier.hsCode }}</el-descriptions-item>
        <el-descriptions-item label="贸易方式">{{ dossier.tradeMode }}</el-descriptions-item>
        <el-descriptions-item label="数量 / 单位">
          {{ dossier.quantity }} {{ dossier.unit }}
        </el-descriptions-item>
        <el-descriptions-item label="件数">{{ dossier.packages }}</el-descriptions-item>
        <el-descriptions-item label="净重 / 毛重（KG）">
          {{ dossier.netWeight }} / {{ dossier.grossWeight }}
        </el-descriptions-item>
        <el-descriptions-item label="单价">
          {{ dossier.unitPrice }} {{ dossier.totalAmount.currency }}
        </el-descriptions-item>
        <el-descriptions-item label="总金额">
          {{ dossier.totalAmount.amount }} {{ dossier.totalAmount.currency }}
        </el-descriptions-item>
        <el-descriptions-item label="汇率">{{ dossier.exchangeRate }}</el-descriptions-item>
        <el-descriptions-item label="贸易术语">{{ dossier.incoterm }}</el-descriptions-item>
        <el-descriptions-item label="启运港">{{ dossier.portOfLoading }}</el-descriptions-item>
        <el-descriptions-item label="目的港代码">
          {{ dossier.destinationPortCode ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="唛头 Shipping Marks">
          {{ dossier.shippingMarks ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="目的地" :span="2">{{ dossier.destination }}</el-descriptions-item>
        <el-descriptions-item label="关务复核" :span="2">
          {{ dossier.checkedBy ?? '未复核' }}
        </el-descriptions-item>
      </el-descriptions>

      <h3 class="drawer-title">系统生成文件</h3>
      <el-table :data="dossier.documents" size="small" border>
        <el-table-column prop="templateCode" label="模板编码" width="95" />
        <el-table-column prop="name" label="文件" min-width="210">
          <template #default="{ row }">
            <el-icon class="doc-icon"><Document /></el-icon>{{ row.name }}
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="66" />
        <el-table-column label="生成时间" width="146">
          <template #default="{ row }">{{ row.generatedAt ?? '未生成' }}</template>
        </el-table-column>
        <el-table-column prop="exchangeRate" label="汇率快照" width="94">
          <template #default="{ row }">{{ row.exchangeRate ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="118">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="!row.documentId || row.pending"
              @click="emit('preview', row.documentId)"
            >
              预览
            </el-button>
            <el-button
              link
              type="primary"
              :disabled="!row.documentId || row.pending"
              @click="emit('download', row.documentId)"
            >
              下载
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <template v-if="currentManifest">
        <h3 class="drawer-title">
          申报清单快照（V{{ currentManifest.version }} · {{ currentManifest.declaredAt }}）
        </h3>
        <el-table :data="currentManifest.manifest" size="small" border>
          <el-table-column prop="templateCode" label="模板编码" width="120" />
          <el-table-column prop="name" label="文件" min-width="240" />
          <el-table-column label="送出版本" width="100">
            <template #default="{ row }">V{{ row.version }}</template>
          </el-table-column>
        </el-table>
        <p class="drawer-hint">
          申报人 {{ currentManifest.declaredBy }}；回执
          {{ currentManifest.receiptNo ?? '未归档' }}
        </p>
      </template>

      <template v-if="dossier.corrections?.length">
        <h3 class="drawer-title">申报后更正记录</h3>
        <el-timeline>
          <el-timeline-item
            v-for="item in dossier.corrections"
            :key="item.seq"
            :timestamp="`${item.createdAt} · ${item.createdBy}`"
          >
            <b>第 {{ item.seq }} 次更正 → 申报版本 V{{ item.resultingDeclarationVersion }}</b>
            <p class="correction-reason">理由：{{ item.reason }}</p>
            <p class="correction-docs">
              涉及：
              <span v-for="doc in item.affectedDocuments" :key="doc.templateCode" class="correction-doc">
                {{ doc.name }} V{{ doc.fromVersion }} → V{{ doc.toVersion }}
              </span>
            </p>
          </el-timeline-item>
        </el-timeline>
      </template>

      <p class="drawer-note">
        文件统一由 docgen 按受控模板出具（形式发票／商业发票共用一套版式，装箱单、出口合同、
        报关数据包各一套），返回受权限控制的短时效链接；<b>每次生成都是新版本，旧版原样保留</b>，
        各版本各留一份出具当时的汇率快照。申报即冻结清单快照，此后任何改动都要走带理由的更正并重报；
        关务复核不可跳过。要素齐套由服务端判定，页面上的禁用只是提前提示。
      </p>
    </template>

    <template #footer>
      <template v-if="dossier">
        <el-button
          v-if="!declared"
          :loading="generating"
          :disabled="!canGenerate"
          @click="emit('generate')"
        >
          生成报关资料包
        </el-button>
        <el-button v-if="status === 'draft'" :loading="busy" @click="emit('submit-review')">
          送关务复核
        </el-button>
        <template v-if="status === 'checking'">
          <el-button :loading="busy" @click="emit('return-for-fix')">退回业务修改</el-button>
          <el-button type="primary" :loading="busy" @click="emit('approve-review')">
            关务复核通过
          </el-button>
        </template>
        <el-button
          v-if="status === 'generated'"
          type="primary"
          :loading="busy"
          @click="emit('declare')"
        >
          申报
        </el-button>
        <template v-if="status === 'declared'">
          <el-button :loading="busy" @click="emit('correct')">更正并重报</el-button>
          <el-button :loading="busy" @click="emit('receipt')">归档回执</el-button>
          <el-button type="primary" :loading="busy" @click="emit('release')">放行</el-button>
        </template>
      </template>
    </template>
  </el-drawer>
</template>

<style scoped>
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

.drawer-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.correction-reason {
  margin: 4px 0 2px;
  font-size: 13px;
}

.correction-docs {
  margin: 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.correction-doc {
  margin-right: 10px;
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
</style>
