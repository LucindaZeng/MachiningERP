/**
 * 生成物的对外形状。
 *
 * 不下发 `objectKey`：对象键是服务端的内部定位方式，前端拿它没有用处，
 * 而泄露出去等于把存储布局摊开。前端要文件走 `/files/generated-document/:id/preview-url`
 * 与 `download-url`，两者都会验权并签发短时效链接。
 */
export interface GeneratedDocumentView {
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
