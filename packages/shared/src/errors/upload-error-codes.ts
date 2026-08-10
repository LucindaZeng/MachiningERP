import type { BizErrorDefinition } from './error-segment'

/**
 * SYS_904x —— 文件上传。
 *
 * 与预览（SYS_903x）同属平台能力：图纸、客户订单原件、将来的质量文件
 * 走同一套校验，错误码因此也只有这一套。
 */
export const UPLOAD_ERRORS = {
  FILE_REQUIRED: {
    code: 'SYS_9040',
    status: 400,
    message: '请选择要上传的文件',
  },
  EXTENSION_NOT_ALLOWED: {
    code: 'SYS_9041',
    status: 415,
    message: '不支持该文件类型',
  },
  TOO_LARGE: {
    code: 'SYS_9042',
    status: 413,
    message: '文件超过大小上限',
  },
  EMPTY_FILE: {
    code: 'SYS_9043',
    status: 400,
    message: '文件内容为空',
  },
  /** 只看扩展名等于不设防：改名上传必须挡下来 */
  CONTENT_MISMATCH: {
    code: 'SYS_9044',
    status: 415,
    message: '文件内容与扩展名不符',
  },
  /** 已上传的对象不可覆盖：改图只能出新版本 */
  IMMUTABLE_OBJECT: {
    code: 'SYS_9045',
    status: 409,
    message: '已上传的文件不可覆盖，请以新版本上传',
  },
  STORAGE_UNAVAILABLE: {
    code: 'SYS_9046',
    status: 503,
    message: '对象存储不可用，请稍后重试',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type UploadErrorKey = keyof typeof UPLOAD_ERRORS
