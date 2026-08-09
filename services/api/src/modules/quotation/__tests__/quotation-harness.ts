import { PERMISSION_CODES } from '@machining-erp/shared'

import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { CostingService } from '../services/costing.service'
import { QuotationReviewService } from '../services/quotation-review.service'
import {
  QuotationService,
  type QuotationActor,
  type QuotationDraftPayload,
} from '../services/quotation.service'
import { QuoteChangeRequestService } from '../services/quote-change-request.service'

import { FakeCostAnalysisRepository, LINE_ROW_1, LINE_ROW_3 } from './fakes'
import { FakeQuotationRepository, FakeQuoteChangeRepository } from './quotation-fakes'

export const SALES: QuotationActor = {
  userCode: 'WFX-2018-0042',
  permissions: [PERMISSION_CODES.SALES_OPERATE],
}
export const MANAGER: QuotationActor = {
  userCode: 'WFX-2015-0007',
  permissions: [PERMISSION_CODES.QUOTE_APPROVE],
}
/** 报价工程师同时持有核价与「处理修改申请」两个权限点 */
export const ENGINEER: QuotationActor = {
  userCode: 'WFX-2019-0113',
  permissions: [PERMISSION_CODES.COSTING_EDIT, PERMISSION_CODES.QUOTE_CHANGE_HANDLE],
}

export interface Harness {
  quotations: QuotationService
  review: QuotationReviewService
  changes: QuoteChangeRequestService
  costing: CostingService
  costRepo: FakeCostAnalysisRepository
  quotationRepo: FakeQuotationRepository
  changeRepo: FakeQuoteChangeRepository
  notify: jest.Mock
  timelineEnter: jest.Mock
  timelineClose: jest.Mock
}

let docSeq = 0

export function buildHarness(): Harness {
  const costRepo = new FakeCostAnalysisRepository()
  const quotationRepo = new FakeQuotationRepository()
  const changeRepo = new FakeQuoteChangeRepository()

  const notify = jest.fn().mockResolvedValue(undefined)
  const timelineEnter = jest.fn().mockResolvedValue(undefined)
  const timelineClose = jest.fn().mockResolvedValue(undefined)

  const docNumber = {
    next: jest.fn(async (type: string) => `${type}${String((docSeq += 1)).padStart(4, '0')}`),
  } as unknown as DocNumberService
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService
  const notifications = { notify } as unknown as NotificationService
  const timeline = {
    enter: timelineEnter,
    close: timelineClose,
  } as unknown as DocTimelineService

  const costing = new CostingService(docNumber, audit, notifications, costRepo)
  const quotations = new QuotationService(docNumber, audit, timeline, costing, quotationRepo)
  const review = new QuotationReviewService(
    quotations,
    costing,
    audit,
    notifications,
    timeline,
    quotationRepo,
  )
  const changes = new QuoteChangeRequestService(
    docNumber,
    audit,
    notifications,
    quotations,
    costing,
    changeRepo,
  )

  return {
    quotations,
    review,
    changes,
    costing,
    costRepo,
    quotationRepo,
    changeRepo,
    notify,
    timelineEnter,
    timelineClose,
  }
}

/** 建一份已核价完成的成本分析，返回其 id 与两行的行 id。 */
export async function seedCompletedAnalysis(harness: Harness): Promise<{
  id: string
  lineIds: string[]
}> {
  const record = await harness.costing.create(
    { customerId: 'CU1', productModel: 'BCM-2607', lines: [LINE_ROW_1, LINE_ROW_3] },
    ENGINEER,
  )
  await harness.costing.complete(record.id, SALES.userCode, ENGINEER)

  const completed = await harness.costing.load(record.id)
  return { id: completed.id, lineIds: completed.lines.map((line) => line.id) }
}

/** 单件成本：第 1 行 270.74 元、第 2 行 13.22 元，均已对齐 CNC成本分析.xls */
export const UNIT_COST_ROW_1 = 27_074n
export const UNIT_COST_ROW_3 = 1_322n

export function draftPayload(
  costAnalysisId: string,
  lineIds: readonly string[],
  overrides: Partial<QuotationDraftPayload> = {},
): QuotationDraftPayload {
  return {
    customerId: 'CU1',
    costAnalysisId,
    template: 'DOMESTIC',
    currency: 'CNY',
    fxRateMicros: null,
    fxQuotedOn: null,
    moldFeeMinor: 0n,
    terms: null,
    items: [
      {
        sequence: 1,
        productName: '12K Live Front Panel',
        drawingNo: 'BCM-2607',
        drawingVersionId: 'DV1',
        revision: 'REV A',
        material: 'AL6061-T6',
        finishing: '阳极氧化',
        process: 'CNC',
        costAnalysisLineId: lineIds[0] ?? null,
        remark: null,
        tiers: [
          { minQuantity: '10', unitPriceMinor: 32_000n, label: null },
          { minQuantity: '100', unitPriceMinor: 29_000n, label: null },
        ],
      },
    ],
    ...overrides,
  }
}
