import type { Money } from '@machining-erp/shared'

export interface QuotationTierView {
  minQuantity: string
  unitPrice: Money
  /**
   * 单件成本与毛利。**只在有 `quote.costing.edit` 或审核权限时下发**，
   * 普通查看者拿到的对象里整组字段直接缺席，而不是给 0——
   * 缺席才能让「不该看到成本」在序列化出口就成为结构性事实。
   */
  cost?: { unitCost: Money; grossMarginBps: number }
  label: string | null
}
