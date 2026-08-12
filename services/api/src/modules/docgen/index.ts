/** docgen 模块唯一对外出口（按受控模板出具对外单据）。 */

export { DocgenModule } from './docgen.module'

/** 主用例 */
export { DocgenService, type DocgenActor } from './services/docgen.service'
export { MergeExportService } from './services/merge-export.service'
export { DocumentIssueService, type IssueRequest, type IssuedFile } from './services/document-issue.service'
export { TemplateRendererService, type RenderedWorkbook } from './services/template-renderer.service'
export { DocgenContextService } from './services/docgen-context.service'
export { CustomsRenderAdapter } from './services/customs-render.adapter'

/** 模板清单与选型 */
export {
  CUSTOMS_TEMPLATE_BY_KIND,
  DOCGEN_TEMPLATES,
  MERGE_EXPORT_LIMIT,
  TEMPLATE_DEFINITIONS,
  isDocgenTemplateId,
  quotationTemplateOf,
  type DocgenTemplateId,
  type TemplateDefinition,
} from './constants/template-registry'

/** 标记语法与纯渲染规则（供测试与将来的模板校验工具使用） */
export {
  INDEX_FIELD,
  MARKER_CLOSE,
  MARKER_OPEN,
  REPEAT_PREFIX,
  SELECTED_MARK,
  SELECT_PREFIX,
  UNSELECTED_MARK,
} from './constants/marker-syntax'
export {
  isMarkerOnly,
  parseMarkers,
  repeatArraysOf,
  repeatValueAt,
  valueAt,
  type Marker,
  type RepeatMarker,
  type ScalarMarker,
  type SelectMarker,
} from './services/marker-parser'
export {
  renderCell,
  rootContext,
  type CellValue,
  type RenderContext,
} from './services/cell-renderer'
export {
  blockHeight,
  blocksBottomUp,
  planRepeatBlocks,
  type RepeatBlock,
  type RowTexts,
} from './services/repeat-plan'
export { fillWorksheet } from './services/worksheet-filler'

/** 金额与数量到单元格的转换（整数分口径唯一放开的地方） */
export {
  bpsToPercent,
  decimalToNumber,
  minorToNumber,
  toDateText,
  toRateText,
} from './services/money-format'

/** 对象键与文件名 */
export {
  XLSX_CONTENT_TYPE,
  composeCustomsObjectKey,
  composeFileName,
  composeGeneratedObjectKey,
  sanitizeSegment,
} from './services/document-object-key'

/** 各单据的模板数据映射 */
export {
  toQuotationMergeRows,
  toQuotationPayload,
  type QuotationNaming,
} from './services/quotation-payload.mapper'
export {
  toCostAnalysisMergeRows,
  toCostAnalysisPayload,
  type CostAnalysisNaming,
} from './services/cost-analysis-payload.mapper'
export { toStatementPayload, type StatementNaming } from './services/statement-payload.mapper'
export {
  toCustomsPayload,
  type CustomsDocumentFacts,
  type CustomsNaming,
} from './services/customs-payload.mapper'

/** 视图与仓储端口 */
export { toGeneratedDocumentView } from './services/generated-document-view.mapper'
export type { GeneratedDocumentView } from './dto/generated-document-view.dto'
export {
  DOCGEN_SOURCE_TYPES,
  GENERATED_DOCUMENT_REPOSITORY,
  type CreateGeneratedDocumentData,
  type DocgenSourceType,
  type GeneratedDocumentQuery,
  type GeneratedDocumentRecord,
  type GeneratedDocumentRepositoryPort,
} from './repositories/generated-document.repository.port'
