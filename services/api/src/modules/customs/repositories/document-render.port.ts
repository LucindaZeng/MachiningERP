import type { CustomsDocKind } from '@prisma/client'

/**
 * 文件出具端口（业务规格第 10 章「由 docgen 统一出文件」）。
 *
 * 本模块负责**要素、版本、申报与留痕**；真正把一份 Excel/PDF 渲染出来是 docgen 的活。
 * docgen 是队列里的下一个模块，因此这里先声明契约 + 一个语义写明白的 stub，
 * 语义与 shipment 的 QC / 回款、invoice-request 的开票、sales-return 的结算 stub 一致。
 *
 * 边界说明：前端那支客户端 SheetJS 工具**继续**负责通用列表导出（把当前表格导成
 * Excel），不搬到服务端。两者的区别是「导出你屏幕上这张表」与「按受控模板出具一份
 * 对外单据」——后者要留版本、要盖汇率快照、要能被审计，前者不需要。
 */
export interface DocumentRenderRequest {
  dossierId: string
  docNo: string
  kind: CustomsDocKind
  templateCode: string
  version: number
  /** 出具那一刻的汇率快照，随文件一起落 */
  exchangeRate: string
  currency: string
}

export interface DocumentRenderResult {
  /** 生成物在 object-storage 上的位置；docgen 落地前为 null，表示「尚未真正出文件」 */
  objectKey: string | null
  fileName: string | null
  renderedAt: Date
}

export interface DocumentRenderPort {
  render(request: DocumentRenderRequest): Promise<DocumentRenderResult>
}

export const DOCUMENT_RENDER_PORT = Symbol('DOCUMENT_RENDER_PORT')
