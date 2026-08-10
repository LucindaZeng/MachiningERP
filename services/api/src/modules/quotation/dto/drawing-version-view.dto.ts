/**
 * 上传回执。`drawingVersionId` 是下游唯一要记住的东西——
 * 报价行、BOM 申请都引用它，谁都不再重新上传一份。
 */
export interface DrawingVersionView {
  drawingVersionId: string
  drawingNo: string
  revision: string
  sequence: number
  fileName: string
  fileSize: number
  uploadedBy: string
  uploadedAt: string
}
