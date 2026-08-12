import { Injectable, Logger } from '@nestjs/common'

import { StubDocumentRenderAdapter } from './stub-document-render.adapter'

import type {
  DocumentRenderPort,
  DocumentRenderRequest,
  DocumentRenderResult,
} from './document-render.port'

/**
 * 出文件端口的**注册表**（与 shipment 的 `StatementSourceRegistry` 同一套倒置手法）。
 *
 * 为什么不是 `{ provide: DOCUMENT_RENDER_PORT, useClass: 真实实现 }` 那样直接换 provider：
 * docgen 渲染报关文件需要读**整份资料包**（品名、要素、随附单证清单），
 * 也就是 docgen 要依赖 customs。如果 customs 反过来 import DocgenModule 去拿实现，
 * 两个模块就成环了。倒置之后依赖方向只有一条：**docgen → customs**，
 * docgen 在 `onModuleInit` 里把自己登记进来。
 *
 * 未登记时退回 STUB：只登记版本与汇率快照、不出文件。这让 customs
 * 在没有 docgen 的环境（单元测试、精简部署）里依旧能跑完整个版本链。
 */
@Injectable()
export class DocumentRenderRegistry implements DocumentRenderPort {
  private readonly logger = new Logger(DocumentRenderRegistry.name)
  private renderer: DocumentRenderPort | null = null

  constructor(private readonly fallback: StubDocumentRenderAdapter) {}

  /** 由 docgen 在启动时调用。重复登记以最后一次为准，并留一条日志。 */
  register(renderer: DocumentRenderPort): void {
    if (this.renderer !== null) {
      this.logger.warn('报关文件渲染实现被重复登记，以最后一次为准')
    }
    this.renderer = renderer
  }

  /** 是否已接上真实实现。测试与健康检查用得上。 */
  get wired(): boolean {
    return this.renderer !== null
  }

  render(request: DocumentRenderRequest): Promise<DocumentRenderResult> {
    return (this.renderer ?? this.fallback).render(request)
  }
}
