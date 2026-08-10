import { collectPrerequisiteIssues } from '../services/order-prerequisites'

import type { OrderFacts, OrderLineFacts } from '../services/order-prerequisites'

const READY_LINE: OrderLineFacts = {
  sequence: 1,
  productName: '12K Live Front Panel',
  quotationItemId: 'QI1',
  costAnalysisId: 'CA1',
  drawingVersionId: 'DV1',
  bomConfirmed: true,
  itemCode: '1008010001',
  quantity: '100',
  unitPriceMinor: 32_000n,
  deliveryDate: new Date('2026-09-30T00:00:00Z'),
}

function facts(overrides: Partial<OrderFacts> = {}): OrderFacts {
  return {
    orderType: 'FORMAL',
    chargeMode: 'CHARGED',
    customerPoNo: 'PO-2026-0815',
    customerPoFile: 'po-2026-0815.pdf',
    internalDueDate: null,
    costOwner: null,
    freeReason: null,
    estimatedCostMinor: null,
    customerReadyForOrder: true,
    lines: [READY_LINE],
    ...overrides,
  }
}

const fields = (issues: ReturnType<typeof collectPrerequisiteIssues>): string[] =>
  issues.map((issue) => issue.field)

describe('齐备的正式订单可以下单', () => {
  it('全部前置条件满足时没有任何缺失项', () => {
    expect(collectPrerequisiteIssues(facts())).toEqual([])
  })
})

describe('环环相扣：没有生效报价与成本分析不能下单', () => {
  it('缺报价被点名', () => {
    const issues = collectPrerequisiteIssues(
      facts({ lines: [{ ...READY_LINE, quotationItemId: null }] }),
    )
    expect(fields(issues)).toContain('quotationItemId')
    expect(issues[0]?.message).toContain('缺少生效报价单')
  })

  it('缺成本分析被点名', () => {
    const issues = collectPrerequisiteIssues(
      facts({ lines: [{ ...READY_LINE, costAnalysisId: null }] }),
    )
    expect(fields(issues)).toContain('costAnalysisId')
  })

  it('缺失项一次性全部列出，而不是报第一条就停', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        lines: [
          {
            ...READY_LINE,
            quotationItemId: null,
            costAnalysisId: null,
            drawingVersionId: null,
            bomConfirmed: false,
            itemCode: null,
          },
        ],
      }),
    )

    expect(fields(issues)).toEqual([
      'quotationItemId',
      'costAnalysisId',
      'drawingVersionId',
      'bomRequestNo',
      'itemCode',
    ])
  })

  it('多行产品各自点名，提示里带行号与产品名', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        lines: [
          READY_LINE,
          { ...READY_LINE, sequence: 2, productName: '底座', costAnalysisId: null },
        ],
      }),
    )

    expect(issues).toHaveLength(1)
    expect(issues[0]?.sequence).toBe(2)
    expect(issues[0]?.message).toContain('第 2 行「底座」')
  })
})

describe('工程资料：样品单除外', () => {
  it('样品单不查图纸与 BOM', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        orderType: 'SAMPLE',
        chargeMode: 'FREE',
        costOwner: '公司承担',
        freeReason: '首次合作打样',
        estimatedCostMinor: 50_000n,
        customerPoNo: null,
        customerPoFile: null,
        lines: [
          { ...READY_LINE, drawingVersionId: null, bomConfirmed: false, itemCode: null, unitPriceMinor: 0n },
        ],
      }),
    )

    expect(issues).toEqual([])
  })

  it('样品单也不要求成品品号', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        orderType: 'SAMPLE',
        lines: [{ ...READY_LINE, itemCode: null }],
      }),
    )
    expect(fields(issues)).not.toContain('itemCode')
  })

  it('模具单不查 BOM 但要品号（模具编号）', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        orderType: 'MOLD',
        lines: [{ ...READY_LINE, bomConfirmed: false, itemCode: null }],
      }),
    )

    expect(fields(issues)).toContain('itemCode')
    expect(fields(issues)).not.toContain('bomRequestNo')
  })

  it('备料单要 BOM 与品号', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        orderType: 'STOCK_PREP',
        chargeMode: 'INTERNAL',
        costOwner: '公司承担',
        freeReason: '常备库存',
        estimatedCostMinor: 100_000n,
        internalDueDate: new Date('2026-10-01T00:00:00Z'),
        lines: [{ ...READY_LINE, bomConfirmed: false, deliveryDate: null }],
      }),
    )
    expect(fields(issues)).toContain('bomRequestNo')
  })
})

