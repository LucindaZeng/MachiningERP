import { DOCGEN_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { CostingService, QuotationService } from '../../quotation'
import { StatementService } from '../../shipment'
import {
  TEMPLATE_DEFINITIONS,
  quotationTemplateOf,
  type DocgenTemplateId,
} from '../constants/template-registry'
import {
  DOCGEN_SOURCE_TYPES,
  GENERATED_DOCUMENT_REPOSITORY,
  type DocgenSourceType,
  type GeneratedDocumentRecord,
  type GeneratedDocumentRepositoryPort,
} from '../repositories/generated-document.repository.port'

import { toCostAnalysisPayload } from './cost-analysis-payload.mapper'
import { DocgenContextService } from './docgen-context.service'
import { DocumentIssueService } from './document-issue.service'
import { composeFileName, composeGeneratedObjectKey } from './document-object-key'
import { toQuotationPayload } from './quotation-payload.mapper'
import { toStatementPayload } from './statement-payload.mapper'


/** 出具动作的执行人。 */
export interface DocgenActor {
  userCode: string
}

/**
 * 单份单据的出具（报价单 / 成本分析 / 对账单）。
 *
 * 三条路径的骨架完全一样：**取记录 → 取名字 → 映射 → 渲染落盘 → 登记 → 审计**。
 * 差异只在中间两步，因此统一收在 `issueAndRegister` 里，
 * 免得三处各写一遍「文件名怎么拼、审计记什么」而慢慢长歪。
 *
 * 报关文件不走这里：它有自己的版本链行做登记（见 customs-render.adapter.ts）。
 */
@Injectable()
export class DocgenService {
  constructor(
    private readonly quotations: QuotationService,
    private readonly costing: CostingService,
    private readonly statements: StatementService,
    private readonly context: DocgenContextService,
    private readonly issuer: DocumentIssueService,
    private readonly audit: AuditService,
    @Inject(GENERATED_DOCUMENT_REPOSITORY)
    private readonly repository: GeneratedDocumentRepositoryPort,
  ) {}

  /** 报价单：国内 / 国外两套版式由记录上的 `template` 决定。 */
  async issueQuotation(id: string, actor: DocgenActor): Promise<GeneratedDocumentRecord> {
    const record = await this.quotations.load(id)
    const templateId = quotationTemplateOf(record.template)
    const naming = await this.context.quotationNaming(
      record.customerId,
      record.createdBy ?? actor.userCode,
    )
    const issuedOn = new Date()

    return this.issueAndRegister({
      templateId,
      payload: toQuotationPayload(record, naming, templateId, issuedOn),
      sourceType: DOCGEN_SOURCE_TYPES.QUOTATION,
      sourceId: record.id,
      sourceDocNo: record.docNo,
      issuedOn,
      actor,
    })
  }

  /** CNC 成本分析：金额取后端算好的值，模板里已无公式。 */
  async issueCostAnalysis(id: string, actor: DocgenActor): Promise<GeneratedDocumentRecord> {
    const record = await this.costing.load(id)
    const totals = this.costing.totalsOf(record)
    const customerName = await this.context.customerName(record.customerId)
    const issuedOn = new Date()

    return this.issueAndRegister({
      templateId: 'COST_ANALYSIS_CNC',
      payload: toCostAnalysisPayload(record, totals, { customerName }, issuedOn),
      sourceType: DOCGEN_SOURCE_TYPES.COST_ANALYSIS,
      sourceId: record.id,
      sourceDocNo: record.docNo,
      issuedOn,
      actor,
    })
  }

  /** 客户对账单。 */
  async issueStatement(id: string, actor: DocgenActor): Promise<GeneratedDocumentRecord> {
    const record = await this.statements.load(id)
    const [customerName, ownerName] = await Promise.all([
      this.context.customerName(record.customerId),
      this.context.displayName(record.ownerUserCode),
    ])

    return this.issueAndRegister({
      templateId: 'STATEMENT',
      payload: toStatementPayload(record, {
        customerName,
        ownerName,
        // 口径文字随对账单一起印出去：客户问「这个数怎么来的」，答案要在纸面上
        basisLabel: basisLabelOf(record.differenceNote),
      }),
      sourceType: DOCGEN_SOURCE_TYPES.STATEMENT,
      sourceId: record.id,
      sourceDocNo: record.docNo,
      issuedOn: new Date(),
      actor,
    })
  }

  async detail(id: string): Promise<GeneratedDocumentRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(DOCGEN_ERRORS.GENERATED_NOT_FOUND)
    return record
  }

  list(sourceType: string, sourceId: string): Promise<GeneratedDocumentRecord[]> {
    return this.repository.list({ sourceType, sourceId })
  }

  /** 渲染 → 落盘 → 登记 → 审计。四条出具路径共用。 */
  async issueAndRegister(input: {
    templateId: DocgenTemplateId
    payload: unknown
    sourceType: DocgenSourceType
    sourceId: string
    sourceDocNo: string
    issuedOn: Date
    actor: DocgenActor
    documentCount?: number
    label?: string
  }): Promise<GeneratedDocumentRecord> {
    const definition = TEMPLATE_DEFINITIONS[input.templateId]
    const objectKey = composeGeneratedObjectKey({
      sourceType: input.sourceType,
      sourceDocNo: input.sourceDocNo,
      templateId: input.templateId,
      templateVersion: definition.version,
    })

    const issued = await this.issuer.issue({
      templateId: input.templateId,
      payload: input.payload,
      objectKey,
      fileName: composeFileName(
        input.label ?? definition.label,
        input.sourceDocNo,
        input.issuedOn,
      ),
    })

    const record = await this.repository.create({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceDocNo: input.sourceDocNo,
      templateId: input.templateId,
      templateVersion: issued.templateVersion,
      objectKey: issued.objectKey,
      fileName: issued.fileName,
      sizeBytes: issued.sizeBytes,
      documentCount: input.documentCount ?? 1,
      generatedBy: input.actor.userCode,
    })

    await this.audit.record({
      actorUserCode: input.actor.userCode,
      action: 'docgen.issue',
      entityType: input.sourceType,
      entityId: input.sourceDocNo,
      after: {
        templateId: input.templateId,
        templateVersion: issued.templateVersion,
        fileName: issued.fileName,
        documentCount: input.documentCount ?? 1,
      },
    })

    return record
  }
}

/**
 * 对账单口径文字。
 *
 * `StatementRecord` 上没有独立的 basis 字段（口径在生成时决定并已体现进各列金额），
 * 因此这里只能给一句通用说明，而不是编一个看起来精确的口径名。
 */
function basisLabelOf(differenceNote: string | null): string {
  return differenceNote ? '按生成时所选口径汇总（详见差异说明）' : '按生成时所选口径汇总'
}
