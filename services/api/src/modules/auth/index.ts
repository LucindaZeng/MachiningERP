/** auth 模块唯一对外出口。 */

export { AuthModule } from './auth.module'
export { AccessTokenService, type AccessTokenClaims } from './services/access-token.service'
export { LoginService, type LoginContext } from './services/login.service'
export { CaptchaService } from './services/captcha.service'
export { JwtAuthGuard } from './guards/jwt-auth.guard'
export { PermissionsGuard } from './guards/permissions.guard'
export {
  evaluateThrottle,
  applyFailure,
  describeFailure,
  expireLockIfElapsed,
  INITIAL_THROTTLE_STATE,
  type ThrottleConfig,
  type ThrottleDecision,
  type ThrottleState,
} from './services/login-throttle.policy'
