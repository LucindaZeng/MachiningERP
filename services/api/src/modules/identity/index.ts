/** identity 模块唯一对外出口（development-guide 3.5）。 */

export { IdentityModule } from './identity.module'

export { AccountAvailabilityService } from './services/account-availability.service'
export { AccountRequestService } from './services/account-request.service'
export { PasswordResetRequestService } from './services/password-reset-request.service'
export { PasswordService } from './services/password.service'
export { UserCodeService } from './services/user-code.service'
export { UserDirectoryService } from './services/user-directory.service'

export type { UserRecord, ReleasedAccountRecord } from './repositories/user.repository.port'
export { USER_REPOSITORY, type UserRepositoryPort } from './repositories/user.repository.port'
export {
  USER_CODE_REPOSITORY,
  type UserCodeRepositoryPort,
} from './repositories/user-code.repository.port'
export {
  ACCOUNT_REQUEST_REPOSITORY,
  type AccountRequestRepositoryPort,
} from './repositories/account-request.repository.port'
export {
  PASSWORD_RESET_REPOSITORY,
  type PasswordResetRepositoryPort,
} from './repositories/password-reset.repository.port'
export {
  normalizeAccount,
  isValidAccount,
  buildAccountSuggestions,
  ACCOUNT_PATTERN,
  MIN_PASSWORD_LENGTH,
} from './constants/account-rules'
