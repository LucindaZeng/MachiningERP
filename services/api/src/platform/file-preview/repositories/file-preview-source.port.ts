import type { PreviewOwnerType } from '../constants/preview-owner-types'

/** 看预览的人。权限判定所需的全部信息，不多不少。 */
export interface PreviewViewer {
  userCode: string
  displayName: string
  permissions: readonly string[]
}

/** resolver 解析出来的文件事实 + 它挂在哪张单据上（审计要记）。 */
export interface ResolvedPreviewFile {
  objectKey: string
  fileName: string
  /** 归属单据类型与主键，用于审计留痕 */
  docType: string
  docId: string
  /** 便于审计里认人认单，例如图号或订单号 */
  docLabel: string
}

/**
 * 预览来源解析器。每个实现负责两件事，且**顺序不能反**：
 * 先按自己那张单据的规则判权限，再返回文件位置。
 *
 * 无权访问时一律返回 null —— 由服务层统一抛 404，
 * 让「无权」与「不存在」对外不可区分，避免用探测响应码猜文件是否存在。
 */
export interface FilePreviewSource {
  readonly ownerType: PreviewOwnerType
  resolve(ownerId: string, viewer: PreviewViewer): Promise<ResolvedPreviewFile | null>
}

/** 多实现注入：Nest 会把所有 provider 收成数组。 */
export const FILE_PREVIEW_SOURCES = Symbol('FILE_PREVIEW_SOURCES')
