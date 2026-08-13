/**
 * 领域事件（api-conventions.md「事件」）：命名 `domain.entity.action`。
 * 预警中心、节点计时、BI 均以事件为事实来源，业务模块不得直接写预警表。
 */
export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId: string
  name: string
  occurredAt: Date
  traceId?: string | null
  payload: TPayload
}

export const DOMAIN_EVENTS = {
  ACCOUNT_REQUEST_SUBMITTED: 'identity.account-request.submitted',
  ACCOUNT_REQUEST_APPROVED: 'identity.account-request.approved',
  ACCOUNT_REQUEST_REJECTED: 'identity.account-request.rejected',
  PASSWORD_RESET_REQUESTED: 'identity.password-reset.requested',
  USER_LOGGED_IN: 'auth.session.logged-in',
  USER_LOGIN_FAILED: 'auth.session.login-failed',
  USER_LOCKED: 'auth.session.locked',
  /**
   * BOM 建好了 → **解锁下单**。contract-order 据此放行「BOM 已建立」这条下单前置。
   *
   * 只看 BOM 这一个开关，与加工程序无关：程序编制（ENG-04）与订单审批、
   * 采购是并行跑的，程序卡的是开工，不是下单。
   */
  BOM_REQUEST_BOM_READY: 'engineering.bom-request.bom-ready',
  /**
   * 全部工程完成（BOM + 加工程序都齐）。
   *
   * **不用于下单放行**（那是 `BOM_REQUEST_BOM_READY` 的事）。这条留给
   * 后续 MES 的开工放行与工程时效统计：一张申请只在两个开关都合上时发一次。
   */
  BOM_REQUEST_COMPLETED: 'engineering.bom-request.completed',
  /**
   * 出货过账 → **应收依据**（业务规格第 7 章「推送应收依据给财务」）。
   * payload 带客户、币种、金额与逐行明细，finance 落地后订阅本条建应收。
   */
  SHIPMENT_POSTED: 'sales.shipment.posted',
  /** 客户签收：开票与账期的起算点，invoice-request 与 statement 都要看这一条。 */
  SHIPMENT_SIGNED: 'sales.shipment.signed',
  /**
   * 尾数走返工补交 → 通知未来的 rework 模块拆返工子订单。
   * 另外三条路径（入库 / 直接入库 / 报废）在本模块内就地结清，不需要下游接手。
   */
  SHIPMENT_TAIL_REWORK_REQUESTED: 'sales.shipment.tail-rework-requested',
  /**
   * 发票已开出（正票为正、红字为负）。对账单的「开票」列、应收账龄都以此为准；
   * **寄出与签收不发事件**——它们不改变任何下游事实。
   */
  INVOICE_ISSUED: 'sales.invoice.issued',
  /**
   * RMA 中判为返工的行 → 通知未来的 rework 模块拆返工工单
   * （业务规格第 8 章「退货返工发起独立返工工单，执行在生产/品质侧」）。
   *
   * payload 只带**判为 REWORK 的行**：同一张 RMA 里退款、报废的行与生产无关，
   * 塞给生产只会让他们自己再过滤一遍。
   */
  SALES_RETURN_REWORK_REQUESTED: 'sales.sales-return.rework-requested',
  /**
   * RMA 结案 → 金额与处置就此锁死，对账单据此在 closedAt 所在期间计入退货折让。
   *
   * 为什么是结案而不是处置审批：处置审批之后金额还会在执行中变动，
   * 已发出的对账单不允许被后来的改动改写。
   */
  SALES_RETURN_CLOSED: 'sales.sales-return.closed',
  /**
   * ECN 判为「对生产有影响」且 PMC 已清点数量 → 通知未来的 rework 模块拆返工工单
   * （业务规格第 6 章新增规则）。
   *
   * 与 `SALES_RETURN_REWORK_REQUESTED` 是同一类接缝，但来源不同：
   * 那条是客户退回来的不良品，这条是**图纸/工艺改了、已投产的那批要按新版重做**。
   * payload 带新旧图纸版本，因为返工工单必须知道「照哪一版做」——
   * 只给一个数量，车间无从判断该返成什么样。
   */
  ECN_REWORK_REQUESTED: 'engineering.ecn.rework-requested',
} as const

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS] | string
