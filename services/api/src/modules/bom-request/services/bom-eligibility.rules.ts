import { BOM_ERRORS } from '@machining-erp/shared'

import { BizError } from '../../../common/errors/biz-error'

/**
 * 建单资格：这份报价产品到底该不该建 BOM。
 *
 * 拆成纯函数是因为这几条判断要被穷举测试，而且下单校验链
 * （contract-order 的 `collectPrerequisiteIssues`）迟早也要复用同一口径——
 * 「样品不建 BOM」这条规则只能有一处定义。
 */
export interface QuotationLineFacts {
  /** 报价单状态；只有生效报价才能据以建 BOM */
  quotationStatus: string
  /** 报价行是否按样品口径报的（样品既无 BOM 也无成品品号） */
  isSampleLine: boolean
  quotationItemId: string | null
  drawingVersionId: string | null
}

/** 只有生效的报价单能往下走。草稿与审核中的报价随时可能改，据此建 BOM 等于白建。 */
const EFFECTIVE_STATUSES: ReadonlySet<string> = new Set(['EFFECTIVE', 'WON'])

export function assertEligibleForBom(facts: QuotationLineFacts): void {
  // 样品优先判：样品单本来就不该出现在这个入口，先说清楚比报「报价未生效」更有用
  if (facts.isSampleLine) {
    throw new BizError(BOM_ERRORS.SAMPLE_NEEDS_NO_BOM)
  }

  if (!EFFECTIVE_STATUSES.has(facts.quotationStatus)) {
    throw new BizError(BOM_ERRORS.QUOTATION_REQUIRED, {
      message: `报价单当前状态为「${facts.quotationStatus}」，只有生效报价才能据以建立 BOM`,
      details: { quotationStatus: facts.quotationStatus },
    })
  }

  if (!facts.quotationItemId) throw new BizError(BOM_ERRORS.QUOTATION_REQUIRED)
  // 图纸沿用报价环节上传的版本；没有版本号就意味着有人打算另传一份
  if (!facts.drawingVersionId) throw new BizError(BOM_ERRORS.DRAWING_VERSION_REQUIRED)
}

export function isEffectiveQuotation(status: string): boolean {
  return EFFECTIVE_STATUSES.has(status)
}
