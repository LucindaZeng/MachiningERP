import { AuditService } from '../../../platform/audit'
import { ObjectStorageService } from '../../../platform/object-storage'
import {
  autoRevision,
  composeDrawingObjectKey,
  sanitizeFileName,
  sanitizeSegment,
} from '../services/drawing-object-key'
import { DrawingUploadService } from '../services/drawing-upload.service'
import { validateQuotationDraft } from '../services/quotation-rules'

import type {
  DrawingRepositoryPort,
  DrawingVersionRecord,
} from '../repositories/drawing.repository.port'
import type { DrawingUploadActor } from '../services/drawing-upload.service'

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])

const SALES: DrawingUploadActor = { userCode: 'WFX-2018-0042', permissions: ['sales.operate'] }
const ENGINEER: DrawingUploadActor = { userCode: 'WFX-2019-0200', permissions: ['quote.costing.edit'] }
const OUTSIDER: DrawingUploadActor = { userCode: 'WFX-2020-0001', permissions: [] }

interface Harness {
  service: DrawingUploadService
  putImmutable: jest.Mock
  audit: jest.Mock
  created: jest.Mock
  drawings: DrawingRepositoryPort
}

/** 假图纸库：记住每张图的最大序号，好验证版本递增。 */
function build(existingSequence = 0): Harness {
  const putImmutable = jest.fn().mockResolvedValue(undefined)
  const storage = {
    putImmutable,
    config: { maxUploadBytes: 1024 },
  } as unknown as ObjectStorageService

  const audit = jest.fn().mockResolvedValue(undefined)
  const auditService = { record: audit } as unknown as AuditService

  const created = jest.fn(
    async (data: Record<string, unknown>): Promise<DrawingVersionRecord> => ({
      ...(data as unknown as DrawingVersionRecord),
      id: 'DV-NEW',
      drawingNo: 'MT-7719',
      uploadedAt: new Date('2026-08-10T02:00:00Z'),
    }),
  )

  const drawings = {
    ensureDrawing: jest.fn().mockResolvedValue({ id: 'D1', drawingNo: 'MT-7719' }),
    latestSequence: jest.fn().mockResolvedValue(existingSequence),
    createVersion: created,
    findVersion: jest.fn().mockResolvedValue(null),
    listVersions: jest.fn().mockResolvedValue([]),
  } as unknown as DrawingRepositoryPort

  return {
    service: new DrawingUploadService(storage, auditService, drawings),
    putImmutable,
    audit,
    created,
    drawings,
  }
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    drawingNo: 'MT-7719',
    customerId: 'C1',
    title: '直线导轨安装座',
    revision: null,
    fileName: 'MT-7719.pdf',
    contentType: 'application/pdf',
    content: PDF,
    ...overrides,
  } as Parameters<DrawingUploadService['upload']>[0]
}

describe('对象键必须带版本号', () => {
  it('键里含 v{序号}-{版本名}，新版本一定是新键', () => {
    expect(
      composeDrawingObjectKey({
        drawingNo: 'MT-7719',
        sequence: 2,
        revision: 'REV B',
        fileName: 'MT-7719.pdf',
      }),
    ).toBe('drawings/MT-7719/v2-REV-B/MT-7719.pdf')
  })

  it('同图号同版本名的两次上传因序号不同而键不同——这是缓存失效的关键', () => {
    const first = composeDrawingObjectKey({
      drawingNo: 'MT-7719', sequence: 1, revision: 'REV A', fileName: 'a.pdf',
    })
    const second = composeDrawingObjectKey({
      drawingNo: 'MT-7719', sequence: 2, revision: 'REV A', fileName: 'a.pdf',
    })

    expect(first).not.toBe(second)
  })

  it('图号里的斜杠不会在对象存储里凭空多出一层目录', () => {
    const key = composeDrawingObjectKey({
      drawingNo: 'MT-7719/A', sequence: 1, revision: 'REV A', fileName: 'a.pdf',
    })

    expect(key.split('/')).toHaveLength(4)
    expect(key).toContain('MT-7719-A')
  })

  it('文件名保留扩展名——kkFileView 靠它选渲染器', () => {
    expect(sanitizeFileName('导轨 压板 (最终).pdf')).toMatch(/\.pdf$/)
    expect(sanitizeFileName('no-extension')).toBe('no-extension')
  })

  it('中文段落保留，不被清成一串横杠', () => {
    expect(sanitizeSegment('导轨压板')).toBe('导轨压板')
  })

  it('清洗后为空时兜底成 unnamed，不产生空路径段', () => {
    expect(sanitizeSegment('///')).toBe('unnamed')
  })
})

describe('自动版本名', () => {
  it.each([
    [1, 'REV A'],
    [2, 'REV B'],
    [26, 'REV Z'],
    [27, 'REV AA'],
  ])('第 %s 版 → %s', (sequence, expected) => {
    expect(autoRevision(sequence)).toBe(expected)
  })
})

