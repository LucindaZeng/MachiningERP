import type { DocStatus, TimelineNode } from './common.types'
import type { OrderType } from './order.types'

/* ---------------- 订单修改申请（ORC）---------------- */

/**
 * 订单信息变更：数量、交期、单价、收费方式、收货信息、包装要求、取消订单。
 * 与 ECN 的分工：改图 / 改材料 / 改表面处理属于产品变更走 ECN；
 * 这里只改订单本身，不改产品，因此不发布新图纸版本，但可能触发重新核价与订单重新审批。
 */
export type OrderChangeType = 'quantity' | 'delivery' | 'shipTo' | 'packing' | 'cancel'

export interface OrderChangeImpact {
  scope: string
  quantity: string
  amount: string
  note: string
}

export interface OrderChangeRequest {
  id: string
  docNo: string
  orderNo: string
  customerName: string
  productName: string
  drawingNo: string
  orderType: OrderType
  changeType: OrderChangeType
  origin: 'customer' | 'internal'
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  impacts: OrderChangeImpact[]
  /** 是否触发重新核价 / 订单重新审批 */
  needRequote: boolean
  needReapproval: boolean
  /** 变更是否已同步给 PMC 重排计划 */
  planSynced: boolean
  /** 变更产生的费用由谁承担 */
  costOwner: '客户承担' | '公司承担' | '双方分摊' | '无额外费用'
  status: DocStatus
  owner: string
  submittedAt: string
  timeline: TimelineNode[]
}

/* ---------------- 发票申请（INV）---------------- */

export type InvoiceType = 'special' | 'general' | 'export' | 'proforma'

export interface InvoiceLine {
  seq: number
  shipmentNo: string
  productName: string
  drawingNo: string
  quantity: string
  unitPrice: string
  amount: string
  taxRate: number
  taxAmount: string
}

/**
 * 发票申请：业务按已签收出货单发起，财务开票并回写发票号。
 * 开票金额必须与出货单、对账单三者一致；差异需先在对账单处理完再开票。
 */
export interface InvoiceRequest {
  id: string
  docNo: string
  customerName: string
  customerCode: string
  invoiceType: InvoiceType
  /** 关联对账单（按期间开票时必填） */
  statementNo?: string
  lines: InvoiceLine[]
  amountExTax: string
  taxAmount: string
  amountIncTax: string
  currency: string
  /** 开票信息 */
  title: string
  taxNo: string
  bankAccount?: string
  address?: string
  /** 交付方式：电子发票邮箱 / 纸质快递 */
  deliveryMethod: '电子发票（邮箱）' | '纸质发票（快递）'
  deliveryTarget: string
  /** 财务回写 */
  invoiceNo?: string
  issuedAt?: string
  /** 与出货 / 对账金额是否一致，不一致禁止开票 */
  amountMatched: boolean
  matchNote?: string
  expectedPaymentDate: string
  status: DocStatus
  owner: string
  submittedAt: string
  timeline: TimelineNode[]
  /** 正票还是红字发票；红字发票金额为负，与正票同列显示 */
  kind?: 'invoice' | 'credit-note'
  /** 红字发票指向的原票号 */
  originalDocNo?: string
  /** 作废或红冲的理由 */
  voidReason?: string
}
