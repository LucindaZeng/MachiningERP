<script setup lang="ts">
import { computed, reactive } from 'vue'

import DraftToolbar from '@/components/DraftToolbar.vue'
import { ECN_CHANGE_TYPE } from '@/components/status-dictionary'
import { useFormDraft } from '@/composables/use-form-draft'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

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
})

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
          <el-button type="primary" @click="visible = false">提交工程评估</el-button>
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
