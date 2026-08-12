/**
 * 每日经营量：接单 / 出货 / 未完成订单
 *
 * 这些是**前后端共享的线上契约**（development-guide §1：packages/shared = 类型/DTO/枚举/错误码）。
 * 后端 DTO 映射器与前端面板编译同一份定义，字段漂移因此是编译错误而不是线上惊喜。
 * fixture 只保留数据，类型从这里反向引入。
 */

import type { PanelAvailability } from './panel-availability'

export interface DailyOpsRow {
  date: string
  /** 当日接单 */
  receivedOrders: number
  receivedQty: number
  receivedAmount: number
  /** 当日出货 */
  shippedOrders: number
  shippedQty: number
  shippedAmount: number
  /** 日终未完成订单存量 */
  openOrders: number
  openQty: number
  openAmount: number
}

export interface DailyOpsReport extends PanelAvailability {
  rows: DailyOpsRow[]
  /** 统计区间说明与数据截止 */
  caliber: string
  updatedAt: string
}
