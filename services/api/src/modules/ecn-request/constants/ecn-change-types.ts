import { ECN_ERRORS } from '@machining-erp/shared'

import { BizError } from '../../../common/errors/biz-error'

import type { EcnChangeType } from '@prisma/client'

/**
 * ECN 的受理范围（业务规格第 6 章）。
 *
 * 这张表是 contract-order 里 `REDIRECTED_INTENTS` 的**反方向**：那边把
 * 「改图/改材料/改表面处理」推回 ECN，这边把「改数量/改交期/改包装/改价格」
 * 推回订单修改与报价变更。两张表必须对得上，否则会出现两个模块互相推诿、
 * 用户在中间来回换字眼重提的情况。
 */
export const ECN_CHANGE_TYPES = ['DRAWING', 'MATERIAL', 'SURFACE', 'PROCESS'] as const

export const ECN_CHANGE_TYPE_LABEL: Record<EcnChangeType, string> = {
  DRAWING: '图纸版本',
  MATERIAL: '材料牌号',
  SURFACE: '表面处理',
  PROCESS: '工艺 / 工序（随图纸同步）',
}

/**
 * 明确挡在 ECN 之外的诉求 → 正确去处。
 *
 * 键用前端那套小写枚举值：越界请求是**前端传上来**的，
 * 报错要能直接对上用户在界面上选的那一项。
 */
export const REDIRECTED_INTENTS: Record<string, string> = {
  quantity: '改数量请走「订单管理 → 订单修改申请（ORC）」（业务规格 4.6）',
  delivery: '改交期请走「订单管理 → 订单修改申请（ORC）」（业务规格 4.6）',
  shipTo: '改收货信息请走「订单管理 → 订单修改申请（ORC）」',
  packing: '改包装要求请走「订单管理 → 订单修改申请（ORC）」',
  cancel: '取消订单请走「订单管理 → 订单修改申请（ORC）」',
  price: '改价格请走「报价管理 → 报价单修改申请（QRC）」（业务规格 2.5），由报价工程师改成本分析后重新报价',
  requirement: '客户其它要求变更请按落点选择：涉及订单信息走订单修改申请，涉及价格走报价单修改申请',
}

export function isEcnChangeType(value: string): value is EcnChangeType {
  return (ECN_CHANGE_TYPES as readonly string[]).includes(value)
}

/**
 * 受理范围硬闸门。
 *
 * 越界时**必须点名正确去处**——只说「不受理」，用户会把同一张单换个字眼再提一次，
 * 而那次多半就蒙混过去了。
 */
export function assertEcnChangeType(value: string): EcnChangeType {
  if (isEcnChangeType(value)) return value

  const hint = REDIRECTED_INTENTS[value]
  throw new BizError(ECN_ERRORS.OUT_OF_SCOPE, {
    message: hint
      ? `「${value}」不属于工程变更申请的受理范围：${hint}`
      : `「${value}」不属于工程变更申请的受理范围；ECN 只受理改图、改材料、改表面处理与随之同步的工艺变更`,
    details: { changeType: value, allowed: ECN_CHANGE_TYPES },
  })
}

/** 改图必须给出新版图纸——「变更后」不能只是一句描述。 */
export function requiresNewDrawing(changeType: EcnChangeType): boolean {
  return changeType === 'DRAWING'
}

/** 中途改工序只能对指定批次版本生效，否则已投产批次会被无声地改掉。 */
export function requiresEffectiveBatch(changeType: EcnChangeType): boolean {
  return changeType === 'PROCESS'
}

/**
 * 改图必须联动改工艺路线（第 6 章硬规则）。
 *
 * 只对 DRAWING 生效：改材料/改表面处理不必然动工艺路线，
 * 而 PROCESS 本身改的就是工艺路线，再要求它「同步工艺路线」是同义反复。
 */
export function requiresRoutingSync(changeType: EcnChangeType): boolean {
  return changeType === 'DRAWING'
}
