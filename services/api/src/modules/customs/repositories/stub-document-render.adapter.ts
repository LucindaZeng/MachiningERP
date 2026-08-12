import { Injectable, Logger } from '@nestjs/common'

import type {
  DocumentRenderPort,
  DocumentRenderRequest,
  DocumentRenderResult,
} from './document-render.port'

/**
 * ⚠️ STUB —— docgen 模块落地前的临时实现，**不是**最终实现。
 *
 * 语义选择：**只登记版本，不出文件**。返回 `objectKey: null`，意思是
 * 「这一版已经在系统里立了档，文件本身等 docgen 接上后补出」。
 * 不假造一个对象键——假键会让预览端点去取一个不存在的对象，
 * 用户看到的是一个说不清的 500，而不是一句「尚未生成」。
 *
 * 因此预览 resolver 对 objectKey 为空的版本一律当作「不存在」处理，
 * 前端就自然显示成未生成。每次调用打 warn。
 */
@Injectable()
export class StubDocumentRenderAdapter implements DocumentRenderPort {
  private readonly logger = new Logger(StubDocumentRenderAdapter.name)

  async render(request: DocumentRenderRequest): Promise<DocumentRenderResult> {
    this.logger.warn(
      `报关文件出具使用 STUB 实现：${request.docNo} 的 ${request.templateCode} ` +
        `V${request.version} 已登记版本与汇率快照（${request.exchangeRate}），但尚未产出文件。` +
        'docgen 模块落地后替换 DOCUMENT_RENDER_PORT。',
    )

    return { objectKey: null, fileName: null, renderedAt: new Date() }
  }
}
