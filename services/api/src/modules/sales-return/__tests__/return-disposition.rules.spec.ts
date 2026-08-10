import {
  collectClosureIssues,
  isMixedDisposition,
  isMixedResponsibility,
  needsFinanceApproval,
  reworkLines,
  rollupDisposition,
  rollupResponsibility,
  type ReturnLineFacts,
} from '../services/return-disposition.rules'

function line(overrides: Partial<ReturnLineFacts> = {}): ReturnLineFacts {
  return {
    sequence: 1,
    productName: '导轨压板',
    responsibility: 'COMPANY',
    disposition: 'REWORK',
    dispositionNote: null,
    amountMinor: 477_600n,
    allowanceMinor: null,
    receivedAt: new Date('2026-07-27T10:30:00Z'),
    ...overrides,
  }
}

describe('结案闸门逐行校验', () => {
  it('全部齐备时没有任何问题', () => {
    expect(collectClosureIssues([line()])).toEqual([])
  })

  it('责任未判定要报出来', () => {
    const issues = collectClosureIssues([line({ responsibility: 'UNDECIDED' })])
    expect(issues.map((issue) => issue.kind)).toEqual(['RESPONSIBILITY_UNDECIDED'])
  })

  it('处置未定时不再刷派生噪音——只报「处置未定」这一条', () => {
    const issues = collectClosureIssues([
      line({ responsibility: 'UNDECIDED', disposition: 'UNDECIDED' }),
    ])
    expect(issues.map((issue) => issue.kind)).toEqual([
      'RESPONSIBILITY_UNDECIDED',
      'DISPOSITION_UNDECIDED',
    ])
  })

  it.each([
    ['REFUND', true],
    ['CONCESSION', true],
    ['SCRAP', true],
    ['REWORK', false],
    ['REPLACEMENT', false],
  ] as const)('%s 是否强制理由 → %s', (disposition, mustExplain) => {
    const issues = collectClosureIssues([
      line({
        disposition,
        dispositionNote: null,
        // 让步另有折让额的要求，这里补上以免混进别的问题
        allowanceMinor: disposition === 'CONCESSION' ? 100n : null,
      }),
    ])
    expect(issues.some((issue) => issue.kind === 'REASON_MISSING')).toBe(mustExplain)
  })

  it('空白理由等同没写', () => {
    const issues = collectClosureIssues([line({ disposition: 'REFUND', dispositionNote: '   ' })])
    expect(issues.map((issue) => issue.kind)).toEqual(['REASON_MISSING'])
  })

  it('让步接收必须录折让额——系统推算不出谈定的减价', () => {
    const issues = collectClosureIssues([
      line({ disposition: 'CONCESSION', dispositionNote: '客户同意降价使用', allowanceMinor: null }),
    ])
    expect(issues.map((issue) => issue.kind)).toEqual(['ALLOWANCE_MISSING'])
  })

  it('折让额不得超过该行货值，否则会冲出一笔负应收', () => {
    const issues = collectClosureIssues([
      line({
        disposition: 'CONCESSION',
        dispositionNote: '客户同意降价使用',
        amountMinor: 1_000n,
        allowanceMinor: 1_001n,
      }),
    ])
    expect(issues.map((issue) => issue.kind)).toEqual(['ALLOWANCE_TOO_LARGE'])
  })

  it('折让额恰好等于货值是允许的（整行白送）', () => {
    const issues = collectClosureIssues([
      line({
        disposition: 'CONCESSION',
        dispositionNote: '整批让步',
        amountMinor: 1_000n,
        allowanceMinor: 1_000n,
      }),
    ])
    expect(issues).toEqual([])
  })

  it('返工没收到不良品就不能结案——修不了看不见的货', () => {
    const issues = collectClosureIssues([line({ disposition: 'REWORK', receivedAt: null })])
    expect(issues.map((issue) => issue.kind)).toEqual(['GOODS_NOT_RECEIVED'])
  })

  it('退款不要求实物入库（客户可能已就地报废）', () => {
    const issues = collectClosureIssues([
      line({ disposition: 'REFUND', dispositionNote: '全额退款', receivedAt: null }),
    ])
    expect(issues).toEqual([])
  })

  it('一次报全部问题，不逼着业务员一条一条试', () => {
    const issues = collectClosureIssues([
      line({ sequence: 1, responsibility: 'UNDECIDED', disposition: 'REFUND' }),
      line({ sequence: 2, disposition: 'REWORK', receivedAt: null }),
    ])
    expect(issues.map((issue) => `${issue.sequence}:${issue.kind}`)).toEqual([
      '1:RESPONSIBILITY_UNDECIDED',
      '1:REASON_MISSING',
      '2:GOODS_NOT_RECEIVED',
    ])
  })

  it('空单没有任何问题（数量校验在登记时另管）', () => {
    expect(collectClosureIssues([])).toEqual([])
  })
})

