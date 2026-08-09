import type { DocStatus, TimelineNode } from './common.types'

/* ------------------------------ 订单 ORD ------------------------------ */

export type OrderType = 'mold' | 'sample' | 'formal' | 'stock'
export type ChargeMode = 'charged' | 'free' | 'partial' | 'deferred' | 'deposit' | 'internal'

export interface HkPricing {
  /** 触发条件是否成立：客户已勾选 且 订单类型=正式 */
  applied: boolean
  factor: number
  originalUnitPrice: string
  finalUnitPrice: string
  roundingRule: string
  calculatedAt?: string
  priceVersion: string
  customerFlagSnapshot: boolean
  orderTypeSnapshot: OrderType
}

/** 订单明细行：一张单可以下多项产品 */
export interface OrderLine {
  seq: number
  productName: string
  drawingNo: string
  /** 品号：只有正式订单的产品才有；样品为空，模具为模具编号 */
  itemCode?: string
  quantity: string
  /** 客户原始单价（HK 客户的 70% 由系统按原价折算，禁止手工先折） */
  unitPrice: string
  amount: string
  deliveryDate: string
  remark?: string
}

export interface SalesOrder {
  id: string
  docNo: string
  customerCode: string
  customerName: string
  orderType: OrderType
  chargeMode: ChargeMode
  productName: string
  drawingNo: string
  /**
   * 品号（产品编码）：只有正式订单的产品才有。
   * 样品订单无品号，仅以图号 + 样品单号标识；
   * 模具订单用模具编号；备料订单必须引用已存在的品号。
   */
  itemCode?: string
  quantity: string
  currency: string
  taxRate: number
  unitPrice: string
  amount: string
  deliveryDate: string
  quotationNo?: string
  customerPoNo?: string
  costOwner?: string
  freeReason?: string
  estimatedCost?: string
  status: DocStatus
  owner: string
  t0?: string
  hk: HkPricing
  timeline: TimelineNode[]
  reviewRounds: number
  /** 正式订单关联的备料订单与加权平均成本；备料订单本身为空 */
  stockLink?: StockLink
  /** 备料订单专用：完工入库数量，达到订单数量即视为完成 */
  stockedQty?: string
  /** 一单多产品：明细行；单产品订单也会写入一行，保证口径统一 */
  lines?: OrderLine[]
  /** 客户订单原件附件（模具 / 正式订单强制；样品订单有价格时强制） */
  poFile?: string
}

/** 备料订单库存：完工入库后可被正式订单领用，直到用完 */
export interface StockOrder {
  id: string
  docNo: string
  productName: string
  drawingNo: string
  totalQty: string
  usedQty: string
  remainingQty: string
  /** 备料订单的单件生产成本 */
  unitCost: string
  currency: string
  status: 'producing' | 'stocked' | 'consumed'
  completedAt?: string
  owner: string
}

/** 正式订单领用备料后的加权平均成本明细 */
export interface StockLink {
  stockOrderNo: string
  /** 本次领用的备料数量 */
  usedQty: string
  stockUnitCost: string
  /** 需新投产数量 = 订单数量 − 领用数量 */
  produceQty: string
  produceUnitCost: string
  /** 加权平均单件成本 = (备料成本×领用数 + 新产成本×新产数) / 订单数量 */
  blendedUnitCost: string
}
