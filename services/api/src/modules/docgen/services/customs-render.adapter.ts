import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'

import { CustomsService, DocumentRenderRegistry } from '../../customs'
import { CUSTOMS_TEMPLATE_BY_KIND, TEMPLATE_DEFINITIONS } from '../constants/template-registry'

import { toCustomsPayload } from './customs-payload.mapper'
import { DocgenContextService } from './docgen-context.service'
import { DocumentIssueService } from './document-issue.service'
import { composeCustomsObjectKey, composeFileName } from './document-object-key'

import type {
  DocumentRenderPort,
  DocumentRenderRequest,
  DocumentRenderResult,
} from '../../customs'

/**
 * 报关文件的真实出具实现——替换 customs 里那个只登记版本的 STUB。
 *
 * 依赖方向：**docgen → customs**，靠 `DocumentRenderRegistry` 在启动时登记自己
 * （理由见该注册表的文件头）。customs 侧的版本链、申报快照与更正规则一行未改：
 * 它照旧调 `DOCUMENT_RENDER_PORT.render(...)`，只是这次真的拿到了文件。
 *
 * 文件**不登记 `GeneratedDocument`**：报关文件自己那张版本行就是登记，
 * 预览也早已按 `customs-document` 挂在那一行上。再记一遍会出现两处真相。
 */
@Injectable()
export class CustomsRenderAdapter implements DocumentRenderPort, OnModuleInit {
  private readonly logger = new Logger(CustomsRenderAdapter.name)

  constructor(
    private readonly registry: DocumentRenderRegistry,
    private readonly customs: CustomsService,
    private readonly issuer: DocumentIssueService,
    private readonly context: DocgenContextService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this)
    this.logger.log('报关文件渲染已接入 docgen（模板：customs-invoice / packing-list / contract / data-pack）')
  }

  async render(request: DocumentRenderRequest): Promise<DocumentRenderResult> {
    const templateId = CUSTOMS_TEMPLATE_BY_KIND[request.kind]
    if (!templateId) {
      // 出现新的文件种类而模板没跟上：退回「只登记版本」，别让整条出具链断掉
      this.logger.warn(`报关文件种类 ${request.kind} 尚未登记模板，本次只登记版本`)
      return { objectKey: null, fileName: null, renderedAt: new Date() }
    }

    const record = await this.customs.load(request.dossierId)
    const naming = await this.context.customsNaming(record)
    const issuedOn = new Date()

    const issued = await this.issuer.issue({
      templateId,
      payload: toCustomsPayload(
        record,
        {
          kind: request.kind,
          version: request.version,
          // 汇率取**本版快照**，不取资料包表头的当前汇率
          exchangeRate: request.exchangeRate,
          issuedOn,
        },
        naming,
      ),
      objectKey: composeCustomsObjectKey(request.docNo, request.kind, request.version),
      fileName: composeFileName(
        `${TEMPLATE_DEFINITIONS[templateId].label}-V${request.version}`,
        request.docNo,
        issuedOn,
      ),
    })

    return {
      objectKey: issued.objectKey,
      fileName: issued.fileName,
      renderedAt: issued.issuedAt,
    }
  }
}
