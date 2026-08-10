import type { ShipmentStatus, StatementStatus } from '@prisma/client'

/**
 * 列表过滤用的枚举字面量。放在 constants/ 是为了让 controller 的 DTO
 * 拿得到取值范围而不必 import @prisma/client（controller 只做 HTTP 编解码）。
 */
export const SHIPMENT_STATUS_VALUES = [
  'PLANNED',
  'PICKING',
  'PACKED',
  'SHIPPED',
  'SIGNED',
  'INVOICED',
  'CLOSED',
] as const satisfies readonly ShipmentStatus[]

export type ShipmentStatusFilter = (typeof SHIPMENT_STATUS_VALUES)[number]

export const STATEMENT_STATUS_VALUES = [
  'DRAFT',
  'SENT',
  'CONFIRMED',
  'DISPUTED',
  'SETTLED',
] as const satisfies readonly StatementStatus[]

export type StatementStatusFilter = (typeof STATEMENT_STATUS_VALUES)[number]

export const DEFAULT_LIST_LIMIT = 200
