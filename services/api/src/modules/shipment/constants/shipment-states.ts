import { StateMachine } from '../../../platform/state-machine'

import type { ShipmentStatus } from '@prisma/client'

/**
 * 出货单状态机（业务规格第 7 章 / SHP-01~06）。
 *
 * 七态与前端 `ShipmentStatus` 一一对应——界面是设计基线，后端照着它建。
 * 唯一的「闸门」在 PACKED → SHIPPED：品质放行与财务信用两道检查都过才放行，
 * 其余迁移只是节点推进。没有任何一条边允许手工填进度，进度只能靠动作端点推。
 */
export const SHIPMENT_TRANSITIONS = {
  PLANNED: ['PICKING'],
  PICKING: ['PACKED'],
  /// 双闸门在这一步：assertShippable 通过后才允许迁到 SHIPPED
  PACKED: ['SHIPPED'],
  SHIPPED: ['SIGNED'],
  /// 签收后既可以先开票再结案，也可以无票直接商业关闭（模具第二期等场景）
  SIGNED: ['INVOICED', 'CLOSED'],
  INVOICED: ['CLOSED'],
  CLOSED: [],
} as const satisfies Record<ShipmentStatus, readonly ShipmentStatus[]>

export const shipmentStateMachine = new StateMachine<ShipmentStatus>(
  '出货单',
  SHIPMENT_TRANSITIONS,
)

/** 明细行只有在出库前可以改；一旦发出，数量就是应收依据的一部分。 */
export function isShipmentEditable(status: ShipmentStatus): boolean {
  return status === 'PLANNED' || status === 'PICKING'
}

/** 已实际发出货物：订单回写与应收依据都以此为界。 */
export function hasLeftFactory(status: ShipmentStatus): boolean {
  return status === 'SHIPPED' || status === 'SIGNED' || status === 'INVOICED' || status === 'CLOSED'
}
