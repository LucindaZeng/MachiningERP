import type { SalesReturnStatus } from '@prisma/client'

/**
 * 列表筛选可用的状态值。放在 constants/ 里，
 * controller 与 DTO 因此都不需要 import @prisma/client（模块边界检查会拦）。
 */
export const RETURN_STATUS_VALUES = [
  'REGISTERED',
  'QUALITY_JUDGING',
  'DISPOSITION',
  'EXECUTING',
  'CLOSED',
  'REJECTED',
] as const satisfies readonly SalesReturnStatus[]

export type ReturnStatusFilter = (typeof RETURN_STATUS_VALUES)[number]

export const RESPONSIBILITY_VALUES = ['COMPANY', 'CUSTOMER', 'SUPPLIER', 'UNDECIDED'] as const

export const DISPOSITION_VALUES = [
  'REFUND',
  'REPLACEMENT',
  'REWORK',
  'CONCESSION',
  'SCRAP',
  'UNDECIDED',
] as const

/** 前端状态线上值 → 枚举，供 controller 翻译查询参数。 */
export const RETURN_STATUS_BY_WIRE = {
  registered: 'REGISTERED',
  'quality-judging': 'QUALITY_JUDGING',
  disposition: 'DISPOSITION',
  executing: 'EXECUTING',
  closed: 'CLOSED',
  rejected: 'REJECTED',
} as const satisfies Record<string, SalesReturnStatus>

export const RETURN_STATUS_TO_WIRE = Object.fromEntries(
  Object.entries(RETURN_STATUS_BY_WIRE).map(([wire, status]) => [status, wire]),
) as Record<SalesReturnStatus, keyof typeof RETURN_STATUS_BY_WIRE>
