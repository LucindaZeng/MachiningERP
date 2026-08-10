import { needsCustomerPo } from '../constants/order-type-rules'
import {
  CustomerPoUploadService,
  composeCustomerPoObjectKey,
} from '../services/customer-po-upload.service'
import { collectPrerequisiteIssues } from '../services/order-prerequisites'

import type { AuditService } from '../../../platform/audit'
import type { ObjectStorageService } from '../../../platform/object-storage'
import type { SalesOrderRepositoryPort } from '../repositories/sales-order.repository.port'
import type { OrderFacts } from '../services/order-prerequisites'
import type { OrderActor } from '../services/sales-order.service'
import type { SalesOrderType } from '@prisma/client'

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d])

const SALES: OrderActor = { userCode: 'WFX-2018-0042', permissions: ['sales.operate'] }
const OUTSIDER: OrderActor = { userCode: 'WFX-2019-0200', permissions: [] }

interface Harness {
  service: CustomerPoUploadService
  putImmutable: jest.Mock
  setCustomerPoFile: jest.Mock
  audit: jest.Mock
}

function build(order: Record<string, unknown> | null = null): Harness {
  const putImmutable = jest.fn().mockResolvedValue(undefined)
  const storage = { putImmutable, config: { maxUploadBytes: 1024 } } as unknown as ObjectStorageService

  const audit = jest.fn().mockResolvedValue(undefined)
  const auditService = { record: audit } as unknown as AuditService

  const setCustomerPoFile = jest.fn().mockResolvedValue(undefined)
  const orders = {
    findById: jest.fn().mockResolvedValue(order),
    setCustomerPoFile,
  } as unknown as SalesOrderRepositoryPort

  return {
    service: new CustomerPoUploadService(storage, auditService, orders),
    putImmutable,
    setCustomerPoFile,
    audit,
  }
}

const DRAFT_ORDER = { id: 'O1', docNo: 'SO-20260710-0085', status: 'DRAFT' }

function input(overrides: Record<string, unknown> = {}) {
  return {
    orderId: null,
    fileName: 'PO-88712.pdf',
    contentType: 'application/pdf',
    content: PDF,
    ...overrides,
  } as Parameters<CustomerPoUploadService['upload']>[0]
}

describe('必传闸门：模具与正常订单必传，收费样品必传，免费样品与备料豁免', () => {
  it.each<[SalesOrderType, bigint, boolean]>([
    ['FORMAL', 0n, true],
    ['FORMAL', 10_000n, true],
    ['MOLD', 0n, true],
    // 样品看价格而不是 chargeMode：只要有价就是收费样品
    ['SAMPLE', 10_000n, true],
    ['SAMPLE', 0n, false],
    ['STOCK_PREP', 10_000n, false],
  ])('%s 总价 %s → 必传 = %s', (orderType, total, expected) => {
    expect(needsCustomerPo(orderType, total)).toBe(expected)
  })
})

describe('缺客户订单原件时建单被拒', () => {
  function facts(overrides: Partial<OrderFacts> = {}): OrderFacts {
    return {
      orderType: 'FORMAL',
      chargeMode: 'CHARGED',
      customerPoNo: 'MT-PO-2607119',
      customerPoFile: null,
      lines: [
        {
          sequence: 1,
          productName: '导轨压板',
          drawingNo: 'MT-7719',
          quotationId: 'Q1',
          quotationItemId: 'QI1',
          costAnalysisId: 'CA1',
          quantity: '100',
          unitPriceMinor: 1_000n,
          bomReady: true,
          deliveryDate: new Date('2026-09-01'),
        },
      ],
      ...overrides,
    } as OrderFacts
  }

  it('正常订单没传原件 → 报 customerPoFile', () => {
    const fields = collectPrerequisiteIssues(facts()).map((issue) => issue.field)
    expect(fields).toContain('customerPoFile')
  })

  it('模具订单没传原件 → 同样报', () => {
    const fields = collectPrerequisiteIssues(facts({ orderType: 'MOLD' })).map((i) => i.field)
    expect(fields).toContain('customerPoFile')
  })

  it('免费样品豁免——单价为零就没有客户订单原件可谈', () => {
    const free = facts({
      orderType: 'SAMPLE',
      lines: [{ ...facts().lines[0]!, unitPriceMinor: 0n }],
    })
    expect(collectPrerequisiteIssues(free).map((i) => i.field)).not.toContain('customerPoFile')
  })

  it('收费样品不豁免', () => {
    const paid = facts({ orderType: 'SAMPLE' })
    expect(collectPrerequisiteIssues(paid).map((i) => i.field)).toContain('customerPoFile')
  })

  it('备料订单豁免', () => {
    const stock = facts({ orderType: 'STOCK_PREP' })
    expect(collectPrerequisiteIssues(stock).map((i) => i.field)).not.toContain('customerPoFile')
  })

  it('传了对象键之后这一条不再报——上传闭环成立', () => {
    const uploaded = facts({ customerPoFile: 'orders/customer-po/SO-1/PO-88712.pdf' })
    expect(collectPrerequisiteIssues(uploaded).map((i) => i.field)).not.toContain('customerPoFile')
  })
})

