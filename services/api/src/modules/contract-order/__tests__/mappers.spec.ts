import { toSalesOrderDraft } from '../services/sales-order-input.mapper'
import { toSalesOrderView } from '../services/sales-order-view.mapper'
import { toAvailabilityView, toConsumptionView } from '../services/stock-prep-view.mapper'

import type { CreateSalesOrderDto } from '../dto/create-sales-order.dto'
import type { SalesOrderRecord } from '../repositories/sales-order.repository.port'
import type { StockConsumptionRecord } from '../repositories/stock-consumption.repository.port'

const DTO: CreateSalesOrderDto = {
  customerId: 'CU1',
  orderType: 'FORMAL',
  chargeMode: 'CHARGED',
  lines: [
    {
      sequence: 1,
      productName: '12K Live Front Panel',
      drawingNo: 'BCM-2607',
      quantity: '100',
      unitPriceMinor: '32000',
    },
  ],
}

describe('订单入参映射', () => {
  it('币种与税率有默认值', () => {
    const draft = toSalesOrderDraft(DTO)

    expect(draft.currency).toBe('CNY')
    expect(draft.taxRateBps).toBe(1300)
  })

  it('可选字段缺省一律落成 null，不是 undefined', () => {
    const draft = toSalesOrderDraft(DTO)

    expect(draft).toMatchObject({
      customerPoNo: null,
      customerPoFile: null,
      internalDueDate: null,
      costOwner: null,
      freeReason: null,
      estimatedCostMinor: null,
    })
    expect(draft.lines[0]).toMatchObject({
      quotationId: null,
      quotationItemId: null,
      costAnalysisId: null,
      drawingVersionId: null,
      revision: null,
      itemCode: null,
      bomRequestNo: null,
      deliveryDate: null,
      remark: null,
    })
  })

  it('金额转 bigint、日期转 Date', () => {
    const draft = toSalesOrderDraft({
      ...DTO,
      internalDueDate: '2026-10-01T00:00:00.000Z',
      estimatedCostMinor: '500000',
      currency: 'USD',
      taxRateBps: 0,
      customerPoNo: 'PO-1',
      customerPoFile: 'po.pdf',
      costOwner: '公司承担',
      freeReason: '打样',
      lines: [{ ...DTO.lines[0]!, deliveryDate: '2026-09-30T00:00:00.000Z' }],
    })

    expect(draft.estimatedCostMinor).toBe(500_000n)
    expect(draft.internalDueDate).toEqual(new Date('2026-10-01T00:00:00.000Z'))
    expect(draft.lines[0]?.deliveryDate).toEqual(new Date('2026-09-30T00:00:00.000Z'))
    expect(draft.taxRateBps).toBe(0)
    expect(draft.currency).toBe('USD')
  })

  it('超出 2^53 的分值走字符串不丢精度', () => {
    const huge = '9007199254740993'
    const draft = toSalesOrderDraft({
      ...DTO,
      lines: [{ ...DTO.lines[0]!, unitPriceMinor: huge }],
    })

    expect(draft.lines[0]?.unitPriceMinor.toString()).toBe(huge)
  })

  it('明细可选字段传了就原样带上', () => {
    const draft = toSalesOrderDraft({
      ...DTO,
      lines: [
        {
          ...DTO.lines[0]!,
          quotationId: 'Q1',
          quotationItemId: 'QI1',
          costAnalysisId: 'CA1',
          drawingVersionId: 'DV1',
          revision: 'REV A',
          itemCode: '1008010001',
          bomRequestNo: 'BOMR1',
          remark: '含丝印',
        },
      ],
    })

    expect(draft.lines[0]).toMatchObject({
      quotationId: 'Q1',
      itemCode: '1008010001',
      bomRequestNo: 'BOMR1',
      remark: '含丝印',
    })
  })
})

const RECORD: SalesOrderRecord = {
  id: 'SO1',
  docNo: 'SO202608090001',
  customerId: 'CU1',
  orderType: 'FORMAL',
  chargeMode: 'CHARGED',
  customerPoNo: 'PO-2026-0815',
  customerPoFile: 'po.pdf',
  currency: 'CNY',
  taxRateBps: 1300,
  internalDueDate: null,
  costOwner: null,
  freeReason: null,
  estimatedCostMinor: null,
  status: 'APPROVED',
  submittedAt: new Date('2026-08-09T01:00:00Z'),
  submittedBy: 'WFX-2018-0042',
  approvedAt: new Date('2026-08-09T05:00:00Z'),
  rejectReason: null,
  stockedQty: null,
  stockStatus: null,
  createdBy: 'WFX-2018-0042',
  versionLock: 4,
  lines: [
    {
      id: 'SOL1',
      sequence: 1,
      quotationId: 'Q1',
      quotationItemId: 'QI1',
      costAnalysisId: 'CA1',
      productName: '12K Live Front Panel',
      drawingNo: 'BCM-2607',
      drawingVersionId: 'DV1',
      revision: 'REV A',
      itemCode: '1008010001',
      bomRequestNo: 'BOMR1',
      quantity: '100',
      unitPriceMinor: 32_000n,
      deliveryDate: new Date('2026-09-30T00:00:00Z'),
      remark: null,
    },
    {
      id: 'SOL2',
      sequence: 2,
      quotationId: 'Q1',
      quotationItemId: 'QI2',
      costAnalysisId: 'CA1',
      productName: '底座',
      drawingNo: 'BCM-2608',
      drawingVersionId: 'DV2',
      revision: null,
      itemCode: '1008010002',
      bomRequestNo: 'BOMR1',
      quantity: '50',
      unitPriceMinor: 12_500n,
      deliveryDate: null,
      remark: '加急',
    },
  ],
}

