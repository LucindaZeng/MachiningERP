/**
 * 错误码分段（api-conventions.md「错误」章节）。
 * 所有业务错误必须落在某个分段内，禁止裸抛字符串。
 */
export const ERROR_SEGMENTS = {
  AUTH: 'AUTH',
  ORD: 'ORD',
  PMC: 'PMC',
  PUR: 'PUR',
  WMS: 'WMS',
  MES: 'MES',
  QMS: 'QMS',
  FIN: 'FIN',
  SYS: 'SYS',
} as const

export type ErrorSegment = (typeof ERROR_SEGMENTS)[keyof typeof ERROR_SEGMENTS]

export interface BizErrorDefinition {
  code: string
  /** 默认 HTTP 状态码：400 校验 / 401·403 认证权限 / 404 越权 / 409 冲突 / 422 业务拒绝 / 429 限流 */
  status: number
  message: string
}
