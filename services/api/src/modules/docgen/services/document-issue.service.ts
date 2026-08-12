import { Injectable } from '@nestjs/common'

import { ObjectStorageService } from '../../../platform/object-storage'

import { XLSX_CONTENT_TYPE } from './document-object-key'
import { TemplateRendererService } from './template-renderer.service'

import type { DocgenTemplateId } from '../constants/template-registry'

export interface IssueRequest {
  templateId: DocgenTemplateId
  payload: unknown
  objectKey: string
  fileName: string
}

export interface IssuedFile {
  objectKey: string
  fileName: string
  sizeBytes: number
  templateVersion: number
  issuedAt: Date
}

/**
 * 「渲染 → 落存储」这一段，所有出具路径共用。
 *
 * 单独一层的理由：报关文件落在自己的版本链行上、其它单据落在 `GeneratedDocument`，
 * 两条路径的**登记方式不同，但出文件的方式必须完全相同**。
 * 抽出来才不会出现「报关的文件名带日期、报价的不带」这种只有客户会发现的差异。
 *
 * 用 `putImmutable` 而不是 `putObject`：已出具的文件不可覆盖，是全仓一致的规矩
 * （见 object-storage 的同名方法与 invoice 红冲、报关更正的处理）。
 */
@Injectable()
export class DocumentIssueService {
  constructor(
    private readonly renderer: TemplateRendererService,
    private readonly storage: ObjectStorageService,
  ) {}

  async issue(request: IssueRequest): Promise<IssuedFile> {
    const rendered = await this.renderer.render(request.templateId, request.payload)
    await this.storage.putImmutable(request.objectKey, rendered.bytes, XLSX_CONTENT_TYPE)

    return {
      objectKey: request.objectKey,
      fileName: request.fileName,
      sizeBytes: rendered.bytes.byteLength,
      templateVersion: rendered.templateVersion,
      issuedAt: new Date(),
    }
  }
}
