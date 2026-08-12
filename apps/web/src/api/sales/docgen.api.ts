import { request } from '../http'

/**
 * 单据出具（docgen）。
 *
 * 与 `utils/export-excel.ts` 那支客户端导出的分工：
 * **「导出你屏幕上这张表」归前端，「按受控模板出具一份对外单据」归服务端。**
 * 后者要留版本、盖汇率快照、能被审计、能在线预览——这些前端都做不到。
 *
 * 端点只返回生成记录，**不返回文件字节**：文件一律走
 * `/files/generated-document/:id/preview-url` 与 `download-url` 取，
 * 那两个端点会验权、签短时效链接并逐次留审计。
 */
export interface GeneratedDocument {
  id: string
  sourceType: string
  sourceId: string
  sourceDocNo: string
  templateId: string
  templateVersion: number
  fileName: string
  sizeBytes: number
  /** 合并导出时被合进来的单据份数；单份出具为 1 */
  documentCount: number
  generatedAt: string
  generatedBy: string
}

/** 某张单据出过哪些文件（按出具时间倒序）。 */
export function fetchGeneratedDocuments(
  sourceType: string,
  sourceId: string,
): Promise<GeneratedDocument[]> {
  return request<GeneratedDocument[]>({
    method: 'GET',
    url: `/documents?sourceType=${encodeURIComponent(sourceType)}&sourceId=${encodeURIComponent(sourceId)}`,
  })
}

/** 按受控模板出具报价单；国内 / 国外版式由单据自身的 template 决定。 */
export function issueQuotationDocument(id: string): Promise<GeneratedDocument> {
  return request<GeneratedDocument>({ method: 'POST', url: `/documents/quotations/${id}` })
}

export function issueCostAnalysisDocument(id: string): Promise<GeneratedDocument> {
  return request<GeneratedDocument>({ method: 'POST', url: `/documents/cost-analyses/${id}` })
}

export function issueStatementDocument(id: string): Promise<GeneratedDocument> {
  return request<GeneratedDocument>({ method: 'POST', url: `/documents/statements/${id}` })
}

/**
 * 多份报价合并成一张比较平表。
 *
 * 摊平成一行一档位，因此**单价列不能直接求和**——表尾写明了这一点。
 * 这条路径从客户端搬到服务端，是因为合并比较表是要发出去给人看的受控文档，
 * 不是「把当前表格另存为 Excel」。
 */
export function mergeExportQuotations(ids: string[]): Promise<GeneratedDocument> {
  return request<GeneratedDocument>({
    method: 'POST',
    url: '/documents/merge/quotations',
    body: { ids },
  })
}

export function mergeExportCostAnalyses(ids: string[]): Promise<GeneratedDocument> {
  return request<GeneratedDocument>({
    method: 'POST',
    url: '/documents/merge/cost-analyses',
    body: { ids },
  })
}
