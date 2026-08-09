import { parseDecimal } from '@machining-erp/shared'

export interface QuotationRuleIssue {
  field: string
  message: string
}

export interface TierInput {
  /** 起订量，decimal 字符串 */
  minQuantity: string
  unitPriceMinor: bigint
  /** 该档对应的单件成本（来自成本分析行） */
  unitCostMinor: bigint
  label?: string | null
}

export interface QuotationItemInput {
  productName: string
  drawingNo: string
  /** 图纸版本 id。业务规格 2.2：报价单**强制上传图纸**，缺图纸不能提交 */
  drawingVersionId: string | null
  costAnalysisLineId: string | null
  tiers: TierInput[]
}

export interface QuotationDraftInput {
  customerId: string
  /** 业务规格 2.2 第 6 条：每一份报价单**强制关联成本分析** */
  costAnalysisId: string | null
  items: QuotationItemInput[]
}

/**
 * 阶梯价校验：数量段必须递增且不重复，价格与成本不能为负。
 * 非阶梯报价即只有一档，同样走这套校验。
 */
function checkTiers(issues: QuotationRuleIssue[], item: QuotationItemInput, index: number): void {
  const prefix = `items[${index}]`

  if (item.tiers.length === 0) {
    issues.push({ field: `${prefix}.tiers`, message: `第 ${index + 1} 行产品至少要有一档报价` })
    return
  }

  let previous: ReturnType<typeof parseDecimal> | null = null
  item.tiers.forEach((tier, tierIndex) => {
    const quantity = parseDecimal(tier.minQuantity, '起订量')

    if (quantity.lessThanOrEqualTo(0)) {
      issues.push({
        field: `${prefix}.tiers[${tierIndex}].minQuantity`,
        message: `第 ${index + 1} 行第 ${tierIndex + 1} 档的起订量必须大于 0`,
      })
    }
    if (previous && quantity.lessThanOrEqualTo(previous)) {
      issues.push({
        field: `${prefix}.tiers[${tierIndex}].minQuantity`,
        message: `第 ${index + 1} 行的阶梯数量段必须递增且不重复`,
      })
    }
    if (tier.unitPriceMinor < 0n) {
      issues.push({
        field: `${prefix}.tiers[${tierIndex}].unitPrice`,
        message: `第 ${index + 1} 行第 ${tierIndex + 1} 档的报价不能为负`,
      })
    }
    previous = quantity
  })
}

/** 建单/改单时的结构校验。返回全部问题，界面一次性提示。 */
export function validateQuotationDraft(input: QuotationDraftInput): QuotationRuleIssue[] {
  const issues: QuotationRuleIssue[] = []

  // 硬校验一：无成本分析不能创建、不能提交审核
  if (!input.costAnalysisId) {
    issues.push({
      field: 'costAnalysisId',
      message: '报价单必须关联成本分析，请先由报价工程师完成核价',
    })
  }

  if (input.items.length === 0) {
    issues.push({ field: 'items', message: '报价单至少要有一行产品' })
  }

  input.items.forEach((item, index) => {
    if (!item.productName?.trim()) {
      issues.push({ field: `items[${index}].productName`, message: `第 ${index + 1} 行缺产品名称` })
    }
    // 硬校验二：报价单强制上传图纸
    if (!item.drawingVersionId) {
      issues.push({
        field: `items[${index}].drawingVersionId`,
        message: `第 ${index + 1} 行「${item.productName || item.drawingNo}」缺图纸，报价单必须上传图纸`,
      })
    }
    checkTiers(issues, item, index)
  })

  return issues
}

export interface BelowCostViolation {
  itemIndex: number
  tierIndex: number
  productName: string
  minQuantity: string
  unitPriceMinor: bigint
  unitCostMinor: bigint
  shortfallMinor: bigint
}

/**
 * 低于成本价检测（业务规格 2.4）。
 *
 * 「业务员可自由填入最终报价价格；**低于成本价时系统提示，要求修改成本分析**。」
 * 所以这里不是静默放过、也不是直接改价，而是把每一档的缺口列清楚，
 * 由业务去发起报价单修改申请、报价工程师重核成本分析。
 */
export function findBelowCostTiers(items: readonly QuotationItemInput[]): BelowCostViolation[] {
  const violations: BelowCostViolation[] = []

  items.forEach((item, itemIndex) => {
    item.tiers.forEach((tier, tierIndex) => {
      if (tier.unitPriceMinor >= tier.unitCostMinor) return

      violations.push({
        itemIndex,
        tierIndex,
        productName: item.productName,
        minQuantity: tier.minQuantity,
        unitPriceMinor: tier.unitPriceMinor,
        unitCostMinor: tier.unitCostMinor,
        shortfallMinor: tier.unitCostMinor - tier.unitPriceMinor,
      })
    })
  })

  return violations
}

export function describeBelowCost(violations: readonly BelowCostViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.productName}（起订量 ${parseDecimal(violation.minQuantity, '起订量').toFixed()}）` +
        `报价 ${formatYuan(violation.unitPriceMinor)} 低于成本 ${formatYuan(violation.unitCostMinor)}，` +
        `缺口 ${formatYuan(violation.shortfallMinor)}`,
    )
    .join('；')
}

function formatYuan(minor: bigint): string {
  return parseDecimal(minor.toString(), '金额').div(100).toFixed(2)
}
