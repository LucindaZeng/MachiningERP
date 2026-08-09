import { Module } from '@nestjs/common'

import { NumberingModule } from '../../platform/numbering'

import { ACCOUNT_REQUEST_REPOSITORY } from './repositories/account-request.repository.port'
import { PASSWORD_RESET_REPOSITORY } from './repositories/password-reset.repository.port'
import { PrismaAccountRequestRepository } from './repositories/prisma-account-request.repository'
import { PrismaPasswordResetRepository } from './repositories/prisma-password-reset.repository'
import { PrismaUserCodeRepository } from './repositories/prisma-user-code.repository'
import { PrismaUserRepository } from './repositories/prisma-user.repository'
import { USER_CODE_REPOSITORY } from './repositories/user-code.repository.port'
import { USER_REPOSITORY } from './repositories/user.repository.port'
import { AccountAvailabilityService } from './services/account-availability.service'
import { AccountRequestService } from './services/account-request.service'
import { PasswordResetRequestService } from './services/password-reset-request.service'
import { PasswordService } from './services/password.service'
import { UserCodeService } from './services/user-code.service'
import { UserDirectoryService } from './services/user-directory.service'

@Module({
  imports: [NumberingModule],
  providers: [
    AccountAvailabilityService,
    AccountRequestService,
    PasswordResetRequestService,
    PasswordService,
    UserCodeService,
    UserDirectoryService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: USER_CODE_REPOSITORY, useClass: PrismaUserCodeRepository },
    { provide: ACCOUNT_REQUEST_REPOSITORY, useClass: PrismaAccountRequestRepository },
    { provide: PASSWORD_RESET_REPOSITORY, useClass: PrismaPasswordResetRepository },
  ],
  exports: [
    AccountAvailabilityService,
    AccountRequestService,
    PasswordResetRequestService,
    PasswordService,
    UserCodeService,
    UserDirectoryService,
  ],
})
export class IdentityModule {}
