import { Injectable } from '@nestjs/common'

import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'

import { ReturnContextService } from './return-context.service'
import { toReturnLineDrafts } from './return-input.mapper'
import { toReturnTimelineView } from './return-timeline.mapper'
import { toSalesReturnView } from './return-view.mapper'
import { SalesReturnService, type ReturnActor } from './sales-return.service'

import type { RegisterReturnDto } from '../dto/register-return.dto'
import type { SalesReturnView } from '../dto/sales-return-view.dto'
import type {
  SalesReturnQuery,
  SalesReturnRecord,
} from '../repositories/sales-return.repository.port'

/**
 * 读侧组装：领域记录 + 跨模块的名称 + 平台节点计时 → 前端要的那一坨。
 *
 * 单独拎出来是因为这段组装两个 controller 都要用，
 * 而 controller 只该做 HTTP 编解码。
 */
@Injectable()
export class ReturnReadService {
  constructor(
    private readonly returns: SalesReturnService,
    private readonly context: ReturnContextService,
    private readonly timeline: DocTimelineService,
  ) {}

  async render(record: SalesReturnRecord): Promise<SalesReturnView> {
    const [naming, nodes] = await Promise.all([
      this.context.namingFor(
        record.customerId,
        record.ownerUserCode,
        record.shipmentId,
        record.orderId,
      ),
      this.timeline.list(DOC_TYPES.SALES_RETURN, record.id),
    ])

    return toSalesReturnView(record, naming, toReturnTimelineView(nodes, naming.ownerName))
  }

  async list(query: SalesReturnQuery): Promise<SalesReturnView[]> {
    const records = await this.returns.list(query)
    return Promise.all(records.map((record) => this.render(record)))
  }

  async detail(id: string): Promise<SalesReturnView> {
    return this.render(await this.returns.load(id))
  }

  /**
   * 登记并返回视图。客户、订单、币种都从**原出货单**带出而不是前端传——
   * 前端能传的东西，前端就能传错。
   */
  async registerAndView(dto: RegisterReturnDto, actor: ReturnActor): Promise<SalesReturnView> {
    const shipment = await this.context.shipmentContext(dto.shipmentId)
    const record = await this.returns.register(
      {
        orderId: shipment.orderId,
        shipmentId: shipment.shipmentId,
        customerId: shipment.customerId,
        currency: shipment.currency,
        reason: dto.reason,
        eightDNo: dto.eightDNo ?? null,
        eightDRequired: dto.eightDRequired ?? false,
        complaintAt: new Date(dto.complaintAt),
        lines: toReturnLineDrafts(dto),
      },
      actor,
      shipment.lines,
    )

    return this.render(record)
  }
}
