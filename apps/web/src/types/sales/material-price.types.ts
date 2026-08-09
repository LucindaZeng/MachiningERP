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