describe('单头派生值：一致取该值，不一致明说按行看', () => {
  it('全行一致时取该值', () => {
    const lines = [line({ sequence: 1 }), line({ sequence: 2 })]
    expect(rollupResponsibility(lines)).toBe('COMPANY')
    expect(rollupDisposition(lines)).toBe('REWORK')
    expect(isMixedResponsibility(lines)).toBe(false)
    expect(isMixedDisposition(lines)).toBe(false)
  })

  it('fixture RT1 那种一单两责任：回落到待判定并标记按行', () => {
    const lines = [
      line({ sequence: 1, responsibility: 'COMPANY', disposition: 'REWORK' }),
      line({ sequence: 2, responsibility: 'SUPPLIER', disposition: 'SCRAP' }),
    ]
    expect(rollupResponsibility(lines)).toBe('UNDECIDED')
    expect(rollupDisposition(lines)).toBe('UNDECIDED')
    expect(isMixedResponsibility(lines)).toBe(true)
    expect(isMixedDisposition(lines)).toBe(true)
  })

  it('两个轴各自独立：责任一致而处置不一致', () => {
    const lines = [
      line({ sequence: 1, disposition: 'REWORK' }),
      line({ sequence: 2, disposition: 'REFUND' }),
    ]
    expect(isMixedResponsibility(lines)).toBe(false)
    expect(isMixedDisposition(lines)).toBe(true)
    expect(rollupResponsibility(lines)).toBe('COMPANY')
  })

  it('空单不算 mixed，派生值回落到待判定', () => {
    expect(rollupResponsibility([])).toBe('UNDECIDED')
    expect(rollupDisposition([])).toBe('UNDECIDED')
    expect(isMixedResponsibility([])).toBe(false)
    expect(isMixedDisposition([])).toBe(false)
  })
})

describe('财务升级与返工筛选', () => {
  it.each([
    ['REFUND', true],
    ['REPLACEMENT', true],
    ['CONCESSION', true],
    ['SCRAP', false],
    ['REWORK', false],
    ['UNDECIDED', false],
  ] as const)('单行 %s → 需要财务审批 %s', (disposition, expected) => {
    expect(needsFinanceApproval([line({ disposition })])).toBe(expected)
  })

  it('只要有一行动钱，整张单就升级', () => {
    expect(
      needsFinanceApproval([
        line({ sequence: 1, disposition: 'REWORK' }),
        line({ sequence: 2, disposition: 'REFUND' }),
      ]),
    ).toBe(true)
  })

  it('只把返工的行送去 rework 模块，别让生产自己再过滤一遍', () => {
    const picked = reworkLines([
      line({ sequence: 1, disposition: 'REWORK' }),
      line({ sequence: 2, disposition: 'REFUND' }),
      line({ sequence: 3, disposition: 'REWORK' }),
    ])
    expect(picked.map((item) => item.sequence)).toEqual([1, 3])
  })
})
