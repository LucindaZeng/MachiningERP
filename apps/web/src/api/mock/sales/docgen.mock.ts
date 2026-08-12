import type { GeneratedDocument } from '@/api/sales/docgen.api'

/**
 * 单据出具的本地兜底。
 *
 * 只造**生成记录**，不造文件：本地没有对象存储也没有 kkFileView，
 * 编一个假的下载地址只会让人以为文件真的出来了。因此预览／下载在本地
 * 会走到 file-preview 的兜底，那里明说的是「本地演示无文件」。
 *
 * 记录仍然造得完整（模板 id、模板版本、份数、文件名），
 * 因为页面上要展示的正是这些，且它们能验证前端把参数传对了。
 */

const issued: GeneratedDocument[] = []

function stamp(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
}

function record(input: {
  sourceType: string
  sourceId: string
  templateId: string
  label: string
  documentCount: number
}): GeneratedDocument {
  const generated: GeneratedDocument = {
    id: `GEN-${issued.length + 1}`,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceDocNo: input.sourceId,
    templateId: input.templateId,
    templateVersion: 1,
    fileName: `${input.label}-${input.sourceId}-${stamp()}.xlsx`,
    sizeBytes: 18_432,
    documentCount: input.documentCount,
    generatedAt: new Date().toISOString(),
    generatedBy: 'WFX-2018-0042',
  }
  issued.unshift(generated)
  return generated
}

function idsOf(body: unknown): string[] {
  const ids = (body as { ids?: unknown })?.ids
  return Array.isArray(ids) ? ids.map(String) : []
}

export const DOCGEN_ROUTES: Array<{
  path: string
  handle: (params: string[], body: unknown) => unknown
}> = [
  {
    path: 'GET /documents',
    handle: () => issued,
  },
  {
    path: 'POST /documents/quotations/:id',
    handle: ([id]) =>
      record({
        sourceType: 'Quotation',
        sourceId: id!,
        templateId: 'QUOTATION_DOMESTIC',
        label: '报价单',
        documentCount: 1,
      }),
  },
  {
    path: 'POST /documents/cost-analyses/:id',
    handle: ([id]) =>
      record({
        sourceType: 'CostAnalysis',
        sourceId: id!,
        templateId: 'COST_ANALYSIS_CNC',
        label: '成本分析',
        documentCount: 1,
      }),
  },
  {
    path: 'POST /documents/statements/:id',
    handle: ([id]) =>
      record({
        sourceType: 'Statement',
        sourceId: id!,
        templateId: 'STATEMENT',
        label: '对账单',
        documentCount: 1,
      }),
  },
  {
    path: 'POST /documents/merge/quotations',
    handle: (_params, body) =>
      record({
        sourceType: 'MergeExport',
        sourceId: 'merge',
        templateId: 'QUOTATION_MERGE',
        label: '报价合并比较表',
        documentCount: idsOf(body).length,
      }),
  },
  {
    path: 'POST /documents/merge/cost-analyses',
    handle: (_params, body) =>
      record({
        sourceType: 'MergeExport',
        sourceId: 'merge',
        templateId: 'COST_ANALYSIS_MERGE',
        label: '成本分析合并比较表',
        documentCount: idsOf(body).length,
      }),
  },
]
