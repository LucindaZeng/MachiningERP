import { Module } from '@nestjs/common'

import { EventsModule } from '../../platform/events'
import { NumberingModule } from '../../platform/numbering'
import { QuotationModule } from '../quotation'

import { BomEngineeringController } from './controllers/bom-engineering.controller'
import { BomRequestController } from './controllers/bom-request.controller'
import { BOM_REQUEST_REPOSITORY } from './repositories/bom-request.repository.port'
import { PrismaBomRequestRepository } from './repositories/prisma-bom-request.repository'
import { BomEngineeringService } from './services/bom-engineering.service'
import { BomQuotationContextService } from './services/bom-quotation-context.service'
import { BomRequestService } from './services/bom-request.service'

/**
 * bom-request：BOM 申请（业务规格第 5 章 / ENG-02、ENG-05）。
 *
 * 业务侧与工程侧拆成两个 service + 两个 controller：
 * 前者归业务权限、后者归工程权限，混在一起会让权限判断散落在方法里。
 */
@Module({
  imports: [NumberingModule, EventsModule, QuotationModule],
  controllers: [BomRequestController, BomEngineeringController],
  providers: [
    BomRequestService,
    BomEngineeringService,
    BomQuotationContextService,
    { provide: BOM_REQUEST_REPOSITORY, useClass: PrismaBomRequestRepository },
  ],
  exports: [BomRequestService, BomEngineeringService],
})
export class BomRequestModule {}
