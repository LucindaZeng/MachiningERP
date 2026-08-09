import { computed } from 'vue'

import type { SalesOrderFormModel } from './form-model'
import type { ComputedRef } from 'vue'

export interface OrderTypeFlags {
  isFormal: ComputedRef<boolean>
  isStock: ComputedRef<boolean>
  isSample: ComputedRef<boolean>
  needFreeFields: ComputedRef<boolean>
  needPoFile: ComputedRef<boolean>
}

/** 四类订单派生出的开关：模板、校验规则与阻断清单都只读这些标记，避免各处再散写字符串比较 */
export function useOrderTypeFlags(form: SalesOrderFormModel): OrderTypeFlags {
  const isFormal = computed(() => form.orderType === 'formal')
  const isStock = computed(() => form.orderType === 'stock')
  /** 样品订单不建 BOM：按客户来图编制临时工艺路线试做，转量产时才提 BOM 申请 */
  const isSample = computed(() => form.orderType === 'sample')

  const needFreeFields = computed(
    () => !isFormal.value && !isStock.value && form.chargeMode !== 'charged',
  )

  /** 需要上传客户订单原件：模具 / 正式订单一律要；样品订单只要有价格就要 */
  const needPoFile = computed(
    () =>
      isFormal.value ||
      form.orderType === 'mold' ||
      (isSample.value && Number(form.originalUnitPrice || '0') > 0),
  )

  return { isFormal, isStock, isSample, needFreeFields, needPoFile }
}
