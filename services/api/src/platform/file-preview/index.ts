/**
 * file-preview 平台能力的唯一对外出口。
 *
 * 业务模块**只**需要知道 `PREVIEW_OWNER_TYPES` 里的归属类型字符串；
 * 不得 import 本目录下的任何内部文件。
 */

export { FilePreviewModule } from './file-preview.module'
export { FilePreviewService } from './services/file-preview.service'

export {
  PREVIEW_OWNER_TYPES,
  PREVIEW_OWNER_TYPE_VALUES,
  isPreviewOwnerType,
  type PreviewOwnerType,
} from './constants/preview-owner-types'
export { extensionOf, isPreviewable } from './constants/previewable-extensions'

export {
  DEFAULT_PREVIEW_TTL_SECONDS,
  FILE_PREVIEW_CONFIG,
  MAX_PREVIEW_TTL_SECONDS,
  clampTtl,
  loadFilePreviewConfig,
  type FilePreviewConfig,
} from './services/file-preview.config'
export { buildPreviewUrl, composeWatermark, toBase64 } from './services/preview-url.builder'

export {
  FILE_PREVIEW_SOURCES,
  type FilePreviewSource,
  type PreviewViewer,
  type ResolvedPreviewFile,
} from './repositories/file-preview-source.port'
export type { PreviewUrlView } from './dto/preview-url-view.dto'
