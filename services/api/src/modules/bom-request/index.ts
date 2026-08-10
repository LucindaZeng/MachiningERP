/** bom-request 模块唯一对外出口（BOM 申请与工程回传）。 */

export { BomRequestModule } from './bom-request.module'

export { BomRequestService, type BomActor } from './services/bom-request.service'
export { BomEngineeringService, deriveStatus } from './services/bom-engineering.service'

/** 状态机：BOM 可下单与程序可开工是两个独立开关，不得合并 */
export {
  BOM_REQUEST_TRANSITIONS,
  bomRequestStateMachine,
  canPlaceOrder,
  isBomRequestEditable,
} from './constants/bom-request-states'

export { toBomRequestView } from './services/bom-request-view.mapper'
export { toBomRequestDraft } from './services/bom-request-input.mapper'
export type { BomRequestView } from './dto/bom-request-view.dto'
export {
  BOM_REQUEST_REPOSITORY,
  type BomRequestDraft,
  type BomRequestPatch,
  type BomRequestQuery,
  type BomRequestRecord,
  type BomRequestRepositoryPort,
  type CreateBomRequestData,
} from './repositories/bom-request.repository.port'
