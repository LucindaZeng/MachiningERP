import { PERMISSION_CODES, QUOTATION_ERRORS, type CurrencyCode } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DOC_TYPES, DocNumberService } from '../../../platform/numbering'
import {
  COST_ANALYSIS_REPOSITORY,
  type CostAnalysisLineDraft,
  type CostAnalysisRecord,
  type CostAnalysisRepositoryPort,
  type CostRateData,
} from '../repositories/cost-analysis.repository.port'

import {
  DEFAULT_PROCESS_COLUMNS,
  DEFAULT_RATES,
  calculateCostAnalysis,
  type CostAnalysisTotals,
  type ProcessColumn,
} from './cost-analysis-calculator'
import { formatBps, validateCostRates } from './cost-rate-rules'

export interface CostingActor {
  userCode: string
  permissions: readonly string[]
}

export interface CreateCostAnalysisInput {
  customerId: string
  productModel: string
  lossBps?: number
  overheadBps?: number
  vatBps?: number
  currency?: CurrencyCode
  processColumns?: ProcessColumn[]
  lines: CostAnalysisLineDraft[]
}

/**
 * 成本分析（核价）。
 *
 * 业务规格 2.2 第 4 条：**成本分析只有报价工程师角色才能做**，业务员无权创建或修改。
 * 因此每个写入口都先过 `assertQuoteEngineer`，而不是只在 controller 上挂守卫——
 * 别的模块（如报价单修改申请触发的重核）也会调到这里。
 */
@Injectable()
export class CostingService {
  constructor(
    private readonly docNumber: DocNumberService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    @Inject(COST_ANALYSIS_REPOSITORY) private readonly repository: CostAnalysisRepositoryPort,
  ) {}

