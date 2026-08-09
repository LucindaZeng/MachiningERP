/**
 * 权限点字典。与 apps/web `composables/use-permission.ts` 保持同一套码值，
 * 登录成功后由后端下发 permissions 数组，前端不再自行推导。
 */
export const PERMISSION_CODES = {
  /**
   * 香港 70% 价格：**独立权限点**。
   * 未授予者在列表、详情、报表与导出中一律看不到勾选、原始价格与计算价格
   * （docs/product/business-department-modules.md 3.2）。
   */
  HK_PRICE_VIEW: 'sales.hk-price.view',
  /** 成本核算（建立/修改成本分析）——仅报价工程师 */
  COSTING_EDIT: 'quote.costing.edit',
  /** 报价单修改申请的处理（改成本分析 / 驳回）——仅报价工程师 */
  QUOTE_CHANGE_HANDLE: 'quote.change.handle',
  /** 报价单审核——业务经理 */
  QUOTE_APPROVE: 'quote.approve',
  /** 业务操作：提报价申请、下单、出货 */
  SALES_OPERATE: 'sales.operate',
  /** 发票申请提交 */
  INVOICE_APPLY: 'sales.invoice.apply',
  /** 订单审核——业务经理 */
  ORDER_APPROVE: 'order.approve',
  /** 备料订单总经办审批 */
  STOCK_ORDER_GM_APPROVE: 'order.stock-prep.gm-approve',
  /** 订单追踪查看（业务部 / 总经办 / PMC 三方） */
  ORDER_TRACKING_VIEW: 'order.tracking.view',
  /** 客户档案建档与常规字段维护 */
  CUSTOMER_EDIT: 'customer.edit',
  /** 客户档案敏感字段（银行账号、付款条件、香港勾选）变更的审批权 */
  CUSTOMER_SENSITIVE_EDIT: 'customer.sensitive.edit',
  /** 跨业务员查看全部客户；未授予者只能看到自己负责的客户 */
  CUSTOMER_VIEW_ALL: 'customer.view-all',
  /** 客户财务字段（税号、银行账号、授信、账龄）明文查看 */
  CUSTOMER_FINANCE_VIEW: 'customer.finance.view',
  /** 原材料价格表与当日汇率维护 */
  MATERIAL_PRICE_EDIT: 'quote.material-price.edit',
  /** IT 系统管理：账户申请审批、密码重置 */
  IT_ACCOUNT_ADMIN: 'sys.account.admin',
} as const

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES]

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = Object.values(PERMISSION_CODES)
