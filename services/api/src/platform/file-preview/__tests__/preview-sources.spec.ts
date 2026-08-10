import { DrawingVersionPreviewSource } from '../repositories/drawing-version.source'
import { OrderCustomerPoPreviewSource, baseNameOf } from '../repositories/order-customer-po.source'

import type { PrismaService } from '../../../infrastructure/prisma/prisma.service'
import type { PreviewViewer } from '../repositories/file-preview-source.port'

const OWNER: PreviewViewer = {
  userCode: 'WFX-2018-0042',
  displayName: '陈志强',
  permissions: ['sales.operate'],
}
const OTHER_SALES: PreviewViewer = { ...OWNER, userCode: 'WFX-2019-0200' }
const ENGINEER: PreviewViewer = { ...OWNER, permissions: ['eng.bom.handle'] }
const OUTSIDER: PreviewViewer = { ...OWNER, permissions: [] }
const VIEW_ALL: PreviewViewer = { ...OTHER_SALES, permissions: ['sales.operate', 'customer.view-all'] }

const VERSION = {
  id: 'DV1',
  revision: 'REV B',
  fileKey: 'drawings/MT-7719/REV-B.pdf',
  fileName: 'MT-7719_REV-B.pdf',
  drawing: { drawingNo: 'MT-7719', customerId: 'C1' },
}

function prismaFor(overrides: {
  version?: unknown
  order?: unknown
  salesUserCode?: string | null
}): PrismaService {
  return {
    drawingVersion: { findUnique: jest.fn().mockResolvedValue(overrides.version ?? null) },
    salesOrder: { findUnique: jest.fn().mockResolvedValue(overrides.order ?? null) },
    customer: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.salesUserCode === undefined ? null : { salesUserCode: overrides.salesUserCode },
      ),
    },
  } as unknown as PrismaService
}

describe('图纸版本：岗位 + 客户数据范围两道判定', () => {
  it('负责该客户的业务员能看', async () => {
    const source = new DrawingVersionPreviewSource(
      prismaFor({ version: VERSION, salesUserCode: 'WFX-2018-0042' }),
    )

    await expect(source.resolve('DV1', OWNER)).resolves.toEqual({
      objectKey: 'drawings/MT-7719/REV-B.pdf',
      fileName: 'MT-7719_REV-B.pdf',
      docType: 'DrawingVersion',
      docId: 'DV1',
      docLabel: 'MT-7719 REV B',
    })
  })

  it('工程岗位同样能看——建 BOM 要对着图纸', async () => {
    const source = new DrawingVersionPreviewSource(
      prismaFor({ version: VERSION, salesUserCode: 'WFX-2018-0042' }),
    )
    await expect(source.resolve('DV1', { ...ENGINEER, userCode: 'WFX-2018-0042' })).resolves.not.toBeNull()
  })

  it('不看图的岗位直接拒，连库都不查', async () => {
    const prisma = prismaFor({ version: VERSION })
    const source = new DrawingVersionPreviewSource(prisma)

    await expect(source.resolve('DV1', OUTSIDER)).resolves.toBeNull()
    expect(prisma.drawingVersion.findUnique).not.toHaveBeenCalled()
  })

  it('别的业务员看不到不属于自己的客户的图纸', async () => {
    const source = new DrawingVersionPreviewSource(
      prismaFor({ version: VERSION, salesUserCode: 'WFX-2018-0042' }),
    )
    await expect(source.resolve('DV1', OTHER_SALES)).resolves.toBeNull()
  })

  it('有 customer.view-all 则跨客户可看', async () => {
    const source = new DrawingVersionPreviewSource(
      prismaFor({ version: VERSION, salesUserCode: 'WFX-2018-0042' }),
    )
    await expect(source.resolve('DV1', VIEW_ALL)).resolves.not.toBeNull()
  })

  it('通用件（图纸不挂客户）不做范围限制', async () => {
    const source = new DrawingVersionPreviewSource(
      prismaFor({ version: { ...VERSION, drawing: { drawingNo: 'STD-01', customerId: null } } }),
    )
    await expect(source.resolve('DV1', OTHER_SALES)).resolves.not.toBeNull()
  })

  it('版本不存在返回 null，交给服务层统一成 404', async () => {
    const source = new DrawingVersionPreviewSource(prismaFor({}))
    await expect(source.resolve('NOPE', OWNER)).resolves.toBeNull()
  })

  it('客户记录查不到时按无权处理，不放行', async () => {
    const source = new DrawingVersionPreviewSource(
      prismaFor({ version: VERSION, salesUserCode: undefined }),
    )
    await expect(source.resolve('DV1', OWNER)).resolves.toBeNull()
  })
})

describe('客户订单原件：文件名从对象键推出来', () => {
  const ORDER = {
    id: 'O1',
    docNo: 'SO-20260710-0085',
    customerId: 'C1',
    customerPoFile: 'orders/O1/PO-88712.pdf',
  }

  it('负责该客户的业务员能看，docLabel 是订单号', async () => {
    const source = new OrderCustomerPoPreviewSource(
      prismaFor({ order: ORDER, salesUserCode: 'WFX-2018-0042' }),
    )

    await expect(source.resolve('O1', OWNER)).resolves.toEqual({
      objectKey: 'orders/O1/PO-88712.pdf',
      fileName: 'PO-88712.pdf',
      docType: 'SalesOrder',
      docId: 'O1',
      docLabel: 'SO-20260710-0085',
    })
  })

  it('审核链上的岗位也能看', async () => {
    const source = new OrderCustomerPoPreviewSource(
      prismaFor({ order: ORDER, salesUserCode: 'WFX-2018-0042' }),
    )
    const financeReviewer: PreviewViewer = {
      ...OWNER,
      permissions: ['order.finance.review', 'customer.view-all'],
    }

    await expect(source.resolve('O1', financeReviewer)).resolves.not.toBeNull()
  })

  it('订单没传原件时返回 null——单据在，文件不在', async () => {
    const source = new OrderCustomerPoPreviewSource(
      prismaFor({ order: { ...ORDER, customerPoFile: null }, salesUserCode: 'WFX-2018-0042' }),
    )
    await expect(source.resolve('O1', OWNER)).resolves.toBeNull()
  })

  it('别的业务员看不到', async () => {
    const source = new OrderCustomerPoPreviewSource(
      prismaFor({ order: ORDER, salesUserCode: 'WFX-2018-0042' }),
    )
    await expect(source.resolve('O1', OTHER_SALES)).resolves.toBeNull()
  })

  it('无关岗位直接拒', async () => {
    const prisma = prismaFor({ order: ORDER })
    const source = new OrderCustomerPoPreviewSource(prisma)

    await expect(source.resolve('O1', OUTSIDER)).resolves.toBeNull()
    expect(prisma.salesOrder.findUnique).not.toHaveBeenCalled()
  })

  it('订单不存在返回 null', async () => {
    const source = new OrderCustomerPoPreviewSource(prismaFor({}))
    await expect(source.resolve('NOPE', OWNER)).resolves.toBeNull()
  })
})

describe('对象键的 basename', () => {
  it.each([
    ['orders/O1/PO-88712.pdf', 'PO-88712.pdf'],
    ['PO-88712.pdf', 'PO-88712.pdf'],
    ['a/b/c/图纸.dwg', '图纸.dwg'],
    ['trailing/slash/', 'slash'],
  ])('%s → %s', (key, expected) => {
    expect(baseNameOf(key)).toBe(expected)
  })

  it('空串原样返回，不炸', () => {
    expect(baseNameOf('')).toBe('')
  })
})