describe('对象键', () => {
  it('挂到订单上时键里带单据号', () => {
    expect(composeCustomerPoObjectKey('SO-20260710-0085', 'PO-88712.pdf')).toBe(
      'orders/customer-po/SO-20260710-0085/PO-88712.pdf',
    )
  })

  it('暂存时保留 staging 层级', () => {
    const key = composeCustomerPoObjectKey('staging/abc-123', 'PO.pdf')
    expect(key).toBe('orders/customer-po/staging/abc-123/PO.pdf')
  })

  it('文件名里的空格与括号被清洗，扩展名保留', () => {
    expect(composeCustomerPoObjectKey('SO-1', '客户 订单 (扫描).pdf')).toBe(
      'orders/customer-po/SO-1/客户-订单-扫描-.pdf',
    )
  })
})

describe('上传', () => {
  it('不带 orderId 时暂存，不碰订单', async () => {
    const harness = build()
    const result = await harness.service.upload(input(), SALES)

    expect(result.boundOrderId).toBeNull()
    expect(result.objectKey).toContain('orders/customer-po/staging/')
    expect(harness.setCustomerPoFile).not.toHaveBeenCalled()
  })

  it('两次暂存同名文件得到不同的键——已上传对象不可覆盖', async () => {
    const first = await build().service.upload(input(), SALES)
    const second = await build().service.upload(input(), SALES)

    expect(first.objectKey).not.toBe(second.objectKey)
  })

  it('带 orderId 时当场写进订单列，预览随即可用', async () => {
    const harness = build(DRAFT_ORDER)
    const result = await harness.service.upload(input({ orderId: 'O1' }), SALES)

    expect(result.boundOrderId).toBe('O1')
    expect(harness.setCustomerPoFile).toHaveBeenCalledWith(
      'O1',
      'orders/customer-po/SO-20260710-0085/PO-88712.pdf',
      'WFX-2018-0042',
    )
  })

  it('订单不存在 → 404', async () => {
    await expect(build(null).service.upload(input({ orderId: 'GONE' }), SALES)).rejects.toMatchObject(
      { code: 'ORD_2000' },
    )
  })

  it('已送审的订单不许换原件——那份文件已是审核依据', async () => {
    const harness = build({ ...DRAFT_ORDER, status: 'MANAGER_REVIEW' })

    await expect(
      harness.service.upload(input({ orderId: 'O1' }), SALES),
    ).rejects.toMatchObject({ code: 'SYS_9045', status: 409 })
    expect(harness.putImmutable).not.toHaveBeenCalled()
  })

  it('非业务岗位不能传', async () => {
    await expect(build().service.upload(input(), OUTSIDER)).rejects.toMatchObject({
      code: 'ORD_2012',
    })
  })

  it('类型与大小校验共用平台那一套', async () => {
    const harness = build()
    await expect(
      harness.service.upload(input({ fileName: 'payload.exe' }), SALES),
    ).rejects.toMatchObject({ code: 'SYS_9041' })
    await expect(
      harness.service.upload(input({ content: Buffer.alloc(2048, 0x25) }), SALES),
    ).rejects.toMatchObject({ code: 'SYS_9042' })
  })

  it('留痕区分暂存与已挂单', async () => {
    const staged = build()
    await staged.service.upload(input(), SALES)
    expect(staged.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'order.customer-po.upload',
        after: expect.objectContaining({ staged: true }),
      }),
    )

    const bound = build(DRAFT_ORDER)
    await bound.service.upload(input({ orderId: 'O1' }), SALES)
    expect(bound.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'SO-20260710-0085',
        after: expect.objectContaining({ staged: false }),
      }),
    )
  })
})
