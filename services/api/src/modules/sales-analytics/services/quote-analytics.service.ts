import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { ANALYTICS_LIMITS } from '../constants/analytics-periods'

import { groupBy, monthKeyOf, rateOf, toTenThousand } from './analytics-aggregation.rules'
import { orderAmountMinor } from './daily-ops.service'

import type { SalesOrderRecord } from '../../contract-order'
import type {
  FunnelRow,
  LostReason,
  QuoteByDim,
  QuoteCycleRow,
  SampleCycleRow,
} from '@machining-erp/shared'

/**
 * 报价与样品转化分析（规格第 11 章）。
 *
 * ⚠️ **一处已知的取数限制**：`QuotationService` 只提供
 * `listByCustomer(customerId, limit)`，没有跨客户查询、没有状态与日期过滤。
 * 想按报价单本身算成交率，就得先列全部客户再逐个取报价——N+1，
 * 而且客户表本身也要分页。
 *
 * 因此漏斗与成交率**改从订单侧反推**：订单行上带着 `quotationId`，
 * 「有多少报价最终变成了订单」这个问题，订单侧同样答得出，而且只要一次查询。
 * 报价单总数这一格因此只能给「已转化」那一段——待 quotation 补上
 * 跨客户查询后再补全，届时改这一支即可。
 */
@Injectable()
export class QuoteAnalyticsService {
  constructor(private readonly orders: SalesOrderService) {}

  private load(): Promise<SalesOrderRecord[]> {
    return this.orders.list({ limit: ANALYTICS_LIMITS.ORDERS })
  }

  /** 报价转化漏斗：从订单侧看到的那几段。 */
  async funnel(): Promise<FunnelRow[]> {
    const orders = await this.load()
    const quoted = new Set(
      orders.flatMap((order) => order.lines.map((line) => line.quotationId).filter(Boolean)),
    )
    const approved = orders.filter((order) => order.approvedAt !== null)

    return [
      { stage: '已转化报价', count: quoted.size, hint: '订单行引用到的报价单数（报价总数待报价模块补跨客户查询）' },
      { stage: '已下单', count: orders.length, hint: '全部订单（含草稿与待审）' },
      { stage: '已审核通过', count: approved.length, hint: 'ORD-02 审核通过' },
    ]
  }

  /** 按业务员的报价成交。毛利待成本模块，一律 0 并由上层标记。 */
  async byOwner(): Promise<QuoteByDim[]> {
    const orders = await this.load()
    return this.byDimension(orders, (order) => order.createdBy ?? '未指派')
  }

  /** 按材质的报价成交。材质在订单行上没有，退回按产品名分组。 */
  async byMaterial(): Promise<QuoteByDim[]> {
    const orders = await this.load()
    return this.byDimension(orders, (order) => order.lines[0]?.productName ?? '未命名')
  }

  /**
   * 未成交原因。
   *
   * 订单侧看不到「没成交的报价」——那些报价根本没变成订单。
   * 与其从被拒订单里编一个原因分布，不如如实返回空：
   * 这一格要等报价模块补上跨客户查询与 REJECTED 状态过滤。
   */
  async lostReasons(): Promise<LostReason[]> {
    return []
  }

  /**
   * 报价周期。同样受限于报价模块没有跨客户查询，
   * 现阶段只能给出订单侧的「提交 → 审核通过」这一段。
   */
  async cycle(): Promise<QuoteCycleRow[]> {
    const orders = await this.load()

    return orders
      .filter((order) => order.submittedAt !== null && order.approvedAt !== null)
      .map((order) => {
        const hours =
          ((order.approvedAt as Date).getTime() - (order.submittedAt as Date).getTime()) / 3_600_000
        const total = Math.round(hours * 10) / 10
        return {
          docNo: order.docNo,
          customer: order.customerId,
          // 核价耗时属于报价模块的节点，订单侧看不到
          costingHours: 0,
          approvalHours: total,
          totalHours: total,
          slaHours: ORDER_APPROVAL_SLA_HOURS,
          overdue: total > ORDER_APPROVAL_SLA_HOURS,
        }
      })
      .sort((left, right) => right.totalHours - left.totalHours)
  }

  /** 样品转化：样品订单里有多少客户后来下了正式单。 */
  async sampleConversion(): Promise<{ samples: number; converted: number; rate: number; amount: number }> {
    const orders = await this.load()
    const samples = orders.filter((order) => order.orderType === 'SAMPLE')
    const formalCustomers = new Set(
      orders.filter((order) => order.orderType === 'FORMAL').map((order) => order.customerId),
    )
    const converted = samples.filter((order) => formalCustomers.has(order.customerId))

    return {
      samples: samples.length,
      converted: converted.length,
      rate: rateOf(converted.length, samples.length) ?? 0,
      amount: toTenThousand(converted.reduce((sum, order) => sum + orderAmountMinor(order), 0n)),
    }
  }

  /** 样品转化按月。 */
  async sampleCycle(): Promise<SampleCycleRow[]> {
    const orders = await this.load()
    const samples = orders.filter((order) => order.orderType === 'SAMPLE' && order.approvedAt !== null)
    const formalCustomers = new Set(
      orders.filter((order) => order.orderType === 'FORMAL').map((order) => order.customerId),
    )

    return [...groupBy(samples, (order) => monthKeyOf(order.approvedAt as Date))]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([month, items]) => {
        const converted = items.filter((order) => formalCustomers.has(order.customerId))
        return {
          month,
          samples: items.length,
          converted: converted.length,
          rate: rateOf(converted.length, items.length) ?? 0,
          // 打样天数要 MES 报工，订单侧没有
          avgDays: 0,
        }
      })
  }

  private byDimension(
    orders: readonly SalesOrderRecord[],
    keyOf: (order: SalesOrderRecord) => string,
  ): QuoteByDim[] {
    return [...groupBy([...orders], keyOf)].map(([name, items]) => {
      const won = items.filter((order) => order.approvedAt !== null)
      return {
        name,
        quoted: items.length,
        won: won.length,
        rate: rateOf(won.length, items.length) ?? 0,
        // 平均毛利要实际成本，待成本模块
        avgMargin: 0,
      }
    })
  }
}

/** 订单审核 SLA（小时）。超过它就在报表上标红。 */
export const ORDER_APPROVAL_SLA_HOURS = 24
