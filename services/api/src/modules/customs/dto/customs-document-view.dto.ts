/**
 * 报关文件的对外形状，对齐前端 `CustomsDocument`。
 *
 * `version` 是**字符串**（'V2' / '—'），照 fixture 的写法来：它是展示值，
 * 数值版本号在服务端另有其位（`versionNo`，本轮新增的可选字段）。
 */
export interface CustomsDocumentView {
  templateCode: string
  name: string
  version: string
  generatedAt?: string
  /** 数值版本号；未生成时为 0 */
  versionNo?: number
  /** 该版本的 id，预览端点按 `(customs-document, id)` 取文件 */
  documentId?: string
  /** 本版出具那一刻的汇率快照 */
  exchangeRate?: string
  /** 已登记版本但尚未真正出文件（docgen 接入前）——前端据此禁用下载与预览 */
  pending?: boolean
}
