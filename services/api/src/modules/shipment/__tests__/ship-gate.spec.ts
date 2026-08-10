import {
  collectCreditIssues,
  collectQcIssues,
  collectShipGateIssues,
  needsPrepayment,
  paymentTermLabel,
} from '../services/ship-gate.rules'
import { ShipGateService } from '../services/ship-gate.service'

import { FakeQcReleasePort, FakeReceiptPort } from './fakes'

import type { ShipmentRecord } from '../repositories/shipment.repository.port'
import type { CreditFacts, QcLineFacts } from '../services/ship-gate.rules'
import type { PaymentTerm } from '@prisma/client'

const RELEASED: QcLineFacts = {
  drawingNo: 'MT-7719',
  batchNo: 'B26071502',
  released: true,
  reason: null,
}
const BLOCKED: QcLineFacts = {
  drawingNo: 'RX-3390',
  batchNo: 'B26071503',
  released: false,
  reason: '平面度超差待处置',
}

function credit(overrides: Partial<CreditFacts> = {}): CreditFacts {
  return {
    paymentTerm: 'NET_60',
    payableMinor: 10_000n,
    receivedMinor: 0n,
    currency: 'CNY',
    ...overrides,
  }
}

describe('付款条件决定要不要看回款', () => {
  it.each<[PaymentTerm, boolean]>([
    ['DEPOSIT_THEN_BALANCE', true],
    ['CASH_BEFORE_SHIPMENT', true],
    ['NET_30', false],
    ['NET_60', false],
    ['NET_90', false],
  ])('%s → 需要款到才发货 = %s', (term, expected) => {
    expect(needsPrepayment(term)).toBe(expected)
  })

  it('五种付款条件都有可读文案，不会漏出枚举值', () => {
    const terms: PaymentTerm[] = [
      'DEPOSIT_THEN_BALANCE',
      'CASH_BEFORE_SHIPMENT',
      'NET_30',
      'NET_60',
      'NET_90',
    ]
    for (const term of terms) {
      expect(paymentTermLabel(term)).not.toMatch(/^[A-Z_]+$/)
    }
  })
})

describe('品质闸门逐行判定', () => {
  it('全部放行时没有问题项', () => {
    expect(collectQcIssues([RELEASED, RELEASED])).toEqual([])
  })

  it('未放行的行全部列出来，不只报第一条', () => {
    const issues = collectQcIssues([BLOCKED, RELEASED, { ...BLOCKED, batchNo: 'B26071504' }])

    expect(issues).toHaveLength(2)
    expect(issues[0]?.gate).toBe('QC_RELEASE')
    expect(issues[0]?.message).toContain('平面度超差待处置')
  })

  it('没写原因时也拦，只是文案里不带原因', () => {
    const issues = collectQcIssues([{ ...BLOCKED, reason: null }])

    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('未取得品质放行')
    expect(issues[0]?.message).not.toContain('：')
  })

  it('空明细没有品质问题项——空单该被建单校验拦，不该在这里报', () => {
    expect(collectQcIssues([])).toEqual([])
  })
})

describe('信用闸门只对预付/现金客户生效', () => {
  it('月结客户欠款也照发', () => {
    expect(collectCreditIssues(credit({ paymentTerm: 'NET_90', receivedMinor: 0n }))).toEqual([])
  })

  it('现金客户未收款被拦，文案里带出差额', () => {
    const issues = collectCreditIssues(
      credit({ paymentTerm: 'CASH_BEFORE_SHIPMENT', receivedMinor: 3_000n }),
    )

    expect(issues).toHaveLength(1)
    expect(issues[0]?.gate).toBe('CREDIT')
    expect(issues[0]?.message).toContain('尚差 7000')
  })

  it('预付客户付清全额才放行——付款条件①的剩余款项也要出货前付清', () => {
    expect(
      collectCreditIssues(credit({ paymentTerm: 'DEPOSIT_THEN_BALANCE', receivedMinor: 10_000n })),
    ).toEqual([])
    expect(
      collectCreditIssues(credit({ paymentTerm: 'DEPOSIT_THEN_BALANCE', receivedMinor: 9_999n })),
    ).toHaveLength(1)
  })

  it('超付也放行', () => {
    expect(
      collectCreditIssues(credit({ paymentTerm: 'CASH_BEFORE_SHIPMENT', receivedMinor: 20_000n })),
    ).toEqual([])
  })
})

