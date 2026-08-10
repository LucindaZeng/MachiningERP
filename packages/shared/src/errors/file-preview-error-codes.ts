import type { BizErrorDefinition } from './error-segment'

/**
 * SYS_903x —— 在线预览（deployment-environment.md 第 3 章）。
 *
 * 归在 SYS 段是因为预览是平台能力，不属于任何业务域：
 * 图纸、客户订单原件、将来的质量文件都走同一条链路，错误码只有这一套。
 */
export const FILE_PREVIEW_ERRORS = {
  /** 越权一律按「不存在」返回（api-conventions.md「认证与权限」），不泄露文件是否存在 */
  NOT_FOUND: {
    code: 'SYS_9030',
    status: 404,
    message: '文件不存在或无权访问',
  },
  UNKNOWN_OWNER_TYPE: {
    code: 'SYS_9031',
    status: 400,
    message: '未知的文件归属类型',
  },
  /** 该扩展名 kkFileView 渲染不了，前端应回落到下载 */
  UNSUPPORTED: {
    code: 'SYS_9032',
    status: 415,
    message: '该文件类型不支持在线预览，请下载后查看',
  },
  /** 归属单据在，但没挂文件（例如订单没传客户订单原件） */
  NO_FILE_ATTACHED: {
    code: 'SYS_9033',
    status: 404,
    message: '该单据尚未上传文件',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type FilePreviewErrorKey = keyof typeof FILE_PREVIEW_ERRORS
