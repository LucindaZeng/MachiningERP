import { Injectable } from '@nestjs/common'

import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'

import { ShipmentContextService } from './shipment-context.service'
import { toShipmentHeaderDraft, toShipmentLineDrafts } from './shipment-input.mapper'
import { toShipmentTimelineView } from './shipment-timeline.mapper'
import { toShipmentView } from './shipment-view.mapper'
import { ShipmentService, type ShipmentActor } from './shipment.service'

import type { CreateShipmentDto } from '../dto/create-shipment.dto'
import type { ShipmentView } from '../dto/shipment-view.dto'
import type {
  ShipmentQuery,
  ShipmentRecord,
} from '../repositories/shipment.repository.port'

/**
 * 读侧组装：领域记录 + 跨模块的名称 + 平台节点计时 → 前端要的那一坨。
 *
 * 单独拎出来是因为这段组装 controller 和 flow controller 都要用，
 * 而 controller 只该做 HTTP 编解码——把三处取数塞进 controller 就成了业务层。
 */
@Injectable()
export class ShipmentReadService {
  constructor(
    private readonly shipments: ShipmentService,
    private readonly context: ShipmentContextService,
    private readonly timeline: DocTimelineService,
  ) {}

  async render(record: ShipmentRecord): Promise<ShipmentView> {
    const [naming, nodes] = await Promise.all([
      this.context.namingFor(record.orderId, record.customerId, record.ownerUserCode),
      this.timeline.list(DOC_TYPES.SHIPMENT, record.id),
    ])

    return toShipmentView(record, naming, toShipmentTimelineView(nodes, naming.ownerName))
  }

  async list(query: ShipmentQuery): Promise<ShipmentView[]> {
    const records = await this.shipments.list(query)
    return Promise.all(records.map((record) => this.render(record)))
  }

  async detail(id: string): Promise<ShipmentView> {
    return this.render(await this.shipments.load(id))
  }

  async createAndView(dto: CreateShipmentDto, actor: ShipmentActor & { userCode: string }): Promise<ShipmentView> {
    const order = await this.context.orderContext(dto.orderId)
    const record = await this.shipments.create(
      toShipmentHeaderDraft(dto, actor.userCode),
      toShipmentLineDrafts(dto),
      order.lines,
      actor,
    )
    return this.render(record)
  }
}
