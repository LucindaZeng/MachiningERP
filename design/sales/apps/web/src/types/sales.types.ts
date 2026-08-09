/**
 * 业务部（销售）领域契约类型。
 * 报价/核价/客户/订单沿用 docs/workflows/order-to-pack-lifecycle.md 的 QTN / ENG / ORD 节点定义；
 * 销货 SHP、销退 RMA、报关 EXP 为本轮补充设计，见 docs/product/business-department.md。
 * M0 完成后整体迁移至 packages/shared。
 */

/** 统一单据状态机（docs/product/department-control-matrix.md 统一审核权限规则） */
export type DocStatus =
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'closed'
  | 'rejected'
  | 'void'

/** 金额一律字符串定点数 + 币种（api-conventions.md） */
export interface Money {
  amount: string
  currency: string
}

export type AlertLevel = 'info' | 'due' | 'overdue' | 'severe' | 'blocking'

export interface AlertItem {
  id: string
  level: AlertLevel
  domain: string
  subject: string
  triggerValue: string
  threshold: string
  occurredAt: string
  dueAt: string
  owner: string
  escalateTo: string
  relatedDocNo: string
  suggestion: string
}

export type TimelineState = 'done' | 'active' | 'pending' | 'overdue'

/** 节点计时：口径见 lifecycle 文档「12 个计时字段」 */
export interface TimelineNode {
  node: string
  owner: string
  state: TimelineState
  enteredAt?: string
  firstViewedAt?: string
  finishedAt?: string
  dueAt?: string
  /** 节点总历时（小时） */
  elapsedHours?: number
  /** 超期时长（小时） */
  overdueHours?: number
  remark?: string
}

export interface TodoItem {
  id: string
  category: string
  title: string
  docNo: string
  customer: string
  dueAt: string
  level: AlertLevel
  route: string
}

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

/* ------------------------------ 核价 QTN-02 ------------------------------ */

export interface CostLine {
  key: string
  label: string
  amount: string
  note: string
  /** 是否属于业务不可见的敏感字段（如未授权供应商底价） */
  restricted?: boolean
}

export interface MetalPriceSnapshot {
  metal: string
  source: string
  quotedAt: string
  price: string
  unit: string
  currency: string
  exchangeRate: string
  /** 快照过期天数阈值，超出触发预警 */
  expired: boolean
}

export interface SimilarProduct {
  drawingNo: string
  productName: string
  customerName: string
  material: string
  quotedPrice: string
  actualCost: string
  marginRate: number
  quotedAt: string
}

export interface CostAnalysis {
  quotationNo: string
  productName: string
  drawingNo: string
  quantity: string
  currency: string
  lines: CostLine[]
  snapshot: MetalPriceSnapshot
  similar: SimilarProduct[]
  targetMarginRate: number
  quotedUnitPrice: string
}

/* ------------------------------ 客户 ENG-01 ------------------------------ */

export type CustomerStatus = 'draft' | 'pending' | 'active' | 'suspended'

export interface Customer {
  id: string
  code: string
  name: string
  shortName: string
  country: string
  contact: string
  phone: string
  email: string
  address: string
  tradeTerm: string
  paymentTerm: string
  currency: string
  level: string
  /** 香港代生产价格客户勾选（HKO） */
  hkPricingEnabled: boolean
  hkFactor: number
  hkEffectiveFrom?: string
  hkAppliedBy?: string
  hkApprovedBy?: string
  hkChangeReason?: string
  status: CustomerStatus
  createdBy: string
  approvedBy?: string
  /** 财务维护字段：业务角色只读或不可见 */
  finance: {
    taxNo: string
    bankAccount: string
    creditLimit: Money
    creditUsed: Money
    arDays: number
    overdueAmount: Money
  }
}

/* ------------------------------ 订单 ORD ------------------------------ */

