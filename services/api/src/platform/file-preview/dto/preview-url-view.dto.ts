/** 预览地址回执。URL 里已含短时效签名，前端拿到即用，不要缓存。 */
export interface PreviewUrlView {
  previewUrl: string
  fileName: string
  expiresInSeconds: number
  /** 水印文案（姓名 + 工号），下载回落时为空串 */
  watermarkText: string
}
