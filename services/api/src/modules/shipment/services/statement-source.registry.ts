import { Injectable, Logger } from '@nestjs/common'

import type { SourceDocumentEntry } from '../repositories/statement-source.port'

/**
 * 对账单的开票 / 退货两路来源注册表。
 *
 * 为什么要注册表而不是直接注入对方模块：**会成环**。
 * invoice-request 建单时要读出货明细（自动带出金额），
 * 而对账单的「开票」列又要读发票——两个模块互相依赖。
 * 于是反过来：shipment 只挂一个空槽，invoice-request / sales-return
 * 在自己启动时把实现塞进来。依赖方向因此只有一条（下游 → shipment），
 * 不用 forwardRef，也不用把对账搬出 shipment。
 *
 * 与 file-preview 的 resolver registry 是同一套路子。
 */
export interface StatementInvoiceSource {
  /** 期间内**已开出**的发票（含红字发票，红字为负） */
  invoicesInPeriod(customerId: string, from: Date, to: Date): Promise<SourceDocumentEntry[]>
}

/**
 * 退货来源的条目比通用的源单条目多两个字段，因为对账单需要**逐条**知道：
 *
 * - `lineType`：这条是退货（RETURN）还是折让（ALLOWANCE）。两者都是减项，
 *   但客户看到的是两回事——让步接收的货还在客户手里，写成「退货」他会来问。
 * - `settledByCreditNote`：这笔扣减是否已由红字发票承接。开票制口径下，
 *   红字已经把开票列减过一次了，这里再减一次就是重复冲减。
 */
export interface ReturnSourceEntry extends SourceDocumentEntry {
  lineType: 'RETURN' | 'ALLOWANCE'
  settledByCreditNote: boolean
}

export interface StatementReturnSource {
  /** 期间内的退货与折让（按 RMA 结案日落期间） */
  returnsInPeriod(customerId: string, from: Date, to: Date): Promise<ReturnSourceEntry[]>
}

@Injectable()
export class StatementSourceRegistry {
  private readonly logger = new Logger(StatementSourceRegistry.name)

  private invoiceSource: StatementInvoiceSource | null = null
  private returnSource: StatementReturnSource | null = null

  registerInvoiceSource(source: StatementInvoiceSource): void {
    this.invoiceSource = source
    this.logger.log('对账单「开票」列已接入真实来源（invoice-request）')
  }

  registerReturnSource(source: StatementReturnSource): void {
    this.returnSource = source
    this.logger.log('对账单「退货折让」列已接入真实来源（sales-return）')
  }

  /**
   * 没有注册来源时返回空集——这是**已知的不完整**，不是算错：
   * 对应模块还没落地，那一列就该是 0，而不是拿别处的数字凑。
   */
  async invoicesInPeriod(customerId: string, from: Date, to: Date): Promise<SourceDocumentEntry[]> {
    return this.invoiceSource?.invoicesInPeriod(customerId, from, to) ?? []
  }

  async returnsInPeriod(customerId: string, from: Date, to: Date): Promise<ReturnSourceEntry[]> {
    return this.returnSource?.returnsInPeriod(customerId, from, to) ?? []
  }

  /** 供自检与测试断言：这两列现在读的是真数据还是空槽。 */
  get wiring(): { invoices: boolean; returns: boolean } {
    return { invoices: this.invoiceSource !== null, returns: this.returnSource !== null }
  }
}