export type OrderType = 'mold' | 'sample' | 'formal' | 'stock'
export type ChargeMode = 'charged' | 'free' | 'partial' | 'deferred' | 'deposit' | 'internal'

export interface HkPricing {
  /** 触发条件是否成立：客户已勾选 且 订单类型=正式 */
  applied: boolean
  factor: number
  originalUnitPrice: string
  finalUnitPrice: string
  roundingRule: string
  calculatedAt?: string
  priceVersion: string
  customerFlagSnapshot: boolean
  orderTypeSnapshot: OrderType
}

/** 订单明细行：一张单可以下多项产品 */
export interface OrderLine {
  seq: number
  productName: string
  drawingNo: string
  /** 品号：只有正式订单的产品才有；样品为空，模具为模具编号 */
  itemCode?: string
  quantity: string
  /** 客户原始单价（HK 客户的 70% 由系统按原价折算，禁止手工先折） */
  unitPrice: string
  amount: string
  deliveryDate: string
  remark?: string
}

export interface SalesOrder {
  id: string
  docNo: string
  customerCode: string
  customerName: string
  orderType: OrderType
  chargeMode: ChargeMode
  productName: string
  drawingNo: string
  /**
   * 品号（产品编码）：只有正式订单的产品才有。
   * 样品订单无品号，仅以图号 + 样品单号标识；
   * 模具订单用模具编号；备料订单必须引用已存在的品号。
   */
  itemCode?: string
  quantity: string
  currency: string
  taxRate: number
  unitPrice: string
  amount: string
  deliveryDate: string
  quotationNo?: string
  customerPoNo?: string
  costOwner?: string
  freeReason?: string
  estimatedCost?: string
  status: DocStatus
  owner: string
  t0?: string
  hk: HkPricing
  timeline: TimelineNode[]
  reviewRounds: number
  /** 正式订单关联的备料订单与加权平均成本；备料订单本身为空 */
  stockLink?: StockLink
  /** 备料订单专用：完工入库数量，达到订单数量即视为完成 */
  stockedQty?: string
  /** 一单多产品：明细行；单产品订单也会写入一行，保证口径统一 */
  lines?: OrderLine[]
  /** 客户订单原件附件（模具 / 正式订单强制；样品订单有价格时强制） */
  poFile?: string
}

/** 备料订单库存：完工入库后可被正式订单领用，直到用完 */
export interface StockOrder {
  id: string
  docNo: string
  productName: string
  drawingNo: string
  totalQty: string
  usedQty: string
  remainingQty: string
  /** 备料订单的单件生产成本 */
  unitCost: string
  currency: string
  status: 'producing' | 'stocked' | 'consumed'
  completedAt?: string
  owner: string
}

/** 正式订单领用备料后的加权平均成本明细 */
export interface StockLink {
  stockOrderNo: string
  /** 本次领用的备料数量 */
  usedQty: string
  stockUnitCost: string
  /** 需新投产数量 = 订单数量 − 领用数量 */
  produceQty: string
  produceUnitCost: string
  /** 加权平均单件成本 = (备料成本×领用数 + 新产成本×新产数) / 订单数量 */
  blendedUnitCost: string
}

/* ------------------------------ 销货 SHP（本轮补充） ------------------------------ */

export type ShipmentStatus =
  | 'planned'
  | 'picking'
  | 'packed'
  | 'shipped'
  | 'signed'
  | 'invoiced'
  | 'closed'

/** 出货明细行：一张发货单可以发多项产品 */
export interface ShipmentLine {
  seq: number
  productName: string
  drawingNo: string
  itemCode?: string
  batchNo: string
  orderedQty: string
  shippedQty: string
  tailQty: string
  amount: string
}

/** 退货明细行：一张退货单可以退多项产品 */
export interface ReturnLine {
  seq: number
  productName: string
  drawingNo: string
  batchNo: string
  returnQty: string
  reason: string
  amount: string
}

