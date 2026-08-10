import { UPLOAD_ACCEPT_ATTRIBUTE, isPreviewable, isUploadable } from '@machining-erp/shared'

import { assertUploadAllowed, contentMatchesExtension, formatBytes } from '../services/upload-validation'

const LIMITS = { maxBytes: 1024 }

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
const DWG = Buffer.from([0x41, 0x43, 0x31, 0x30, 0x32, 0x37])
const TEXT = Buffer.from('0\nSECTION\n2\nHEADER\n', 'utf8')

describe('扩展名白名单', () => {
  it.each(['pdf', 'dwg', 'dxf', 'step', 'jpg', 'png', 'xlsx', 'docx', 'zip'])(
    '%s 允许上传',
    (ext) => {
      expect(isUploadable(`drawing.${ext}`)).toBe(true)
    },
  )

  it.each(['exe', 'sh', 'bat', 'js', 'iso'])('%s 拒绝上传', (ext) => {
    expect(isUploadable(`payload.${ext}`)).toBe(false)
  })

  it('没有扩展名一律拒绝', () => {
    expect(isUploadable('drawing')).toBe(false)
  })

  it('大小写不敏感', () => {
    expect(isUploadable('MT-7719.DWG')).toBe(true)
  })

  it('accept 串覆盖全部白名单，前端选择框与后端同源', () => {
    for (const ext of ['pdf', 'dwg', 'dxf', 'step', 'zip']) {
      expect(UPLOAD_ACCEPT_ATTRIBUTE).toContain(`.${ext}`)
    }
  })

  it('上传白名单与预览白名单**不相等**：STEP 传得上去但预览不了', () => {
    // 这正是 415 回落下载存在的理由，两个集合不该被「统一」掉
    expect(isUploadable('part.step')).toBe(true)
    expect(isPreviewable('part.step')).toBe(false)
  })
})

describe('内容嗅探：挡住改名上传', () => {
  it('魔数与扩展名一致时放行', () => {
    expect(contentMatchesExtension('pdf', PDF)).toBe(true)
    expect(contentMatchesExtension('png', PNG)).toBe(true)
    expect(contentMatchesExtension('dwg', DWG)).toBe(true)
  })

  it('xlsx / docx / zip 共用 zip 魔数', () => {
    expect(contentMatchesExtension('xlsx', ZIP)).toBe(true)
    expect(contentMatchesExtension('docx', ZIP)).toBe(true)
    expect(contentMatchesExtension('zip', ZIP)).toBe(true)
  })

  it('把可执行文件改名成 .pdf 会被识破', () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00])
    expect(contentMatchesExtension('pdf', exe)).toBe(false)
  })

  it('内容比魔数还短时判为不符', () => {
    expect(contentMatchesExtension('pdf', Buffer.from([0x25]))).toBe(false)
  })

  it('DXF / STEP 是纯文本，没有魔数可查，只能放行', () => {
    expect(contentMatchesExtension('dxf', TEXT)).toBe(true)
    expect(contentMatchesExtension('step', TEXT)).toBe(true)
    expect(contentMatchesExtension('stp', TEXT)).toBe(true)
  })

  it('白名单外的扩展名没有魔数规则，判定交给白名单那一关', () => {
    expect(contentMatchesExtension('txt', TEXT)).toBe(true)
  })
})

describe('三道校验合在一起', () => {
  it('合规文件通过', () => {
    expect(() =>
      assertUploadAllowed({ fileName: 'a.pdf', sizeBytes: PDF.length, content: PDF }, LIMITS),
    ).not.toThrow()
  })

  it('类型不在白名单 → 415', () => {
    expect(() =>
      assertUploadAllowed({ fileName: 'a.exe', sizeBytes: 4, content: PDF }, LIMITS),
    ).toThrow(expect.objectContaining({ code: 'SYS_9041', status: 415 }))
  })

  it('空文件 → 400', () => {
    expect(() =>
      assertUploadAllowed({ fileName: 'a.pdf', sizeBytes: 0, content: Buffer.alloc(0) }, LIMITS),
    ).toThrow(expect.objectContaining({ code: 'SYS_9043' }))
  })

  it('超过上限 → 413，文案里给出可读的大小', () => {
    expect(() =>
      assertUploadAllowed({ fileName: 'a.pdf', sizeBytes: 2048, content: PDF }, LIMITS),
    ).toThrow(expect.objectContaining({ code: 'SYS_9042', status: 413 }))
  })

  it('恰好等于上限时放行，边界不误伤', () => {
    expect(() =>
      assertUploadAllowed({ fileName: 'a.pdf', sizeBytes: 1024, content: PDF }, LIMITS),
    ).not.toThrow()
  })

  it('内容与扩展名不符 → 415', () => {
    expect(() =>
      assertUploadAllowed({ fileName: 'a.pdf', sizeBytes: 4, content: ZIP }, LIMITS),
    ).toThrow(expect.objectContaining({ code: 'SYS_9044' }))
  })

  it('白名单先判：伪装成 .exe 的合法 PDF 也不许传', () => {
    expect(() =>
      assertUploadAllowed({ fileName: 'a.exe', sizeBytes: PDF.length, content: PDF }, LIMITS),
    ).toThrow(expect.objectContaining({ code: 'SYS_9041' }))
  })
})

describe('大小格式化', () => {
  it.each([
    [512, '512 B'],
    [2048, '2.0 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('%s → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})
