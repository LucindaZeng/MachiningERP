import { computed } from 'vue'

import { buildBlockingChecks } from './blocking-checks'
import { collectEngineeringGaps } from './engineering-gaps'
import { isHkPriceConsistent } from './order-pricing'

import type { BlockingCheck, BlockingCheckContext } from './blocking-checks'
import type { SalesOrderFormModel } from './form-model'
import type { OrderTypeFlags } from './use-order-type-flags'
import type { HkPricing, StockLink } from '@/types/sales.types'
import type { ComputedRef, Ref } from 'vue'

export interface OrderChecksInput {
  form: SalesOrderFormModel
  flags: OrderTypeFlags
  hk: Ref<HkPricing | null>
  stockUsage: ComputedRef<StockLink | null>
}

/** 把响应式状态求值后交给纯规则函数，界面拿到的只是一份逐条可见的阻断清单 */
export function useOrderChecks(input: OrderChecksInput) {
  const engineeringGaps = computed(() => collectEngineeringGaps(input.form))

  const checks = computed<BlockingCheck[]>(() =>
    buildBlockingChecks(snapshot(input, engineeringGaps.value)),
  )

  const canSubmit = computed(() => checks.value.every((item) => item.passed))

  return { engineeringGaps, checks, canSubmit }
}

function snapshot(input: OrderChecksInput, engineeringGaps: string[]): BlockingCheckContext {
  const { form, flags } = input
  return {
    form,
    isFormal: flags.isFormal.value,
    isStock: flags.isStock.value,
    isSample: flags.isSample.value,
    needFreeFields: flags.needFreeFields.value,
    needPoFile: flags.needPoFile.value,
    engineeringGaps,
    hkConsistent: isHkPriceConsistent(input.hk.value),
    stockUsageReady: Boolean(input.stockUsage.value) && Number(form.produceUnitCost) > 0,
  }
}
