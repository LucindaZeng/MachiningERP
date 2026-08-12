/**
 * 聚合的取数窗口与上限。
 *
 * **关于 limit**：各模块的 `list()` 都要求传 limit 且不支持 offset，
 * 因此大数据量下聚合会被静默截断。现阶段的量级（百级单据）够用；
 * 真正的解法是各模块补上分页或专门的聚合查询，那属于那些模块的改动，
 * 不该由分析层用循环翻页去绕——一绕就变成了在分析层重写取数逻辑。
 * 这里把上限集中一处声明，将来一改改一处。
 */
export const ANALYTICS_LIMITS = {
  ORDERS: 2000,
  SHIPMENTS: 2000,
  RETURNS: 1000,
  INVOICES: 2000,
  STATEMENTS: 500,
  QUOTATIONS_PER_CUSTOMER: 200,
  CUSTOMERS: 500,
} as const

/** 日报窗口：近 30 天，与 fixture 的「近 30 天」一致。 */
export const DAILY_OPS_WINDOW_DAYS = 30

/** 趋势图窗口：近 12 个月。 */
export const TREND_WINDOW_MONTHS = 12

/** 排行榜取前 N 名。 */
export const RANK_LIMIT = 8

/** 口径说明原文照搬 fixture——它是给业务员看的，不是注释。 */
export const DAILY_OPS_CALIBER =
  '接单按 ORD-02 审核通过日归集，出货按实际发货日归集，未完成订单为当日日终存量（已评审未出清）。周日不排产，接单与出货为 0 属正常。'
