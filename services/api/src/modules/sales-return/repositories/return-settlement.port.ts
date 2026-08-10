/**
 * 退货财务处置执行端口（业务规格第 8 章「退货结果联动财务：退款、折让、补发不另收费」）。
 *
 * 我方系统负责**判定、审批、留痕与对账口径**；真正把钱打出去、
 * 把折让挂到应收上，是财务的动作。finance 模块落地前，这里只声明契约 +
 * 一个明确标注语义的 stub，与 shipment 的 QC / 回款、invoice-request 的
 * 开票 stub 是同一套写法。
 *
 * **注意口径边界**：对账单上那笔扣减不经过这个端口——它由结案的 RMA 行直接产生
 * （见 return-statement-source.ts）。这个端口负责的是「钱实际怎么走」，
 * 两者互不代替：财务还没打款，客户对账单上的扣减照样成立。
 */
export interface ReturnSettlementLine {
  lineId: string
  sequence: number
  productName: string
  /** REFUND / CONCESSION / SCRAP 之一；其余处置不动钱，不会走到这里 */
  disposition: string
  /** 扣减金额（正数，最小货币单位） */
  deductionMinor: bigint
  reason: string
}

export interface ReturnSettlementRequest {
  returnId: string
  docNo: string
  customerId: string
  currency: string
  lines: ReturnSettlementLine[]
}

export interface ReturnSettlementResult {
  /** 财务侧的受理凭据；stub 阶段为 null，表示只登记不执行 */
  settlementNo: string | null
  acceptedAt: Date
}

export interface ReturnSettlementPort {
  /** 把结案后的财务处置推给财务。返回受理回执，不代表款已付。 */
  submitSettlement(request: ReturnSettlementRequest): Promise<ReturnSettlementResult>
}

export const RETURN_SETTLEMENT_PORT = Symbol('RETURN_SETTLEMENT_PORT')
