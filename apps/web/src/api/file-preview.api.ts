import { request } from './http'

/**
 * 在线预览（kkFileView）。文件按 `(ownerType, ownerId)` 定位——
 * 系统里还没有统一的文件表，前端传的是「哪张单据上的哪个文件位」。
 */
export type PreviewOwnerType = 'drawing-version' | 'order-customer-po'

export interface PreviewUrlView {
  previewUrl: string
  fileName: string
  expiresInSeconds: number
  /** 水印文案（姓名 + 工号），下载回落时为空串 */
  watermarkText: string
}

/** GET /files/:ownerType/:ownerId/preview-url —— 短时效预签名 + 水印，后端逐次审计。 */
export function fetchPreviewUrl(
  ownerType: PreviewOwnerType,
  ownerId: string,
): Promise<PreviewUrlView> {
  return request<PreviewUrlView>({
    method: 'GET',
    url: `/files/${ownerType}/${ownerId}/preview-url`,
  })
}

/** GET /files/:ownerType/:ownerId/download-url —— 供 415（不支持预览）时回落。 */
export function fetchDownloadUrl(
  ownerType: PreviewOwnerType,
  ownerId: string,
): Promise<PreviewUrlView> {
  return request<PreviewUrlView>({
    method: 'GET',
    url: `/files/${ownerType}/${ownerId}/download-url`,
  })
}
