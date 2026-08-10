import { loadObjectStorageConfig } from '../services/object-storage.config'
import { ObjectStorageService } from '../services/object-storage.service'

/**
 * 端点替换是整个 kkFileView 接入里最经典的坑，所以这里对着**真实 SDK**
 * 签一次名再解析主机名——预签名是本地加密运算，不联网，测得起。
 */
describe('预签名端点：预览签给容器可达地址，下载签给浏览器可达地址', () => {
  function service(env: Record<string, string> = {}): ObjectStorageService {
    return new ObjectStorageService(loadObjectStorageConfig(env as NodeJS.ProcessEnv))
  }

  it('audience=preview 用 S3_PREVIEW_ENDPOINT，而不是 localhost', async () => {
    const url = await service().presign('drawings/MT-7719/REV-B.pdf', {
      audience: 'preview',
      ttlSeconds: 180,
    })

    // 容器里的 localhost 是 kkFileView 自己，签在 localhost 上必然取不到文件
    expect(new URL(url).host).toBe('minio:9000')
    expect(url).not.toContain('localhost')
  })

  it('audience=browser 用 S3_ENDPOINT', async () => {
    const url = await service().presign('drawings/MT-7719/REV-B.pdf', {
      audience: 'browser',
      ttlSeconds: 180,
    })

    expect(new URL(url).host).toBe('localhost:9000')
  })

  it('两个端点都可被环境变量覆盖，代码里不写死主机名', async () => {
    const configured = service({
      S3_ENDPOINT: 'https://files.example.com',
      S3_PREVIEW_ENDPOINT: 'http://minio.internal:9000',
      S3_BUCKET: 'erp-prod',
    })

    const preview = await configured.presign('k', { audience: 'preview', ttlSeconds: 60 })
    const browser = await configured.presign('k', { audience: 'browser', ttlSeconds: 60 })

    expect(new URL(preview).host).toBe('minio.internal:9000')
    expect(new URL(browser).host).toBe('files.example.com')
  })

  it('预览端点默认是 compose 服务名，而不是回落到 S3_ENDPOINT', () => {
    // 回落等于默认签一个容器取不到的地址，出问题时排查成本极高
    const config = loadObjectStorageConfig({
      S3_ENDPOINT: 'http://localhost:9000',
    } as NodeJS.ProcessEnv)

    expect(config.previewEndpoint).toBe('http://minio:9000')
  })

  it('MinIO 只认 path-style：桶名出现在路径里而不是子域名里', async () => {
    const url = await service({ S3_BUCKET: 'machining-erp' }).presign('a/b.pdf', {
      audience: 'preview',
      ttlSeconds: 60,
    })

    expect(new URL(url).pathname).toBe('/machining-erp/a/b.pdf')
  })

  it('有效期原样进签名参数', async () => {
    const url = await service().presign('k', { audience: 'preview', ttlSeconds: 300 })
    expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe('300')
  })

  it('下载时带 content-disposition，浏览器另存为的文件名才对', async () => {
    const url = await service().presign('9f2c1a3e', {
      audience: 'browser',
      ttlSeconds: 60,
      downloadFileName: '导轨压板.pdf',
    })

    const disposition = new URL(url).searchParams.get('response-content-disposition')
    expect(disposition).toContain('attachment')
  })
})

describe('对象存储配置', () => {
  it('缺省值对齐 infra/.env.example 与 compose', () => {
    const config = loadObjectStorageConfig({} as NodeJS.ProcessEnv)

    expect(config).toMatchObject({
      endpoint: 'http://localhost:9000',
      previewEndpoint: 'http://minio:9000',
      bucket: 'machining-erp',
      forcePathStyle: true,
    })
  })

  it('凭证优先取 S3_*，回落到 MINIO_ROOT_*', () => {
    expect(
      loadObjectStorageConfig({
        MINIO_ROOT_USER: 'erp',
        MINIO_ROOT_PASSWORD: 'pw',
      } as NodeJS.ProcessEnv).accessKeyId,
    ).toBe('erp')

    expect(
      loadObjectStorageConfig({
        S3_ACCESS_KEY_ID: 'ak',
        MINIO_ROOT_USER: 'erp',
      } as NodeJS.ProcessEnv).accessKeyId,
    ).toBe('ak')
  })
})
