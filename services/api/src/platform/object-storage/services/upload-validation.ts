import { UPLOAD_ERRORS, extensionOf, isUploadable } from '@machining-erp/shared'

import { BizError } from '../../../common/errors/biz-error'

/**
 * 上传校验：扩展名白名单 + 大小上限 + 内容嗅探。
 *
 * 三道都要，各挡各的：
 * - 白名单挡「传了不该传的类型」；
 * - 大小上限挡「一张 800MB 的图把磁盘写满」；
 * - **内容嗅探**挡「把 payload.exe 改名成 drawing.pdf」——只看扩展名等于不设防。
 *
 * 嗅探只对有稳定魔数的格式做；DXF、STEP 是纯文本，没有魔数可查，
 * 对它们只做扩展名与大小校验，并在这里写明为什么，免得后来人以为是漏了。
 */
export interface UploadCandidate {
  fileName: string
  sizeBytes: number
  content: Buffer
}

export interface UploadLimits {
  maxBytes: number
}

/** 魔数表：前缀字节匹配即认为一致。 */
const MAGIC_NUMBERS: ReadonlyArray<{ extensions: readonly string[]; prefix: readonly number[] }> = [
  { extensions: ['pdf'], prefix: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { extensions: ['png'], prefix: [0x89, 0x50, 0x4e, 0x47] },
  { extensions: ['jpg', 'jpeg'], prefix: [0xff, 0xd8, 0xff] },
  // xlsx / docx 都是 zip 容器，与 zip 同一个魔数
  { extensions: ['zip', 'xlsx', 'docx'], prefix: [0x50, 0x4b, 0x03, 0x04] },
  // AutoCAD DWG：'AC' + 四位版本号，例如 AC1027
  { extensions: ['dwg'], prefix: [0x41, 0x43, 0x31] },
]

/** 没有稳定魔数的纯文本格式，只能靠扩展名与大小把关。 */
const TEXT_FORMATS: ReadonlySet<string> = new Set(['dxf', 'step', 'stp'])

export function assertUploadAllowed(candidate: UploadCandidate, limits: UploadLimits): void {
  const extension = extensionOf(candidate.fileName)

  if (!isUploadable(candidate.fileName)) {
    throw new BizError(UPLOAD_ERRORS.EXTENSION_NOT_ALLOWED, {
      message: `不支持上传 .${extension || '(无扩展名)'} 文件`,
      details: { fileName: candidate.fileName, extension },
    })
  }

  if (candidate.sizeBytes <= 0) {
    throw new BizError(UPLOAD_ERRORS.EMPTY_FILE, { details: { fileName: candidate.fileName } })
  }

  if (candidate.sizeBytes > limits.maxBytes) {
    throw new BizError(UPLOAD_ERRORS.TOO_LARGE, {
      message: `文件 ${formatBytes(candidate.sizeBytes)} 超过上限 ${formatBytes(limits.maxBytes)}`,
      details: { sizeBytes: candidate.sizeBytes, maxBytes: limits.maxBytes },
    })
  }

  if (!contentMatchesExtension(extension, candidate.content)) {
    throw new BizError(UPLOAD_ERRORS.CONTENT_MISMATCH, {
      message: `文件内容与扩展名 .${extension} 不符，疑似改名上传`,
      details: { fileName: candidate.fileName, extension },
    })
  }
}

/** 内容与扩展名是否相符。无魔数可查的格式一律放行（返回 true）。 */
export function contentMatchesExtension(extension: string, content: Buffer): boolean {
  if (TEXT_FORMATS.has(extension)) return true

  const entry = MAGIC_NUMBERS.find((item) => item.extensions.includes(extension))
  if (!entry) return true

  if (content.length < entry.prefix.length) return false
  return entry.prefix.every((byte, index) => content[index] === byte)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
