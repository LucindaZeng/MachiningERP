<script setup lang="ts">
import { Delete, Plus, UploadFilled } from '@element-plus/icons-vue'
import { UPLOAD_ACCEPT_ATTRIBUTE } from '@machining-erp/shared'
import { computed, ref } from 'vue'


import type { OrderLine } from '@/types/sales.types'

const props = defineProps<{
  /** 明细行由父页的表单模型持有，这里就地编辑（行内 v-model 写的是同一份响应式对象） */
  lines: OrderLine[]
  totalQty: number
  totalAmount: number
  currency: string
  poFile: string
  needPoFile: boolean
  poUploading: boolean
  poPercent: number
  poError: string
  isFormal: boolean
  isSample: boolean
  isStock: boolean
}>()

const emit = defineEmits<{
  'add-line': []
  'remove-line': [number]
  'pick-po-file': [File]
  'clear-po-file': []
}>()

const poInput = ref<HTMLInputElement>()

function onPoPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('pick-po-file', file)
}

const deliveryDate = defineModel<string>('deliveryDate', { required: true })
const customerPoNo = defineModel<string>('customerPoNo', { required: true })
const quotationNo = defineModel<string>('quotationNo', { required: true })
const itemCode = defineModel<string>('itemCode', { required: true })
const bomRequestNo = defineModel<string>('bomRequestNo', { required: true })

/** 品号口径按订单类型分三种：样品免品号、备料引用既有品号、正式与模具由工程建立 */
const itemCodePlaceholder = computed(() => {
  if (props.isSample) {
    return '样品无品号，以图号 + 样品单号标识'
  }
  if (props.isStock) {
    return '选择该图号已量产的品号，如 P-HS4471-A-01'
  }
  return props.isFormal ? '工程建立的品号，如 P-HS4471-A-01' : '模具编号，如 M-HS4471-01'
})

const bomPlaceholder = computed(() => {
  if (props.isSample) {
    return '样品不建 BOM，无需关联'
  }
  if (props.isStock) {
    return '沿用该品号已发布的 BOM，无需另申请'
  }
  return '工程回传「BOM 可下单」的申请单号'
})
</script>

