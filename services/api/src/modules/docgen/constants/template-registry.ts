/**
 * 受控模板清单。
 *
 * **版式的唯一真相是 templates/ 下的 .xlsx 文件**，本文件只登记
 * 「有哪些模板、文件名是什么、当前是第几版」。业务要改版式，改文件、
 * 把 `version` 加一即可，代码一行都不用动（改法见本模块 README）。
 *
 * `version` 会随生成记录一起落库：日后客户拿着一份旧单来问「这数怎么算的」，
 * 得先知道它是用哪一版模板出的。
 */

export const DOCGEN_TEMPLATES = {
  QUOTATION_DOMESTIC: 'QUOTATION_DOMESTIC',
  QUOTATION_OVERSEAS: 'QUOTATION_OVERSEAS',
  COST_ANALYSIS_CNC: 'COST_ANALYSIS_CNC',
  STATEMENT: 'STATEMENT',
  CUSTOMS_PROFORMA_INVOICE: 'CUSTOMS_PROFORMA_INVOICE',
  CUSTOMS_COMMERCIAL_INVOICE: 'CUSTOMS_COMMERCIAL_INVOICE',
  CUSTOMS_PACKING_LIST: 'CUSTOMS_PACKING_LIST',
  CUSTOMS_CONTRACT: 'CUSTOMS_CONTRACT',
  CUSTOMS_DATA_PACK: 'CUSTOMS_DATA_PACK',
  QUOTATION_MERGE: 'QUOTATION_MERGE',
  COST_ANALYSIS_MERGE: 'COST_ANALYSIS_MERGE',
} as const

export type DocgenTemplateId = (typeof DOCGEN_TEMPLATES)[keyof typeof DOCGEN_TEMPLATES]

export interface TemplateDefinition {
  /** templates/ 下的文件名 */
  fileName: string
  /** 模板版本；改了 .xlsx 就加一 */
  version: number
  /** 出具后的文件名前缀（中文，客户会看到） */
  label: string
  /** 阶梯价列数上限；超出的档位不出现在这份模板上 */
  tierColumns?: number
  /** 工艺成本列数上限 */
  processColumns?: number
}

/**
 * 形式发票与商业发票共用一个文件：字段与版式完全一致，
 * 差别在**出具时点与法律含义**（形式发票出货前按订单开，商业发票出货后按实发数开），
 * 那两件事由 customs 模块的闸门管，不该靠两份长得一样的模板去表达。
 */
export const TEMPLATE_DEFINITIONS: Record<DocgenTemplateId, TemplateDefinition> = {
  QUOTATION_DOMESTIC: {
    fileName: 'quotation-domestic.xlsx',
    version: 1,
    label: '报价单',
    tierColumns: 2,
  },
  QUOTATION_OVERSEAS: {
    fileName: 'quotation-overseas.xlsx',
    version: 1,
    label: 'Quotation',
    tierColumns: 5,
  },
  COST_ANALYSIS_CNC: {
    fileName: 'cost-analysis-cnc.xlsx',
    version: 1,
    label: '成本分析',
    processColumns: 6,
  },
  STATEMENT: { fileName: 'statement.xlsx', version: 1, label: '对账单' },
  CUSTOMS_PROFORMA_INVOICE: {
    fileName: 'customs-invoice.xlsx',
    version: 1,
    label: '形式发票',
  },
  CUSTOMS_COMMERCIAL_INVOICE: {
    fileName: 'customs-invoice.xlsx',
    version: 1,
    label: '商业发票',
  },
  CUSTOMS_PACKING_LIST: { fileName: 'customs-packing-list.xlsx', version: 1, label: '装箱单' },
  CUSTOMS_CONTRACT: { fileName: 'customs-contract.xlsx', version: 1, label: '出口合同' },
  CUSTOMS_DATA_PACK: { fileName: 'customs-data-pack.xlsx', version: 1, label: '报关单要素表' },
  QUOTATION_MERGE: { fileName: 'quotation-merge.xlsx', version: 1, label: '报价合并比较表' },
  COST_ANALYSIS_MERGE: {
    fileName: 'cost-analysis-merge.xlsx',
    version: 1,
    label: '成本分析合并比较表',
  },
}

/** 报价模板按国内/国外选。模板值来自 quotation 的 `QUOTATION_TEMPLATES`。 */
export function quotationTemplateOf(template: string): DocgenTemplateId {
  return template === 'OVERSEAS'
    ? DOCGEN_TEMPLATES.QUOTATION_OVERSEAS
    : DOCGEN_TEMPLATES.QUOTATION_DOMESTIC
}

/** 报关文件种类 → 模板。与 customs 的 `CustomsDocKind` 一一对应。 */
export const CUSTOMS_TEMPLATE_BY_KIND: Record<string, DocgenTemplateId> = {
  PROFORMA_INVOICE: DOCGEN_TEMPLATES.CUSTOMS_PROFORMA_INVOICE,
  COMMERCIAL_INVOICE: DOCGEN_TEMPLATES.CUSTOMS_COMMERCIAL_INVOICE,
  PACKING_LIST: DOCGEN_TEMPLATES.CUSTOMS_PACKING_LIST,
  CONTRACT: DOCGEN_TEMPLATES.CUSTOMS_CONTRACT,
  DATA_PACK: DOCGEN_TEMPLATES.CUSTOMS_DATA_PACK,
}

/** 合并导出一次最多几份。上限存在的理由是内存：一次点选整年报价会把进程拖垮。 */
export const MERGE_EXPORT_LIMIT = 200

export function isDocgenTemplateId(value: string): value is DocgenTemplateId {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_DEFINITIONS, value)
}
