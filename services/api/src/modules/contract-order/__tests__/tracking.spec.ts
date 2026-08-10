import { STANDARD_TRACKING_ROUTE } from '../constants/tracking-route'
import {
  aggregateLineProgress,
  clampDone,
  summarizeOrderProgress,
  toNodeProgress,
} from '../services/tracking-progress'
import { trimTrackingRoute } from '../services/tracking-route'

import type { TrackingNodeFacts } from '../services/tracking-progress'

const names = (codes: string[]): string[] => trimTrackingRoute(codes).map((node) => node.node)

describe('标准链与业务规格 4.7 一致', () => {
  it('全工艺都有时是完整的 23 个节点', () => {
    const full = trimTrackingRoute([
      '12', '11', '10', '14', '25', '17', '19', '16',
    ])

    expect(full).toHaveLength(23)
    expect(full[0]?.node).toBe('订单评审')
    expect(full.at(-1)?.node).toBe('入库')
  })

  it('追踪起点是订单评审，不是下单', () => {
    expect(STANDARD_TRACKING_ROUTE[0]?.key).toBe('order-review')
  })

  it('序号连续，裁剪后重新编号', () => {
    const trimmed = trimTrackingRoute(['10'])
    expect(trimmed.map((node) => node.sequence)).toEqual(
      Array.from({ length: trimmed.length }, (_, index) => index + 1),
    )
  })
})

describe('按工艺路线自动裁剪', () => {
  it('没有车床工艺时车床与它的品质检一起被裁掉', () => {
    const trimmed = names(['10', '16'])

    expect(trimmed).not.toContain('车床')
    // CNC 保留，所以仍有一个品质检
    expect(trimmed).toContain('CNC')
  })

  it('没有委外表处时，交接、表处、回料、表处后品质检四个节点整体消失', () => {
    const trimmed = trimTrackingRoute(['10', '16']).map((node) => node.key)

    expect(trimmed).not.toContain('handover-out')
    expect(trimmed).not.toContain('surface-treatment')
    expect(trimmed).not.toContain('handover-in')
    expect(trimmed).not.toContain('surface-qc')
  })

  it('有阳极氧化时表处四件套整体出现', () => {
    const trimmed = trimTrackingRoute(['10', '25']).map((node) => node.key)

    expect(trimmed).toContain('handover-out')
    expect(trimmed).toContain('surface-treatment')
    expect(trimmed).toContain('handover-in')
    expect(trimmed).toContain('surface-qc')
  })

  it('任一委外表处工艺都能命中同一组节点', () => {
    for (const code of ['21', '47', '72']) {
      expect(trimTrackingRoute([code]).map((node) => node.key)).toContain('surface-treatment')
    }
  })

  it('打磨节点被去毛刺/振磨/抛光/研磨任一命中', () => {
    for (const code of ['14', '15', '52', '63']) {
      expect(names([code])).toContain('打磨')
    }
  })

  it('镭雕或丝印任一存在都保留镭雕丝印节点', () => {
    expect(names(['17'])).toContain('镭雕丝印')
    expect(names(['19'])).toContain('镭雕丝印')
  })

  it('工艺路线为空时只剩固定节点', () => {
    const trimmed = names([])

    expect(trimmed).toEqual([
      '订单评审',
      'PMC跑生产计划',
      '采购计划',
      '到料',
      '原材料品质检(IQC)',
      '出货报告',
      '入库',
    ])
  })

  it('调机跟随 CNC 或车床，两者都没有时首件检测也不出现', () => {
    expect(names(['16'])).not.toContain('调机')
    expect(names(['16'])).not.toContain('首件检测')
    expect(names(['11'])).toContain('首件检测')
  })

  it('不认识的工艺编号不会凭空造出节点', () => {
    expect(names(['999'])).toEqual(names([]))
  })

  it('命中的工艺编号会记在节点上，便于回溯是哪道工艺', () => {
    const cnc = trimTrackingRoute(['10']).find((node) => node.key === 'cnc')
    expect(cnc?.processCode).toBe('10')
  })

  it('固定节点不绑工艺编号', () => {
    const review = trimTrackingRoute(['10']).find((node) => node.key === 'order-review')
    expect(review?.processCode).toBeNull()
  })

  it('责任部门取自公司部门清单', () => {
    const trimmed = trimTrackingRoute(['10', '25'])
    expect(trimmed.find((node) => node.key === 'pmc-plan')?.department).toBe('企划课')
    expect(trimmed.find((node) => node.key === 'surface-treatment')?.department).toBe('外协课')
  })
})

function node(overrides: Partial<TrackingNodeFacts> = {}): TrackingNodeFacts {
  return {
    sequence: 1,
    node: 'CNC',
    phase: '机加工',
    department: '生产一部',
    status: 'ACTIVE',
    qtyIn: '100',
    qtyOk: '58',
    qtyNg: '0',
    startedAt: null,
    finishedAt: null,
    ...overrides,
  }
}

