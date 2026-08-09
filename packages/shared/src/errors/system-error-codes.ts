import type { BizErrorDefinition } from './error-segment'

/** SYS_9xxx —— 系统、校验、幂等与乐观锁。 */
export const SYSTEM_ERRORS = {
  UNKNOWN: {
    code: 'SYS_9000',
    status: 500,
    message: '系统异常，请联系管理员并提供 traceId',
  },
  VALIDATION_FAILED: {
    code: 'SYS_9001',
    status: 400,
    message: '请求参数校验未通过',
  },
  NOT_FOUND: {
    code: 'SYS_9004',
    status: 404,
    message: '资源不存在或无权访问',
  },
  VERSION_CONFLICT: {
    code: 'SYS_9009',
    status: 409,
    message: '数据已被他人修改（乐观锁冲突），请刷新后重试',
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    code: 'SYS_9010',
    status: 400,
    message: '创建单据必须携带 Idempotency-Key 头',
  },
  IDEMPOTENCY_CONFLICT: {
    code: 'SYS_9011',
    status: 409,
    message: '相同幂等键的请求内容不一致',
  },
  ILLEGAL_STATE_TRANSITION: {
    code: 'SYS_9012',
    status: 409,
    message: '当前状态不允许该操作',
  },
  RATE_LIMITED: {
    code: 'SYS_9029',
    status: 429,
    message: '请求过于频繁，请稍后再试',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type SystemErrorKey = keyof typeof SYSTEM_ERRORS