export interface Shipment {
  id: string
  docNo: string
  orderNo: string
  customerName: string
  productName: string
  /** 一单多产品明细；单产品出货也写一行 */
  lines?: ShipmentLine[]
  batchNo: string
  orderedQty: string
  qualifiedQty: string
  packedQty: string
  shippedQty: string
  /** 尾数 = 订单数 − 已发数，四路径处理 */
  tailQty: string
  tailPlan?: 'rework' | 'stock' | 'direct-stock' | 'scrap'
  packedAt?: string
  shippedAt?: string
  signedAt?: string
  carrier?: string
  trackingNo?: string
  invoiceNo?: string
  amount: Money
  status: ShipmentStatus
  owner: string
  timeline: TimelineNode[]
}

/* ------------------------------ 销退 RMA（本轮补充） ------------------------------ */

export type ReturnStatus =
  | 'registered'
  | 'quality-judging'
  | 'disposition'
  | 'executing'
  | 'closed'
  | 'rejected'

export type ReturnResponsibility = 'company' | 'customer' | 'supplier' | 'undecided'
export type ReturnDisposition =
  | 'refund'
  | 'replacement'
  | 'rework'
  | 'concession'
  | 'scrap'
  | 'undecided'

export interface SalesReturn {
  id: string
  docNo: string
  orderNo: string
  shipmentNo: string
  customerName: string
  productName: string
  /** 一单多产品明细 */
  lines?: ReturnLine[]
  batchNo: string
  returnQty: string
  reason: string
  responsibility: ReturnResponsibility
  disposition: ReturnDisposition
  amount: Money
  complaintAt: string
  respondedAt?: string
  eightDNo?: string
  status: ReturnStatus
  owner: string
  needFinanceApproval: boolean
  timeline: TimelineNode[]
}

/* ------------------------------ 报关资料 EXP（本轮补充） ------------------------------ */

export type CustomsStatus = 'draft' | 'checking' | 'generated' | 'declared' | 'released'

export interface CustomsDocument {
  templateCode: string
  name: string
  version: string
  generatedAt?: string
}

export interface CustomsDossier {
  id: string
  docNo: string
  shipmentNo: string
  orderNo: string
  customerName: string
  tradeMode: string
  incoterm: string
  portOfLoading: string
  destination: string
  hsCode: string
  goodsNameCn: string
  goodsNameEn: string
  quantity: string
  unit: string
  netWeight: string
  grossWeight: string
  packages: string
  unitPrice: string
  totalAmount: Money
  exchangeRate: string
  status: CustomsStatus
  owner: string
  checkedBy?: string
  documents: CustomsDocument[]
  missingFields: string[]
}

/* ------------------------------ 原材料价格（MKT，业务视图） ------------------------------ */

/** 行情实时性标识：界面必须显式标注，非实时价不得用于自动核价 */
export type QuoteFreshness = 'realtime' | 'delayed' | 'daily' | 'manual'

export interface MaterialPrice {
  id: string
  materialCode: string
  materialName: string
  form: string
  spec: string
  instrument: string
  /** 市场基准价 */
  basePrice: string
  /** 企业落地参考价（含汇率、升贴水、加工、物流、税费） */
  landedPrice: string
  unit: string
  currency: string
  dayChange: number
  weekChange: number
  monthChange: number
  quotedAt: string
  freshness: QuoteFreshness
  source: string
  /** 报价引用的快照是否已过期 */
  snapshotExpired: boolean
  /** 近 30 日走势，用于迷你趋势图 */
  history: number[]
}

/* ------------------------------ BOM 申请（ENG-02 / ENG-05） ------------------------------ */

export type BomRequestStatus =
  | 'draft'
  | 'submitted'
  | 'claimed'
  | 'returned'
  | 'bom-done'
  | 'all-done'
  | 'ordered'

