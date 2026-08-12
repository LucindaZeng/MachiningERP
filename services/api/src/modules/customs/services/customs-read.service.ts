import { Injectable } from '@nestjs/common'

import { DOC_TYPES } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'

import { CustomsContextService } from './customs-context.service'
import { toCustomsTimelineView } from './customs-timeline.mapper'
import { toCustomsDossierView } from './customs-view.mapper'
import { CustomsService } from './customs.service'

import type { CustomsDossierView } from '../dto/customs-dossier-view.dto'
import type {
  CustomsDossierRecord,
  CustomsQuery,
} from '../repositories/customs.repository.port'

/**
 * 读侧组装：领域记录 + 跨模块的名称 + 平台节点计时 → 前端要的那一坨。
 *
 * 单独拎出来是因为这段组装两个 controller 都要用，而 controller 只该做 HTTP 编解码。
 */
@Injectable()
export class CustomsReadService {
  constructor(
    private readonly customs: CustomsService,
    private readonly context: CustomsContextService,
    private readonly timeline: DocTimelineService,
  ) {}

  async render(record: CustomsDossierRecord): Promise<CustomsDossierView> {
    const [naming, nodes] = await Promise.all([
      this.context.namingFor(
        record.shipmentId,
        record.orderId,
        record.customerId,
        record.ownerUserCode,
      ),
      this.timeline.list(DOC_TYPES.CUSTOMS_DOSSIER, record.id),
    ])

    return toCustomsDossierView(record, naming, toCustomsTimelineView(nodes, naming.ownerName))
  }

  async list(query: CustomsQuery): Promise<CustomsDossierView[]> {
    const records = await this.customs.list(query)
    return Promise.all(records.map((record) => this.render(record)))
  }

  async detail(id: string): Promise<CustomsDossierView> {
    return this.render(await this.customs.load(id))
  }
}
