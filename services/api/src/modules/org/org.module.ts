import { Module } from '@nestjs/common'

import { DepartmentController } from './controllers/department.controller'
import { DEPARTMENT_REPOSITORY } from './repositories/department.repository.port'
import { PrismaDepartmentRepository } from './repositories/prisma-department.repository'
import { DepartmentService } from './services/department.service'

@Module({
  controllers: [DepartmentController],
  providers: [
    DepartmentService,
    { provide: DEPARTMENT_REPOSITORY, useClass: PrismaDepartmentRepository },
  ],
  exports: [DepartmentService],
})
export class OrgModule {}