export interface BomRequest {
  id: string
  docNo: string
  customerName: string
  quotationNo?: string
  customerPoNo?: string
  productName: string
  drawingNo: string
  drawingVersion: string
  material: string
  surfaceTreatment: string
  inspection: string
  packing: string
  quantity: string
  targetDeliveryDate: string
  /**
   * 申请用途：batch = 正式量产产品（建品号 + BOM + 工艺路线）；
   * mold = 模具（建模具编号，不建品号，模具不是可售产品）。
   * 样品订单不提 BOM 申请，因此这里没有 sample。
   */
  productionType: 'batch' | 'mold'
  /** 由样品转量产时回填的样品单号，用于把试做工时与实际成本带入首次量产 */
  fromSampleNo?: string
  specialRequirement?: string
  status: BomRequestStatus
  owner: string
  submittedAt?: string
  claimedAt?: string
  /** 工程退回等待时间（小时），退回重提时累计 */
  returnedHours?: number
  /** ENG-05 双状态：两者必须分别展示，不得合并为「全部工程完成」 */
  bomReady: boolean
  programReady: boolean
  /** 工程建立的编码：productionType=batch 时为品号，=mold 时为模具编号 */
  productCode?: string
  timeline: TimelineNode[]
}

/* ------------------------------ 工程变更申请 ECN（业务发起） ------------------------------ */

export type EcnChangeType =
  | 'drawing'
  | 'material'
  | 'surface'
  | 'process'
  | 'quantity'
  | 'delivery'
  | 'packing'
  | 'requirement'

export type EcnStatus =
  | 'draft'
  | 'submitted'
  | 'assessing'
  | 'reviewing'
  | 'approved'
  | 'executing'
  | 'closed'
  | 'rejected'

export interface EcnImpact {
  scope: string
  quantity: string
  amount: string
  note: string
}

export interface EngineeringChange {
  id: string
  docNo: string
  customerName: string
  orderNo?: string
  productName: string
  drawingNo: string
  changeType: EcnChangeType
  /** 变更来源：客户要求 or 内部发起 */
  origin: 'customer' | 'internal'
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  /** 影响范围评估：在制工单、已采购物料、已完工库存、已发货批次 */
  impacts: EcnImpact[]
  /** 改图必须联动改工艺路线 */
  routingUpdated: boolean
  /** 中途改工序：只允许对指定批次版本生效 */
  effectiveBatch?: string
  /** 是否触发订单变更重审与重新核价 */
  needRequote: boolean
  needOrderReapproval: boolean
  status: EcnStatus
  owner: string
  submittedAt?: string
  timeline: TimelineNode[]
}

/* ------------------------------ 订单追踪 TRK（业务 / 总经办 / PMC 共享） ------------------------------ */

export type TrackStageStatus = 'done' | 'active' | 'pending' | 'blocked'

export interface TrackStage {
  seq: number
  /** 所属阶段：计划与采购 / 来料与检验 / 机加工 / 后处理与委外 / 交付入库 */
  phase: string
  name: string
  /** 进度条上的短标签（进度条空间有限，长名称在悬浮提示里展示） */
  shortName: string
  dept: string
  status: TrackStageStatus
  /** 该环节完成百分比；未给出时由数量或状态推算 */
  progress?: number
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
  /** 投入数 / 合格数 / 不良数 */
  qtyIn?: string
  qtyOk?: string
  qtyNg?: string
  /** 该环节停留时长（小时） */
  dwellHours?: number
  remark?: string
}

export interface OrderTracking {
  id: string
  orderNo: string
  customerName: string
  productName: string
  drawingNo: string
  orderType: OrderType
  quantity: string
  deliveryDate: string
  batchNo: string
  /** 当前所处环节名称 */
  currentStage: string
  /** 已完成环节数 / 总环节数 */
  doneCount: number
  totalCount: number
  /** 交付风险：正常 / 临期 / 延期 */
  risk: 'normal' | 'due' | 'late'
  riskNote?: string
  updatedAt: string
  stages: TrackStage[]
}

