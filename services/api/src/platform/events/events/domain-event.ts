/**
 * 领域事件（api-conventions.md「事件」）：命名 `domain.entity.action`。
 * 预警中心、节点计时、BI 均以事件为事实来源，业务模块不得直接写预警表。
 */
export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId: string
  name: string
  occurredAt: Date
  traceId?: string | null
  payload: TPayload
}

export const DOMAIN_EVENTS = {
  ACCOUNT_REQUEST_SUBMITTED: 'identity.account-request.submitted',
  ACCOUNT_REQUEST_APPROVED: 'identity.account-request.approved',
  ACCOUNT_REQUEST_REJECTED: 'identity.account-request.rejected',
  PASSWORD_RESET_REQUESTED: 'identity.password-reset.requested',
  USER_LOGGED_IN: 'auth.session.logged-in',
  USER_LOGIN_FAILED: 'auth.session.login-failed',
  USER_LOCKED: 'auth.session.locked',
} as const

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS] | string
