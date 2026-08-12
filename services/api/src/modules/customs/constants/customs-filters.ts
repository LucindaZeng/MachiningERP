import type { CustomsStatus } from '@prisma/client'

/** 列表筛选可用的状态值；放 constants/ 里，controller 与 DTO 因此不必 import @prisma/client。 */
export const CUSTOMS_STATUS_VALUES = [
  'DRAFT',
  'CHECKING',
  'GENERATED',
  'DECLARED',
  'RELEASED',
] as const satisfies readonly CustomsStatus[]

export type CustomsStatusFilter = (typeof CUSTOMS_STATUS_VALUES)[number]

export const CUSTOMS_STATUS_BY_WIRE = {
  draft: 'DRAFT',
  checking: 'CHECKING',
  generated: 'GENERATED',
  declared: 'DECLARED',
  released: 'RELEASED',
} as const satisfies Record<string, CustomsStatus>

export const CUSTOMS_STATUS_TO_WIRE = Object.fromEntries(
  Object.entries(CUSTOMS_STATUS_BY_WIRE).map(([wire, status]) => [status, wire]),
) as Record<CustomsStatus, keyof typeof CUSTOMS_STATUS_BY_WIRE>

export const DEFAULT_LIST_LIMIT = 200
