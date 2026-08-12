import type { SalesOrderType } from '@prisma/client'

/**
 * 订单类型的中文名。报表直接显示，不显示枚举名。
 *
 * 注意 fixture 的面板叫「五类订单结构」，而 schema 里只有四个类型
 * （FORMAL / SAMPLE / MOLD / STOCK_PREP）——第五类「退货返工订单」在规格里
 * 属于 rework 模块，尚未落地。少的那一类**不补空行**：补一行 0 会读成
 * 「这类订单一张都没有」，而实际是这类单据还不存在于系统里。
 */
export const ORDER_TYPE_LABEL: Record<SalesOrderType, string> = {
  FORMAL: '正式业务订单',
  SAMPLE: '样品订单',
  MOLD: '模具订单',
  STOCK_PREP: '备料订单',
}

/** 在手订单按剩余交期分桶。桶名直接显示给业务员看。 */
export const BACKLOG_BUCKETS = ['已超期', '7 天内', '8-30 天', '31-60 天', '60 天以上', '无交期'] as const

export type BacklogBucket = (typeof BACKLOG_BUCKETS)[number]

/**
 * 分桶。**没有交期的单独成桶**，不并进「60 天以上」——
 * 那会把一批根本没排期的订单藏进一个看起来很从容的格子里。
 */
export function backlogBucketOf(daysLeft: number | null): BacklogBucket {
  if (daysLeft === null) return '无交期'
  if (daysLeft < 0) return '已超期'
  if (daysLeft <= 7) return '7 天内'
  if (daysLeft <= 30) return '8-30 天'
  if (daysLeft <= 60) return '31-60 天'
  return '60 天以上'
}

/** 客户分级阈值：累计占比 80% 为 A，95% 为 B，其余 C（帕累托口径）。 */
export const CUSTOMER_GRADE_THRESHOLDS = { A: 0.8, B: 0.95 } as const

export function gradeOf(cumulativeShare: number): 'A' | 'B' | 'C' {
  if (cumulativeShare <= CUSTOMER_GRADE_THRESHOLDS.A) return 'A'
  if (cumulativeShare <= CUSTOMER_GRADE_THRESHOLDS.B) return 'B'
  return 'C'
}

/** 客户活跃度分级：多久没下单算观察 / 流失。 */
export const CHURN_THRESHOLDS = { WATCH_DAYS: 60, CHURN_DAYS: 120 } as const

export function churnRiskOf(daysSince: number): 'normal' | 'watch' | 'churn' {
  if (daysSince >= CHURN_THRESHOLDS.CHURN_DAYS) return 'churn'
  if (daysSince >= CHURN_THRESHOLDS.WATCH_DAYS) return 'watch'
  return 'normal'
}

/** 临期预警提前量。 */
export const BACKLOG_WARN_DAYS = 7

/** 客诉首响 SLA（小时），与 fixture 的「2 小时首响」一致。 */
export const RMA_RESPONSE_SLA_HOURS = 2
