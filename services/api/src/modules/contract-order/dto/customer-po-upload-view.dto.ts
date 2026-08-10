/** 上传回执。`objectKey` 要原样带进建单请求的 `customerPoFile`。 */
export interface CustomerPoUploadView {
  objectKey: string
  fileName: string
  fileSize: number
  /** 已挂到订单上时为订单 id；仅暂存时为 null，建单后才可预览 */
  boundOrderId: string | null
}
