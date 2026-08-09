/**
 * 成本分析的三项费率。
 *
 * 放在 constants/ 而不是 repositories/ 或 dto/：仓储端口、service、入参映射与
 * controller 四处都要用同一个形状，沉到最底层才不会出现层间互相 import
 * （controller 触碰 repositories/ 会被 ESLint 直接判违规）。
 *
 * 一律按**万分比整数**存取：500 = 5%、700 = 7%、1000 = 10%、1300 = 13%。
 * 用整数是为了避开浮点——费率会直接乘进金额，0.07 这种值累积起来就是钱的误差。
 */
export interface CostRates {
  /** 损耗率。默认 5%，报价工程师可按产品与客户调整 */
  lossBps: number
  /** 管理费利润率。默认 5%，可调 */
  overheadBps: number
  /** 增值税率。默认 13% */
  vatBps: number
}

/** 费率上限 100%。见 cost-rate-rules.ts 里关于这个取值的说明。 */
export const RATE_BPS_MAX = 10_000
