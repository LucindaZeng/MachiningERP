/**
 * 回款读端口（业务规格第 7 章「预付/现金客户未收款到位时阻断出货」）。
 *
 * finance 模块尚未落地，因此这里同样只声明**读**契约 +
 * 一个明确标注的 stub provider（见 stub-receipt.adapter.ts）。
 * 对账单的「回款」明细也走这个端口，两处口径因此天然一致。
 */
export interface ReceiptSummary {
  /** 该订单/客户已收到的金额（最小货币单位） */
  receivedMinor: bigint
  currency: string
}

export interface ReceiptEntry {
  occurredAt: Date
  docNo: string
  /** 回款金额取正数，落到对账单明细时再取负 */
  amountMinor: bigint
  remark: string | null
}

export interface ReceiptPort {
  /** 某订单目前已收款合计；用于预付/现金客户的出货信用闸门 */
  receivedForOrder(orderId: string): Promise<ReceiptSummary>
  /** 某客户某期间的回款流水；用于对账单 */
  receiptsInPeriod(customerId: string, from: Date, to: Date): Promise<ReceiptEntry[]>
  /** 某客户当前逾期未收金额；用于对账单的 overdueAmount */
  overdueForCustomer(customerId: string): Promise<bigint>
}

export const RECEIPT_PORT = Symbol('RECEIPT_PORT')
