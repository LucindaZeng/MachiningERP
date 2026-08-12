<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'

import { SERVER_CHANGE_TYPE, createEngineeringChange } from '@/api/sales/ecn.api'
import DraftToolbar from '@/components/DraftToolbar.vue'
import { ECN_CHANGE_TYPE } from '@/components/status-dictionary'
import { useFormDraft } from '@/composables/use-form-draft'

import type { EngineeringChange } from '@/types/sales.types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  created: [change: EngineeringChange]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

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
  /** 改图必填：新版图纸经报价模块既有的上传通道产生，ECN 不另建上传路径 */
  newDrawingVersionId: '',
})

const submitting = ref(false)

const REQUIRED: Array<[keyof typeof createForm, string]> = [
  ['customerCode', '客户'],
  ['product', '产品名称'],
  ['drawingNo', '图号'],
  ['beforeValue', '变更前'],
  ['afterValue', '变更后'],
  ['reason', '变更原因'],
]

/**
 * 提交。
 *
 * 受理范围与样品阶段两道闸门都在**服务端**，这里不预判——预判会漏，
 * 而且服务端的拒绝消息里带着「该走哪条路」，比前端自己编的提示有用得多。
 */
async function submit(): Promise<void> {
  const missing = REQUIRED.filter(([key]) => String(createForm[key] ?? '').trim() === '').map(
    ([, label]) => label,
  )
  if (missing.length) {
    ElMessage.warning(`请填写：${missing.join('、')}`)
    return
  }

  submitting.value = true
  try {
    const created = await createEngineeringChange({
      customerId: createForm.customerCode,
      orderId: createForm.orderNo || null,
      productName: createForm.product,
      drawingNo: createForm.drawingNo,
      newDrawingVersionId: createForm.newDrawingVersionId || null,
      changeType: SERVER_CHANGE_TYPE[createForm.changeType] ?? createForm.changeType,
      origin: createForm.origin === 'customer' ? 'CUSTOMER' : 'INTERNAL',
      urgent: createForm.urgent,
      beforeValue: createForm.beforeValue,
      afterValue: createForm.afterValue,
      reason: createForm.reason,
    })
    ElMessage.success(`变更申请 ${created.docNo} 已提交工程评估`)
    emit('created', created)
    visible.value = false
  } catch (error) {
    // 越界类型、样品阶段等拒绝消息里带着正确去处，原样显示
    ElMessage.error(error instanceof Error ? error.message : '提交失败')
  } finally {
    submitting.value = false
  }
}

const {
  drafts,
  lastSavedAt,
  save: saveDraft,
  load: loadDraft,
  remove: removeDraft,
} = useFormDraft('ecn-create', createForm)
</script>

<template>
  <el-dialog v-model="visible" title="新建 ECN 申请（ECN-01）" width="640px">
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
      <el-form-item v-if="createForm.changeType === 'drawing'" label="新版图纸版本 ID" required>
        <el-input
          v-model="createForm.newDrawingVersionId"
          placeholder="经「报价管理 → 图纸上传」产生的版本 ID"
        />
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
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="submit">提交工程评估</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
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
</style>
