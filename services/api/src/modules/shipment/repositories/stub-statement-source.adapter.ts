import { Injectable } from '@nestjs/common'

import type { SourceDocumentEntry, StatementSourcePort } from './statement-source.port'

/**
 * ⚠️ STUB —— invoice-request / sales-return / finance 落地前的临时 provider。
 *
 * 全部返回空集与零期初。对账单因此在这一阶段只汇总发货，
 * 开票与退货折让两栏为 0——这是**已知的不完整**，不是算错：
 * 汇总逻辑（statement-aggregation.ts）不区分数据来自 stub 还是真实模块，
 * 换 provider 就能补齐，口径不用重算。
 */
@Injectable()
export class StubStatementSourceAdapter implements StatementSourcePort {
  async invoicesInPeriod(): Promise<SourceDocumentEntry[]> {
    return []
  }

  async returnsInPeriod(): Promise<SourceDocumentEntry[]> {
    return []
  }

  async openingBalance(): Promise<bigint> {
    return 0n
  }
}