describe('订单对外表示', () => {
  it('金额一律定点字符串 + 币种', () => {
    const view = toSalesOrderView(RECORD)

    expect(view.lines[0]?.unitPrice).toEqual({ amount: '320.00', currency: 'CNY' })
    // 100 × 320.00 = 32000.00
    expect(view.lines[0]?.amount).toEqual({ amount: '32000.00', currency: 'CNY' })
  })

  it('整单合计是各行金额之和', () => {
    // 100×320 + 50×125 = 32000 + 6250 = 38250
    expect(toSalesOrderView(RECORD).totalAmount).toEqual({
      amount: '38250.00',
      currency: 'CNY',
    })
  })

  it('税率按万分比转成小数展示', () => {
    expect(toSalesOrderView(RECORD).taxRate).toBeCloseTo(0.13, 10)
  })

  it('时间一律 ISO 字符串，无值为 null', () => {
    const view = toSalesOrderView(RECORD)

    expect(view.submittedAt).toBe('2026-08-09T01:00:00.000Z')
    expect(view.approvedAt).toBe('2026-08-09T05:00:00.000Z')
    expect(view.internalDueDate).toBeNull()
    expect(view.lines[1]?.deliveryDate).toBeNull()
  })

  it('预计成本为空时给 null 而不是 0 元', () => {
    expect(toSalesOrderView(RECORD).estimatedCost).toBeNull()
  })

  it('预计成本有值时转成 Money', () => {
    const view = toSalesOrderView({ ...RECORD, estimatedCostMinor: 500_000n })
    expect(view.estimatedCost).toEqual({ amount: '5000.00', currency: 'CNY' })
  })

  it('响应里不含任何香港 70% 字段', () => {
    const json = JSON.stringify(toSalesOrderView(RECORD))

    expect(json).not.toContain('hk')
    expect(json).not.toContain('factor')
    expect(json).not.toContain('originalUnitPrice')
  })

  it('备料订单透出入库数量与库存状态', () => {
    const view = toSalesOrderView({
      ...RECORD,
      orderType: 'STOCK_PREP',
      stockedQty: '20',
      stockStatus: 'STOCKED',
    })

    expect(view.stockedQty).toBe('20')
    expect(view.stockStatus).toBe('STOCKED')
  })

  it('空明细时合计为 0，不会崩', () => {
    const view = toSalesOrderView({ ...RECORD, lines: [] })

    expect(view.totalAmount).toEqual({ amount: '0.00', currency: 'CNY' })
    expect(view.lines).toEqual([])
  })

  it('小数数量的行金额按 decimal 算，不用浮点', () => {
    const view = toSalesOrderView({
      ...RECORD,
      lines: [{ ...RECORD.lines[0]!, quantity: '0.3', unitPriceMinor: 10n }],
    })
    // 0.3 × 10 分 = 3 分
    expect(view.lines[0]?.amount).toEqual({ amount: '0.03', currency: 'CNY' })
  })
})

describe('备料视图', () => {
  it('可领用量与单件成本转成对外形状', () => {
    const view = toAvailabilityView({
      orderId: 'SO2',
      docNo: 'STK202608090001',
      drawingNo: 'BCM-2607',
      totalQty: '20',
      consumedQty: '5',
      availableQty: '15',
      unitCostMinor: 1_000n,
      currency: 'CNY',
      stockStatus: 'STOCKED',
    })

    expect(view.availableQty).toBe('15')
    expect(view.unitCost).toEqual({ amount: '10.00', currency: 'CNY' })
    expect(view.stockStatus).toBe('STOCKED')
  })

  it('领用履历的三个成本都转成 Money', () => {
    const record: StockConsumptionRecord = {
      id: 'SC1',
      stockOrderId: 'SO2',
      orderLineId: 'SOL1',
      consumedQty: '20',
      stockUnitCostMinor: 1_000n,
      produceQty: '80',
      produceUnitCostMinor: 1_200n,
      blendedUnitCostMinor: 1_160n,
      currency: 'CNY',
      createdAt: new Date('2026-08-09T00:00:00Z'),
    }

    const view = toConsumptionView(record)

    expect(view.stockUnitCost).toEqual({ amount: '10.00', currency: 'CNY' })
    expect(view.produceUnitCost).toEqual({ amount: '12.00', currency: 'CNY' })
    expect(view.blendedUnitCost).toEqual({ amount: '11.60', currency: 'CNY' })
    expect(view.createdAt).toBe('2026-08-09T00:00:00.000Z')
  })
})
