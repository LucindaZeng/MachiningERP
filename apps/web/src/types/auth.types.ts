/**
 * 认证相关契约类型。
 *
 * M0 已落地 `packages/shared`：契约的**唯一权威**在 `@machining-erp/shared`，
 * 由前后端共享（后端 DTO 也引用同一份），本文件只做别名再导出，
 * 保证既有的 `@/types/auth.types` 引用路径不变（development-guide 第 1 节）。
 */

import type {
  AccountAvailabilityContract,
  AccountRequestContract,
  AccountRequestResultContract,
  CaptchaChallengeContract,
  LoginRequestContract,
  LoginResultContract,
  LoginUserContract,
  PasswordResetRequestContract,
  PasswordResetRequestResultContract,
} from '@machining-erp/shared'

export type { LoginAudience } from '@machining-erp/shared'

export type LoginRequest = LoginRequestContract
export type LoginUser = LoginUserContract
export type LoginResult = LoginResultContract
export type CaptchaChallenge = CaptchaChallengeContract
export type PasswordResetRequestInput = PasswordResetRequestContract
export type PasswordResetRequestResult = PasswordResetRequestResultContract
export type AccountRequestInput = AccountRequestContract
export type AccountRequestResult = AccountRequestResultContract
export type AccountAvailability = AccountAvailabilityContract
