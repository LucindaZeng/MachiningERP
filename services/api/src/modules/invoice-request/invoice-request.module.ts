import { Module } from '@nestjs/common'

import { AuditModule } from '../../platform/audit'
import { EventsModule } from '../../platform/events'
import { NotificationModule } from '../../platform/notification'
import { NumberingModule } from '../../platform/numbering'
import { IdentityModule } from '../identity'
import { MasterdataModule } from '../masterdata'
import { ShipmentModule } from '../shipment'

import { InvoiceIssuanceController } from './controllers/invoice-issuance.controller'
import { InvoiceRequestController } from './controllers/invoice-request.controller'
import { FINANCE_ISSUANCE_PORT } from './repositories/finance-issuance.port'
import { INVOICE_REPOSITORY } from './repositories/invoice-request.repository.port'
import { PrismaInvoiceRequestRepository } from './repositories/prisma-invoice-request.repository'
import { StubFinanceIssuanceAdapter } from './repositories/stub-finance-issuance.adapter'
import { InvoiceContextService } from './services/invoice-context.service'
import { InvoiceCreditNoteService } from './services/invoice-credit-note.service'
import { InvoiceIssuanceService } from './services/invoice-issuance.service'
import { InvoiceReadService } from './services/invoice-read.service'
import { InvoiceRequestService } from './services/invoice-request.service'
import { InvoiceStatementSource } from './services/invoice-statement-source'

/**
 * invoice-request：发票申请（业务规格第 9 章）。
 *
 * 依赖方向只有一条：本模块 → shipment / masterdata / identity。
 * 对账单的「开票」列反过来需要本模块的数据，走的是 shipment 暴露的
 * `StatementSourceRegistry`——本模块启动时把自己注册进去，因此不成环、
 * 也不需要 forwardRef。
 *
 * ⚠️ 一个 STUB：`FINANCE_ISSUANCE_PORT` 在 finance / 税控对接落地前只受理不发号，
 * 语义写在 stub-finance-issuance.adapter.ts 的文件头。
 */
@Module({
  imports: [
    NumberingModule,
    AuditModule,
    EventsModule,
    NotificationModule,
    MasterdataModule,
    IdentityModule,
    ShipmentModule,
  ],
  controllers: [InvoiceRequestController, InvoiceIssuanceController],
  providers: [
    InvoiceRequestService,
    InvoiceIssuanceService,
    InvoiceCreditNoteService,
    InvoiceContextService,
    InvoiceReadService,
    InvoiceStatementSource,
    { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRequestRepository },
    { provide: FINANCE_ISSUANCE_PORT, useClass: StubFinanceIssuanceAdapter },
  ],
  exports: [InvoiceRequestService, InvoiceIssuanceService, InvoiceCreditNoteService],
})
export class InvoiceRequestModule {}