describe('上传：版本递增且永不覆盖', () => {
  it('首次上传落 v1 / REV A', async () => {
    const { service, created, putImmutable } = build(0)
    await service.upload(input(), SALES)

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ sequence: 1, revision: 'REV A', source: 'QUOTATION' }),
    )
    expect(putImmutable).toHaveBeenCalledWith(
      'drawings/MT-7719/v1-REV-A/MT-7719.pdf',
      PDF,
      'application/pdf',
    )
  })

  it('已有两版时新上传是第三版', async () => {
    const { service, created } = build(2)
    await service.upload(input(), SALES)

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ sequence: 3, revision: 'REV C' }),
    )
  })

  it('业务填了版本名就用它的', async () => {
    const { service, created } = build(1)
    await service.upload(input({ revision: 'Rev.B-客户确认版' }), SALES)

    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 'Rev.B-客户确认版' }),
    )
  })

  it('写对象在写库之前——反过来会留下指向空气的版本记录', async () => {
    const order: string[] = []
    const { service } = (() => {
      const harness = build(0)
      harness.putImmutable.mockImplementation(async () => {
        order.push('storage')
      })
      ;(harness.drawings.createVersion as jest.Mock).mockImplementation(async () => {
        order.push('database')
        return { id: 'DV1', uploadedAt: new Date() } as DrawingVersionRecord
      })
      return harness
    })()

    await service.upload(input(), SALES)
    expect(order).toEqual(['storage', 'database'])
  })

  it('对象键被占用时整个上传失败，不写库', async () => {
    const harness = build(0)
    harness.putImmutable.mockRejectedValue(
      Object.assign(new Error('exists'), { code: 'SYS_9045' }),
    )

    await expect(harness.service.upload(input(), SALES)).rejects.toThrow()
    expect(harness.created).not.toHaveBeenCalled()
  })
})

describe('上传的权限与校验', () => {
  it('业务与报价工程师都能传', async () => {
    await expect(build().service.upload(input(), SALES)).resolves.toBeDefined()
    await expect(build().service.upload(input(), ENGINEER)).resolves.toBeDefined()
  })

  it('无关岗位不能传', async () => {
    await expect(build().service.upload(input(), OUTSIDER)).rejects.toMatchObject({
      code: 'ORD_2224',
      status: 403,
    })
  })

  it('没有图号不能传——图纸挂不到任何一张图上', async () => {
    await expect(build().service.upload(input({ drawingNo: '  ' }), SALES)).rejects.toMatchObject({
      code: 'SYS_9040',
    })
  })

  it('类型不在白名单时在写对象之前就被拦下', async () => {
    const harness = build()
    await expect(
      harness.service.upload(input({ fileName: 'payload.exe' }), SALES),
    ).rejects.toMatchObject({ code: 'SYS_9041' })
    expect(harness.putImmutable).not.toHaveBeenCalled()
  })

  it('超过大小上限被拦下', async () => {
    const harness = build()
    await expect(
      harness.service.upload(input({ content: Buffer.alloc(2048, 0x25) }), SALES),
    ).rejects.toMatchObject({ code: 'SYS_9042', status: 413 })
  })

  it('每次上传都留痕：谁、哪张图、第几版', async () => {
    const harness = build(1)
    await harness.service.upload(input(), SALES)

    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserCode: 'WFX-2018-0042',
        action: 'drawing.upload',
        entityType: 'DrawingVersion',
        after: expect.objectContaining({ drawingNo: 'MT-7719', sequence: 2, revision: 'REV B' }),
      }),
    )
  })

  it('版本查不到时 404', async () => {
    await expect(build().service.loadVersion('NOPE')).rejects.toMatchObject({ code: 'ORD_2223' })
  })
})

describe('报价单强制上传图纸的服务端闸门', () => {
  const tier = { minQuantity: '100', unitPriceMinor: 1000n, unitCostMinor: 800n }

  it('缺 drawingVersionId 时拒绝——前端那句「未上传图纸，无法提交」在后端成立', () => {
    const issues = validateQuotationDraft({
      customerId: 'C1',
      costAnalysisId: 'CA1',
      items: [
        { productName: '导轨压板', drawingNo: 'MT-7719', drawingVersionId: null, costAnalysisLineId: 'L1', tiers: [tier] },
      ],
    })

    expect(issues.map((issue) => issue.field)).toContain('items[0].drawingVersionId')
  })

  it('带上上传得到的 drawingVersionId 后这一条不再报', () => {
    const issues = validateQuotationDraft({
      customerId: 'C1',
      costAnalysisId: 'CA1',
      items: [
        { productName: '导轨压板', drawingNo: 'MT-7719', drawingVersionId: 'DV-NEW', costAnalysisLineId: 'L1', tiers: [tier] },
      ],
    })

    expect(issues.map((issue) => issue.field)).not.toContain('items[0].drawingVersionId')
  })

  it('多行时逐行判，只点名缺图纸的那一行', () => {
    const issues = validateQuotationDraft({
      customerId: 'C1',
      costAnalysisId: 'CA1',
      items: [
        { productName: 'A', drawingNo: 'A-1', drawingVersionId: 'DV1', costAnalysisLineId: 'L1', tiers: [tier] },
        { productName: 'B', drawingNo: 'B-1', drawingVersionId: null, costAnalysisLineId: 'L2', tiers: [tier] },
      ],
    })

    const fields = issues.map((issue) => issue.field)
    expect(fields).toContain('items[1].drawingVersionId')
    expect(fields).not.toContain('items[0].drawingVersionId')
  })
})
