import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'

import { StatementSourceRegistry, type StatementReturnSource, type ReturnSourceEntry } from '../../shipment'
import {
  SALES_RETURN_REPOSITORY,
  type SalesReturnRepositoryPort,
} from '../repositories/sales-return.repository.port'

import { deductionMinorOf, deductionTypeOf } from './return-statement.rules'

/**
 * 对账单「退货折让」列的真实来源——替换 shipment 里那个返回空集的 stub。
 *
 * 三条口径，每一条都值得单独记住：
 *
 * 1. **按结案日（closedAt）计入**，不是按登记日，也不是按处置审批日。
 *    结案是金额定死的那一刻；在此之前计入，等于让一张已经发给客户的对账单
 *    被后来的改动偷偷改写。七月登记、八月结案的退货落在八月——这是有意的。
 * 2. **只有动钱的行进来。** 返工把货修好还回去、补货「补发不另收费」，
 *    这两类不改变任何应收；把它们塞进对账单只会让客户以为又被减了一次。
 * 3. **让步是 ALLOWANCE，不是 RETURN。** 客户把货留下了，只是少付钱；
 *    在对账单上写「退货」，客户看到的是一笔他手里明明还有货的退货行。
 *
 * 注册进 registry 而不是被 shipment 直接注入：两个模块互相需要对方
 * （本模块建单要读出货明细），走注册表才不会成环。
 */
@Injectable()
export class ReturnStatementSource implements StatementReturnSource, OnModuleInit {
  constructor(
    private readonly registry: StatementSourceRegistry,
    @Inject(SALES_RETURN_REPOSITORY) private readonly returns: SalesReturnRepositoryPort,
  ) {}

  onModuleInit(): void {
    this.registry.registerReturnSource(this)
  }

  async returnsInPeriod(customerId: string, from: Date, to: Date): Promise<ReturnSourceEntry[]> {
    const records = await this.returns.list({
      customerId,
      status: 'CLOSED',
      closedFrom: from,
      closedTo: to,
      limit: 1000,
    })

    return records
      .filter((record) => record.closedAt !== null)
      .flatMap((record) =>
        record.lines.flatMap((line) => {
          const lineType = deductionTypeOf(line.disposition)
          if (lineType === null) return []

          return [
            {
              occurredAt: record.closedAt as Date,
              docNo: record.docNo,
              productName: line.productName,
              quantity: line.returnQty,
              amountMinor: deductionMinorOf(line),
              remark: line.dispositionNote ?? line.reason,
              lineType,
              // 开票制口径下，已由红字发票承接的扣减不再重复计入（见 statement-aggregation）
              settledByCreditNote: line.settledByCreditNote,
            },
          ]
        }),
      )
  }
}
