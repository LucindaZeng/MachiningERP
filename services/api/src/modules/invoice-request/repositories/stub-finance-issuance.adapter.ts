import { Injectable, Logger } from '@nestjs/common'

import type {
  FinanceIssuancePort,
  FinanceIssuanceRequest,
  FinanceIssuanceResult,
} from './finance-issuance.port'

/**
 * ⚠️ STUB —— finance / 税控对接落地前的临时实现，**不是**最终实现。
 *
 * 语义选择：**只受理，不发号**。返回 `invoiceNo: null`，意思是
 * 「申请已到财务手上，发票号等财务在税控系统开出后人工回填」。
 * 不假造一个发票号——假号会被当成真号写进对账单和客户档案，
 * 是那种要靠翻审计日志才能收拾的错。每次调用打 warn。
 */
@Injectable()
export class StubFinanceIssuanceAdapter implements FinanceIssuancePort {
  private readonly logger = new Logger(StubFinanceIssuanceAdapter.name)

  async submitForIssuance(request: FinanceIssuanceRequest): Promise<FinanceIssuanceResult> {
    this.logger.warn(
      `财务开票使用 STUB 实现：${request.docNo} 已置为「财务开票中」，` +
        '发票号需财务在税控系统开出后人工回填。finance 模块落地后替换 FINANCE_ISSUANCE_PORT。',
    )
    return { invoiceNo: null, acceptedAt: new Date() }
  }
}