describe('进度一律「完成数/工单数」，绝不出现百分比', () => {
  it('进行中的节点给出 58 / 100', () => {
    const progress = toNodeProgress(node(), '100')

    expect(progress.done).toBe('58')
    expect(progress.total).toBe('100')
  })

  it('契约里根本没有百分比字段，前端想渲染成 58% 也无从取值', () => {
    const progress = toNodeProgress(node(), '100')

    expect(Object.keys(progress)).not.toContain('progress')
    expect(Object.keys(progress)).not.toContain('percent')
    expect(Object.keys(progress)).not.toContain('ratio')
  })

  it('未开始就是 0，不按状态猜一个「约 50%」', () => {
    const progress = toNodeProgress(node({ status: 'PENDING', qtyOk: '30' }), '100')
    expect(progress.done).toBe('0')
  })

  it('进行中但还没报合格数时是 0/100，这是真话', () => {
    const progress = toNodeProgress(node({ qtyOk: null }), '100')
    expect(progress.done).toBe('0')
    expect(progress.total).toBe('100')
  })

  it('已完成且没记合格数时按投入数兜底', () => {
    const progress = toNodeProgress(node({ status: 'DONE', qtyOk: null }), '100')
    expect(progress.done).toBe('100')
  })

  it('没有投入数时按订单数量当总数', () => {
    const progress = toNodeProgress(node({ qtyIn: null, qtyOk: '10' }), '250')
    expect(progress.total).toBe('250')
  })

  it('不良数原样透出供预警联动', () => {
    expect(toNodeProgress(node({ qtyNg: '3' }), '100').ngQty).toBe('3')
  })

  it('合格数超过投入数时截断，不让完成数大于总数', () => {
    expect(clampDone('120', '100')).toBe('100')
    expect(clampDone('80', '100')).toBe('80')
  })
})

describe('停留时长', () => {
  it('未开始的节点没有停留时长', () => {
    expect(toNodeProgress(node({ startedAt: null }), '100').dwellHours).toBeNull()
  })

  it('已完成的节点按开始到完成计', () => {
    const progress = toNodeProgress(
      node({
        startedAt: new Date('2026-08-08T00:00:00Z'),
        finishedAt: new Date('2026-08-08T06:30:00Z'),
      }),
      '100',
    )
    expect(progress.dwellHours).toBe(6.5)
  })

  it('时间倒挂时按 0 处理，不给出负的停留时长', () => {
    const progress = toNodeProgress(
      node({
        startedAt: new Date('2026-08-08T06:00:00Z'),
        finishedAt: new Date('2026-08-08T00:00:00Z'),
      }),
      '100',
    )
    expect(progress.dwellHours).toBe(0)
  })
})

describe('产品行与订单头的汇总', () => {
  const line = (done: number, total: number, blocked = false): TrackingNodeFacts[] =>
    Array.from({ length: total }, (_, index) => {
      const isBlocked = blocked && index === done
      const status = index < done ? 'DONE' : isBlocked ? 'BLOCKED' : index === done ? 'ACTIVE' : 'PENDING'
      return node({ sequence: index + 1, node: `N${index + 1}`, status })
    })

  it('已完成节点数与总节点数都是计数，不是比例', () => {
    const progress = aggregateLineProgress(line(3, 10), '100')

    expect(progress.doneNodes).toBe(3)
    expect(progress.totalNodes).toBe(10)
  })

  it('当前节点取第一个进行中或异常的节点', () => {
    expect(aggregateLineProgress(line(3, 10), '100').currentNode).toBe('N4')
  })

  it('全部完成时当前节点是最后一个', () => {
    expect(aggregateLineProgress(line(5, 5), '100').currentNode).toBe('N5')
  })

  it('乱序传入也按 sequence 排好', () => {
    const shuffled = [...line(2, 4)].reverse()
    expect(aggregateLineProgress(shuffled, '100').nodes.map((item) => item.sequence)).toEqual([
      1, 2, 3, 4,
    ])
  })

  it('异常节点被标出来供预警中心联动', () => {
    expect(aggregateLineProgress(line(2, 6, true), '100').hasBlocked).toBe(true)
  })

  it('空节点链不炸', () => {
    const progress = aggregateLineProgress([], '100')
    expect(progress).toMatchObject({ currentNode: null, doneNodes: 0, totalNodes: 0 })
  })

  it('一单多产品时订单头取最慢的一行，不报最快的那行', () => {
    const fast = aggregateLineProgress(line(8, 10), '100')
    const slow = aggregateLineProgress(line(2, 10), '100')

    expect(summarizeOrderProgress([fast, slow]).doneNodes).toBe(2)
  })

  it('任一行异常，订单头就标异常', () => {
    const ok = aggregateLineProgress(line(5, 10), '100')
    const bad = aggregateLineProgress(line(9, 10, true), '100')

    expect(summarizeOrderProgress([ok, bad]).hasBlocked).toBe(true)
  })

  it('没有产品行时汇总为空态', () => {
    expect(summarizeOrderProgress([])).toMatchObject({ totalNodes: 0, currentNode: null })
  })

  it('节点数为 0 的行参与比较也不会除零', () => {
    const empty = aggregateLineProgress([], '100')
    const normal = aggregateLineProgress(line(5, 10), '100')

    expect(summarizeOrderProgress([empty, normal]).totalNodes).toBe(0)
  })
})
