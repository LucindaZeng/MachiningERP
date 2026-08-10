import type { SalesOrderLineView } from './sales-order-line-view.dto'
import type { Money } from '@machining-erp/shared'

/**
 * 订单对外表示。金额一律「定点字符串 + 币种」。
 *
 * 注意这里**没有任何香港 70% 相关字段**——该能力已按产品决定整体移除。
 */
export interface SalesOrderView {
  id: string
  docNo: string
  customerId: string
  orderType: string
  chargeMode: string
  customerPoNo: string | null
  customerPoFile: string | null
  currency: string
  taxRate: number
  internalDueDate: string | null
  costOwner: string | null
  freeReason: string | null
  estimatedCost: Money | null
  status: string
  /** 审批链 T0 */
  submittedAt: string | null
  submittedBy: string | null
  approvedAt: string | null
  rejectReason: string | null
  /** 备料订单：已完工入库数量 / 库存状态 */
  stockedQty: string | null
  stockStatus: string | null
  /** 整单金额合计 */
  totalAmount: Money
  lines: SalesOrderLineView[]
  versionLock: number
}
