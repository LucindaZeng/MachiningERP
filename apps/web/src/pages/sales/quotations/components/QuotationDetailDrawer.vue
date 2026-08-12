<script setup lang="ts">
import { computed } from 'vue'

import DocTimeline from '@/components/DocTimeline.vue'

import type { Quotation } from '@/types/sales.types'

/**
 * 报价单详情抽屉。
 *
 * 从 QuotationTable 拆出来，是因为那个文件撞上了 400 行红线。
 * 拆的是「详情展示」这一整块职责：抽屉只负责把一份报价渲染出来，
 * 所有动作（核价、出具、导出、预览图纸）一律 emit 回列表去做——
 * 取数与状态留在列表那一侧，抽屉不自己去拿任何东西。
 */
const props = defineProps<{
  modelValue: boolean
  quotation: Quotation | null
  /** 出具中，按钮转 loading，避免连点出两份文件 */
  issuing: boolean
  stageDict: Record<string, { label: string; type: 'info' | 'warning' | 'primary' | 'success' }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  cost: []
  issue: []
  export: []
  preview: [versionId: string]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const quotation = computed(() => props.quotation)

/** 未关联成本分析就不能送审，也不该出具正式报价单。 */
const costMissing = computed(() => Boolean(props.quotation) && !props.quotation?.costAnalysisNo)
</script>

<template>
  <el-drawer v-model="visible" size="640px" :title="quotation?.docNo">
    <template v-if="quotation">
      <el-alert
        v-if="quotation.stage === 'applied'"
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
        <el-descriptions-item label="客户">{{ quotation.customerName }}</el-descriptions-item>
        <el-descriptions-item label="客户编码">{{ quotation.customerCode }}</el-descriptions-item>
        <el-descriptions-item label="产品">{{ quotation.productName }}</el-descriptions-item>
        <el-descriptions-item label="图号 / 版本">
          {{ quotation.drawingNo }} · {{ quotation.drawingVersion }}
          <el-button
            v-if="quotation.drawingVersionId"
            link
            type="primary"
            class="preview-link"
            @click="emit('preview', quotation.drawingVersionId)"
          >
            预览图纸
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item label="材料">{{ quotation.material }}</el-descriptions-item>
        <el-descriptions-item label="表面处理">{{ quotation.surfaceTreatment }}</el-descriptions-item>
        <el-descriptions-item label="贸易条件">{{ quotation.tradeTerm }}</el-descriptions-item>
        <el-descriptions-item label="目标交期">
          {{ quotation.targetDeliveryDays }} 天
        </el-descriptions-item>
        <el-descriptions-item label="报价版本">{{ quotation.version }}</el-descriptions-item>
        <el-descriptions-item label="阶段">
          <el-tag size="small" :type="stageDict[quotation.stage].type">
            {{ stageDict[quotation.stage].label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="申请业务 / 报价工程师">
          {{ quotation.applicant }} / {{ quotation.engineer ?? '待分派' }}
        </el-descriptions-item>
        <el-descriptions-item label="数量口径">
          {{ quotation.quantityMode === 'tier' ? '阶梯数量' : '单一数量' }}
        </el-descriptions-item>
        <el-descriptions-item label="图纸（强制）" :span="2">
          <template v-if="quotation.drawing">
            <b class="drawing">{{ quotation.drawing.fileName }}</b>
            <span class="muted">
              　{{ quotation.drawing.version }} · {{ quotation.drawing.uploadedBy }} 于
              {{ quotation.drawing.uploadedAt }} 上传
            </span>
            <div class="dist">
              分发至：
              <el-tag
                v-for="target in quotation.drawing.distributedTo"
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
          {{ quotation.confirmedVersion ?? '未确认' }}
        </el-descriptions-item>
        <el-descriptions-item label="关联成本分析" :span="2">
          <span v-if="quotation.costAnalysisNo" class="cost-no">{{ quotation.costAnalysisNo }}</span>
          <el-tag v-else type="danger" size="small">未关联（必填）</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <h3 class="drawer-title">阶梯报价</h3>
      <el-table :data="quotation.tiers" size="small" border>
        <el-table-column prop="quantity" label="数量（件）" />
        <el-table-column label="单价">
          <template #default="{ row }">{{ row.unitPrice }} {{ quotation?.currency }}</template>
        </el-table-column>
      </el-table>

      <el-alert
        v-if="quotation.grossMarginRate < 0.18"
        class="drawer-alert"
        type="warning"
        :closable="false"
        show-icon
        title="毛利低于阈值，送审将触发会签"
        description="按控制矩阵，低毛利报价需业务、工程、PMC、财务会签后由总经办批准。"
      />

      <DocTimeline class="drawer-timeline" title="节点计时（T0 起）" :nodes="quotation.timeline" />
    </template>

    <template #footer>
      <template v-if="quotation">
        <el-button v-if="costMissing" type="warning" @click="emit('cost')">去核价</el-button>
        <el-button :disabled="costMissing" :loading="issuing" @click="emit('issue')">出具报价单</el-button>
        <el-button @click="emit('export')">导出 Excel</el-button>
        <el-button type="primary" :disabled="costMissing">提交审批</el-button>
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

.drawer-alert,
.drawer-timeline {
  margin-bottom: 12px;
}

.preview-link {
  margin-left: 8px;
}

.drawing {
  color: var(--wfx-navy);
}

.muted {
  color: var(--wfx-text-muted);
}

.dist {
  margin-top: 6px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.dist__tag {
  margin-right: 6px;
}

.cost-no {
  font-weight: 600;
  color: var(--wfx-navy);
}
</style>
