import { AuditService } from '../../audit'
import { ObjectStorageService } from '../../object-storage'
import { FilePreviewService } from '../services/file-preview.service'

import type {
  FilePreviewSource,
  PreviewViewer,
  ResolvedPreviewFile,
} from '../repositories/file-preview-source.port'
import type { FilePreviewConfig } from '../services/file-preview.config'

const VIEWER: PreviewViewer = {
  userCode: 'WFX-2018-0042',
  displayName: '陈志强',
  permissions: ['sales.operate'],
}

const DRAWING: ResolvedPreviewFile = {
  objectKey: 'drawings/MT-7719/REV-B.pdf',
  fileName: 'MT-7719_REV-B.pdf',
  docType: 'DrawingVersion',
  docId: 'DV1',
  docLabel: 'MT-7719 REV B',
}

const CONFIG: FilePreviewConfig = { baseUrl: 'http://localhost:8012', ttlSeconds: 180 }

interface Harness {
  service: FilePreviewService
  presign: jest.Mock
  audit: jest.Mock
  resolve: jest.Mock
}

function build(resolved: ResolvedPreviewFile | null = DRAWING): Harness {
  const presign = jest.fn().mockResolvedValue('http://minio:9000/machining-erp/k?X-Amz-Signature=s')
  const storage = { presign } as unknown as ObjectStorageService

  const audit = jest.fn().mockResolvedValue(undefined)
  const auditService = { record: audit } as unknown as AuditService

  const resolve = jest.fn().mockResolvedValue(resolved)
  const source = { ownerType: 'drawing-version', resolve } as unknown as FilePreviewSource

  return {
    service: new FilePreviewService(storage, auditService, [source], CONFIG),
    presign,
    audit,
    resolve,
  }
}

