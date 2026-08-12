/** customs 模块唯一对外出口（报关资料）。 */

export { CustomsModule } from './customs.module'

/** 主用例 */
export {
  CustomsService,
  assertFieldsComplete,
  completenessFactsOf,
  type CustomsActor,
} from './services/customs.service'
export {
  CustomsDocumentService,
  assertPackComplete,
  assertShipmentReady,
  type ShipmentPostingFacts,
} from './services/customs-document.service'
export {
  CustomsDeclarationService,
  assertDeclaredAlready,
  assertPackReadyForDeclaration,
  assertReviewed,
  collectCorrectionLines,
} from './services/customs-declaration.service'
export { CustomsReadService } from './services/customs-read.service'
export { CustomsDocumentFacade } from './services/customs-document.facade'
export {
  CustomsContextService,
  type CustomsShipmentContext,
} from './services/customs-context.service'

/** 版本链与申报快照的纯规则 */
export {
  buildDeclarationManifest,
  currentVersionOf,
  diffAgainstDeclaration,
  missingPackDocuments,
  nextVersionOf,
  type CorrectionLine,
  type DeclarationLine,
  type DocumentVersionFacts,
} from './services/customs-version.rules'

/** 要素齐套清单（服务端硬闸门） */
export {
  COMPLETENESS_MANIFEST,
  missingFieldsFor,
  missingFieldsForDossier,
  type CompletenessFacts,
} from './constants/customs-completeness'

/** 状态机与文件种类字典 */
export {
  CUSTOMS_TRANSITIONS,
  customsStateMachine,
  isDeclared,
  isDossierEditable,
} from './constants/customs-states'
export {
  CUSTOMS_DOC_KINDS,
  CUSTOMS_DOC_KIND_VALUES,
  DOC_KIND_BY_TEMPLATE,
  DOC_KIND_LABEL,
  DOC_KIND_TO_TEMPLATE,
  REQUIRED_FOR_DATA_PACK,
  isCustomsTemplateCode,
  requiresPostedShipment,
  type CustomsTemplateCode,
} from './constants/customs-doc-kinds'
export {
  CUSTOMS_TIMELINE_NODES,
  customsTimelineNodeFor,
  type CustomsTimelineStage,
} from './constants/customs-timeline'

/** 视图映射 */
export { toCustomsDossierView, type CustomsNaming } from './services/customs-view.mapper'
export { toCustomsTimelineView } from './services/customs-timeline.mapper'
export type { CustomsDossierView } from './dto/customs-dossier-view.dto'
export type { CustomsDocumentView } from './dto/customs-document-view.dto'
export type { CustomsDeclarationView } from './dto/customs-declaration-view.dto'
export type { CustomsCorrectionView } from './dto/customs-correction-view.dto'

/** 仓储端口与出文件 STUB 端口 */
export {
  CUSTOMS_REPOSITORY,
  type CreateCustomsDossierData,
  type CustomsDocumentRecord,
  type CustomsDossierPatch,
  type CustomsDossierRecord,
  type CustomsQuery,
  type CustomsRepositoryPort,
} from './repositories/customs.repository.port'
export {
  DOCUMENT_RENDER_PORT,
  type DocumentRenderPort,
  type DocumentRenderRequest,
  type DocumentRenderResult,
} from './repositories/document-render.port'
/** docgen 通过它登记真实渲染实现；未登记时退回 STUB */
export { DocumentRenderRegistry } from './repositories/document-render.registry'
export { StubDocumentRenderAdapter } from './repositories/stub-document-render.adapter'
