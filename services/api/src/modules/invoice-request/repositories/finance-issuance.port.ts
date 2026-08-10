/**
 * 财务开票执行端口（业务规格第 9 章「申请流转财务开票」「红冲/作废由财务执行」）。
 *
 * 我方系统负责**申请、校验、留痕**；真正在税控系统里开出票据是财务的动作。
 * finance 模块（以及将来的税控对接）落地前，这里只声明契约 + 一个
 * 明确标注语义的 stub，语义与 shipment 的 QC / 回款 stub 一致。
 */
export interface FinanceIssuanceRequest {
  invoiceId: string
  docNo: string
  customerId: string
  invoiceKind: string
  amountIncTaxMinor: bigint
  currency: string
  /** 红字发票为负数，且带上被冲的原票号 */
  originalDocNo: string | null
}

export interface FinanceIssuanceResult {
  /** 税控系统回写的发票号；stub 阶段由人工在界面回填，故可为空 */
  invoiceNo: string | null
  acceptedAt: Date
}

export interface FinanceIssuancePort {
  /** 把申请推给财务。返回受理回执，不代表已开票。 */
  submitForIssuance(request: FinanceIssuanceRequest): Promise<FinanceIssuanceResult>
}

export const FINANCE_ISSUANCE_PORT = Symbol('FINANCE_ISSUANCE_PORT')
