import { Injectable, Logger } from '@nestjs/common'

import type { ReceiptEntry, ReceiptPort, ReceiptSummary } from './receipt.port'

/**
 * ⚠️ STUB —— finance 模块落地前的临时 provider，**不是**最终实现。
 *
 * 语义选择：回款一律返回 0。与品质那个 stub 相反，这里选择保守：
 * 预付/现金客户在没有回款数据时**会被拦下**。放行一批未付款的货是真金白银的损失，
 * 而被拦下只是需要人工确认，两者代价不对称。月结客户不看回款，因此不受影响。
 * finance 上线后替换 RECEIPT_PORT 的 provider 即可。
 */
@Injectable()
export class StubReceiptAdapter implements ReceiptPort {
  private readonly logger = new Logger(StubReceiptAdapter.name)

  async receivedForOrder(orderId: string): Promise<ReceiptSummary> {
    this.logger.warn(
      `回款查询使用 STUB 实现，订单 ${orderId} 一律按未收款处理（预付/现金客户会被拦下）。` +
        'finance 模块落地后必须替换 RECEIPT_PORT 的 provider。',
    )
    return { receivedMinor: 0n, currency: 'CNY' }
  }

  async receiptsInPeriod(): Promise<ReceiptEntry[]> {
    return []
  }

  async overdueForCustomer(): Promise<bigint> {
    return 0n
  }
}
