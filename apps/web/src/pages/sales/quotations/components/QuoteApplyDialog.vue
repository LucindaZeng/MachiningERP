<script setup lang="ts">
import { Delete, Plus, UploadFilled } from '@element-plus/icons-vue'
import { UPLOAD_ACCEPT_ATTRIBUTE } from '@machining-erp/shared'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'

import { uploadDrawing, type DrawingVersionView } from '@/api/sales/drawing.api'
import DraftToolbar from '@/components/DraftToolbar.vue'
import FilePreviewDialog from '@/components/FilePreviewDialog.vue'
import { useFilePreview } from '@/composables/use-file-preview'
import { useFileUpload } from '@/composables/use-file-upload'
import { useFormDraft } from '@/composables/use-form-draft'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

interface QtyLine {
  quantity: string
}

interface ApplyForm extends Record<string, unknown> {
  customerName: string
  productName: string
  drawingNo: string
  drawingVersion: string
  quantityMode: 'tier' | 'single'
  quantities: QtyLine[]
  targetDeliveryDays: string
  currency: string
  remark: string
  drawingFile: string
  /** 上传成功后拿到的图纸版本主键；提交报价申请的硬前提 */
  drawingVersionId: string
}

const form = reactive<ApplyForm>({
  customerName: '',
  productName: '',
  drawingNo: '',
  drawingVersion: 'Rev.A',
  quantityMode: 'tier',
  quantities: [{ quantity: '' }, { quantity: '' }],
  targetDeliveryDays: '',
  currency: 'CNY',
  remark: '',
  drawingFile: '',
  drawingVersionId: '',
})

const { drafts, lastSavedAt, save, load, remove } = useFormDraft<ApplyForm>('quote-apply', form)

const CUSTOMERS = [
  '香港宏晟精密（代生产）',
  'Brenner Maschinenbau GmbH',
  '苏州明泰自动化',
  'Radex Instruments Inc.',
  '东莞德信电子',
  '深圳兆丰医疗',
]

/** 业务只需要提供图纸与数量，其余资料由报价工程师补齐 */
const checks = computed(() => [
  { label: '客户', passed: Boolean(form.customerName) },
  { label: '产品名称与图号', passed: Boolean(form.productName && form.drawingNo) },
  {
    label: '图纸（强制上传）',
    // 认的是上传回来的版本 id，不是文件名——只有真上传成功才算数
    passed: Boolean(form.drawingVersionId),
    hint: '报价单必须上传图纸；系统会把图纸同时分发给报价工程师报价、以及工程用于建立 BOM',
  },
  {
    label: form.quantityMode === 'tier' ? '阶梯数量（至少 2 档）' : '数量',
    passed:
      form.quantityMode === 'tier'
        ? form.quantities.filter((line) => Number(line.quantity) > 0).length >= 2
        : Number(form.quantities[0]?.quantity) > 0,
  },
])

const canSubmit = computed(() => checks.value.every((item) => item.passed))

function addTier(): void {
  form.quantities.push({ quantity: '' })
}

function removeTier(index: number): void {
  form.quantities.splice(index, 1)
}

function switchMode(mode: 'tier' | 'single'): void {
  form.quantityMode = mode
  form.quantities = mode === 'single' ? [{ quantity: form.quantities[0]?.quantity ?? '' }] : [
    { quantity: form.quantities[0]?.quantity ?? '' },
    { quantity: '' },
  ]
}

const drawingUpload = useFileUpload<DrawingVersionView>()
const filePreview = useFilePreview()
const fileInput = ref<HTMLInputElement>()

function pickDrawing(): void {
  if (!form.drawingNo.trim()) {
    ElMessage.warning('请先填写图号，图纸要挂在图号下面')
    return
  }
  fileInput.value?.click()
}

/** 真上传：成功后记住 drawingVersionId，下游核价与 BOM 都引用它，不再重传。 */
async function onFilePicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const version = await drawingUpload.run((onProgress) =>
    uploadDrawing({
      file,
      drawingNo: form.drawingNo.trim(),
      revision: form.drawingVersion.trim() || undefined,
      onProgress,
    }),
  )

  if (!version) return

  form.drawingVersionId = version.drawingVersionId
  form.drawingFile = version.fileName
  form.drawingVersion = version.revision
  ElMessage.success(`图纸 ${version.revision} 已上传，将同时分发给报价工程师与工程（BOM 建立）`)
}

function previewDrawing(): void {
  if (form.drawingVersionId) {
    void filePreview.open('drawing-version', form.drawingVersionId)
  }
}

function clearDrawing(): void {
  form.drawingVersionId = ''
  form.drawingFile = ''
  drawingUpload.reset()
}

