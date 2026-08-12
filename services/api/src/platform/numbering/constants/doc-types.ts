/**
 * 单据类型字典。每一种单据的编号规则集中在此声明并由 seed 落库，
 * 业务模块只按 docType 取号，禁止各自拼编号（平台服务共享铁律）。
 */
export const DOC_TYPES = {
  ACCOUNT_REQUEST: 'ACR',
  PASSWORD_RESET: 'PWR',
  CUSTOMER: 'CUS',
  CUSTOMER_CHANGE: 'CCR',
  INQUIRY: 'INQ',
  QUOTATION: 'QTN',
  COST_ANALYSIS: 'CST',
  QUOTE_CHANGE_REQUEST: 'QCR',
  SALES_ORDER: 'SO',
  SAMPLE_ORDER: 'SMP',
  MOLD_ORDER: 'MLD',
  STOCK_PREP_ORDER: 'STK',
  ORDER_CHANGE_REQUEST: 'OCR',
  BOM_REQUEST: 'BOMR',
  ECN_REQUEST: 'ECN',
  SHIPMENT: 'SHP',
  SALES_RETURN: 'RMA',
  INVOICE_REQUEST: 'INV',
  /** 报关资料：前缀取 EXP（出口），与前端 fixture 与页面的 EXP-01~04 一致 */
  CUSTOMS_DOSSIER: 'EXP',
  STATEMENT: 'STM',
  /** 用户唯一编码：终身不变、永不复用，因此按年重置但带年份段隔离 */
  USER_CODE: 'USER_CODE',
} as const

export type DocType = (typeof DOC_TYPES)[keyof typeof DOC_TYPES]