<template>
  <el-card shadow="never">
    <template #header><span class="card-title">二、产品与交期</span></template>

    <el-form-item label="产品明细">
      <div class="lines">
        <div class="lines__head">
          <span>一张订单可以下多项产品；品号由工程建立，样品行不填品号。</span>
          <el-button link type="primary" :icon="Plus" @click="emit('add-line')">增加一项产品</el-button>
        </div>

        <el-table :data="lines" size="small" border style="width: 100%">
          <el-table-column label="#" width="42" align="center">
            <template #default="{ row }">{{ row.seq }}</template>
          </el-table-column>
          <el-table-column label="产品名称" min-width="160">
            <template #default="{ row }">
              <el-input v-model="row.productName" size="small" placeholder="如：连接器外壳" />
            </template>
          </el-table-column>
          <el-table-column label="图号" width="118">
            <template #default="{ row }">
              <el-input v-model="row.drawingNo" size="small" placeholder="HS-4471-A" />
            </template>
          </el-table-column>
          <el-table-column label="品号" width="132">
            <template #default="{ row }">
              <el-input
                v-model="row.itemCode"
                size="small"
                :disabled="isSample"
                :placeholder="isSample ? '样品无品号' : 'P-HS4471-A-01'"
              />
            </template>
          </el-table-column>
          <el-table-column label="数量" width="86">
            <template #default="{ row }">
              <el-input v-model="row.quantity" size="small" placeholder="件" />
            </template>
          </el-table-column>
          <el-table-column :label="isStock ? '单件成本' : '原始单价'" width="96">
            <template #default="{ row }">
              <el-input v-model="row.unitPrice" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="金额" width="96" align="right">
            <template #default="{ row }">{{ row.amount }}</template>
          </el-table-column>
          <el-table-column label="行交期" width="132">
            <template #default="{ row }">
              <el-date-picker
                v-model="row.deliveryDate"
                type="date"
                size="small"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="" width="46" align="center">
            <template #default="{ $index }">
              <el-button
                link
                type="danger"
                :icon="Delete"
                :disabled="lines.length <= 1"
                @click="emit('remove-line', $index)"
              />
            </template>
          </el-table-column>
        </el-table>

        <div class="lines__total">
          合计 {{ lines.length }} 项产品 · {{ totalQty }} 件 ·
          {{ totalAmount.toFixed(2) }} {{ currency }}
        </div>
      </div>
    </el-form-item>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-form-item :label="isStock ? '期望完工日' : '客户交期'" prop="deliveryDate">
          <el-date-picker
            v-model="deliveryDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="客户原始订单号" prop="customerPoNo">
          <el-input v-model="customerPoNo" :placeholder="isFormal ? '必填' : '选填'" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="客户订单原件">
          <div class="po">
            <input
              ref="poInput"
              type="file"
              class="po__input"
              :accept="UPLOAD_ACCEPT_ATTRIBUTE"
              @change="onPoPicked"
            />
            <el-button
              size="small"
              :icon="UploadFilled"
              :loading="poUploading"
              @click="poInput?.click()"
            >
              {{ poFile ? '重新上传' : '上传原件' }}
            </el-button>

            <el-progress
              v-if="poUploading"
              class="po__progress"
              :percentage="poPercent"
              :stroke-width="12"
              striped
              striped-flow
            />
            <template v-else-if="poFile">
              <span class="po__file">{{ poFile }}</span>
              <el-button link type="danger" size="small" @click="emit('clear-po-file')">
                移除
              </el-button>
            </template>
            <span v-else :class="needPoFile ? 'po__required' : 'po__optional'">
              {{ needPoFile ? '本类型订单强制上传客户订单原件' : '免费样品可不上传' }}
            </span>
          </div>
          <span v-if="poError" class="po__error">{{ poError }}</span>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="关联报价 / 核价" prop="quotationNo">
          <el-input v-model="quotationNo" :placeholder="isFormal ? '必填' : '选填'" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item :label="isStock ? '引用品号' : '品号'">
          <el-input v-model="itemCode" :disabled="isSample" :placeholder="itemCodePlaceholder" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="关联 BOM 申请">
          <el-input
            v-model="bomRequestNo"
            :disabled="isSample || isStock"
            :placeholder="bomPlaceholder"
          />
        </el-form-item>
      </el-col>
    </el-row>

    <el-alert
      v-if="isSample"
      class="inline-alert"
      type="info"
      :closable="false"
      show-icon
      title="样品既没有品号，也没有 BOM"
      description="品号（产品编码）只发给正式订单的产品。样品按客户来图编制临时工艺路线试做，不建品号、不建 BOM、不做程序可开工确认，全程以「图号 + 样品单号」标识；转量产时才由业务提交 BOM 申请建立品号，并回填本样品单号。"
    />

    <el-alert
      v-else-if="isStock"
      class="inline-alert"
      type="info"
      :closable="false"
      show-icon
      title="备料订单不新建品号"
      description="备料是为已量产产品提前投产，必须引用该图号既有的品号；若该产品尚未正式量产（无品号），不允许开备料订单。"
    />
  </el-card>
</template>

<style scoped>
.po__input {
  display: none;
}

.po__progress {
  flex: 1 1 180px;
  min-width: 160px;
}

.po__error {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-color-danger);
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.lines {
  width: 100%;
}

.lines__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.lines__total {
  margin-top: 8px;
  font-size: 12.5px;
  font-weight: 600;
  text-align: right;
  color: var(--wfx-navy);
}

.po {
  display: flex;
  gap: 10px;
  align-items: center;
}

.po__file {
  font-size: 12.5px;
  color: var(--el-color-success);
}

.po__required {
  font-size: 12px;
  color: var(--el-color-danger);
}

.po__optional {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.inline-alert {
  margin-top: 4px;
}
</style>
