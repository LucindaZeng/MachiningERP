import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { UPLOAD_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'

import {
  OBJECT_STORAGE_CONFIG,
  loadObjectStorageConfig,
  type ObjectStorageConfig,
} from './object-storage.config'

/**
 * 预签名的用途决定用哪个端点：
 * - `browser`：浏览器直接下载 → `S3_ENDPOINT`
 * - `preview`：交给 kkFileView 容器去取 → `S3_PREVIEW_ENDPOINT`
 */
export type PresignAudience = 'browser' | 'preview'

export interface PresignOptions {
  audience: PresignAudience
  ttlSeconds: number
  /** 附在 response-content-disposition 上，浏览器下载时文件名才对 */
  downloadFileName?: string
}

/**
 * 对象存储平台能力。当前只有预签名与写入两件事——
 * 写入是给种子数据用的；真正的业务上传（图纸库版本递增、对象键带版本号）
 * 属于后续 `drawing-upload` 任务，届时复用本 provider，不另起一套客户端。
 */
@Injectable()
export class ObjectStorageService {
  private readonly clients: Record<PresignAudience, S3Client>

  constructor(
    @Inject(OBJECT_STORAGE_CONFIG)
    readonly config: ObjectStorageConfig = loadObjectStorageConfig(),
  ) {
    this.clients = {
      browser: createClient(config, config.endpoint),
      preview: createClient(config, config.previewEndpoint),
    }
  }

  get bucket(): string {
    return this.config.bucket
  }

  /** 端点由 audience 决定：预览签给容器可达地址，下载签给浏览器可达地址。 */
  presign(objectKey: string, options: PresignOptions): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: objectKey,
      ResponseContentDisposition: options.downloadFileName
        ? `attachment; filename="${encodeURIComponent(options.downloadFileName)}"`
        : undefined,
    })

    return getSignedUrl(this.clients[options.audience], command, {
      expiresIn: options.ttlSeconds,
    })
  }

  /** 写入对象。业务上传请走 `putImmutable`，它会先确认键没被占。 */
  async putObject(objectKey: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.clients.browser.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    )
  }

  /**
   * 一次性写入：键已存在就拒绝，绝不覆盖。
   *
   * 「改错的图纸只能出新版本，不能原地替换」这条规则最终就落在这一个方法上——
   * 覆盖会让已经发出去的报价、已经建好的 BOM 指向一份**内容变了但版本号没变**
   * 的图纸，而且 kkFileView 那边还留着旧版的转换缓存，对不上账。
   */
  async putImmutable(objectKey: string, body: Uint8Array, contentType: string): Promise<void> {
    if (await this.exists(objectKey)) {
      throw new BizError(UPLOAD_ERRORS.IMMUTABLE_OBJECT, {
        message: `对象键 ${objectKey} 已存在，请以新版本上传`,
        details: { objectKey },
      })
    }

    await this.putObject(objectKey, body, contentType)
  }

  async exists(objectKey: string): Promise<boolean> {
    try {
      await this.clients.browser.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: objectKey }),
      )
      return true
    } catch (error) {
      if (isNotFound(error)) return false
      throw error
    }
  }
}

/** S3 的「不存在」有两种表达，SDK 版本之间还会变，两种都认。 */
function isNotFound(error: unknown): boolean {
  const meta = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return meta?.name === 'NotFound' || meta?.$metadata?.httpStatusCode === 404
}

function createClient(config: ObjectStorageConfig, endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}
