import { needsCustomerPo, ruleOf } from '../constants/order-type-rules'

import type { ChargeMode, SalesOrderType } from '@prisma/client'

/**
 * 下单前置校验的单条结论。
 *
 * 刻意返回**清单**而不是抛第一个错：业务规格 4.1 要求「明确列出缺失项」，
 * 一次只报一条会让业务员来回补三四轮。
 */
export interface PrerequisiteIssue {
  /** 定位到具体行；整单级问题为 null */
  sequence: number | null
  field: string
  message: string
}

export interface OrderLineFacts {
  sequence: number
  productName: string
  /** 生效报价单行；缺失即不能下单 */
  quotationItemId: string | null
  /** 报价对应的成本分析；缺失即不能下单 */
  costAnalysisId: string | null
  /** 图纸版本；样品单除外 */
  drawingVersionId: string | null
  /** BOM 申请已确认；样品单除外 */
  bomConfirmed: boolean
  /** 成品品号 */
  itemCode: string | null
  quantity: string
  unitPriceMinor: bigint
  deliveryDate: Date | null
}

export interface OrderFacts {
  orderType: SalesOrderType
  chargeMode: ChargeMode
  customerPoNo: string | null
  customerPoFile: string | null
  internalDueDate: Date | null
  costOwner: string | null
  freeReason: string | null
  estimatedCostMinor: bigint | null
  /** 客户档案是否已补全到可下单（由 masterdata 模块判定后传入） */
  customerReadyForOrder: boolean
  lines: OrderLineFacts[]
}

const CHARGED_MODES: ReadonlySet<ChargeMode> = new Set<ChargeMode>(['CHARGED'])

/**
 * 下单强制校验链（业务规格 4.1）。
 *
 * 「产品若缺少报价单、成本分析或任何工程资料（图纸、BOM——样品单除外），
 * 系统提示报错并禁止下单，明确列出缺失项。」
 *
 * 这里只做**纯计算**，不碰数据库也不抛异常：service 负责把事实查出来喂进来、
 * 把清单包成 BizError。这样这条链能被穷举测试，也能被前端「提交检查清单」
 * 复用同一套口径。
 */
export function collectPrerequisiteIssues(facts: OrderFacts): PrerequisiteIssue[] {
  return [
    ...headerIssues(facts),
    ...facts.lines.flatMap((line) => lineIssues(line, facts.orderType)),
  ]
}

function headerIssues(facts: OrderFacts): PrerequisiteIssue[] {
  const issues: PrerequisiteIssue[] = []
  const rule = ruleOf(facts.orderType)

  if (facts.lines.length === 0) {
    issues.push({ sequence: null, field: 'lines', message: '订单至少要有一行产品明细' })
  }
  if (!facts.customerReadyForOrder) {
    issues.push({
      sequence: null,
      field: 'customerId',
      message: '客户档案未补全，成交下单前必须补全完整档案',
    })
  }

  issues.push(...customerPoIssues(facts))
  issues.push(...chargeIssues(facts))

  // 备料订单没有客户交期，改填内部要求完成时间——但那一项同样必填
  if (!rule.needsCustomerDeliveryDate && !facts.internalDueDate) {
    issues.push({
      sequence: null,
      field: 'internalDueDate',
      message: '备料订单没有客户交期，但必须填写内部要求完成时间',
    })
  }

  return issues
}

function customerPoIssues(facts: OrderFacts): PrerequisiteIssue[] {
  const total = facts.lines.reduce((sum, line) => sum + line.unitPriceMinor, 0n)
  if (!needsCustomerPo(facts.orderType, total)) return []

  const issues: PrerequisiteIssue[] = []
  if (!facts.customerPoNo?.trim()) {
    issues.push({
      sequence: null,
      field: 'customerPoNo',
      message: `${ruleOf(facts.orderType).label}必须关联客户原始订单号`,
    })
  }
  if (!facts.customerPoFile?.trim()) {
    issues.push({
      sequence: null,
      field: 'customerPoFile',
      message: `${ruleOf(facts.orderType).label}必须上传客户订单原件`,
    })
  }
  return issues
}

function chargeIssues(facts: OrderFacts): PrerequisiteIssue[] {
  const issues: PrerequisiteIssue[] = []
  const charged = CHARGED_MODES.has(facts.chargeMode)

  if (ruleOf(facts.orderType).mustBeCharged && !charged) {
    issues.push({
      sequence: null,
      field: 'chargeMode',
      message: '正式业务订单强制收费，不允许免费或部分收费',
    })
    return issues
  }

  // 免费/部分收费：费用承担方、预计成本与原因三者缺一不可
  if (!charged) {
    const missing: string[] = []
    if (!facts.costOwner?.trim()) missing.push('费用承担方')
    if (facts.estimatedCostMinor === null) missing.push('预计成本')
    if (!facts.freeReason?.trim()) missing.push('原因')

    if (missing.length > 0) {
      issues.push({
        sequence: null,
        field: 'chargeMode',
        message: `免费或部分收费时以下为必填：${missing.join('、')}`,
      })
    }
  }

  return issues
}

function lineIssues(line: OrderLineFacts, orderType: SalesOrderType): PrerequisiteIssue[] {
  const rule = ruleOf(orderType)
  const issues: PrerequisiteIssue[] = []
  const at = (field: string, message: string): PrerequisiteIssue => ({
    sequence: line.sequence,
    field,
    message: `第 ${line.sequence} 行「${line.productName}」${message}`,
  })

  // 环环相扣：报价 → 成本分析 → 下单，缺任一环都不能下单
  if (!line.quotationItemId) issues.push(at('quotationItemId', '缺少生效报价单'))
  if (!line.costAnalysisId) issues.push(at('costAnalysisId', '缺少对应的成本分析'))

  // 工程资料：图纸与 BOM——样品单除外
  if (rule.needsBom) {
    if (!line.drawingVersionId) issues.push(at('drawingVersionId', '缺少图纸版本'))
    if (!line.bomConfirmed) issues.push(at('bomRequestNo', '的 BOM 尚未建立完成'))
  }
  if (rule.needsItemCode && !line.itemCode?.trim()) {
    issues.push(at('itemCode', '缺少品号'))
  }

  if (Number(line.quantity) <= 0) issues.push(at('quantity', '数量必须大于 0'))
  if (rule.needsCustomerDeliveryDate && !line.deliveryDate) {
    issues.push(at('deliveryDate', '缺少客户交期'))
  }
  if (rule.mustBeCharged && line.unitPriceMinor <= 0n) {
    issues.push(at('unitPriceMinor', '价格不能为零'))
  }

  return issues
}
