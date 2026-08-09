import { ElMessage, type FormInstance } from 'element-plus'
import { computed, reactive, ref } from 'vue'

import { applyOrderTypeDefaults, createEmptyForm } from './sales-order-form/form-model'
import { createSalesOrderRules } from './sales-order-form/form-rules'
import { computeStockUsage } from './sales-order-form/order-pricing'
import { useHkPricing } from './sales-order-form/use-hk-pricing'
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
 * 四类订单规则、备料领用加权成本、HK 70% 试算与阻断校验都是纯函数，便于脱离组件单测。
 */
export function useSalesOrderForm() {
  const formRef = ref<FormInstance>()
  const form = reactive(createEmptyForm())

  const lines = useOrderLines(form)
  const masterData = useOrderMasterData(form)
  const flags = useOrderTypeFlags(form)
  const pricing = useHkPricing(form)
  const rules = createSalesOrderRules(() => flags.isFormal.value)

  /** 备料领用与加权平均成本：(备料单价×领用数 + 新产单价×新产数) / 订单数量 */
  const stockUsage = computed(() =>
    computeStockUsage(masterData.selectedStock.value, form.quantity, form.produceUnitCost),
  )

  const checks = useOrderChecks({ form, flags, hk: pricing.hk, stockUsage })
  const submission = useOrderSubmit({ form, formRef, canSubmit: checks.canSubmit })

  function onOrderTypeChange(value: OrderType): void {
    applyOrderTypeDefaults(form, value)
    void pricing.refreshHkPrice()
  }

  /** 上传客户订单原件（原型阶段用文件名占位） */
  function pickPoFile(): void {
    form.poFile = `${form.customerPoNo || 'CUSTOMER-PO'}.pdf`
    ElMessage.success('客户订单原件已上传并归档到订单附件')
  }

  return {
    form,
    formRef,
    rules,
    stockUsage,
    pickPoFile,
    onOrderTypeChange,
    ...lines,
    ...masterData,
    ...flags,
    ...pricing,
    ...checks,
    ...submission,
  }
}