/* ------------------------------ 客户对账单 STM（本轮补充） ------------------------------ */

export type StatementStatus = 'draft' | 'sent' | 'confirmed' | 'disputed' | 'settled'

export interface StatementLine {
  date: string
  /** 单据类型：发货 / 开票 / 回款 / 退货 / 折让 */
  type: string
  docNo: string
  productName?: string
  quantity?: string
  amount: string
  /** 客户是否已核对该行 */
  matched: boolean
  remark?: string
}

export interface Statement {
  id: string
  docNo: string
  customerCode: string
  customerName: string
  periodFrom: string
  periodTo: string
  currency: string
  openingBalance: string
  shippedAmount: string
  invoicedAmount: string
  receivedAmount: string
  returnAmount: string
  closingBalance: string
  /** 与客户账面的差异金额，非零需说明 */
  differenceAmount: string
  differenceNote?: string
  overdueAmount: string
  status: StatementStatus
  owner: string
  sentAt?: string
  confirmedAt?: string
  lines: StatementLine[]
}

/* ---------------- 订单修改申请（ORC）---------------- */

/**
 * 订单信息变更：数量、交期、单价、收费方式、收货信息、包装要求、取消订单。
 * 与 ECN 的分工：改图 / 改材料 / 改表面处理属于产品变更走 ECN；
 * 这里只改订单本身，不改产品，因此不发布新图纸版本，但可能触发重新核价与订单重新审批。
 */
export type OrderChangeType = 'quantity' | 'delivery' | 'shipTo' | 'packing' | 'cancel'

export interface OrderChangeImpact {
  scope: string
  quantity: string
  amount: string
  note: string
}

export interface OrderChangeRequest {
  id: string
  docNo: string
  orderNo: string
  customerName: string
  productName: string
  drawingNo: string
  orderType: OrderType
  changeType: OrderChangeType
  origin: 'customer' | 'internal'
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
  impacts: OrderChangeImpact[]
  /** 是否触发重新核价 / 订单重新审批 */
  needRequote: boolean
  needReapproval: boolean
  /** 变更是否已同步给 PMC 重排计划 */
  planSynced: boolean
  /** 变更产生的费用由谁承担 */
  costOwner: '客户承担' | '公司承担' | '双方分摊' | '无额外费用'
  status: DocStatus
  owner: string
  submittedAt: string
  timeline: TimelineNode[]
}

/* ---------------- 发票申请（INV）---------------- */

export type InvoiceType = 'special' | 'general' | 'export' | 'proforma'

export interface InvoiceLine {
  seq: number
  shipmentNo: string
  productName: string
  drawingNo: string
  quantity: string
  unitPrice: string
  amount: string
  taxRate: number
  taxAmount: string
}

/**
 * 发票申请：业务按已签收出货单发起，财务开票并回写发票号。
 * 开票金额必须与出货单、对账单三者一致；差异需先在对账单处理完再开票。
 */
export interface InvoiceRequest {
  id: string
  docNo: string
  customerName: string
  customerCode: string
  invoiceType: InvoiceType
  /** 关联对账单（按期间开票时必填） */
  statementNo?: string
  lines: InvoiceLine[]
  amountExTax: string
  taxAmount: string
  amountIncTax: string
  currency: string
  /** 开票信息 */
  title: string
  taxNo: string
  bankAccount?: string
  address?: string
  /** 交付方式：电子发票邮箱 / 纸质快递 */
  deliveryMethod: '电子发票（邮箱）' | '纸质发票（快递）'
  deliveryTarget: string
  /** 财务回写 */
  invoiceNo?: string
  issuedAt?: string
  /** 与出货 / 对账金额是否一致，不一致禁止开票 */
  amountMatched: boolean
  matchNote?: string
  expectedPaymentDate: string
  status: DocStatus
  owner: string
  submittedAt: string
  timeline: TimelineNode[]
}
