import { isPreviewOwnerType } from '../constants/preview-owner-types'
import { extensionOf, isPreviewable } from '../constants/previewable-extensions'
import { clampTtl, loadFilePreviewConfig } from '../services/file-preview.config'
import { buildPreviewUrl, composeWatermark, toBase64 } from '../services/preview-url.builder'

const PRESIGNED =
  'http://minio:9000/machining-erp/drawings/MT-7719/REV-B.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=180&X-Amz-Signature=abc123'

describe('kkFileView 要求先 Base64 再 URL 编码', () => {
  it('url 参数是「预签名 URL 的 base64」再经 URL 编码', () => {
    const url = buildPreviewUrl({
      baseUrl: 'http://localhost:8012',
      presignedUrl: PRESIGNED,
      fileName: 'MT-7719_REV-B.pdf',
      watermarkText: '陈志强 WFX-2018-0042',
    })

    const encoded = new URL(url).searchParams.get('url')
    expect(encoded).toBe(toBase64(PRESIGNED))
    // searchParams 解出来已是解码后的值，说明传输时确实做了 URL 编码
    expect(url).toContain(encodeURIComponent(toBase64(PRESIGNED)))
  })

  it('往返能还原出原始预签名 URL——顺序反了就还原不出来', () => {
    const url = buildPreviewUrl({
      baseUrl: 'http://localhost:8012',
      presignedUrl: PRESIGNED,
      fileName: 'a.pdf',
      watermarkText: 'w',
    })

    const encoded = new URL(url).searchParams.get('url') ?? ''
    expect(Buffer.from(encoded, 'base64').toString('utf8')).toBe(PRESIGNED)
  })

  it('预签名 URL 里的 & 不会截断 query：解出的 url 参数含全部签名参数', () => {
    const url = buildPreviewUrl({
      baseUrl: 'http://localhost:8012',
      presignedUrl: PRESIGNED,
      fileName: 'a.pdf',
      watermarkText: 'w',
    })
    const decoded = Buffer.from(new URL(url).searchParams.get('url') ?? '', 'base64').toString('utf8')

    expect(decoded).toContain('X-Amz-Signature=abc123')
    expect(new URL(url).searchParams.get('X-Amz-Signature')).toBeNull()
  })

  it('base64 编码走 utf8，中文文件名不乱码', () => {
    const chinese = 'http://minio:9000/b/图纸-导轨压板.pdf'
    expect(Buffer.from(toBase64(chinese), 'base64').toString('utf8')).toBe(chinese)
  })
})

describe('fullfilename 保证选对渲染器', () => {
  it('无扩展名的对象键也能靠 fullfilename 告知真实扩展名', () => {
    const url = buildPreviewUrl({
      baseUrl: 'http://localhost:8012',
      presignedUrl: 'http://minio:9000/b/9f2c1a3e',
      fileName: 'MT-7719_REV-B.dwg',
      watermarkText: 'w',
    })

    expect(new URL(url).searchParams.get('fullfilename')).toBe('MT-7719_REV-B.dwg')
  })

  it('带空格与中文的文件名被正确编码', () => {
    const url = buildPreviewUrl({
      baseUrl: 'http://localhost:8012',
      presignedUrl: 'http://minio:9000/b/k',
      fileName: '导轨压板 REV B.pdf',
      watermarkText: 'w',
    })

    expect(new URL(url).searchParams.get('fullfilename')).toBe('导轨压板 REV B.pdf')
    expect(url).not.toContain(' ')
  })

  it('路径是 /onlinePreview，基础地址原样保留', () => {
    const url = buildPreviewUrl({
      baseUrl: 'https://erp.example.com/preview',
      presignedUrl: 'http://minio:9000/b/k',
      fileName: 'a.pdf',
      watermarkText: 'w',
    })

    expect(url.startsWith('https://erp.example.com/preview/onlinePreview?')).toBe(true)
  })
})

