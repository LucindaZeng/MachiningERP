import { CHANGE_TYPE_LABEL } from '../constants/order-change-rules'

import type { OrderChangeRequestView } from '../dto/order-change-view.dto'
import type { OrderChangeRequestRecord } from '../repositories/order-change-request.repository.port'

export function toOrderChangeView(record: OrderChangeRequestRecord): OrderChangeRequestView {
  return {
    id: record.id,
    requestNo: record.requestNo,
    orderId: record.orderId,
    orderLineId: record.orderLineId,
    changeType: record.changeType,
    changeTypeLabel: CHANGE_TYPE_LABEL[record.changeType],
    origin: record.origin,
    urgent: record.urgent,
    beforeValue: record.beforeValue,
    afterValue: record.afterValue,
    reason: record.reason,
    costOwner: record.costOwner,
    status: record.status,
    submittedBy: record.submittedBy,
    submittedAt: record.submittedAt.toISOString(),
    handledBy: record.handledBy,
    handledAt: record.handledAt?.toISOString() ?? null,
    rejectReason: record.rejectReason,
    versionLock: record.versionLock,
  }
}
