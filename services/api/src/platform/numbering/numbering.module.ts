import { Module } from '@nestjs/common'

import { DOC_NUMBER_REPOSITORY } from './repositories/doc-number.repository.port'
import { PrismaDocNumberRepository } from './repositories/prisma-doc-number.repository'
import { DocNumberService } from './services/doc-number.service'

@Module({
  providers: [
    DocNumberService,
    { provide: DOC_NUMBER_REPOSITORY, useClass: PrismaDocNumberRepository },
  ],
  exports: [DocNumberService],
})
export class NumberingModule {}
