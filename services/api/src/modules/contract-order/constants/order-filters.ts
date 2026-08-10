/** 列表查询用的枚举字面量。放 constants/ 是因为 dto 与 controller 都要用，且 DTO 文件只许导出一个类型。 */
export const ORDER_TYPE_VALUES = ['FORMAL', 'SAMPLE', 'MOLD', 'STOCK_PREP'] as const
export const ORDER_STATUS_VALUES = [
  'DRAFT',
  'MANAGER_REVIEW',
  'FINANCE_REVIEW',
  'GM_REVIEW',
  'CROSS_REVIEW',
  'APPROVED',
  'EXECUTING',
  'COMPLETED',
  'CLOSED',
  'REJECTED',
  'VOID',
] as const

export type OrderTypeFilter = (typeof ORDER_TYPE_VALUES)[number]
export type OrderStatusFilter = (typeof ORDER_STATUS_VALUES)[number]
