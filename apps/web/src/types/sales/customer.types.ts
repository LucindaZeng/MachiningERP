/**
 * 客户档案（ENG-01）。
 *
 * 契约的唯一权威是 `packages/shared` 的 `CustomerContract`，前后端共用同一份；
 * 本文件只做别名再导出，让历史的 `@/types/sales.types` 引用路径继续可用，
 * 避免同一份客户形状在前端再抄一遍而与后端漂移。
 *
 * 注意 `Customer['hk']` 是**可选分组**：没有 `sales.hk-price.view` 权限时后端
 * 整组不下发。前端一律 `customer.hk?.xxx` 判空，不要断言、也不要补默认值，
 * 否则等于把权限判断从后端搬回前端。
 */
export type {
  CustomerCompletenessContract as CustomerCompleteness,
  CustomerContract as Customer,
  CustomerDeliveryAddressContract as CustomerDeliveryAddress,
  CustomerFinanceContract as CustomerFinance,
  CustomerHkPricingContract as CustomerHkPricing,
  CustomerRegionCode as CustomerRegion,
  CustomerStatusCode as CustomerStatus,
  InvoiceTypeCode,
  PaymentTermCode,
  SettlementMethodCode,
} from '@machining-erp/shared'
