import { Injectable } from '@nestjs/common'

import { SalesReturnService, deductionMinorOf } from '../../sales-return'
import { ANALYTICS_LIMITS } from '../constants/analytics-periods'

import {
  groupBy,
  groupWithShares,
  rateOf,
  sumQuantity,
  toTenThousand,
} from './analytics-aggregation.rules'

import type { SalesReturnRecord, SalesReturnLineRecord } from '../../sales-return'
import type { RepeatIssueRow, RmaResponsibilityRow, RmaStatRow } from '@machining-erp/shared'
import type { ReturnResponsibility } from '@prisma/client'

/** 责任归属的中文标签——报表直接显示给人看，不显示枚举名。 */
const RESPONSIBILITY_LABEL: Record<ReturnResponsibility, string> = {
  COMPANY: '本厂加工不良',
  SUPPLIER: '委外 / 供应商不良',
  CUSTOMER: '客户责任',
  UNDECIDED: '待判定',
}

/** 重复问题的判定阈值：同一客户同一产品出现 2 次以上才算「重复」。 */
const REPEAT_THRESHOLD = 2

interface FlatLine {
  record: SalesReturnRecord
  line: SalesReturnLineRecord
}

/**
 * 客诉 / 退货分析（规格第 11 章）。
 *
 * **按行统计而不是按单**——这是 sales-return 那一轮定下的口径：
 * 一张 RMA 里本厂加工不良与委外表处不良可以并存，按单统计会把整单算给一方。
 * 「批数」因此等于行数（一行 = 一个批次）。
 */
@Injectable()
export class RmaAnalyticsService {
  constructor(private readonly returns: SalesReturnService) {}

  private async flatLines(): Promise<FlatLine[]> {
    const records = await this.returns.list({ limit: ANALYTICS_LIMITS.RETURNS })
    return records.flatMap((record) => record.lines.map((line) => ({ record, line })))
  }

  /** 按不良现象归集：批数、数量、金额与占比。 */
  async statsByReason(): Promise<RmaStatRow[]> {
    const flat = await this.flatLines()

    return groupWithShares(flat, (item) => item.line.reason, (item) => item.line.amountMinor).map(
      (group) => ({
        reason: group.key,
        batches: group.items.length,
        quantity: sumQuantity(group.items.map((item) => item.line.returnQty)),
        amount: toTenThousand(group.amountMinor),
        share: group.share,
      }),
    )
  }

  /**
   * 按责任归属归集。`lossAmount` 取**实际扣减额**而不是货值：
   * 让步接收只减了谈定的折让，把整行货值算成损失会把数字放大好几倍。
   */
  async byResponsibility(): Promise<RmaResponsibilityRow[]> {
    const flat = await this.flatLines()

    return groupWithShares(
      flat,
      (item) => RESPONSIBILITY_LABEL[item.line.responsibility],
      (item) => deductionMinorOf(item.line),
    ).map((group) => ({
      responsibility: group.key,
      batches: group.items.length,
      quantity: sumQuantity(group.items.map((item) => item.line.returnQty)),
      lossAmount: toTenThousand(group.amountMinor),
      share: group.share,
      handled: describeHandling(group.items),
    }))
  }

  /** 重复问题：同一客户同一产品反复出事，是最该被看见的一类。 */
  async repeatIssues(): Promise<RepeatIssueRow[]> {
    const flat = await this.flatLines()
    const groups = [...groupBy(flat, (item) => `${item.record.customerId}|${item.line.productName}`)]

    return groups
      .filter(([, items]) => items.length >= REPEAT_THRESHOLD)
      .map(([, items]) => {
        const latest = items.reduce((newest, item) =>
          item.record.complaintAt > newest.record.complaintAt ? item : newest,
        )
        return {
          customer: latest.record.customerId,
          productName: latest.line.productName,
          times: items.length,
          lastAt: latest.record.complaintAt.toISOString().slice(0, 10),
          status: items.every((item) => item.record.status === 'CLOSED') ? '已全部结案' : '仍有未结案',
        }
      })
      .sort((left, right) => right.times - left.times)
  }

  /** 首响达标率：`respondedAt - complaintAt` 在 SLA 内的比例。无数据时返回 null。 */
  async responseRate(slaHours: number): Promise<number | null> {
    const records = await this.returns.list({ limit: ANALYTICS_LIMITS.RETURNS })
    if (records.length === 0) return null

    const responded = records.filter(
      (record) =>
        record.respondedAt !== null &&
        (record.respondedAt.getTime() - record.complaintAt.getTime()) / 3_600_000 <= slaHours,
    )
    return rateOf(responded.length, records.length)
  }
}

/** 处置摘要：把这一组里各种处置各出现几次说清楚，而不是给一句空话。 */
function describeHandling(items: readonly FlatLine[]): string {
  const counts = new Map<string, number>()
  for (const item of items) {
    const label = DISPOSITION_LABEL[item.line.disposition] ?? item.line.disposition
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts].map(([label, count]) => `${label} ${count} 批`).join('、')
}

const DISPOSITION_LABEL: Record<string, string> = {
  REFUND: '退款',
  REPLACEMENT: '补货',
  REWORK: '返工',
  CONCESSION: '让步接收',
  SCRAP: '报废',
  UNDECIDED: '待定',
}