describe('权限：解析不到与无权访问对外不可区分', () => {
  it('resolver 判定无权时返回 404，而不是 403', async () => {
    const { service } = build(null)

    await expect(
      service.previewUrlFor('drawing-version', 'DV1', VIEWER),
    ).rejects.toMatchObject({ code: 'SYS_9030', status: 404 })
  })

  it('被拒时绝不签名，也不写签发审计', async () => {
    const { service, presign, audit } = build(null)

    await expect(service.previewUrlFor('drawing-version', 'DV1', VIEWER)).rejects.toThrow()
    expect(presign).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })

  it('未注册的归属类型 400，不落到某个 resolver 上', async () => {
    const { service, resolve } = build()

    await expect(
      service.previewUrlFor('shipment-attachment', 'X', VIEWER),
    ).rejects.toMatchObject({ code: 'SYS_9031', status: 400 })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('白名单里但没注册 provider 时同样 400，而不是 500', async () => {
    const { service } = build()

    await expect(
      service.previewUrlFor('order-customer-po', 'O1', VIEWER),
    ).rejects.toMatchObject({ code: 'SYS_9031' })
  })

  it('查看者身份原样交给 resolver 自己判', async () => {
    const { service, resolve } = build()
    await service.previewUrlFor('drawing-version', 'DV1', VIEWER)

    expect(resolve).toHaveBeenCalledWith('DV1', VIEWER)
  })
})

describe('签发：短时效 + 容器可达端点 + 水印', () => {
  it('用 preview 端点签名，有效期取配置', async () => {
    const { service, presign } = build()
    await service.previewUrlFor('drawing-version', 'DV1', VIEWER)

    expect(presign).toHaveBeenCalledWith('drawings/MT-7719/REV-B.pdf', {
      audience: 'preview',
      ttlSeconds: 180,
    })
  })

  it('返回的地址是 kkFileView 的 onlinePreview，参数齐三样', async () => {
    const { service } = build()
    const view = await service.previewUrlFor('drawing-version', 'DV1', VIEWER)
    const url = new URL(view.previewUrl)

    expect(url.origin + url.pathname).toBe('http://localhost:8012/onlinePreview')
    expect(Buffer.from(url.searchParams.get('url') ?? '', 'base64').toString('utf8')).toBe(
      'http://minio:9000/machining-erp/k?X-Amz-Signature=s',
    )
    expect(url.searchParams.get('fullfilename')).toBe('MT-7719_REV-B.pdf')
    expect(url.searchParams.get('watermarkTxt')).toBe('陈志强 WFX-2018-0042')
  })

  it('回执带上有效期与水印，前端据此提示', async () => {
    const { service } = build()
    const view = await service.previewUrlFor('drawing-version', 'DV1', VIEWER)

    expect(view).toMatchObject({
      fileName: 'MT-7719_REV-B.pdf',
      expiresInSeconds: 180,
      watermarkText: '陈志强 WFX-2018-0042',
    })
  })

  it('存储凭证不会出现在返回给前端的地址里', async () => {
    const { service } = build()
    const view = await service.previewUrlFor('drawing-version', 'DV1', VIEWER)

    expect(view.previewUrl).not.toContain('erp_dev_password')
    expect(view.previewUrl).not.toContain('X-Amz-Credential=')
  })
})

describe('不支持的类型当场回 415', () => {
  it('STEP 文件不预览，错误里带上文件名供前端提示', async () => {
    const { service, presign } = build({ ...DRAWING, fileName: 'MT-7719.step' })

    await expect(
      service.previewUrlFor('drawing-version', 'DV1', VIEWER),
    ).rejects.toMatchObject({ code: 'SYS_9032', status: 415 })
    expect(presign).not.toHaveBeenCalled()
  })

  it('415 的判定发生在签名之前，不白签一个没人用的 URL', async () => {
    const { service, audit } = build({ ...DRAWING, fileName: 'a.exe' })

    await expect(service.previewUrlFor('drawing-version', 'DV1', VIEWER)).rejects.toThrow()
    expect(audit).not.toHaveBeenCalled()
  })
})

describe('下载回落', () => {
  it('签给浏览器端点并带文件名，415 的类型也能下载', async () => {
    const { service, presign } = build({ ...DRAWING, fileName: 'MT-7719.step' })
    const view = await service.downloadUrlFor('drawing-version', 'DV1', VIEWER)

    expect(presign).toHaveBeenCalledWith('drawings/MT-7719/REV-B.pdf', {
      audience: 'browser',
      ttlSeconds: 180,
      downloadFileName: 'MT-7719.step',
    })
    expect(view.watermarkText).toBe('')
  })

  it('下载同样要过权限', async () => {
    const { service } = build(null)
    await expect(service.downloadUrlFor('drawing-version', 'DV1', VIEWER)).rejects.toMatchObject({
      code: 'SYS_9030',
    })
  })
})

describe('每一次签发都留痕', () => {
  it('记谁、哪个文件、挂在哪张单据上', async () => {
    const { service, audit } = build()
    await service.previewUrlFor('drawing-version', 'DV1', VIEWER)

    expect(audit).toHaveBeenCalledWith({
      actorUserCode: 'WFX-2018-0042',
      action: 'file-preview.issue',
      entityType: 'DrawingVersion',
      entityId: 'DV1',
      after: {
        ownerType: 'drawing-version',
        docLabel: 'MT-7719 REV B',
        fileName: 'MT-7719_REV-B.pdf',
        objectKey: 'drawings/MT-7719/REV-B.pdf',
        ttlSeconds: 180,
      },
    })
  })

  it('下载走另一个 action，两种行为在审计里分得开', async () => {
    const { service, audit } = build()
    await service.downloadUrlFor('drawing-version', 'DV1', VIEWER)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'file-preview.download' }),
    )
  })
})

describe('缺省配置：不传 config 时从环境变量读', () => {
  const saved = { ...process.env }

  afterEach(() => {
    process.env = { ...saved }
  })

  it('走 loadFilePreviewConfig(process.env)，基础地址随环境变化', async () => {
    process.env.KK_PREVIEW_BASE_URL = 'https://erp.example.com/preview'

    const presign = jest.fn().mockResolvedValue('http://minio:9000/b/k')
    const source = {
      ownerType: 'drawing-version',
      resolve: jest.fn().mockResolvedValue(DRAWING),
    } as unknown as FilePreviewSource
    const service = new FilePreviewService(
      { presign } as unknown as ObjectStorageService,
      { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      [source],
    )

    const view = await service.previewUrlFor('drawing-version', 'DV1', VIEWER)
    expect(view.previewUrl.startsWith('https://erp.example.com/preview/onlinePreview?')).toBe(true)
  })
})
