/**
 * 经营分析看板（BI 指标口径见页面说明表）
 *
 * 这些是**前后端共享的线上契约**（development-guide §1：packages/shared = 类型/DTO/枚举/错误码）。
 * 后端 DTO 映射器与前端面板编译同一份定义，字段漂移因此是编译错误而不是线上惊喜。
 * fixture 只保留数据，类型从这里反向引入。
 */

import type { PanelAvailability } from './panel-availability'

export interface TrendPoint {
  label: string
  /** 订单额，万元 */
  amount: number
  orders: number
}

export interface RankItem {
  label: string
  value: number
  hint: string
}

export interface ShareItem {
  key: string
  label: string
  value: number
}

export interface FunnelStage {
  label: string
  value: number
  hint: string
}

export interface MarginRow {
  customer: string
  amount: string
  quotedMargin: number
  actualMargin: number
  gap: number
  risk: string
}

export interface SalesAnalytics extends PanelAvailability {
  headline: {
    ytdAmount: string
    ytdGrowth: string
    marginRate: string
    marginTarget: string
    onTimeRate: string
    overdueAr: string
  }
  trend: TrendPoint[]
  topCustomers: RankItem[]
  orderMix: ShareItem[]
  funnel: FunnelStage[]
  margins: MarginRow[]
}
