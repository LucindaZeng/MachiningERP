import { SHIPMENT_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { QC_RELEASE_PORT, type QcReleasePort } from '../repositories/qc-release.port'
import { RECEIPT_PORT, type ReceiptPort } from '../repositories/receipt.port'

import { collectShipGateIssues, type QcLineFacts, type ShipGateIssue } from './ship-gate.rules'
import { lineAmountMinor } from './shipment-view.mapper'

import type { ShipmentRecord } from '../repositories/shipment.repository.port'
import type { PaymentTerm } from '@prisma/client'

/**
 * 出货双闸门（业务规格第 7 章）：品质放行 + 财务信用。
 *
 * 判定规则是纯函数（ship-gate.rules.ts），本服务只负责把两个读端口的事实取齐。
 * 两道闸门**都跑完**再决定拦不拦——先报品质、业务员补完再被信用拦一次，
 * 是最惹人厌的那种交互。
 */
@Injectable()
export class ShipGateService {
  constructor(
    @Inject(QC_RELEASE_PORT) private readonly qc: QcReleasePort,
    @Inject(RECEIPT_PORT) private readonly receipts: ReceiptPort,
  ) {}

  /** 逐行取品质放行结论；端口约定查不到即 released:false，这里不再兜底放行。 */
  private async qcFactsFor(shipment: ShipmentRecord): Promise<QcLineFacts[]> {
    return Promise.all(
      shipment.lines.map(async (line) => {
        const verdict = await this.qc.verdictFor({
          drawingNo: line.drawingNo,
          batchNo: line.batchNo,
        })
        return {
          drawingNo: line.drawingNo,
          batchNo: line.batchNo,
          released: verdict.released,
          reason: verdict.reason,
        }
      }),
    )
  }

  /** 本单应收：各行「本次发货数 × 单价」之和。 */
  static payableOf(shipment: ShipmentRecord): bigint {
    return shipment.lines.reduce((sum, line) => sum + lineAmountMinor(line), 0n)
  }

  async evaluate(shipment: ShipmentRecord, paymentTerm: PaymentTerm): Promise<ShipGateIssue[]> {
    const [qcLines, received] = await Promise.all([
      this.qcFactsFor(shipment),
      this.receipts.receivedForOrder(shipment.orderId),
    ])

    return collectShipGateIssues(qcLines, {
      paymentTerm,
      payableMinor: ShipGateService.payableOf(shipment),
      receivedMinor: received.receivedMinor,
      currency: shipment.currency,
    })
  }

  /** 有任何一条不通过就拦，失败项一次列全放进 details.issues。 */
  async assertShippable(shipment: ShipmentRecord, paymentTerm: PaymentTerm): Promise<void> {
    const issues = await this.evaluate(shipment, paymentTerm)
    if (issues.length === 0) return

    throw new BizError(SHIPMENT_ERRORS.RELEASE_BLOCKED, {
      message: `出货被阻断（${issues.length} 项）：${issues.map((issue) => issue.message).join('；')}`,
      details: { issues },
    })
  }
}
