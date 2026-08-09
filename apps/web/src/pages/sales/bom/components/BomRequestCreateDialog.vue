<script setup lang="ts">
import { computed, reactive } from 'vue'

import DraftToolbar from '@/components/DraftToolbar.vue'
import { useFormDraft } from '@/composables/use-form-draft'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

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
</script>

<template>
  <el-dialog v-model="visible" title="新建 BOM 申请（ENG-02）" width="620px">
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
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" @click="visible = false">提交工程</el-button>
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
</style>
