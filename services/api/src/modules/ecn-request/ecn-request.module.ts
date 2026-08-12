import { Module } from '@nestjs/common'

import { NumberingModule } from '../../platform/numbering'
import { ContractOrderModule } from '../contract-order'
import { IdentityModule } from '../identity'
import { MasterdataModule } from '../masterdata'
import { QuotationModule } from '../quotation'

import { EcnAssessmentController } from './controllers/ecn-assessment.controller'
import { EcnReleaseController } from './controllers/ecn-release.controller'
import { EcnController } from './controllers/ecn.controller'
import { ECN_REPOSITORY } from './repositories/ecn.repository.port'
import { PrismaEcnRepository } from './repositories/prisma-ecn.repository'
import { EcnApprovalService } from './services/ecn-approval.service'
import { EcnContextService } from './services/ecn-context.service'
import { EcnImpactService } from './services/ecn-impact.service'
import { EcnReadService } from './services/ecn-read.service'
import { EcnRequestFacade } from './services/ecn-request.facade'
import { EcnRequestService } from './services/ecn-request.service'

/**
 * ecn-request：工程变更申请（业务规格第 6 章）。
 *
 * 受理范围**只有产品本身的变更**：改图、改材料、改表面处理，以及随之同步的
 * 工艺路线变更。改数量/交期/包装推回订单修改申请，改价格推回报价单修改申请——
 * 这两条由服务端硬拦并点名去处，与 contract-order 的 `REDIRECTED_INTENTS` 互为反向。
 *
 * 四处跨模块依赖全部走对方的公开出口：订单取 contract-order、
 * **图纸版本取 quotation 的 `DrawingUploadService`**、客户取 masterdata、人名取 identity。
 * 图纸不另建上传路径——另建一条，同一张图就会有两个版本序列，
 * 而「这张图现在是第几版」将没有答案。
 *
 * 新版图纸的预览沿用已有的 `drawing-version` resolver，因此本模块**不引入新的文件种类**，
 * §6.1 的 DoD 已由 quotation 那一侧满足。
 *
 * ⚠️ 跨部门会签（ECN-03）的五个部门模块尚未上线，现由工程岗代签并逐条标记 `proxied`；
 * 表结构按最终形态建，各部门上线时只换签收人来源，状态机与端点契约不动。
 */
@Module({
  imports: [
    NumberingModule,
    QuotationModule,
    ContractOrderModule,
    MasterdataModule,
    IdentityModule,
  ],
  controllers: [EcnController, EcnAssessmentController, EcnReleaseController],
  providers: [
    EcnRequestService,
    EcnImpactService,
    EcnApprovalService,
    EcnContextService,
    EcnReadService,
    EcnRequestFacade,
    { provide: ECN_REPOSITORY, useClass: PrismaEcnRepository },
  ],
  exports: [EcnRequestService, EcnImpactService, EcnApprovalService],
})
export class EcnRequestModule {}