describe('水印带人：姓名 + 工号', () => {
  it('两者拼在一起', () => {
    expect(composeWatermark('陈志强', 'WFX-2018-0042')).toBe('陈志强 WFX-2018-0042')
  })

  it('没有姓名时退回工号，不留一个空格开头的水印', () => {
    expect(composeWatermark('', 'WFX-2018-0042')).toBe('WFX-2018-0042')
    expect(composeWatermark('   ', 'WFX-2018-0042')).toBe('WFX-2018-0042')
  })

  it('水印进 URL 时被编码', () => {
    const url = buildPreviewUrl({
      baseUrl: 'http://localhost:8012',
      presignedUrl: 'http://minio:9000/b/k',
      fileName: 'a.pdf',
      watermarkText: composeWatermark('陈志强', 'WFX-2018-0042'),
    })

    expect(new URL(url).searchParams.get('watermarkTxt')).toBe('陈志强 WFX-2018-0042')
  })
})

describe('预签名有效期封顶 5 分钟', () => {
  it.each([
    [60, 60],
    [300, 300],
    // 超过上限截断成 300，而不是报错——配置写大了该降级，不该让预览瘫掉
    [301, 300],
    [86_400, 300],
  ])('%s 秒 → %s 秒', (input, expected) => {
    expect(clampTtl(input)).toBe(expected)
  })

  it.each([0, -1, Number.NaN])('非法值 %s 回落到默认 180 秒', (input) => {
    expect(clampTtl(input)).toBe(180)
  })

  it('小数向下取整', () => {
    expect(clampTtl(59.9)).toBe(59)
  })
})

describe('配置只从环境变量来', () => {
  it('缺省时用本地 kkFileView 地址', () => {
    const config = loadFilePreviewConfig({} as NodeJS.ProcessEnv)

    expect(config.baseUrl).toBe('http://localhost:8012')
    expect(config.ttlSeconds).toBe(180)
  })

  it('生产反代路径照用，并去掉末尾斜杠避免出现双斜杠', () => {
    const config = loadFilePreviewConfig({
      KK_PREVIEW_BASE_URL: 'https://erp.example.com/preview/',
    } as NodeJS.ProcessEnv)

    expect(config.baseUrl).toBe('https://erp.example.com/preview')
  })

  it('TTL 可配但仍受上限约束', () => {
    const config = loadFilePreviewConfig({ KK_PREVIEW_TTL_SECONDS: '9999' } as NodeJS.ProcessEnv)
    expect(config.ttlSeconds).toBe(300)
  })
})

describe('可预览类型', () => {
  it.each(['pdf', 'docx', 'xlsx', 'png', 'dwg', 'dxf', 'zip'])('%s 可预览', (ext) => {
    expect(isPreviewable(`file.${ext}`)).toBe(true)
  })

  it.each(['step', 'stp', 'iges', 'sldprt', 'exe'])('%s 不可预览，前端应回落下载', (ext) => {
    expect(isPreviewable(`file.${ext}`)).toBe(false)
  })

  it('扩展名大小写不敏感', () => {
    expect(isPreviewable('MT-7719.DWG')).toBe(true)
  })

  it('没有扩展名一律按不可预览处理', () => {
    expect(extensionOf('9f2c1a3e')).toBe('')
    expect(extensionOf('trailing.')).toBe('')
    expect(isPreviewable('9f2c1a3e')).toBe(false)
  })
})

describe('归属类型白名单', () => {
  it('只认注册过的两种', () => {
    expect(isPreviewOwnerType('drawing-version')).toBe(true)
    expect(isPreviewOwnerType('order-customer-po')).toBe(true)
  })

  it('出货附件尚未存在，不在白名单里', () => {
    expect(isPreviewOwnerType('shipment-attachment')).toBe(false)
    expect(isPreviewOwnerType('../../etc/passwd')).toBe(false)
  })
})
