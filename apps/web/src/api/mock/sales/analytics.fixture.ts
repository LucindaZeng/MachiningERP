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

export interface SalesAnalytics {
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

/** 数据分析（BI）看板 mock：口径与来源单据见页面底部说明表。 */
export const SALES_ANALYTICS: SalesAnalytics = {
  headline: {
    ytdAmount: '2648.7',
    ytdGrowth: '+18.2%',
    marginRate: '24.6',
    marginTarget: '26.0',
    onTimeRate: '92.4',
    overdueAr: '12.68',
  },
  trend: [
    { label: '2025-08', amount: 182.4, orders: 21 },
    { label: '2025-09', amount: 204.1, orders: 24 },
    { label: '2025-10', amount: 196.8, orders: 22 },
    { label: '2025-11', amount: 231.5, orders: 27 },
    { label: '2025-12', amount: 268.2, orders: 31 },
    { label: '2026-01', amount: 178.6, orders: 19 },
    { label: '2026-02', amount: 151.3, orders: 16 },
    { label: '2026-03', amount: 243.9, orders: 28 },
    { label: '2026-04', amount: 262.4, orders: 30 },
    { label: '2026-05', amount: 288.1, orders: 33 },
    { label: '2026-06', amount: 301.6, orders: 35 },
    { label: '2026-07', amount: 386.4, orders: 41 },
  ],
  topCustomers: [
    { label: '香港宏晟精密', value: 742.5, hint: '占比 28.0% · 已启用 70% 价格规则' },
    { label: 'Brenner Maschinenbau', value: 518.3, hint: '占比 19.6% · 账期 45 天' },
    { label: 'Radex Instruments', value: 404.1, hint: '占比 15.3% · 出口 FOB 盐田' },
    { label: '苏州明泰自动化', value: 288.4, hint: '占比 10.9% · 信用占用 98.1%' },
    { label: '东莞德信电子', value: 196.2, hint: '占比 7.4% · 内销含税' },
  ],
  orderMix: [
    { key: 'formal', label: '正式业务订单', value: 2317.4 },
    { key: 'mold', label: '模具订单', value: 231.8 },
    { key: 'sample', label: '样品订单', value: 99.5 },
  ],
  funnel: [
    { label: '询价登记', value: 128, hint: '近 90 天进入系统的询价' },
    { label: '完成核价', value: 111, hint: '核价完成率 86.7%' },
    { label: '发出报价', value: 96, hint: '含议价后的多版本' },
    { label: '客户确认', value: 52, hint: '确认率 54.2%' },
    { label: '转为订单', value: 44, hint: '整体转化率 34.4%' },
  ],
  margins: [
    {
      customer: '香港宏晟精密',
      amount: '742.5',
      quotedMargin: 0.223,
      actualMargin: 0.198,
      gap: -0.025,
      risk: '毛利偏低，铝价再涨 3% 将跌破目标',
    },
    {
      customer: 'Brenner Maschinenbau',
      amount: '518.3',
      quotedMargin: 0.284,
      actualMargin: 0.291,
      gap: 0.007,
      risk: '正常',
    },
    {
      customer: 'Radex Instruments',
      amount: '404.1',
      quotedMargin: 0.311,
      actualMargin: 0.276,
      gap: -0.035,
      risk: '色差返工与尾数返工推高实际成本',
    },
    {
      customer: '苏州明泰自动化',
      amount: '288.4',
      quotedMargin: 0.152,
      actualMargin: 0.121,
      gap: -0.031,
      risk: '低于目标 18%，且已逾期 12.68 万',
    },
    {
      customer: '东莞德信电子',
      amount: '196.2',
      quotedMargin: 0.245,
      actualMargin: 0.238,
      gap: -0.007,
      risk: '正常',
    },
  ],
}
