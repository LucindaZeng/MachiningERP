import { Injectable, Logger } from '@nestjs/common'

import type {
  ReturnSettlementPort,
  ReturnSettlementRequest,
  ReturnSettlementResult,
} from './return-settlement.port'

/**
 * ⚠️ STUB —— finance 模块落地前的临时实现，**不是**最终实现。
 *
 * 语义选择：**只登记，不付款**。返回 `settlementNo: null`，意思是
 * 「处置结论已推给财务，实际退款 / 挂折让由财务在自己的账上执行」。
 * 不假造一个付款单号——假号会被当成真的付款凭据引用。每次调用打 warn，
 * 并把逐行扣减写进日志，这样即使 finance 还没落地，钱该往哪走也是有据可查的。
 */
@Injectable()
export class StubReturnSettlementAdapter implements ReturnSettlementPort {
  private readonly logger = new Logger(StubReturnSettlementAdapter.name)

  async submitSettlement(request: ReturnSettlementRequest): Promise<ReturnSettlementResult> {
    const summary = request.lines
      .map((line) => `#${line.sequence} ${line.productName} ${line.disposition} ${line.deductionMinor}`)
      .join('；')

    this.logger.warn(
      `退货财务处置使用 STUB 实现：${request.docNo}（${request.currency}）已登记但未执行付款。` +
        `逐行扣减：${summary || '无动钱的行'}。finance 模块落地后替换 RETURN_SETTLEMENT_PORT。`,
    )

    return { settlementNo: null, acceptedAt: new Date() }
  }
}
