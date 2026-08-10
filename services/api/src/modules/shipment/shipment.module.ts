import { Module } from '@nestjs/common'

import { EventsModule } from '../../platform/events'
import { NumberingModule } from '../../platform/numbering'
import { ContractOrderModule } from '../contract-order'
import { IdentityModule } from '../identity'
import { MasterdataModule } from '../masterdata'

import { ShipmentFlowController } from './controllers/shipment-flow.controller'
import { ShipmentController } from './controllers/shipment.controller'
import { StatementController } from './controllers/statement.controller'
import { PrismaShipmentRepository } from './repositories/prisma-shipment.repository'
import { PrismaStatementRepository } from './repositories/prisma-statement.repository'
import { QC_RELEASE_PORT } from './repositories/qc-release.port'
import { RECEIPT_PORT } from './repositories/receipt.port'
import { SHIPMENT_REPOSITORY } from './repositories/shipment.repository.port'
import { STATEMENT_SOURCE_PORT } from './repositories/statement-source.port'
import { STATEMENT_REPOSITORY } from './repositories/statement.repository.port'
import { StubQcReleaseAdapter } from './repositories/stub-qc-release.adapter'
import { StubReceiptAdapter } from './repositories/stub-receipt.adapter'
import { StubStatementSourceAdapter } from './repositories/stub-statement-source.adapter'
import { ShipGateService } from './services/ship-gate.service'
import { ShipmentContextService } from './services/shipment-context.service'
import { ShipmentFlowService } from './services/shipment-flow.service'
import { ShipmentPostingService } from './services/shipment-posting.service'
import { ShipmentReadService } from './services/shipment-read.service'
import { ShipmentTailService } from './services/shipment-tail.service'
import { ShipmentService } from './services/shipment.service'
import { StatementReadService } from './services/statement-read.service'
import { StatementSourceRegistry } from './services/statement-source.registry'
import { StatementSourceService } from './services/statement-source.service'
import { StatementService } from './services/statement.service'

/**
 * shipment：出货管理 + 客户对账单（业务规格第 7 章）。
 *
 * 三处跨模块依赖全部走对方的公开出口：订单取 contract-order 的 SalesOrderService、
 * 客户取 masterdata 的 CustomerService、业务员姓名取 identity 的 UserDirectoryService。
 *
 * ⚠️ 三个 STUB provider（品质放行 / 回款 / 对账源单）是 QMS、finance、
 * invoice-request、sales-return 落地前的临时实现。各自的 adapter 文件头都写了
 * 默认语义与替换方式；上线这些模块时**只换 provider**，判定与汇总逻辑不动。
 */
@Module({
  imports: [NumberingModule, EventsModule, ContractOrderModule, MasterdataModule, IdentityModule],
  controllers: [ShipmentController, ShipmentFlowController, StatementController],
  providers: [
    ShipmentService,
    ShipmentReadService,
    ShipmentFlowService,
    ShipmentContextService,
    ShipmentPostingService,
    ShipmentTailService,
    ShipGateService,
    StatementService,
    StatementReadService,
    StatementSourceService,
    StatementSourceRegistry,
    { provide: SHIPMENT_REPOSITORY, useClass: PrismaShipmentRepository },
    { provide: STATEMENT_REPOSITORY, useClass: PrismaStatementRepository },
    { provide: QC_RELEASE_PORT, useClass: StubQcReleaseAdapter },
    { provide: RECEIPT_PORT, useClass: StubReceiptAdapter },
    { provide: STATEMENT_SOURCE_PORT, useClass: StubStatementSourceAdapter },
  ],
  exports: [ShipmentService, ShipmentFlowService, StatementService, StatementSourceRegistry],
})
export class ShipmentModule {}
