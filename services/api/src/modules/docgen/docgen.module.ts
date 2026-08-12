import { Module } from '@nestjs/common'

import { ContractOrderModule } from '../contract-order'
import { CustomsModule } from '../customs'
import { IdentityModule } from '../identity'
import { MasterdataModule } from '../masterdata'
import { QuotationModule } from '../quotation'
import { ShipmentModule } from '../shipment'

import { DocgenController } from './controllers/docgen.controller'
import { GENERATED_DOCUMENT_REPOSITORY } from './repositories/generated-document.repository.port'
import { PrismaGeneratedDocumentRepository } from './repositories/prisma-generated-document.repository'
import { CustomsRenderAdapter } from './services/customs-render.adapter'
import { DocgenContextService } from './services/docgen-context.service'
import { DocgenService } from './services/docgen.service'
import { DocumentIssueService } from './services/document-issue.service'
import { MergeExportService } from './services/merge-export.service'
import { TemplateRendererService } from './services/template-renderer.service'

/**
 * docgen：按**受控模板**出具对外单据（报价单、成本分析、对账单、报关四件套）。
 *
 * 与前端那支 SheetJS 导出工具的边界：**「导出你屏幕上这张表」归前端，
 * 「按受控模板出具一份对外单据」归这里**。后者要留版本、要盖汇率快照、
 * 要能被审计、要能预览；前者不需要，也不该为此走一趟服务端。
 * `apps/web/src/utils/export-excel.ts` 因此原样保留，不搬。
 *
 * 依赖方向只有一条：**docgen → 各业务模块**。没有任何模块 import 本模块——
 * 报关那条路径靠 customs 的 `DocumentRenderRegistry` 倒置（见 customs-render.adapter.ts），
 * 正是为了不让这条方向出现回边。
 *
 * ⚠️ 模板是 .xlsx **二进制资产**，tsc 不会把它们带进 dist。
 * nest-cli.json 里的 `assets` 规则负责复制；改模板目录时那条规则要一起改。
 */
@Module({
  imports: [
    QuotationModule,
    ShipmentModule,
    CustomsModule,
    ContractOrderModule,
    MasterdataModule,
    IdentityModule,
  ],
  controllers: [DocgenController],
  providers: [
    TemplateRendererService,
    DocumentIssueService,
    DocgenContextService,
    DocgenService,
    MergeExportService,
    CustomsRenderAdapter,
    { provide: GENERATED_DOCUMENT_REPOSITORY, useClass: PrismaGeneratedDocumentRepository },
  ],
  exports: [DocgenService, MergeExportService, TemplateRendererService],
})
export class DocgenModule {}
