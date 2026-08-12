<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'

import { createCustomsDossier } from '@/api/sales/customs.api'

import type { CustomsDossier } from '@/types/sales.types'



/**
 * EXP-01 建档。
 *
 * **客户、订单、币种一律不在这里填**——它们由服务端从原出货单带出。
 * 报关单上的数量与出货单对不上，是到口岸才会被发现的那种错，
 * 所以这里只收「出货单 + 贸易与商品要素」，其余让服务端自己去取。
 *
 * 目的港代码与唛头虽然表单上可空，但它们在齐套清单里，
 * 不填就生成不了资料包——留空的自由只到「先建档、稍后补」为止。
 */
const props = defineProps<{ modelValue: boolean }>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [dossier: CustomsDossier]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const submitting = ref(false)

function emptyForm() {
  return {
    shipmentId: '',
    tradeMode: '一般贸易',
    incoterm: 'FOB',
    portOfLoading: '',
    destination: '',
    destinationPortCode: '',
    shippingMarks: '',
    hsCode: '',
    goodsNameCn: '',
    goodsNameEn: '',
    quantity: '',
    unit: 'PCS',
    netWeight: '',
    grossWeight: '',
    packages: 1,
    unitPriceMinor: '',
    totalAmountMinor: '',
    exchangeRate: '',
  }
}

const form = reactive(emptyForm())

/** 必填项。其余留空由服务端的齐套闸门在生成时再点名。 */
const REQUIRED: Array<[keyof typeof form, string]> = [
  ['shipmentId', '出货单'],
  ['tradeMode', '贸易方式'],
  ['incoterm', '贸易术语'],
  ['portOfLoading', '启运港'],
  ['destination', '目的地'],
  ['hsCode', 'HS 编码'],
  ['goodsNameCn', '中文品名'],
  ['quantity', '数量'],
  ['unit', '单位'],
  ['netWeight', '净重'],
  ['grossWeight', '毛重'],
  ['unitPriceMinor', '单价（最小货币单位）'],
  ['totalAmountMinor', '总金额（最小货币单位）'],
  ['exchangeRate', '汇率'],
]

async function submit(): Promise<void> {
  const missing = REQUIRED.filter(([key]) => String(form[key] ?? '').trim() === '').map(
    ([, label]) => label,
  )
  if (missing.length) {
    // 一次列全，不做「改一个报一个」——与服务端闸门同一套待人方式
    ElMessage.warning(`请填写：${missing.join('、')}`)
    return
  }

  submitting.value = true
  try {
    const created = await createCustomsDossier({
      ...form,
      destinationPortCode: form.destinationPortCode || undefined,
      shippingMarks: form.shippingMarks || undefined,
      goodsNameEn: form.goodsNameEn || undefined,
    })
    ElMessage.success(`报关资料 ${created.docNo} 已建档`)
    emit('created', created)
    Object.assign(form, emptyForm())
    visible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '建档失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="新建报关资料（EXP-01）" width="720px">
    <el-alert
      class="form-alert"
      type="info"
      :closable="false"
      show-icon
      title="客户、订单与币种由服务端从原出货单带出"
      description="报关单上的数量与出货单对不上，是到口岸才会被发现的错误，因此这几项不接受手工填写。"
    />

    <el-form :model="form" label-width="132px" size="small">
      <el-form-item label="出货单 ID" required>
        <el-input v-model="form.shipmentId" placeholder="已过账的出货单主键" />
      </el-form-item>

      <div class="form-grid">
        <el-form-item label="贸易方式" required>
          <el-input v-model="form.tradeMode" />
        </el-form-item>
        <el-form-item label="贸易术语" required>
          <el-input v-model="form.incoterm" placeholder="FOB / CIF" />
        </el-form-item>
        <el-form-item label="启运港" required>
          <el-input v-model="form.portOfLoading" />
        </el-form-item>
        <el-form-item label="目的地" required>
          <el-input v-model="form.destination" />
        </el-form-item>
        <el-form-item label="目的港代码">
          <el-input v-model="form.destinationPortCode" placeholder="齐套必需，可稍后补" />
        </el-form-item>
        <el-form-item label="唛头 Shipping Marks">
          <el-input v-model="form.shippingMarks" placeholder="齐套必需，可稍后补" />
        </el-form-item>
        <el-form-item label="HS 编码" required>
          <el-input v-model="form.hsCode" />
        </el-form-item>
        <el-form-item label="中文品名" required>
          <el-input v-model="form.goodsNameCn" />
        </el-form-item>
        <el-form-item label="英文品名">
          <el-input v-model="form.goodsNameEn" />
        </el-form-item>
        <el-form-item label="数量" required>
          <el-input v-model="form.quantity" placeholder="定点数字符串" />
        </el-form-item>
        <el-form-item label="单位" required>
          <el-input v-model="form.unit" />
        </el-form-item>
        <el-form-item label="件数" required>
          <el-input-number v-model="form.packages" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="净重（KG）" required>
          <el-input v-model="form.netWeight" />
        </el-form-item>
        <el-form-item label="毛重（KG）" required>
          <el-input v-model="form.grossWeight" />
        </el-form-item>
        <el-form-item label="单价（分）" required>
          <el-input v-model="form.unitPriceMinor" placeholder="整数最小货币单位" />
        </el-form-item>
        <el-form-item label="总金额（分）" required>
          <el-input v-model="form.totalAmountMinor" placeholder="整数最小货币单位" />
        </el-form-item>
        <el-form-item label="当日汇率" required>
          <el-input v-model="form.exchangeRate" placeholder="每份文件出具时另留快照" />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">建档</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.form-alert {
  margin-bottom: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 12px;
}
</style>