describe('两道闸门的四种组合', () => {
  const cash: Partial<CreditFacts> = { paymentTerm: 'CASH_BEFORE_SHIPMENT' }

  it('品质过 + 信用过 → 放行', () => {
    expect(
      collectShipGateIssues([RELEASED], credit({ ...cash, receivedMinor: 10_000n })),
    ).toEqual([])
  })

  it('品质挂 + 信用过 → 只报品质', () => {
    const issues = collectShipGateIssues([BLOCKED], credit({ ...cash, receivedMinor: 10_000n }))
    expect(issues.map((issue) => issue.gate)).toEqual(['QC_RELEASE'])
  })

  it('品质过 + 信用挂 → 只报信用', () => {
    const issues = collectShipGateIssues([RELEASED], credit({ ...cash, receivedMinor: 0n }))
    expect(issues.map((issue) => issue.gate)).toEqual(['CREDIT'])
  })

  it('两道都挂 → 一次列全，不让业务员补完一样再被拦一次', () => {
    const issues = collectShipGateIssues([BLOCKED], credit({ ...cash, receivedMinor: 0n }))
    expect(issues.map((issue) => issue.gate)).toEqual(['QC_RELEASE', 'CREDIT'])
  })
})

describe('ShipGateService 把两个读端口的事实取齐后交给纯规则', () => {
  function shipment(): ShipmentRecord {
    return {
      id: 'S1',
      docNo: 'SHP-20260727-0064',
      orderId: 'O1',
      customerId: 'C1',
      deliveryAddressId: null,
      replacesReturnId: null,
      currency: 'CNY',
      carrier: null,
      trackingNo: null,
      invoiceNo: null,
      status: 'PACKED',
      ownerUserCode: 'WFX-2018-0042',
      packedAt: new Date('2026-07-27T07:20:00Z'),
      shippedAt: null,
      signedAt: null,
      invoicedAt: null,
      closedAt: null,
      versionLock: 0,
      lines: [
        {
          id: 'L1',
          sequence: 1,
          orderLineId: 'OL1',
          productName: '探头支架',
          drawingNo: 'RX-3390',
          itemCode: null,
          batchNo: 'B26071502',
          orderedQty: '100.000000',
          qualifiedQty: '100.000000',
          packedQty: '100.000000',
          shippedQty: '100.000000',
          unitPriceMinor: 2_490n,
          tailPlan: null,
          tailResolvedQty: '0.000000',
          tailApprovedBy: null,
          tailApprovedAt: null,
          tailRemark: null,
        },
      ],
    }
  }

  function build(): { service: ShipGateService; qc: FakeQcReleasePort; receipts: FakeReceiptPort } {
    const qc = new FakeQcReleasePort()
    const receipts = new FakeReceiptPort()
    return { service: new ShipGateService(qc, receipts), qc, receipts }
  }

  it('应收 = 各行「本次发货数 × 单价」之和', () => {
    expect(ShipGateService.payableOf(shipment())).toBe(249_000n)
  })

  it('月结客户即便一分没收也放行', async () => {
    const { service } = build()
    await expect(service.assertShippable(shipment(), 'NET_60')).resolves.toBeUndefined()
  })

  it('现金客户未收款抛 ORD_2506，details 里带失败项', async () => {
    const { service } = build()

    await expect(
      service.assertShippable(shipment(), 'CASH_BEFORE_SHIPMENT'),
    ).rejects.toMatchObject({ code: 'ORD_2506' })
  })

  it('品质未放行时同样抛 ORD_2506，且两项一起出现在 issues 里', async () => {
    const { service, qc } = build()
    qc.block('RX-3390', 'B26071502', '首件未判定')

    const issues = await service.evaluate(shipment(), 'CASH_BEFORE_SHIPMENT')
    expect(issues.map((issue) => issue.gate)).toEqual(['QC_RELEASE', 'CREDIT'])
  })

  it('款项到位且品质放行时通过', async () => {
    const { service, receipts } = build()
    receipts.receivedMinor = 249_000n

    await expect(
      service.assertShippable(shipment(), 'CASH_BEFORE_SHIPMENT'),
    ).resolves.toBeUndefined()
  })
})
