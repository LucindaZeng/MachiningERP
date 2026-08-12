/** ecn-request 模块唯一对外出口（工程变更申请）。 */

export { EcnRequestModule } from './ecn-request.module'

/** 主用例 */
export {
  EcnRequestService,
  type CreateEcnInput,
  type EcnActor,
} from './services/ecn-request.service'
export {
  EcnImpactService,
  type AssessImpactInput,
  type ImpactInput,
} from './services/ecn-impact.service'
export { EcnApprovalService, assertSignoffComplete } from './services/ecn-approval.service'
export { EcnReadService } from './services/ecn-read.service'
export { EcnRequestFacade } from './services/ecn-request.facade'
export { EcnContextService, type EcnLinkageView } from './services/ecn-context.service'

/** 受理范围与发布前置的纯规则（分支覆盖红线压在这里） */
export {
  assertImpactsAssessed,
  assertNewDrawingProvided,
  assertNotSampleStage,
  assertRejectReason,
  assertReleasable,
  suggestNeedRequote,
  type EcnOrderFacts,
  type EcnReleaseFacts,
} from './services/ecn-scope.rules'

/** 字典与状态机 */
export {
  ECN_CHANGE_TYPES,
  ECN_CHANGE_TYPE_LABEL,
  REDIRECTED_INTENTS,
  assertEcnChangeType,
  isEcnChangeType,
  requiresEffectiveBatch,
  requiresNewDrawing,
  requiresRoutingSync,
} from './constants/ecn-change-types'
export {
  ECN_TRANSITIONS,
  ecnStateMachine,
  isEcnApproved,
  isEcnEditable,
  isEcnFinished,
} from './constants/ecn-states'
export {
  ECN_IMPACT_SCOPES,
  ECN_IMPACT_SCOPE_LABEL,
  ECN_IMPACT_SCOPE_ORDER,
  isEcnImpactScope,
  missingImpactScopes,
} from './constants/ecn-impact-scopes'
export {
  ECN_SIGNOFF_DEPARTMENTS,
  PROXY_SIGNOFF_NOTE,
  type EcnSignoffDepartment,
} from './constants/ecn-signoff'
export { ECN_DOC_TYPE, ECN_TIMELINE_NODES, ecnTimelineNodeFor } from './constants/ecn-timeline'

/** 视图映射与仓储端口 */
export { toEcnRequestView, type EcnNaming } from './services/ecn-view.mapper'
export type { EcnRequestView } from './dto/ecn-view.dto'
export type { EcnImpactView } from './dto/ecn-impact-view.dto'
export type { EcnSignoffView } from './dto/ecn-signoff-view.dto'
export {
  ECN_REPOSITORY,
  type CreateEcnRequestData,
  type EcnImpactDraft,
  type EcnImpactRecord,
  type EcnQuery,
  type EcnRepositoryPort,
  type EcnRequestPatch,
  type EcnRequestRecord,
  type EcnSignoffRecord,
} from './repositories/ecn.repository.port'
