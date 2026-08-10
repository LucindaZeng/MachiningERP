import type { TailPlan } from '@prisma/client'

/**
 * 尾数四路径（V2.4 尾数规则）。前端用连字符小写，库里用 Prisma 枚举，
 * 映射表放在这里，两边都不各写一份。第五种处置方式不存在——
 * 真有第五种，就意味着某张单永远结不了案。
 */
export const TAIL_PLAN_BY_WIRE = {
  rework: 'REWORK',
  stock: 'STOCK',
  'direct-stock': 'DIRECT_STOCK',
  scrap: 'SCRAP',
} as const satisfies Record<string, TailPlan>

export type TailPlanWire = keyof typeof TAIL_PLAN_BY_WIRE

export const TAIL_PLAN_TO_WIRE: Record<TailPlan, TailPlanWire> = {
  REWORK: 'rework',
  STOCK: 'stock',
  DIRECT_STOCK: 'direct-stock',
  SCRAP: 'scrap',
}

export const TAIL_PLAN_LABEL: Record<TailPlan, string> = {
  REWORK: '返工补交',
  STOCK: '入库待后续订单',
  DIRECT_STOCK: '直接入库',
  SCRAP: '报废',
}

export function isTailPlanWire(value: string): value is TailPlanWire {
  return Object.prototype.hasOwnProperty.call(TAIL_PLAN_BY_WIRE, value)
}
