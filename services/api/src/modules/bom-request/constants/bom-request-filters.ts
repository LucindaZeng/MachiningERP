/** 列表查询枚举。放 constants/ 让 controller 不必 import @prisma/client，DTO 也只导出一个类型。 */
export const BOM_STATUS_VALUES = [
  'DRAFT',
  'SUBMITTED',
  'CLAIMED',
  'RETURNED',
  'BOM_DONE',
  'ALL_DONE',
  'ORDERED',
] as const
export const PRODUCTION_TYPE_VALUES = ['BATCH', 'MOLD'] as const

export type BomStatusFilter = (typeof BOM_STATUS_VALUES)[number]
export type BomProductionTypeFilter = (typeof PRODUCTION_TYPE_VALUES)[number]
