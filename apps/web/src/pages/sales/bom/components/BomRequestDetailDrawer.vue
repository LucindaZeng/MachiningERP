<script setup lang="ts">
import { CircleCheckFilled, Clock } from '@element-plus/icons-vue'
import { computed } from 'vue'

import DocTimeline from '@/components/DocTimeline.vue'
import FilePreviewDialog from '@/components/FilePreviewDialog.vue'
import { useFilePreview } from '@/composables/use-file-preview'

import type { BomRequest } from '@/types/sales.types'

const props = defineProps<{ modelValue: boolean; request: BomRequest | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const filePreview = useFilePreview()

/** 图纸沿用报价环节上传的那一版，这里只按版本主键调平台预览能力 */
function previewDrawing(versionId: string): void {
  void filePreview.open('drawing-version', versionId)
}

/** 正式量产建「品号」，模具建「模具编号」 */
function codeLabel(row: BomRequest): string {
  return row.productionType === 'mold' ? '模具编号' : '品号'
}

/** BOM 与程序是两个独立门槛，缺一不可下单：两者都完成才允许「据此建单」 */
const orderable = computed(() => props.request?.bomReady && props.request?.programReady)
</script>

<template>
  <el-drawer v-model="visible" size="660px" :title="request?.docNo">
    <template v-if="request">
      <div class="dual-status">
        <div class="dual-status__item" :class="{ 'is-done': request.bomReady }">
          <el-icon><component :is="request.bomReady ? CircleCheckFilled : Clock" /></el-icon>
          <div>
            <p class="dual-status__title">BOM 可下单</p>
            <p class="dual-status__desc">
              {{ request.bomReady ? `${codeLabel(request)} ${request.productCode}，BOM 版本已发布` : `${codeLabel(request)}与 BOM 尚未建立` }}
            </p>
          </div>
        </div>
        <div class="dual-status__item" :class="{ 'is-done': request.programReady }">
          <el-icon><component :is="request.programReady ? CircleCheckFilled : Clock" /></el-icon>
          <div>
            <p class="dual-status__title">程序可开工</p>
            <p class="dual-status__desc">
              {{ request.programReady ? '工艺路线与 CNC 程序均已就绪' : '工艺路线或程序未完成，不得按「全部工程完成」处理' }}
            </p>
          </div>
        </div>
      </div>

      <el-alert
        v-if="request.bomReady && !request.programReady"
        class="drawer-alert"
        type="warning"
        :closable="false"
        show-icon
        title="BOM 已完成但程序未完成"
        description="可以建单，但不得据此承诺开工日；程序未完成时按控制矩阵不得显示为全部工程完成。"
      />

      <el-alert
        v-if="request.status === 'returned'"
        class="drawer-alert"
        type="error"
        :closable="false"
        show-icon
        :title="`工程已退回，退回等待累计 ${request.returnedHours} 小时`"
        description="补齐资料后重提会建立新的处理轮次，总历时从首次提交连续计算。"
      />

      <h3 class="drawer-title">申请内容</h3>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="客户">{{ request.customerName }}</el-descriptions-item>
        <el-descriptions-item label="关联报价">{{ request.quotationNo ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="客户原始订单">
          {{ request.customerPoNo ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="产品">{{ request.productName }}</el-descriptions-item>
        <el-descriptions-item label="图号 / 版本">
          {{ request.drawingNo }} · {{ request.drawingVersion }}
          <el-button
            v-if="request.drawingVersionId"
            link
            type="primary"
            class="preview-link"
            @click="previewDrawing(request.drawingVersionId)"
          >
            预览图纸
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item label="材料">{{ request.material }}</el-descriptions-item>
        <el-descriptions-item label="表面处理">{{ request.surfaceTreatment }}</el-descriptions-item>
        <el-descriptions-item label="检验要求">{{ request.inspection }}</el-descriptions-item>
        <el-descriptions-item label="包装要求">{{ request.packing }}</el-descriptions-item>
        <el-descriptions-item label="数量 / 申请用途">
          {{ request.quantity }} · {{ request.productionType === 'mold' ? '模具（建模具编号）' : '正式量产（建品号）' }}
        </el-descriptions-item>
        <el-descriptions-item label="目标交期">
          {{ request.targetDeliveryDate }}
        </el-descriptions-item>
        <el-descriptions-item :label="codeLabel(request)">
          <span v-if="request.productCode" class="item-code">{{ request.productCode }}</span>
          <span v-else class="muted">待工程建立</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="request.fromSampleNo" label="由样品转量产" :span="2">
          {{ request.fromSampleNo }}
          <span class="muted">（样品本身无品号，转量产时才建立；试做工时与实际成本一并带入首次量产的成本参考值）</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="request.specialRequirement" label="特殊要求" :span="2">
          {{ request.specialRequirement }}
        </el-descriptions-item>
      </el-descriptions>

      <DocTimeline class="drawer-timeline" title="工程处理节点计时" :nodes="request.timeline" />
    </template>

    <!-- Element Plus 具名插槽必须是 el-drawer 的直接子节点，不能再套一层 v-if 的 template -->
    <template #footer>
      <template v-if="request">
        <el-button>催办工程</el-button>
        <el-button type="primary" :disabled="!orderable">据此建单</el-button>
      </template>
    </template>
  </el-drawer>

    <FilePreviewDialog
      v-model="filePreview.visible.value"
      :loading="filePreview.loading.value"
      :preview="filePreview.preview.value"
      :unsupported="filePreview.unsupported.value"
      :error-message="filePreview.errorMessage.value"
      @close="filePreview.close"
      @download="filePreview.download"
    />
</template>

<style scoped>
.preview-link {
  margin-left: 8px;
}

.item-code {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--el-color-success);
}

.muted {
  font-size: 12px;
  color: var(--wfx-text-muted);
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
</style>
