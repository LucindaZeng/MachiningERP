import { DOCGEN_ERRORS } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { CostingService, QuotationService } from '../../quotation'
import { DOCGEN_TEMPLATES, MERGE_EXPORT_LIMIT } from '../constants/template-registry'
import { DOCGEN_SOURCE_TYPES } from '../repositories/generated-document.repository.port'

import { toCostAnalysisMergeRows } from './cost-analysis-payload.mapper'
import { DocgenContextService } from './docgen-context.service'
// ⚠️ 必须是**值导入**：emitDecoratorMetadata 只认值导入，
// 写成 `import type` 会让构造参数的元数据退化成 Object，Nest 就注入不进来了。
// 这里不存在循环——docgen.service 不认识 merge-export.service。
import { DocgenService } from './docgen.service'
import { toDateText } from './money-format'
import { toQuotationMergeRows } from './quotation-payload.mapper'

import type { DocgenActor } from './docgen.service'
import type { GeneratedDocumentRecord } from '../repositories/generated-document.repository.port'

/**
 * 多选合并导出：把 N 份报价单（或 N 份成本分析）合成**一张平表**。
 *
 * 为什么摊平成一行一明细，而不是「一份单据渲染成一块」：
 * 合并导出的用途是横向比价与复核。能排序、能筛选、能透视的平表才做得到这件事；
 * 一块块拼起来的版面，排一次序就散架了。单据身份靠前几列重复带出。
 *
 * 有意保留的一个「不方便」：同一产品有几档起订量就出几行，因此单价列**不能直接求和**。
 * 模板表尾写明了这一点。合成一行再把档位塞进备注，看着清爽，但会让人把不同档的价
 * 当成同一件事去比。
 */
@Injectable()
export class MergeExportService {
  constructor(
    private readonly quotations: QuotationService,
    private readonly costing: CostingService,
    private readonly context: DocgenContextService,
    private readonly docgen: DocgenService,
  ) {}

  /** 报价单合并比较表。 */
  async exportQuotations(ids: readonly string[], actor: DocgenActor): Promise<GeneratedDocumentRecord> {
    assertSelection(ids)
    const records = await Promise.all(ids.map((id) => this.quotations.load(id)))

    const rows = (
      await Promise.all(
        records.map(async (record) =>
          toQuotationMergeRows(
            record,
            await this.context.customerName(record.customerId),
            record.status,
          ),
        ),
      )
    ).flat()

    return this.issue(DOCGEN_TEMPLATES.QUOTATION_MERGE, rows, records.length, actor)
  }

  /** 成本分析合并比较表。 */
  async exportCostAnalyses(
    ids: readonly string[],
    actor: DocgenActor,
  ): Promise<GeneratedDocumentRecord> {
    assertSelection(ids)
    const records = await Promise.all(ids.map((id) => this.costing.load(id)))

    const rows = (
      await Promise.all(
        records.map(async (record) =>
          toCostAnalysisMergeRows(
            record,
            this.costing.totalsOf(record),
            await this.context.customerName(record.customerId),
          ),
        ),
      )
    ).flat()

    return this.issue(DOCGEN_TEMPLATES.COST_ANALYSIS_MERGE, rows, records.length, actor)
  }

  private async issue(
    templateId: typeof DOCGEN_TEMPLATES.QUOTATION_MERGE | typeof DOCGEN_TEMPLATES.COST_ANALYSIS_MERGE,
    rows: ReadonlyArray<Record<string, unknown>>,
    documentCount: number,
    actor: DocgenActor,
  ): Promise<GeneratedDocumentRecord> {
    const issuedOn = new Date()
    const ownerName = await this.context.displayName(actor.userCode)

    return this.docgen.issueAndRegister({
      templateId,
      payload: {
        exportedOn: toDateText(issuedOn),
        owner: { name: ownerName },
        documentCount,
        lineCount: rows.length,
        rows,
      },
      sourceType: DOCGEN_SOURCE_TYPES.MERGE_EXPORT,
      // 合并导出没有单一来源单据；用导出人工号占位，列表按人能查回自己导过什么
      sourceId: EMPTY_SOURCE_ID,
      sourceDocNo: `${actor.userCode}-${documentCount}份`,
      issuedOn,
      actor,
      documentCount,
    })
  }
}

/**
 * 合并导出没有来源单据主键，但 `source_id` 是 uuid 列。
 * 用全零 uuid 占位而不是留空：列类型就摆在那里，塞一个非 uuid 字符串会在写库时炸。
 */
const EMPTY_SOURCE_ID = '00000000-0000-0000-0000-000000000000'

/**
 * 选择校验。上限存在的理由是内存——一次点选整年报价会把渲染进程拖垮，
 * 而那种失败发生在渲染中途，用户只会看到一个超时。
 */
function assertSelection(ids: readonly string[]): void {
  if (ids.length === 0) throw new BizError(DOCGEN_ERRORS.NOTHING_SELECTED)
  if (ids.length > MERGE_EXPORT_LIMIT) {
    throw new BizError(DOCGEN_ERRORS.TOO_MANY_SELECTED, {
      message: `一次最多合并导出 ${MERGE_EXPORT_LIMIT} 份，本次选了 ${ids.length} 份`,
    })
  }
}
