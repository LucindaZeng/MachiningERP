import { Module } from '@nestjs/common'

import { EventsModule } from '../../platform/events'
import { NumberingModule } from '../../platform/numbering'
import { ContractOrderModule } from '../contract-order'
import { IdentityModule } from '../identity'
import { MasterdataModule } from '../masterdata'
import { ShipmentModule } from '../shipment'

import { ReturnFlowController } from './controllers/return-flow.controller'
import { SalesReturnController } from './controllers/sales-return.controller'
import { PrismaSalesReturnRepository } from './repositories/prisma-sales-return.repository'
import { RETURN_SETTLEMENT_PORT } from './repositories/return-settlement.port'
import { SALES_RETURN_REPOSITORY } from './repositories/sales-return.repository.port'
import { StubReturnSettlementAdapter } from './repositories/stub-return-settlement.adapter'
import { ReturnContextService } from './services/return-context.service'
import { ReturnFlowService } from './services/return-flow.service'
import { ReturnReadService } from './services/return-read.service'
import { ReturnStatementSource } from './services/return-statement-source'
import { SalesReturnService } from './services/sales-return.service'

/**
 * sales-return：客诉与退货 / RMA（业务规格第 8 章）。
 *
 * 四处跨模块依赖全部走对方的公开出口：出货取 shipment 的 ShipmentService、
 * 订单取 contract-order 的 SalesOrderService、客户取 masterdata 的 CustomerService、
 * 业务员姓名取 identity 的 UserDirectoryService。
 *
 * `ReturnStatementSource` 在 onModuleInit 时把自己注册进 shipment 的
 * `StatementSourceRegistry`——那个槽位从 shipment 落地起就一直空着等这个模块。
 * 注册而不是被注入，依赖方向才只有一条（本模块 → shipment），不用 forwardRef。
 *
 * ⚠️ `RETURN_SETTLEMENT_PORT` 是 STUB：finance 模块落地前只登记不付款。
 * adapter 文件头写了默认语义与替换方式；上线 finance 时**只换 provider**，
 * 判定与对账口径不动。注意它与对账扣减是两回事——财务还没打款，
 * 客户对账单上那笔扣减照样成立。
 */
@Module({
  imports: [
    NumberingModule,
    EventsModule,
    ShipmentModule,
    ContractOrderModule,
    MasterdataModule,
    IdentityModule,
  ],
  controllers: [SalesReturnController, ReturnFlowController],
  providers: [
    SalesReturnService,
    ReturnFlowService,
    ReturnReadService,
    ReturnContextService,
    ReturnStatementSource,
    { provide: SALES_RETURN_REPOSITORY, useClass: PrismaSalesReturnRepository },
    { provide: RETURN_SETTLEMENT_PORT, useClass: StubReturnSettlementAdapter },
  ],
  exports: [SalesReturnService, ReturnFlowService],
})
export class SalesReturnModule {}
