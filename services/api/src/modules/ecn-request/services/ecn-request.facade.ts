import { Injectable } from '@nestjs/common'

import { EcnContextService } from './ecn-context.service'
import { EcnReadService } from './ecn-read.service'
import { EcnRequestService, type EcnActor } from './ecn-request.service'

import type { CreateEcnDto } from '../dto/create-ecn.dto'
import type { EcnRequestView } from '../dto/ecn-view.dto'

/**
 * 「建单 → 出视图」这一步的编排。
 *
 * 单独一层的理由：controller 只做 HTTP 编解码，不能自己去取订单事实再拼视图；
 * 而 `EcnRequestService` 不该认识视图。中间这一小步放在 facade 里。
 */
@Injectable()
export class EcnRequestFacade {
  constructor(
    private readonly requests: EcnRequestService,
    private readonly context: EcnContextService,
    private readonly reads: EcnReadService,
  ) {}

  async createAndView(dto: CreateEcnDto, actor: EcnActor): Promise<EcnRequestView> {
    // 样品阶段判据取自关联订单，因此建单前先把订单事实取好
    const order = await this.context.orderFacts(dto.orderId ?? null)

    const created = await this.requests.create(
      {
        customerId: dto.customerId,
        orderId: dto.orderId ?? null,
        productName: dto.productName,
        drawingNo: dto.drawingNo,
        drawingVersionId: dto.drawingVersionId ?? null,
        newDrawingVersionId: dto.newDrawingVersionId ?? null,
        bomRequestId: dto.bomRequestId ?? null,
        quotationId: dto.quotationId ?? null,
        changeType: dto.changeType,
        origin: dto.origin,
        urgent: dto.urgent,
        beforeValue: dto.beforeValue,
        afterValue: dto.afterValue,
        reason: dto.reason,
      },
      order,
      actor,
    )

    return this.reads.render(created)
  }
}
