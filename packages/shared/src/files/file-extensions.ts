/**
 * 文件扩展名的**唯一事实来源**。上传白名单与预览白名单都从这里出，
 * 两处各写一份的话，迟早出现「传得上去但点开一片空白」的组合。
 *
 * 注意两个集合**不相等**，这是刻意的：
 * - STEP/IGES 这类三维格式**可以上传**（图纸交付确实用它们），
 *   但 kkFileView 渲染不了 → 预览时回 415，前端回落到下载；
 * - 反过来，mp4 这类 kkFileView 能放的格式没有业务场景，不在上传白名单里。
 */

/** 允许上传的扩展名（业务规格：图纸与客户订单原件）。 */
export const UPLOADABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'pdf',
  'dwg',
  'dxf',
  'step',
  'stp',
  'jpg',
  'jpeg',
  'png',
  'xlsx',
  'docx',
  'zip',
])

/** kkFileView 4.4 能渲染的扩展名。 */
export const PREVIEWABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  // 文档
  'pdf', 'txt', 'md', 'xml', 'json', 'csv',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'odt', 'ods', 'odp', 'rtf',
  // 图片
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff', 'webp', 'svg',
  // CAD —— 图纸库的关键项
  'dwg', 'dxf',
  // 压缩包
  'zip', 'rar', '7z', 'tar', 'gz',
  // 音视频
  'mp3', 'mp4', 'flv',
])

/** 取小写扩展名；没有扩展名时返回空串。 */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0 || dot === fileName.length - 1) return ''
  return fileName.slice(dot + 1).toLowerCase()
}

export function isUploadable(fileName: string): boolean {
  return UPLOADABLE_EXTENSIONS.has(extensionOf(fileName))
}

export function isPreviewable(fileName: string): boolean {
  return PREVIEWABLE_EXTENSIONS.has(extensionOf(fileName))
}

/** 给前端 `<input accept>` 用的字符串，例如 `.pdf,.dwg,...`。 */
export const UPLOAD_ACCEPT_ATTRIBUTE = [...UPLOADABLE_EXTENSIONS]
  .map((ext) => `.${ext}`)
  .join(',')