describe('客户订单原件', () => {
  it('正式订单缺 PO 号与附件都要报', () => {
    const issues = collectPrerequisiteIssues(facts({ customerPoNo: null, customerPoFile: null }))
    expect(fields(issues)).toEqual(['customerPoNo', 'customerPoFile'])
  })

  it('只填了空白字符不算填了', () => {
    const issues = collectPrerequisiteIssues(facts({ customerPoNo: '   ', customerPoFile: '  ' }))
    expect(fields(issues)).toEqual(['customerPoNo', 'customerPoFile'])
  })

  it('模具订单同样无条件要求', () => {
    const issues = collectPrerequisiteIssues(
      facts({ orderType: 'MOLD', customerPoNo: null, customerPoFile: null }),
    )
    expect(fields(issues)).toContain('customerPoNo')
  })

  it('收费样品要传，因为有价格', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        orderType: 'SAMPLE',
        customerPoNo: null,
        customerPoFile: null,
        lines: [{ ...READY_LINE, unitPriceMinor: 20_000n }],
      }),
    )
    expect(fields(issues)).toContain('customerPoNo')
  })

  it('免费样品不要求', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        orderType: 'SAMPLE',
        chargeMode: 'FREE',
        costOwner: '公司承担',
        freeReason: '打样',
        estimatedCostMinor: 1n,
        customerPoNo: null,
        customerPoFile: null,
        lines: [{ ...READY_LINE, unitPriceMinor: 0n }],
      }),
    )
    expect(fields(issues)).not.toContain('customerPoNo')
  })

  it('备料订单不要求', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        orderType: 'STOCK_PREP',
        chargeMode: 'INTERNAL',
        costOwner: '公司承担',
        freeReason: '常备',
        estimatedCostMinor: 1n,
        internalDueDate: new Date('2026-10-01T00:00:00Z'),
        customerPoNo: null,
        customerPoFile: null,
        lines: [{ ...READY_LINE, deliveryDate: null }],
      }),
    )
    expect(fields(issues)).not.toContain('customerPoNo')
  })
})

describe('收费方式', () => {
  it('正式订单不允许免费', () => {
    const issues = collectPrerequisiteIssues(facts({ chargeMode: 'FREE' }))
    expect(issues[0]?.message).toContain('强制收费')
  })

  it('正式订单不允许部分收费', () => {
    expect(collectPrerequisiteIssues(facts({ chargeMode: 'PARTIAL' }))).not.toEqual([])
  })

  it('正式订单强制收费时不再追问免费三要素', () => {
    const issues = collectPrerequisiteIssues(facts({ chargeMode: 'FREE' }))
    expect(issues.filter((issue) => issue.field === 'chargeMode')).toHaveLength(1)
  })

  it('非正式订单免费时三要素缺哪个报哪个', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        orderType: 'MOLD',
        chargeMode: 'FREE',
        costOwner: null,
        estimatedCostMinor: null,
        freeReason: null,
      }),
    )
    expect(issues.find((issue) => issue.field === 'chargeMode')?.message).toContain(
      '费用承担方、预计成本、原因',
    )
  })

  it('预计成本为 0 也算填了（0 元成本是合法的）', () => {
    const issues = collectPrerequisiteIssues(
      facts({
        orderType: 'MOLD',
        chargeMode: 'FREE',
        costOwner: '公司承担',
        estimatedCostMinor: 0n,
        freeReason: '客户长期合作',
      }),
    )
    expect(fields(issues)).not.toContain('chargeMode')
  })

  it('正式订单价格为零被拦下', () => {
    const issues = collectPrerequisiteIssues(
      facts({ lines: [{ ...READY_LINE, unitPriceMinor: 0n }] }),
    )
    expect(fields(issues)).toContain('unitPriceMinor')
  })
})

describe('交期', () => {
  it('正式订单缺客户交期被拦下', () => {
    const issues = collectPrerequisiteIssues(
      facts({ lines: [{ ...READY_LINE, deliveryDate: null }] }),
    )
    expect(fields(issues)).toContain('deliveryDate')
  })

  it('备料订单不要客户交期，但内部要求完成时间必填', () => {
    const base = {
      orderType: 'STOCK_PREP' as const,
      chargeMode: 'INTERNAL' as const,
      costOwner: '公司承担',
      freeReason: '常备库存',
      estimatedCostMinor: 100_000n,
      customerPoNo: null,
      customerPoFile: null,
      lines: [{ ...READY_LINE, deliveryDate: null }],
    }

    expect(fields(collectPrerequisiteIssues(facts({ ...base, internalDueDate: null })))).toContain(
      'internalDueDate',
    )
    expect(
      fields(
        collectPrerequisiteIssues(
          facts({ ...base, internalDueDate: new Date('2026-10-01T00:00:00Z') }),
        ),
      ),
    ).not.toContain('deliveryDate')
  })
})

describe('整单级校验', () => {
  it('一行产品都没有要报错', () => {
    expect(fields(collectPrerequisiteIssues(facts({ lines: [] })))).toContain('lines')
  })

  it('客户档案没补全不能下单', () => {
    const issues = collectPrerequisiteIssues(facts({ customerReadyForOrder: false }))
    expect(issues[0]?.message).toContain('补全完整档案')
  })

  it('数量必须大于 0', () => {
    expect(
      fields(collectPrerequisiteIssues(facts({ lines: [{ ...READY_LINE, quantity: '0' }] }))),
    ).toContain('quantity')
  })
})
