import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { IdentityModule } from '../identity'

import { AccountRequestController } from './controllers/account-request.controller'
import { AuthSessionController } from './controllers/auth-session.controller'
import { PasswordResetController } from './controllers/password-reset.controller'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { PermissionsGuard } from './guards/permissions.guard'
import { AUTH_SESSION_REPOSITORY } from './repositories/auth-session.repository.port'
import { CAPTCHA_REPOSITORY } from './repositories/captcha.repository.port'
import { LOGIN_ATTEMPT_REPOSITORY } from './repositories/login-attempt.repository.port'
import { PrismaAuthSessionRepository } from './repositories/prisma-auth-session.repository'
import { PrismaCaptchaRepository } from './repositories/prisma-captcha.repository'
import { PrismaLoginAttemptRepository } from './repositories/prisma-login-attempt.repository'
import { AccessTokenService } from './services/access-token.service'
import { CaptchaService } from './services/captcha.service'
import { LoginService } from './services/login.service'

@Module({
  imports: [IdentityModule, JwtModule.register({})],
  controllers: [AuthSessionController, AccountRequestController, PasswordResetController],
  providers: [
    LoginService,
    CaptchaService,
    AccessTokenService,
    JwtAuthGuard,
    PermissionsGuard,
    { provide: LOGIN_ATTEMPT_REPOSITORY, useClass: PrismaLoginAttemptRepository },
    { provide: CAPTCHA_REPOSITORY, useClass: PrismaCaptchaRepository },
    { provide: AUTH_SESSION_REPOSITORY, useClass: PrismaAuthSessionRepository },
  ],
  exports: [AccessTokenService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
