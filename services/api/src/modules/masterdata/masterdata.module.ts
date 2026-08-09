import { Module } from '@nestjs/common'

import { NumberingModule } from '../../platform/numbering'
import { IdentityModule } from '../identity'

import { CustomerChangeRequestController } from './controllers/customer-change-request.controller'
import { CustomerController } from './controllers/customer.controller'
import { CUSTOMER_CHANGE_REQUEST_REPOSITORY } from './repositories/customer-change-request.repository.port'
import { CUSTOMER_REPOSITORY } from './repositories/customer.repository.port'
import { PrismaCustomerChangeRequestRepository } from './repositories/prisma-customer-change-request.repository'
import { PrismaCustomerRepository } from './repositories/prisma-customer.repository'
import { CustomerChangeApprovalService } from './services/customer-change-approval.service'
import { CustomerUpdateService } from './services/customer-update.service'
import { CustomerService } from './services/customer.service'

@Module({
  imports: [NumberingModule, IdentityModule],
  controllers: [CustomerController, CustomerChangeRequestController],
  providers: [
    CustomerService,
    CustomerUpdateService,
    CustomerChangeApprovalService,
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
    { provide: CUSTOMER_CHANGE_REQUEST_REPOSITORY, useClass: PrismaCustomerChangeRequestRepository },
  ],
  exports: [CustomerService],
})
export class MasterdataModule {}
