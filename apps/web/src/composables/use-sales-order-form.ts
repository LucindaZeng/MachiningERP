import { ElMessage, type FormInstance } from 'element-plus'
import { computed, reactive, ref } from 'vue'

import { uploadCustomerPo, type CustomerPoUploadView } from '@/api/sales/customer-po.api'
import { useFileUpload } from '@/composables/use-file-upload'

import { applyOrderTypeDefaults, createEmptyForm } from './sales-order-form/form-model'
import { createSalesOrderRules } from './sales-order-form/form-rules'
import { computeStockUsage } from './sales-order-form/order-pricing'
import { useOrderChecks } from './sales-order-form/use-order-checks'
import { useOrderLines } from './sales-order-form/use-order-lines'
import { useOrderMasterData } from './sales-order-form/use-order-master-data'
import { useOrderSubmit } from './sales-order-form/use-order-submit'
import { useOrderTypeFlags } from './sales-order-form/use-order-type-flags'

import type { OrderType } from '@/types/sales.types'

export type { BlockingCheck } from './sales-order-form/blocking-checks'
export type { SalesOrderFormModel } from './sales-order-form/form-model'

/**
 * ORD-01 建单的装配层：只把各职责模块接起来，规则本身分别落在 sales-order-form/ 下。
 * 四类订单规则、备料领用加权成本与阻断校验都是纯函数，便于脱离组件单测。
 */
export function useSalesOrderForm() {
  const formRef = ref<FormInstance>()
  const form = reactive(createEmptyForm())

  const lines = useOrderLines(form)
  const masterData = useOrderMasterData(form)
  const flags = useOrderTypeFlags(form)
  const rules = createSalesOrderRules(() => flags.isFormal.value)

  /** 备料领用与加权平均成本：(备料单价×领用数 + 新产单价×新产数) / 订单数量 */
  const stockUsage = computed(() =>
    computeStockUsage(masterData.selectedStock.value, form.quantity, form.produceUnitCost),
  )

  const checks = useOrderChecks({ form, flags, stockUsage })
  const submission = useOrderSubmit({ form, formRef, canSubmit: checks.canSubmit })

  function onOrderTypeChange(value: OrderType): void {
    applyOrderTypeDefaults(form, value)
  }

  const poUpload = useFileUpload<CustomerPoUploadView>()

  /**
   * 上传客户订单原件。
   *
   * 建单表单里订单还没落库，所以这里**不带 orderId**：后端把文件暂存并回一个对象键，
   * 建单请求把这个键作为 `customerPoFile` 带上，订单落库时那一列就有值了。
   * 也因此预览要等建单之后才可用——预览按订单 id 定位文件。
   */
  async function uploadPoFile(file: File): Promise<void> {
    const uploaded = await poUpload.run((onProgress) => uploadCustomerPo({ file, onProgress }))
    if (!uploaded) {
      ElMessage.error(poUpload.errorMessage.value || '客户订单原件上传失败')
      return
    }

    form.poFile = uploaded.fileName
    form.poFileKey = uploaded.objectKey
    ElMessage.success('客户订单原件已上传，建单时一并归档')
  }

  function clearPoFile(): void {
    form.poFile = ''
    form.poFileKey = ''
    poUpload.reset()
  }

  return {
    form,
    formRef,
    rules,
    stockUsage,
    poUpload,
    uploadPoFile,
    clearPoFile,
    onOrderTypeChange,
    ...lines,
    ...masterData,
    ...flags,
    ...checks,
    ...submission,
  }
}
