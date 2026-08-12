import type {
  CostDrillRow,
  CostRefRow,
  ElementVarianceRow,
  MaterialProcessCell,
  OperationVarianceRow,
  ArAgingRow,
  ProductProcessRow,
  StockAgingRow,
  StockConsumeRow,
  StockIdleRow,
  StockProgressRow,
} from '@machining-erp/shared'

/**
 * 四个尚未上线的上游域读端口（costing / finance / wms / mes）。
 *
 * 分域而不是分面板：一个模块上线时该域下的所有面板同时有数据，
 * 逐面板开端口只会得到二十个要同时替换的 provider。
 *
 * **每个端口返回的都是行集**，而且约定「没有数据就返回空数组」。
 * 上层据此贴 `pending` 标记——绝不把空当成零。理由写在
 * `@machining-erp/shared` 的 panel-availability.ts 里：
 * 一个填成 0 的报废率读起来是优异表现，不是「模块没上线」。
 */

/** 成本域：报价成本与实际成本的偏差，需要工序成本卡与 MES 报工。 */
export interface CostingAnalyticsPort {
  elementVariance(): Promise<ElementVarianceRow[]>
  costDrill(): Promise<CostDrillRow[]>
  operationVariance(): Promise<OperationVarianceRow[]>
  costReference(): Promise<CostRefRow[]>
}

/** 财务域：应收账龄。回款事实在 finance，业务侧只有开票与对账。 */
export interface FinanceAnalyticsPort {
  arAging(): Promise<ArAgingRow[]>
}

/** 仓储域：备料订单的库存进度、账龄、领用与呆滞。 */
export interface WmsAnalyticsPort {
  stockProgress(): Promise<StockProgressRow[]>
  stockAging(): Promise<StockAgingRow[]>
  stockConsume(): Promise<StockConsumeRow[]>
  stockIdle(): Promise<StockIdleRow[]>
}

/** 制造域：产品与材质的工艺分布，需要工序级报工数据。 */
export interface MesAnalyticsPort {
  productProcess(): Promise<ProductProcessRow[]>
  materialProcess(): Promise<MaterialProcessCell[]>
}

export const COSTING_ANALYTICS_PORT = Symbol('COSTING_ANALYTICS_PORT')
export const FINANCE_ANALYTICS_PORT = Symbol('FINANCE_ANALYTICS_PORT')
export const WMS_ANALYTICS_PORT = Symbol('WMS_ANALYTICS_PORT')
export const MES_ANALYTICS_PORT = Symbol('MES_ANALYTICS_PORT')
