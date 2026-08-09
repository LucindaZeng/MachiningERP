import { ref, watch } from 'vue'

import { calculateHkPrice } from '@/api/sales/sales-order.api'

import type { SalesOrderFormModel } from './form-model'
import type { HkPricing } from '@/types/sales.types'

/**
 * HK 70% 价格试算。
 * 客户、原始单价、数量任一变化都要重算：折算系数与适用性由后端按客户标记与订单类型判定，
 * 前端只负责在口径变化时重新取快照，绝不自己乘系数。
 */
export function useHkPricing(form: SalesOrderFormModel) {
  const hk = ref<HkPricing | null>(null)

  async function refreshHkPrice(): Promise<void> {
    if (!form.customerCode || !form.originalUnitPrice) {
      hk.value = null
      return
    }
    hk.value = await calculateHkPrice({
      customerCode: form.customerCode,
      orderType: form.orderType,
      originalUnitPrice: form.originalUnitPrice,
      quantity: form.quantity || '0',
    })
  }

  watch(
    () => [form.customerCode, form.originalUnitPrice, form.quantity],
    () => {
      void refreshHkPrice()
    },
  )

  return { hk, refreshHkPrice }
}