  /** 核价角色闸门。放在 service 层，任何调用路径都绕不过去。 */
  static assertQuoteEngineer(actor: CostingActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.COSTING_EDIT)) {
      throw new BizError(QUOTATION_ERRORS.COSTING_ROLE_REQUIRED)
    }
  }

  /** 费率闸门。建单、改费率、重核三条路径共用，取值合法就原样返回。 */
  static assertRates(rates: CostRateData): CostRateData {
    const issues = validateCostRates(rates)
    if (issues.length === 0) return rates

    throw new BizError(QUOTATION_ERRORS.INVALID_COST_RATE, {
      message: issues.map((issue) => issue.message).join('；'),
      details: issues,
    })
  }

  async create(input: CreateCostAnalysisInput, actor: CostingActor): Promise<CostAnalysisRecord> {
    CostingService.assertQuoteEngineer(actor)
    // 建单就可以带自定义费率（如 7% 损耗 + 10% 管理费），不必先建后改
    const rates = CostingService.assertRates({
      lossBps: input.lossBps ?? DEFAULT_RATES.lossBps,
      overheadBps: input.overheadBps ?? DEFAULT_RATES.overheadBps,
      vatBps: input.vatBps ?? DEFAULT_RATES.vatBps,
    })

    const docNo = await this.docNumber.next(DOC_TYPES.COST_ANALYSIS)
    const record = await this.repository.create({
      docNo,
      version: 1,
      rootId: null,
      customerId: input.customerId,
      productModel: input.productModel.trim(),
      ...rates,
      currency: input.currency ?? DEFAULT_RATES.currency,
      processColumns: input.processColumns ?? [...DEFAULT_PROCESS_COLUMNS],
      preparedBy: actor.userCode,
      createdBy: actor.userCode,
      lines: input.lines,
    })

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'cost-analysis.create',
      entityType: 'CostAnalysis',
      entityId: record.docNo,
      after: { productModel: record.productModel, lineCount: record.lines.length },
    })

    return record
  }

  async replaceLines(
    id: string,
    versionLock: number,
    lines: CostAnalysisLineDraft[],
    actor: CostingActor,
  ): Promise<CostAnalysisRecord> {
    CostingService.assertQuoteEngineer(actor)
    const current = await this.load(id)
    this.assertEditable(current)

    const updated = await this.repository.replaceLines(id, versionLock, lines, actor.userCode)
    if (!updated) {
      throw new BizError(QUOTATION_ERRORS.COST_ANALYSIS_LOCKED, {
        message: '成本分析已被他人修改，请刷新后重试',
      })
    }

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'cost-analysis.update',
      entityType: 'CostAnalysis',
      entityId: current.docNo,
      before: { lineCount: current.lines.length },
      after: { lineCount: updated.lines.length },
    })

    return updated
  }

  /**
   * 核价完成 → 通知业务员生成报价单（业务规格 2.2 第 5 条）。
   * 通知的收件人是提交询价的业务员，由调用方传入。
   */
  async complete(id: string, salesUserCode: string, actor: CostingActor): Promise<CostAnalysisRecord> {
    CostingService.assertQuoteEngineer(actor)
    const current = await this.load(id)
    this.assertEditable(current)

    const done = await this.repository.markCompleted(id, current.versionLock, new Date())
    if (!done) {
      throw new BizError(QUOTATION_ERRORS.COST_ANALYSIS_LOCKED, {
        message: '成本分析已被他人修改，请刷新后重试',
      })
    }

    await this.notifications.notify({
      recipientUserCode: salesUserCode,
      category: 'COST_ANALYSIS_DONE',
      title: `成本分析已完成：${current.productModel}`,
      body: `${current.docNo} 核价完成，可以生成报价单了。`,
      docType: DOC_TYPES.COST_ANALYSIS,
      docId: current.docNo,
    })

    return this.load(id)
  }

  /**
   * 调整费率（业务规格 2.2：**5%/5% 只是默认值，报价工程师可按产品与客户调整**，
   * 7% 损耗 + 10% 管理费同样合法）。
   *
   * 改费率会直接改动报价，因此这里比改明细还严：角色闸门 + 锁版拦截 + 乐观锁 + 前后值留痕。
   * 留痕记的是「5% → 7%」这样的可读值，事后追溯不用再去换算万分比。
   */
  async updateRates(
    id: string,
    versionLock: number,
    rates: CostRateData,
    actor: CostingActor,
  ): Promise<CostAnalysisRecord> {
    CostingService.assertQuoteEngineer(actor)
    CostingService.assertRates(rates)

    const current = await this.load(id)
    this.assertEditable(current)

    const updated = await this.repository.updateRates(id, versionLock, rates, actor.userCode)
    if (!updated) {
      throw new BizError(QUOTATION_ERRORS.COST_ANALYSIS_LOCKED, {
        message: '成本分析已被他人修改，请刷新后重试',
      })
    }

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'cost-analysis.update-rates',
      entityType: 'CostAnalysis',
      entityId: current.docNo,
      before: describeRates(current),
      after: describeRates(updated),
    })

    return updated
  }

  /**
   * 报价审核通过时锁版。锁版后 `replaceLines` / `complete` 都会被 `assertEditable` 挡下，
   * 改价只能通过 `reviseFrom` 生成新版本——这样历史报价永远对得上当时的成本。
   */
  async lock(id: string): Promise<void> {
    await this.repository.markLocked(id)
  }

  /**
   * 从既有成本分析派生新版本（报价单修改申请重核走这条路）。
   * 新版本 version+1、rootId 指向最初那一版，明细复制后由报价工程师继续改。
   */
  async reviseFrom(
    sourceId: string,
    lines: CostAnalysisLineDraft[] | null,
    actor: CostingActor,
    rates: CostRateData | null = null,
  ): Promise<CostAnalysisRecord> {
    CostingService.assertQuoteEngineer(actor)
    const source = await this.load(sourceId)
    // 重核的常见动作就是调费率（比如把管理费从 5% 提到 10%），不传则沿用原版本
    const nextRates = CostingService.assertRates(rates ?? describeSourceRates(source))

    const docNo = await this.docNumber.next(DOC_TYPES.COST_ANALYSIS)
    const record = await this.repository.create({
      docNo,
      version: source.version + 1,
      rootId: source.rootId ?? source.id,
      customerId: source.customerId,
      productModel: source.productModel,
      lossBps: nextRates.lossBps,
      overheadBps: nextRates.overheadBps,
      vatBps: nextRates.vatBps,
      currency: source.currency,
      processColumns: source.processColumns,
      preparedBy: actor.userCode,
      createdBy: actor.userCode,
      lines: lines ?? source.lines.map(stripId),
    })

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'cost-analysis.revise',
      entityType: 'CostAnalysis',
      entityId: record.docNo,
      before: { docNo: source.docNo, version: source.version, ...describeRates(source) },
      after: { docNo: record.docNo, version: record.version, ...describeRates(record) },
    })

    return record
  }

  /** 算总：供报价单取单件成本、以及历史报价的成本分析快照展示。 */
  totalsOf(record: CostAnalysisRecord): CostAnalysisTotals {
    return calculateCostAnalysis(
      record.lines.map((line) => ({
        estimatedWeightKg: line.estimatedWeightKg,
        scrapWeightKg: line.scrapWeightKg,
        materialUnitPriceMinor: line.materialUnitPriceMinor,
        scrapUnitPriceMinor: line.scrapUnitPriceMinor,
        machiningCostMinor: line.machiningCostMinor,
        processCosts: line.processCosts,
      })),
      {
        lossBps: record.lossBps,
        overheadBps: record.overheadBps,
        vatBps: record.vatBps,
        currency: record.currency as CurrencyCode,
      },
    )
  }

  async load(id: string): Promise<CostAnalysisRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new BizError(QUOTATION_ERRORS.COST_ANALYSIS_NOT_FOUND)
    return record
  }

  private assertEditable(record: CostAnalysisRecord): void {
    if (record.status === 'LOCKED') {
      throw new BizError(QUOTATION_ERRORS.COST_ANALYSIS_LOCKED)
    }
  }
}

/** 复制明细到新版本时要去掉行 id，让仓储重新分配。 */
function stripId(line: CostAnalysisRecord['lines'][number]): CostAnalysisLineDraft {
  const { id: _id, ...rest } = line
  return rest
}

function describeSourceRates(record: CostAnalysisRecord): CostRateData {
  return { lossBps: record.lossBps, overheadBps: record.overheadBps, vatBps: record.vatBps }
}

/** 留痕用的可读费率，避免事后还要把 700 换算回 7%。 */
function describeRates(record: CostAnalysisRecord): Record<string, string> {
  return {
    loss: formatBps(record.lossBps),
    overhead: formatBps(record.overheadBps),
    vat: formatBps(record.vatBps),
  }
}
