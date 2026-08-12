import { Module } from '@nestjs/common'

import { NumberingModule } from '../../platform/numbering'
import { ContractOrderModule } from '../contract-order'
import { IdentityModule } from '../identity'
import { MasterdataModule } from '../masterdata'
import { ShipmentModule } from '../shipment'

import { CustomsFlowController } from './controllers/customs-flow.controller'
import { CustomsController } from './controllers/customs.controller'
import { CUSTOMS_REPOSITORY } from './repositories/customs.repository.port'
import { DOCUMENT_RENDER_PORT } from './repositories/document-render.port'
import { DocumentRenderRegistry } from './repositories/document-render.registry'
import { PrismaCustomsRepository } from './repositories/prisma-customs.repository'
import { StubDocumentRenderAdapter } from './repositories/stub-document-render.adapter'
import { CustomsContextService } from './services/customs-context.service'
import { CustomsDeclarationService } from './services/customs-declaration.service'
import { CustomsDocumentFacade } from './services/customs-document.facade'
import { CustomsDocumentService } from './services/customs-document.service'
import { CustomsReadService } from './services/customs-read.service'
import { CustomsService } from './services/customs.service'

/**
 * customs：报关资料（业务规格第 10 章）。
 *
 * 四处跨模块依赖全部走对方的公开出口：出货取 shipment 的 ShipmentService、
 * 订单取 contract-order、客户取 masterdata、业务员姓名取 identity。
 *
 * 生成的报关文件已按 development-guide §6.1 在 file-preview 登记了
 * `customs-document` resolver——新文件种类必须能预览，那是模块 DoD 的一部分。
 *
 * `DOCUMENT_RENDER_PORT` 现在由 `DocumentRenderRegistry` 提供：docgen 在启动时
 * 把真实渲染实现登记进来，未登记时退回原来的 STUB（只登记版本与汇率快照、不出文件）。
 * 之所以改成注册表而不是原计划的「直接换 provider」——docgen 渲染报关文件要读整份
 * 资料包，也就是 docgen 依赖 customs；再让 customs 去 import DocgenModule 就成环了。
 * 倒置之后依赖方向只有 docgen → customs 一条，版本链、申报快照与更正规则一概未动。
 */
@Module({
  imports: [
    NumberingModule,
    ShipmentModule,
    ContractOrderModule,
    MasterdataModule,
    IdentityModule,
  ],
  controllers: [CustomsController, CustomsFlowController],
  providers: [
    CustomsService,
    CustomsDocumentService,
    CustomsDeclarationService,
    CustomsDocumentFacade,
    CustomsReadService,
    CustomsContextService,
    StubDocumentRenderAdapter,
    DocumentRenderRegistry,
    { provide: CUSTOMS_REPOSITORY, useClass: PrismaCustomsRepository },
    { provide: DOCUMENT_RENDER_PORT, useExisting: DocumentRenderRegistry },
  ],
  exports: [
    CustomsService,
    CustomsDocumentService,
    CustomsDeclarationService,
    // docgen 要拿它登记自己的渲染实现
    DocumentRenderRegistry,
  ],
})
export class CustomsModule {}
