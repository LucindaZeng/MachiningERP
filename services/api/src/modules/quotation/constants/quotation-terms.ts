/**
 * 报价单条款。国内模板表尾的固定条款区（example/报价单模板/国内报价单.xls）：
 * 代工方式、付款方式、允许报废率、废料是否退还、有效期限。
 *
 * 放在 constants/ 而不是 dto/ 或 repositories/：入参 DTO、仓储端口、视图映射
 * 三处都要用同一个形状，沉到最底层才不会出现层间互相 import。
 */
export interface QuotationTerms {
  /** 代工方式：包工包料 / 来料加工 */
  processingMode?: string
  /** 付款方式，与客户档案的付款条件同一套口径 */
  paymentTerms?: string
  /** 允许报废率（万分比整数），如 300 表示 3% */
  allowedScrapBps?: number
  /** 废料是否退还客户 */
  scrapReturned?: boolean
  /** 交期说明 */
  leadTime?: string
  /** 其他备注 */
  remark?: string
}

/** 报价模板：国内 / 国外两套表头与条款完全不同 */
export const QUOTATION_TEMPLATES = ['DOMESTIC', 'OVERSEAS'] as const
export type QuotationTemplate = (typeof QUOTATION_TEMPLATES)[number]

/** 报价单默认有效期（天）。审核通过时若未指定 validUntil 就按这个算。 */
export const DEFAULT_VALID_DAYS = 30
