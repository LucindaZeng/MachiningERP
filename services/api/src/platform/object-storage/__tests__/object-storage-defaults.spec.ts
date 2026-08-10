import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

import { ObjectStorageService } from '../services/object-storage.service'

describe('缺省构造：不传配置时从 process.env 读', () => {
  const saved = { ...process.env }

  afterEach(() => {
    process.env = { ...saved }
  })

  it('不传参数时走 loadObjectStorageConfig(process.env)', () => {
    process.env.S3_BUCKET = 'from-env'
    process.env.S3_PREVIEW_ENDPOINT = 'http://minio-from-env:9000'

    const service = new ObjectStorageService()

    expect(service.bucket).toBe('from-env')
    expect(service.config.previewEndpoint).toBe('http://minio-from-env:9000')
  })
})

describe('putObject：仅供种子写入样例文件', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('按配置的桶发 PutObject，键与 content-type 原样带上', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue(undefined as never)
    const service = new ObjectStorageService({
      endpoint: 'http://localhost:9000',
      previewEndpoint: 'http://minio:9000',
      region: 'us-east-1',
      bucket: 'machining-erp',
      accessKeyId: 'erp',
      secretAccessKey: 'pw',
      forcePathStyle: true,
      maxUploadBytes: 50 * 1024 * 1024,
    })

    await service.putObject('drawings/MT-7719/REV-B.pdf', new Uint8Array([1, 2]), 'application/pdf')

    const command = send.mock.calls[0]?.[0] as unknown as PutObjectCommand
    expect(command).toBeInstanceOf(PutObjectCommand)
    expect(command.input).toMatchObject({
      Bucket: 'machining-erp',
      Key: 'drawings/MT-7719/REV-B.pdf',
      ContentType: 'application/pdf',
    })
  })
})

describe('putImmutable：已上传对象不可覆盖', () => {
  const CONFIG = {
    endpoint: 'http://localhost:9000',
    previewEndpoint: 'http://minio:9000',
    region: 'us-east-1',
    bucket: 'machining-erp',
    accessKeyId: 'erp',
    secretAccessKey: 'pw',
    forcePathStyle: true,
    maxUploadBytes: 50 * 1024 * 1024,
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  /** HeadObject 命中即视为已存在；抛 NotFound 视为不存在。 */
  function mockSend(headBehaviour: 'found' | 'missing' | 'error'): jest.SpyInstance {
    return jest.spyOn(S3Client.prototype, 'send').mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        if (headBehaviour === 'found') return undefined as never
        if (headBehaviour === 'missing') {
          throw Object.assign(new Error('NotFound'), { name: 'NotFound' })
        }
        throw Object.assign(new Error('boom'), { $metadata: { httpStatusCode: 500 } })
      }
      return undefined as never
    })
  }

  it('键空闲时正常写入', async () => {
    const send = mockSend('missing')
    const service = new ObjectStorageService(CONFIG)

    await service.putImmutable('drawings/MT-7719/v1-REV-A/a.pdf', new Uint8Array([1]), 'application/pdf')

    expect(send.mock.calls.some(([c]) => c instanceof PutObjectCommand)).toBe(true)
  })

  it('键已被占用时拒绝，且**不发** PutObject——覆盖会让旧版报价指向新内容', async () => {
    const send = mockSend('found')
    const service = new ObjectStorageService(CONFIG)

    await expect(
      service.putImmutable('drawings/MT-7719/v1-REV-A/a.pdf', new Uint8Array([1]), 'application/pdf'),
    ).rejects.toMatchObject({ code: 'SYS_9045', status: 409 })

    expect(send.mock.calls.some(([c]) => c instanceof PutObjectCommand)).toBe(false)
  })

  it('404 状态码也算「不存在」——SDK 两种表达都要认', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        throw Object.assign(new Error('nope'), { $metadata: { httpStatusCode: 404 } })
      }
      return undefined as never
    })

    await expect(new ObjectStorageService(CONFIG).exists('k')).resolves.toBe(false)
  })

  it('非「不存在」的错误原样抛出，不被当成键空闲', async () => {
    mockSend('error')
    await expect(new ObjectStorageService(CONFIG).exists('k')).rejects.toThrow('boom')
  })
})
