import type { OrderChangeType } from '@prisma/client'

/**
 * 订单修改申请的可改范围（业务规格 4.6）。
 *
 * > **锁定字段：现有订单的价格和下单产品不能被修改**——订单修改申请只能改数量、交期等；
 * > 如需改价或换产品，须先走报价单修改申请形成新报价版本。
 * > 改图、改材料、改表面处理属于 ECN，不走订单修改。
 *
 * 所以这里维护的是**允许改什么**的白名单，而不是「禁止改什么」的黑名单——
 * 白名单漏了一项只是少一种申请类型，黑名单漏了一项就是让价格被改掉。
 */
export const ALLOWED_CHANGE_TYPES = [
  'QUANTITY',
  'DELIVERY',
  'SHIP_TO',
  'PACKING',
  'CANCEL',
] as const satisfies readonly OrderChangeType[]

export const CHANGE_TYPE_LABEL: Record<OrderChangeType, string> = {
  QUANTITY: '数量',
  DELIVERY: '交期',
  SHIP_TO: '收货信息',
  PACKING: '包装要求',
  CANCEL: '取消订单',
}

/** 被明确挡在订单修改之外的诉求，报错时按这张表给出正确去处。 */
export const REDIRECTED_INTENTS: Record<string, string> = {
  price: '改价格请走报价单修改申请（业务规格 2.5），形成新报价版本后再按订单换版处理',
  product: '换产品请走报价单修改申请，重新报价后另行下单',
  drawing: '改图纸请走 ECN 申请（业务规格第 6 章）',
  material: '改材料请走 ECN 申请',
  finishing: '改表面处理请走 ECN 申请',
}

export function isAllowedChangeType(value: string): value is OrderChangeType {
  return (ALLOWED_CHANGE_TYPES as readonly string[]).includes(value)
}
