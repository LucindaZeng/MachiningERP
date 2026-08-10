/** quotation 模块唯一对外出口（报价、成本分析、材料价格与汇率）。 */

export { QuotationModule } from './quotation.module'

export { CostingService, type CostingActor, type CreateCostAnalysisInput } from './services/costing.service'

/** 成本分析计算引擎：公式链已对齐 example/成本分析/CNC成本分析.xls */
export {
  calculateCostLine,
  calculateCostAnalysis,
  DEFAULT_RATES,
  BPS_SCALE,
  type CostAnalysisRates,
  type CostAnalysisTotals,
  type CostLineInput,
  type CostLineResult,
} from './services/cost-analysis-calculator'
export { DEFAULT_PROCESS_COLUMNS, type ProcessColumn } from './constants/process-columns'

/** 费率可调：默认 5%/5%/13% 只是初值，报价工程师按产品与客户自行调整 */
export { validateCostRates, formatBps, type CostRateIssue } from './services/cost-rate-rules'
export { RATE_BPS_MAX, type CostRates } from './constants/cost-rates'
export { toCostRates } from './services/cost-analysis-input.mapper'

/** 报价硬校验：强制关联成本分析、强制图纸、低于成本拦截 */
export {
  validateQuotationDraft,
  findBelowCostTiers,
  describeBelowCost,
  type BelowCostViolation,
  type QuotationDraftInput,
  type QuotationItemInput,
  type QuotationRuleIssue,
  type TierInput,
} from './services/quotation-rules'

/** 材料价格与当日汇率：一律取「不晚于报价日期的最新一条」 */
export {
  resolveMaterialPrice,
  resolveExchangeRate,
  convertByRate,
  FX_SCALE,
  type ExchangeRateSnapshot,
  type MaterialPriceCandidate,
  type ResolvedMaterialPrice,
} from './services/material-price-resolver'

/** 报价单：建单 / 草稿维护 / 送审 / 审核 / 修改申请闭环 */
export {
  QuotationService,
  type QuotationActor,
  type QuotationDraftPayload,
  type TierPayload,
} from './services/quotation.service'
export { QuotationReviewService } from './services/quotation-review.service'
/** 图纸上传：一次上传，核价与 BOM 共用同一个 DrawingVersion */
export {
  DrawingUploadService,
  type DrawingUploadActor,
  type DrawingUploadInput,
} from './services/drawing-upload.service'
export {
  autoRevision,
  composeDrawingObjectKey,
  sanitizeFileName,
  sanitizeSegment,
} from './services/drawing-object-key'
export { toDrawingVersionView } from './services/drawing-version-view.mapper'
export type { DrawingVersionView } from './dto/drawing-version-view.dto'
export {
  DRAWING_REPOSITORY,
  type CreateDrawingVersionData,
  type DrawingRepositoryPort,
  type DrawingVersionRecord,
} from './repositories/drawing.repository.port'
export {
  QuoteChangeRequestService,
  type SubmitQuoteChangeInput,
} from './services/quote-change-request.service'

/** 单件成本推导：报价与成本的唯一换算入口，禁止调用方自带成本 */
export { resolveUnitCosts } from './services/unit-cost'

export {
  QUOTATION_TRANSITIONS,
  QUOTE_CHANGE_TRANSITIONS,
  isQuotationEditable,
  quotationStateMachine,
  quoteChangeStateMachine,
} from './constants/quotation-states'
export {
  DEFAULT_VALID_DAYS,
  QUOTATION_TEMPLATES,
  type QuotationTemplate,
  type QuotationTerms,
} from './constants/quotation-terms'

export { toQuotationView, canSeeCost } from './services/quotation-view.mapper'
export { toQuoteChangeView } from './services/quote-change-view.mapper'
export { toQuotationDraftPayload, toTargetPrices } from './services/quotation-input.mapper'
export type { QuotationView } from './dto/quotation-view.dto'
export type { QuotationItemView } from './dto/quotation-item-view.dto'
export type { QuotationTierView } from './dto/quotation-tier-view.dto'
export type { QuoteChangeRequestView } from './dto/quote-change-view.dto'
export {
  QUOTATION_REPOSITORY,
  type CreateQuotationData,
  type QuotationHeaderDraft,
  type QuotationItemDraft,
  type QuotationItemRecord,
  type QuotationRecord,
  type QuotationRepositoryPort,
  type QuotationStatusPatch,
  type QuotationTierDraft,
  type QuotationTierRecord,
} from './repositories/quotation.repository.port'
export {
  QUOTE_CHANGE_REQUEST_REPOSITORY,
  type CreateQuoteChangeRequestData,
  type HandleQuoteChangeData,
  type QuoteChangeRequestRecord,
  type QuoteChangeRequestRepositoryPort,
  type QuoteTargetPrice,
} from './repositories/quote-change-request.repository.port'

export { toCostAnalysisView } from './services/cost-analysis-view.mapper'
export { toCostAnalysisLineDraft, toCostAnalysisLineDrafts } from './services/cost-analysis-input.mapper'
export type { CostAnalysisView } from './dto/cost-analysis-view.dto'
export type { CostAnalysisLineView } from './dto/cost-analysis-line-view.dto'
export {
  COST_ANALYSIS_REPOSITORY,
  type CostAnalysisRecord,
  type CostAnalysisLineRecord,
  type CostAnalysisLineDraft,
  type CostAnalysisRepositoryPort,
  type CostRateData,
} from './repositories/cost-analysis.repository.port'
