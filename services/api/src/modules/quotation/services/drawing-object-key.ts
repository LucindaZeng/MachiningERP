import { extensionOf } from '@machining-erp/shared'

/**
 * 图纸对象键的组成（deployment-environment.md 3.2 要点四）。
 *
 * > 图纸新版本务必用**新对象键**（版本号入键名），避免命中 kkFileView 的旧缓存。
 *
 * 所以键里一定带 sequence：
 *   `drawings/{图号}/v{序号}-{版本名}/{文件名}`
 *
 * 只用图号+版本名不够——同一个「REV A」被改传两次时键会重合，
 * 而 sequence 是库里单调递增的，永不重复。
 */
export interface DrawingKeyInput {
  drawingNo: string
  sequence: number
  revision: string
  fileName: string
}

export function composeDrawingObjectKey(input: DrawingKeyInput): string {
  const segments = [
    'drawings',
    sanitizeSegment(input.drawingNo),
    `v${input.sequence}-${sanitizeSegment(input.revision)}`,
    sanitizeFileName(input.fileName),
  ]

  return segments.join('/')
}

/** 客户订单原件的键。订单尚未落库时先进 staging，建单时把键写进订单列。 */
export function composeCustomerPoObjectKey(orderRef: string, fileName: string): string {
  return `orders/customer-po/${sanitizeSegment(orderRef)}/${sanitizeFileName(fileName)}`
}

/**
 * 键里的一段：只留字母数字与 `-_.`，其余折成 `-`。
 * 图号里常见 `/`（如 `MT-7719/A`），不处理就会在对象存储里凭空多出一层目录。
 */
export function sanitizeSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^\w.\-一-龥]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')

  return cleaned || 'unnamed'
}

/** 文件名同样清洗，但保留扩展名——kkFileView 靠它选渲染器。 */
export function sanitizeFileName(fileName: string): string {
  const extension = extensionOf(fileName)
  const base = extension ? fileName.slice(0, -(extension.length + 1)) : fileName
  const safeBase = sanitizeSegment(base)

  return extension ? `${safeBase}.${extension}` : safeBase
}

/**
 * 自动版本名：REV A、REV B……第 27 版起用 REV AA。
 * 调用方给了版本名就用它的，这里只兜底。
 */
export function autoRevision(sequence: number): string {
  const index = Math.max(1, sequence) - 1
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const cycle = Math.floor(index / letters.length)
  const letter = letters[index % letters.length] ?? 'A'

  return `REV ${letter.repeat(cycle + 1)}`
}
