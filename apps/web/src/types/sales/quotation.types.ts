import type { DocStatus, TimelineNode } from './common.types'

/* ------------------------------ 报价 QTN ------------------------------ */

export interface QuotationTier {
  quantity: string
  unitPrice: string
}

export interface Quotation {
  id: string
  docNo: string
  version: string
  customerName: string
  customerCode: string
  productName: string
  drawingNo: string
  drawingVersion: string
  material: string
  surfaceTreatment: string
  tiers: QuotationTier[]
  currency: string
  targetDeliveryDays: number
  tradeTerm: string
  validUntil: string
  grossMarginRate: number
  status: DocStatus
  owner: string
  inquiryAt: string
  submittedAt?: string
  confirmedAt?: string
  timeline: TimelineNode[]
  /** 客户确认所关联的报价版本，未确认为空 */
  confirmedVersion?: string
  /** 强制关联的成本分析（核价）单号；缺失时禁止提交审批 */
  costAnalysisNo?: string
  /**
   * 报价阶段：
   * applied = 业务已提交报价申请（只有图纸与数量），待报价工程师补齐；
   * costing = 报价工程师核价中；quoted = 已报出；confirmed = 客户已确认。
   */
  stage: 'applied' | 'costing' | 'quoted' | 'confirmed'
  /** 提交报价申请的业务员 */
  applicant: string
  /** 承接的报价工程师，未分派为空 */
  engineer?: string
  /** 数量口径：阶梯或单一数量 */
  quantityMode: 'tier' | 'single'
  /** 图纸附件，报价单强制上传；同一份图纸同时分发给报价工程师与工程建 BOM */
  drawing?: DrawingFile
}

/** 图纸附件：报价强制上传，系统按分发清单同步给报价工程师与工程 */
export interface DrawingFile {
  fileName: string
  version: string
  uploadedAt: string
  uploadedBy: string
  /** 已分发到的下游：报价工程师、工程（BOM 建立） */
  distributedTo: string[]
}

/* ---------------- 报价单修改申请（QRC）---------------- */

/**
 * 业务对已报出的报价单提出改价：直接提交修改后的价格，
 * 由报价工程师改成本分析后接受，或驳回并填写驳回理由。
 */
export interface QuoteChangeRequest {
  id: string
  docNo: string
  quotationNo: string
  customerName: string
  productName: string
  drawingNo: string
  /** 原报价（阶梯逐行） */
  beforeTiers: QuotationTier[]
  /** 业务直接提交的修改后价格 */
  afterTiers: QuotationTier[]
  currency: string
  reason: string
  /** 客户依据：比价单、目标价函件等 */
  evidence?: string
  applicant: string
  submittedAt: string
  engineer?: string
  handledAt?: string
  /** 处理结果：报价工程师改成本分析后接受，或驳回 */
  result?: 'accepted' | 'rejected'
  /** 驳回理由，驳回时必填 */
  rejectReason?: string
  /** 接受时新的成本分析单号与新毛利 */
  newCostAnalysisNo?: string
  newMarginRate?: number
  status: DocStatus
  timeline: TimelineNode[]
}

/** 历史报价查询结果（QTN-02 相似产品与历史成交检索） */
export interface HistoricalQuote {
  id: string
  docNo: string
  quotedAt: string
  customerName: string
  productName: string
  drawingNo: string
  material: string
  surfaceTreatment: string
  quantity: string
  unitPrice: string
  currency: string
  marginRate: number
  /** 成交结果 */
  outcome: 'won' | 'lost' | 'expired'
  orderNo?: string
  actualMarginRate?: number
  owner: string
  costAnalysisNo: string
  /** 当时的成本分析与实际成本回溯，逐道工艺独立核算 */
  operationCosts?: OperationCostLine[]
  quotedUnitCost?: string
  actualUnitCost?: string
  /** 实际成本来源订单 */
  costOrderNo?: string
  /** 领用备料时的加权平均成本说明 */
  blendedNote?: string
}

/**
 * 工序级成本行：每一道实际工艺独立核算（见 docs/features/operation-level-costing.md）。
 * 转入累计成本由前序工序累加得到，界面上按顺序计算展示。
 */
export interface OperationCostLine {
  seq: number
  /** 工序名：切料 / 车床 / CNC / 打磨 / 委外阳极 / 镭雕丝印 / 包装 … */
  operation: string
  /** 机台或委外供应商 */
  workCenter: string
  /** 分项归属：材料 / 加工时间 / 工艺 */
  element: '材料' | '加工时间' | '工艺'
  /** 标准与实际工时（分钟），材料类工序可为空 */
  stdMinutes?: string
  actMinutes?: string
  /** 该工序报价时预估的单件新增成本 */
  quotedCost: string
  /** 该工序实际发生的单件新增成本；未成交为「—」 */
  actualCost: string
  note?: string
}
