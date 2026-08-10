import { Module } from '@nestjs/common'

import { AuditModule } from '../../platform/audit'
import { NumberingModule } from '../../platform/numbering'
import { ObjectStorageModule } from '../../platform/object-storage'

import { CostAnalysisController } from './controllers/cost-analysis.controller'
import { DrawingUploadController } from './controllers/drawing-upload.controller'
import { QuotationController } from './controllers/quotation.controller'
import { QuoteChangeRequestController } from './controllers/quote-change-request.controller'
import { COST_ANALYSIS_REPOSITORY } from './repositories/cost-analysis.repository.port'
import { DRAWING_REPOSITORY } from './repositories/drawing.repository.port'
import { PrismaCostAnalysisRepository } from './repositories/prisma-cost-analysis.repository'
import { PrismaDrawingRepository } from './repositories/prisma-drawing.repository'
import { PrismaQuotationRepository } from './repositories/prisma-quotation.repository'
import { PrismaQuoteChangeRequestRepository } from './repositories/prisma-quote-change-request.repository'
import { QUOTATION_REPOSITORY } from './repositories/quotation.repository.port'
import { QUOTE_CHANGE_REQUEST_REPOSITORY } from './repositories/quote-change-request.repository.port'
import { CostingService } from './services/costing.service'
import { DrawingUploadService } from './services/drawing-upload.service'
import { QuotationReviewService } from './services/quotation-review.service'
import { QuotationService } from './services/quotation.service'
import { QuoteChangeRequestService } from './services/quote-change-request.service'

@Module({
  imports: [NumberingModule, AuditModule, ObjectStorageModule],
  controllers: [
    CostAnalysisController,
    DrawingUploadController,
    QuotationController,
    QuoteChangeRequestController,
  ],
  providers: [
    CostingService,
    DrawingUploadService,
    QuotationService,
    QuotationReviewService,
    QuoteChangeRequestService,
    { provide: COST_ANALYSIS_REPOSITORY, useClass: PrismaCostAnalysisRepository },
    { provide: DRAWING_REPOSITORY, useClass: PrismaDrawingRepository },
    { provide: QUOTATION_REPOSITORY, useClass: PrismaQuotationRepository },
    { provide: QUOTE_CHANGE_REQUEST_REPOSITORY, useClass: PrismaQuoteChangeRequestRepository },
  ],
  exports: [
    CostingService,
    DrawingUploadService,
    QuotationService,
    QuotationReviewService,
    QuoteChangeRequestService,
  ],
})
export class QuotationModule {}
