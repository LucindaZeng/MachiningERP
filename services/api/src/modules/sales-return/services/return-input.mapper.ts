import type { DispositionLineInput, JudgeLineInput } from './return-flow.service'
import type { JudgeReturnDto } from '../dto/judge-return.dto'
import type { ListReturnsDto } from '../dto/list-returns.dto'
import type { RegisterReturnDto } from '../dto/register-return.dto'
import type { SubmitDispositionDto } from '../dto/submit-disposition.dto'
import type { SalesReturnLineDraft, SalesReturnQuery } from '../repositories/sales-return.repository.port'
import type { ReturnDisposition, ReturnResponsibility } from '@prisma/client'

/**
 * HTTP 形状 → 领域形状。
 *
 * 单拎一支文件的理由与 shipment 一样：controller 只做编解码，
 * 而「字符串金额 → bigint」「ISO 串 → Date」这类转换有一处就够了，
 * 散在两个 controller 里迟早会有一处忘了转。
 */

export function toReturnLineDrafts(dto: RegisterReturnDto): SalesReturnLineDraft[] {
  return dto.lines.map((line) => ({
    sequence: line.sequence,
    shipmentLineId: line.shipmentLineId,
    orderLineId: line.orderLineId ?? null,
    productName: line.productName,
    drawingNo: line.drawingNo,
    batchNo: line.batchNo,
    returnQty: line.returnQty,
    unitPriceMinor: BigInt(line.unitPriceMinor),
    amountMinor: BigInt(line.amountMinor),
    reason: line.reason,
  }))
}

export function toJudgeInputs(dto: JudgeReturnDto): JudgeLineInput[] {
  return dto.lines.map((line) => ({
    lineId: line.lineId,
    responsibility: line.responsibility as ReturnResponsibility,
  }))
}

export function toDispositionInputs(dto: SubmitDispositionDto): DispositionLineInput[] {
  return dto.lines.map((line) => ({
    lineId: line.lineId,
    disposition: line.disposition as ReturnDisposition,
    dispositionNote: line.dispositionNote ?? null,
    // 空串与 undefined 都当作「没填」，不要变成 0n——0 折让与没填是两回事
    allowanceMinor: line.allowanceMinor ? BigInt(line.allowanceMinor) : null,
  }))
}

export function toReturnQuery(dto: ListReturnsDto): SalesReturnQuery {
  const query: SalesReturnQuery = {}
  if (dto.customerId) query.customerId = dto.customerId
  if (dto.orderId) query.orderId = dto.orderId
  if (dto.shipmentId) query.shipmentId = dto.shipmentId
  if (dto.status) query.status = dto.status
  if (dto.ownerUserCode) query.ownerUserCode = dto.ownerUserCode
  if (dto.closedFrom) query.closedFrom = new Date(dto.closedFrom)
  if (dto.closedTo) query.closedTo = new Date(dto.closedTo)
  return query
}
