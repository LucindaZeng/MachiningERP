import { CUSTOMS_ERRORS } from '@machining-erp/shared'

import { SalesOrderService } from '../../contract-order'
import { UserDirectoryService } from '../../identity'
import { CustomerService } from '../../masterdata'
import { ShipmentService } from '../../shipment'
import { CustomsContextService } from '../services/customs-context.service'
import {
  assertDeclaredAlready,
  assertPackReadyForDeclaration,
  assertReviewed,
  collectCorrectionLines,
} from '../services/customs-declaration.service'
import { assertPackComplete, assertShipmentReady } from '../services/customs-document.service'

import { buildHarness, createDossier } from './harness'

import type { CustomsDossierRecord } from '../repositories/customs.repository.port'
import type { ShipmentStatus } from '@prisma/client'

function buildContext(status: ShipmentStatus = 'SHIPPED'): CustomsContextService {
  const shipments = {
    load: jest.fn(async () => ({
      id: 'SH1',
      docNo: 'SHP-20260727-0064',
      orderId: 'O1',
      customerId: 'C1',
      currency: 'USD',
      status,
      lines: [
        {
          productName: '铝合金探头支架',
          drawingNo: 'MT-9001',
          shippedQty: '1000.000000',
        },
        { productName: '压板', drawingNo: 'MT-9002', shippedQty: '486.000000' },
      ],
    })),
  } as unknown as ShipmentService
  const orders = {
    load: jest.fn(async () => ({ id: 'O1', docNo: 'SO-20260710-0085' })),
  } as unknown as SalesOrderService
  const customers = {
    profileFor: jest.fn(async () => ({ name: 'Radex Instruments Inc.' })),
  } as unknown as CustomerService
  const users = {
    findByUserCode: jest.fn(async (code: string) =>
      code === 'WFX-2018-0042' ? { displayName: '陈志强' } : null,
    ),
  } as unknown as UserDirectoryService

  return new CustomsContextService(shipments, orders, customers, users)
}

describe('跨模块取数只走对方的公开出口', () => {
  it('出货上下文带出订单、客户、币种与合计数量', async () => {
    const context = await buildContext().shipmentContext('SH1')
    expect(context).toMatchObject({ orderId: 'O1', customerId: 'C1', currency: 'USD' })
    expect(context.quantity).toBe('1486.000000')
    expect(context.productName).toBe('铝合金探头支架')
  })

  it('已离厂判为已过账——与对账单计发货列用的是同一个判据', async () => {
    expect((await buildContext('SHIPPED').shipmentContext('SH1')).posted).toBe(true)
    expect((await buildContext('SIGNED').shipmentContext('SH1')).posted).toBe(true)
    expect((await buildContext('PACKED').shipmentContext('SH1')).posted).toBe(false)
    expect((await buildContext('PLANNED').shipmentContext('SH1')).posted).toBe(false)
  })

  it('查不到姓名时退回工号——宁可显示工号，也不要显示空白', async () => {
    const context = buildContext()
    expect(await context.displayName('WFX-2018-0042')).toBe('陈志强')
    expect(await context.displayName('WFX-9999-9999')).toBe('WFX-9999-9999')
  })

  it('namingFor 一次取齐四个名字', async () => {
    const naming = await buildContext().namingFor('SH1', 'O1', 'C1', 'WFX-2018-0042')
    expect(naming).toEqual({
      shipmentNo: 'SHP-20260727-0064',
      orderNo: 'SO-20260710-0085',
      customerName: 'Radex Instruments Inc.',
      ownerName: '陈志强',
    })
  })
})

describe('闸门的导出纯函数', () => {
  let record: CustomsDossierRecord

  beforeEach(async () => {
    record = await createDossier(buildHarness())
  })

  it('复核过就放行，没复核过就抛', () => {
    expect(() => assertReviewed({ ...record, checkedBy: 'WFX-2016-0007' })).not.toThrow()
    expect(() => assertReviewed(record)).toThrow(
      expect.objectContaining({ code: CUSTOMS_ERRORS.REVIEW_REQUIRED.code }),
    )
  })

  it('数据包必需件齐了才放行，缺项时把缺的中文名列出来', () => {
    expect(() => assertPackComplete(record)).toThrow(
      expect.objectContaining({ code: CUSTOMS_ERRORS.DATA_PACK_INCOMPLETE.code }),
    )
    expect(() => assertPackReadyForDeclaration(record)).toThrow(
      expect.objectContaining({ code: CUSTOMS_ERRORS.DATA_PACK_INCOMPLETE.code }),
    )

    const full = withDocuments(record, ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'CONTRACT'])
    expect(() => assertPackComplete(full)).not.toThrow()
    expect(() => assertPackReadyForDeclaration(full)).not.toThrow()
  })

  it('发货前置只卡按实发数开的那三种', () => {
    expect(() => assertShipmentReady(record, 'PROFORMA_INVOICE', false)).not.toThrow()
    expect(() => assertShipmentReady(record, 'CONTRACT', false)).not.toThrow()
    expect(() => assertShipmentReady(record, 'COMMERCIAL_INVOICE', true)).not.toThrow()
    expect(() => assertShipmentReady(record, 'COMMERCIAL_INVOICE', false)).toThrow(
      expect.objectContaining({ code: CUSTOMS_ERRORS.SHIPMENT_NOT_POSTED.code }),
    )
  })

  it('已申报的判据要求状态与版本号同时成立', () => {
    expect(() => assertDeclaredAlready(record)).toThrow(
      expect.objectContaining({ code: CUSTOMS_ERRORS.CORRECTION_REQUIRES_DECLARATION.code }),
    )
    // 状态到了但版本号还是 0（不该出现的中间态）同样不算已申报
    expect(() =>
      assertDeclaredAlready({ ...record, status: 'DECLARED', declarationVersion: 0 }),
    ).toThrow(expect.objectContaining({ code: CUSTOMS_ERRORS.CORRECTION_REQUIRES_DECLARATION.code }))
    expect(() =>
      assertDeclaredAlready({ ...record, status: 'RELEASED', declarationVersion: 1 }),
    ).not.toThrow()
  })

  it('找不到上一版快照时按空快照比——已生成的都算新增，而不是静默返回空', () => {
    const declared: CustomsDossierRecord = {
      ...withDocuments(record, ['CONTRACT']),
      status: 'DECLARED',
      declarationVersion: 7, // 故意指向一版不存在的快照
    }
    expect(collectCorrectionLines(declared)).toEqual([
      { kind: 'CONTRACT', fromVersion: 0, toVersion: 1 },
    ])
  })

  function withDocuments(
    base: CustomsDossierRecord,
    kinds: ReadonlyArray<'COMMERCIAL_INVOICE' | 'PACKING_LIST' | 'CONTRACT'>,
  ): CustomsDossierRecord {
    return {
      ...base,
      documents: kinds.map((kind, index) => ({
        id: `D${index}`,
        kind,
        version: 1,
        objectKey: null,
        fileName: null,
        exchangeRate: '7.152000',
        currency: 'USD',
        generatedAt: new Date('2026-07-27T10:00:00Z'),
        generatedBy: 'WFX-2018-0042',
      })),
    }
  }
})
