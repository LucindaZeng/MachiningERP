import { PERMISSION_CODES, QUOTATION_ERRORS, UPLOAD_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { ObjectStorageService, assertUploadAllowed } from '../../../platform/object-storage'
import {
  DRAWING_REPOSITORY,
  type DrawingRepositoryPort,
  type DrawingVersionRecord,
} from '../repositories/drawing.repository.port'

import { autoRevision, composeDrawingObjectKey } from './drawing-object-key'

export interface DrawingUploadActor {
  userCode: string
  permissions: readonly string[]
}

export interface DrawingUploadInput {
  drawingNo: string
  customerId: string | null
  title: string | null
  /** 业务填的版本名；不填则按序号自动生成 REV A / REV B */
  revision: string | null
  fileName: string
  contentType: string
  content: Buffer
}

/**
 * 图纸上传（业务规格 2.2：**报价单强制上传图纸**）。
 *
 * 三条规则落在这里：
 * 1. **一次上传，下游复用**——上传产生一个 `DrawingVersion`，报价核价与工程建 BOM
 *    都引用同一个 id，下游任何环节都不再重传（BOM 申请那边已经硬校验了这一点）；
 * 2. **改图 = 新版本**，永不覆盖：序号单调递增，对象键带序号，
 *    连带把 kkFileView 的转换缓存也隔开；
 * 3. 存储只经平台 provider，本模块不碰 S3 SDK。
 */
@Injectable()
export class DrawingUploadService {
  constructor(
    private readonly storage: ObjectStorageService,
    private readonly audit: AuditService,
    @Inject(DRAWING_REPOSITORY) private readonly drawings: DrawingRepositoryPort,
  ) {}

  static assertCanUpload(actor: DrawingUploadActor): void {
    const allowed = [PERMISSION_CODES.SALES_OPERATE, PERMISSION_CODES.COSTING_EDIT]
    if (!allowed.some((code) => actor.permissions.includes(code))) {
      throw new BizError(QUOTATION_ERRORS.SALES_ROLE_REQUIRED, {
        message: '只有业务或报价工程师可以上传图纸',
      })
    }
  }

  async upload(input: DrawingUploadInput, actor: DrawingUploadActor): Promise<DrawingVersionRecord> {
    DrawingUploadService.assertCanUpload(actor)
    if (!input.drawingNo.trim()) {
      throw new BizError(UPLOAD_ERRORS.FILE_REQUIRED, { message: '上传图纸必须提供图号' })
    }

    assertUploadAllowed(
      { fileName: input.fileName, sizeBytes: input.content.length, content: input.content },
      { maxBytes: this.storage.config.maxUploadBytes },
    )

    const drawing = await this.drawings.ensureDrawing({
      drawingNo: input.drawingNo.trim(),
      customerId: input.customerId,
      title: input.title,
      createdBy: actor.userCode,
    })

    const sequence = (await this.drawings.latestSequence(drawing.id)) + 1
    const revision = input.revision?.trim() || autoRevision(sequence)
    const fileKey = composeDrawingObjectKey({
      drawingNo: drawing.drawingNo,
      sequence,
      revision,
      fileName: input.fileName,
    })

    // 先落对象再落库：反过来的话，写库成功而写对象失败会留下一条指向空气的版本记录
    await this.storage.putImmutable(fileKey, input.content, input.contentType)

    const version = await this.drawings.createVersion({
      drawingId: drawing.id,
      revision,
      sequence,
      source: 'QUOTATION',
      fileKey,
      fileName: input.fileName,
      fileSize: input.content.length,
      uploadedBy: actor.userCode,
    })

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'drawing.upload',
      entityType: 'DrawingVersion',
      entityId: version.id,
      after: {
        drawingNo: drawing.drawingNo,
        revision,
        sequence,
        fileKey,
        fileName: input.fileName,
        fileSize: input.content.length,
      },
    })

    return version
  }

  async loadVersion(id: string): Promise<DrawingVersionRecord> {
    const version = await this.drawings.findVersion(id)
    if (!version) {
      throw new BizError(QUOTATION_ERRORS.DRAWING_VERSION_NOT_FOUND, { details: { id } })
    }
    return version
  }
}