function submit(): void {
  if (!canSubmit.value) {
    ElMessage.error('图纸与数量为必填，请补齐后再提交')
    return
  }
  ElMessage.success('报价申请已提交，已推送报价工程师补齐材料、表面处理、工艺与成本分析')
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" title="新建报价申请（业务：图纸 + 数量）" width="860px">
    <el-alert
      class="apply-alert"
      type="info"
      :closable="false"
      show-icon
      title="业务只需提供图纸与数量，其余资料由报价工程师填写"
      description="材料牌号、表面处理、工艺路线、工时假设、成本分析与最终单价均由报价工程师完成；业务提交后报价单进入「待报价工程师补齐」阶段。图纸为强制项，上传后同时分发给报价工程师（报价）与工程部（建 BOM）。"
    />

    <DraftToolbar
      class="apply-draft"
      :drafts="drafts"
      :last-saved-at="lastSavedAt"
      @save="save"
      @load="load"
      @remove="remove"
    />

    <el-form label-width="110px" class="apply-form">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="客户" required>
            <el-select v-model="form.customerName" placeholder="选择客户" style="width: 100%">
              <el-option v-for="item in CUSTOMERS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="产品名称" required>
            <el-input v-model="form.productName" placeholder="如：导轨端盖" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="图号" required>
            <el-input v-model="form.drawingNo" placeholder="如：MT-7802" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="图纸版本">
            <el-input v-model="form.drawingVersion" placeholder="Rev.A" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="图纸" required>
        <div class="upload">
          <input
            ref="fileInput"
            type="file"
            class="upload__input"
            :accept="UPLOAD_ACCEPT_ATTRIBUTE"
            @change="onFilePicked"
          />
          <el-button
            :icon="UploadFilled"
            :loading="drawingUpload.uploading.value"
            @click="pickDrawing"
          >
            {{ form.drawingVersionId ? '重新上传（生成新版本）' : '上传图纸（PDF / DWG / STEP）' }}
          </el-button>

          <el-progress
            v-if="drawingUpload.uploading.value"
            class="upload__progress"
            :percentage="drawingUpload.percent.value"
            :stroke-width="14"
            striped
            striped-flow
          />

          <span v-else-if="form.drawingVersionId" class="upload__file">
            {{ form.drawingFile }}
            <el-tag size="small" effect="plain">{{ form.drawingVersion }}</el-tag>
            <el-tag size="small" type="success" effect="plain">已分发：报价工程师 · 工程 BOM</el-tag>
            <el-button link type="primary" @click="previewDrawing">预览</el-button>
            <el-button link type="danger" @click="clearDrawing">移除</el-button>
          </span>
          <span v-else class="upload__empty">未上传图纸，无法提交报价申请</span>
        </div>

        <el-alert
          v-if="drawingUpload.errorMessage.value"
          class="upload__error"
          type="error"
          :closable="false"
          show-icon
          title="图纸上传失败"
          :description="drawingUpload.errorMessage.value"
        />
        <p class="upload__hint">
          改错的图纸请直接重新上传：系统会生成**新版本**并保留旧版，绝不覆盖。
        </p>
      </el-form-item>

      <el-form-item label="数量口径">
        <el-radio-group :model-value="form.quantityMode" @change="switchMode($event as 'tier' | 'single')">
          <el-radio-button value="tier">阶梯数量</el-radio-button>
          <el-radio-button value="single">单一数量</el-radio-button>
        </el-radio-group>
        <span class="mode-hint">
          阶梯报价按档位分别核价；单一数量只报一档，后续追加数量需重新报价。
        </span>
      </el-form-item>

      <el-form-item :label="form.quantityMode === 'tier' ? '阶梯数量' : '数量'" required>
        <div class="qty">
          <div v-for="(line, index) in form.quantities" :key="index" class="qty__row">
            <span class="qty__label">
              {{ form.quantityMode === 'tier' ? `第 ${index + 1} 档` : '数量' }}
            </span>
            <el-input v-model="line.quantity" placeholder="件数，定点整数" style="width: 180px" />
            <span class="qty__price">单价：由报价工程师核价后填写</span>
            <el-button
              v-if="form.quantityMode === 'tier' && form.quantities.length > 2"
              link
              type="danger"
              :icon="Delete"
              @click="removeTier(index)"
            />
          </div>
          <el-button
            v-if="form.quantityMode === 'tier'"
            link
            type="primary"
            :icon="Plus"
            @click="addTier"
          >
            增加一档
          </el-button>
        </div>
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="目标交期">
            <el-input v-model="form.targetDeliveryDays" placeholder="天数，如 25">
              <template #suffix>天</template>
            </el-input>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="报价币种">
            <el-select v-model="form.currency" style="width: 100%">
              <el-option label="CNY" value="CNY" />
              <el-option label="USD" value="USD" />
              <el-option label="EUR" value="EUR" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="客户特殊要求">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          placeholder="如：随货附检验报告、指定表面处理供应商、包装要求等"
        />
      </el-form-item>
    </el-form>

    <div class="checks">
      <span class="checks__title">提交前校验</span>
      <span v-for="item in checks" :key="item.label" :class="['checks__item', { 'is-bad': !item.passed }]">
        {{ item.passed ? '✓' : '✕' }} {{ item.label }}
      </span>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!canSubmit" @click="submit">
        提交报价申请
      </el-button>
    </template>
  </el-dialog>

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
.upload__input {
  display: none;
}

.upload__progress {
  flex: 1 1 240px;
  min-width: 200px;
}

.upload__error {
  margin-top: 10px;
}

.upload__hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.apply-alert {
  margin-bottom: 14px;
}

.apply-draft {
  margin-bottom: 14px;
}

.upload {
  display: flex;
  gap: 12px;
  align-items: center;
}

.upload__file {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12.5px;
  color: var(--el-color-success);
}

.upload__empty {
  font-size: 12.5px;
  color: var(--el-color-danger);
}

.mode-hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.qty__row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 3px 0;
}

.qty__label {
  width: 52px;
  font-size: 12.5px;
  color: var(--wfx-text-muted);
}

.qty__price {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  padding: 10px 12px;
  font-size: 12.5px;
  background: var(--wfx-surface-alt);
  border-radius: 4px;
}

.checks__title {
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.checks__item {
  color: var(--el-color-success);
}

.checks__item.is-bad {
  color: var(--el-color-danger);
}
</style>
