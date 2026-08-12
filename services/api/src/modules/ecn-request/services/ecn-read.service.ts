import { Injectable } from '@nestjs/common'

import { DocTimelineService, toTimelineNodeViews } from '../../../platform/timeline'
import { ECN_DOC_TYPE, ECN_TIMELINE_NODES } from '../constants/ecn-timeline'

import { EcnContextService } from './ecn-context.service'
import { EcnRequestService } from './ecn-request.service'
import { toEcnRequestView } from './ecn-view.mapper'

import type { EcnRequestView } from '../dto/ecn-view.dto'
import type { EcnQuery, EcnRequestRecord } from '../repositories/ecn.repository.port'
import type { EcnChangeType, EcnStatus } from '@prisma/client'

/** controller 传上来的是原始字符串；枚举收敛在这里做，controller 不认识 Prisma 类型。 */
export interface EcnListQuery {
  customerId?: string
  orderId?: string
  status?: string
  changeType?: string
  ownerUserCode?: string
}

/** 视图组装：记录 + 名字 + 链路 + 时间线。业务规则一概不在这里。 */
@Injectable()
export class EcnReadService {
  constructor(
    private readonly requests: EcnRequestService,
    private readonly context: EcnContextService,
    private readonly timeline: DocTimelineService,
  ) {}

  async render(record: EcnRequestRecord): Promise<EcnRequestView> {
    const [customerName, orderNo, ownerName, linkage, nodes] = await Promise.all([
      this.context.customerName(record.customerId),
      this.context.orderDocNo(record.orderId),
      this.context.displayName(record.ownerUserCode),
      this.context.linkage(record),
      this.timeline.list(ECN_DOC_TYPE, record.id),
    ])

    return toEcnRequestView(
      record,
      { customerName, orderNo, ownerName },
      linkage,
      toTimelineNodeViews(nodes, ECN_TIMELINE_NODES, ownerName),
    )
  }

  async list(query: EcnListQuery): Promise<EcnRequestView[]> {
    const narrowed: EcnQuery = {
      customerId: query.customerId,
      orderId: query.orderId,
      status: query.status as EcnStatus | undefined,
      changeType: query.changeType as EcnChangeType | undefined,
      ownerUserCode: query.ownerUserCode,
    }
    const records = await this.requests.list(narrowed)
    return Promise.all(records.map((record) => this.render(record)))
  }

  async detail(id: string): Promise<EcnRequestView> {
    return this.render(await this.requests.load(id))
  }
}
