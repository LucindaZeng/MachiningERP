import { PERMISSION_CODES } from '@machining-erp/shared'

import { toLineTrackingView } from '../services/order-tracking-view.mapper'
import { OrderTrackingService } from '../services/order-tracking.service'

import { FakeOrderTrackingRepository } from './fakes'

import type { SalesOrderLineRecord } from '../repositories/sales-order.repository.port'
import type { TrackingEvent } from '../services/order-tracking.service'

const LINE = 'SOL1'

function build(): { service: OrderTrackingService; repo: FakeOrderTrackingRepository } {
  const repo = new FakeOrderTrackingRepository()
  return { service: new OrderTrackingService(repo), repo }
}

function event(overrides: Partial<TrackingEvent> = {}): TrackingEvent {
  return {
    orderLineId: LINE,
    sequence: 1,
    status: 'ACTIVE',
    occurredAt: new Date('2026-08-09T08:00:00Z'),
    source: 'MES',
    ...overrides,
  }
}

describe('建链：按工艺路线自动裁剪', () => {
  it('CNC + 阳极氧化 + 包装的产品得到裁剪后的节点链', async () => {
    const { service } = build()
    const nodes = await service.buildRoute(LINE, ['10', '25', '16'])

    const names = nodes.map((node) => node.node)
    expect(names[0]).toBe('订单评审')
    expect(names).toContain('CNC')
    expect(names).toContain('委外表处')
    expect(names).not.toContain('车床')
    expect(names.at(-1)).toBe('入库')
  })

  it('新建的节点一律 PENDING，没有任何数量', async () => {
    const { service } = build()
    const nodes = await service.buildRoute(LINE, ['10'])

    expect(nodes.every((node) => node.status === 'PENDING')).toBe(true)
    expect(nodes.every((node) => node.qtyIn === null && node.qtyOk === null)).toBe(true)
  })

  it('重建会整链替换，不会残留旧节点', async () => {
    const { service, repo } = build()
    await service.buildRoute(LINE, ['10', '11', '25', '16'])
    const before = repo.rows.length

    await service.buildRoute(LINE, ['10'])
    expect(repo.rows.length).toBeLessThan(before)
    expect(repo.rows.every((row) => row.orderLineId === LINE)).toBe(true)
  })

  it('不同产品行各建各的链，互不干扰', async () => {
    const { service, repo } = build()
    await service.buildRoute('SOL-A', ['10'])
    await service.buildRoute('SOL-B', ['10', '25'])

    const a = repo.rows.filter((row) => row.orderLineId === 'SOL-A').length
    const b = repo.rows.filter((row) => row.orderLineId === 'SOL-B').length
    expect(b).toBeGreaterThan(a)
  })
})

describe('进度只能由事件推进', () => {
  it('MES 事件把节点推进到进行中并记下投入与合格数', async () => {
    const { service } = build()
    await service.buildRoute(LINE, ['10'])

    const node = await service.applyEvent(event({ qtyIn: '100', qtyOk: '58' }))

    expect(node.status).toBe('ACTIVE')
    expect(node.qtyIn).toBe('100')
    expect(node.qtyOk).toBe('58')
  })

  it('合格数超过投入数时截断，完成数不会大于工单数', async () => {
    const { service } = build()
    await service.buildRoute(LINE, ['10'])

    const node = await service.applyEvent(event({ qtyIn: '100', qtyOk: '120' }))
    expect(node.qtyOk).toBe('100')
  })

  it('完成事件写入完成时间', async () => {
    const { service } = build()
    await service.buildRoute(LINE, ['10'])

    const node = await service.applyEvent(
      event({ status: 'DONE', qtyIn: '100', qtyOk: '100' }),
    )
    expect(node.finishedAt).toEqual(new Date('2026-08-09T08:00:00Z'))
  })

  it('未完成的节点不写完成时间', async () => {
    const { service } = build()
    await service.buildRoute(LINE, ['10'])

    expect((await service.applyEvent(event())).finishedAt).toBeNull()
  })

  it('开始时间只记第一次，后续事件不覆盖', async () => {
    const { service } = build()
    await service.buildRoute(LINE, ['10'])

    await service.applyEvent(event({ occurredAt: new Date('2026-08-09T08:00:00Z') }))
    const later = await service.applyEvent(
      event({ occurredAt: new Date('2026-08-09T12:00:00Z'), qtyOk: '80' }),
    )

    expect(later.startedAt).toEqual(new Date('2026-08-09T08:00:00Z'))
  })

  it('检验不合格的事件把节点标成异常', async () => {
    const { service } = build()
    await service.buildRoute(LINE, ['10'])

    const node = await service.applyEvent(
      event({ source: 'QMS', status: 'BLOCKED', qtyIn: '100', qtyOk: '90', qtyNg: '10' }),
    )

    expect(node.status).toBe('BLOCKED')
    expect(node.qtyNg).toBe('10')
  })

  it('节点不存在时报错，而不是静默新建一个', async () => {
    const { service } = build()
    await service.buildRoute(LINE, ['10'])

    await expect(service.applyEvent(event({ sequence: 999 }))).rejects.toMatchObject({
      code: 'ORD_2000',
    })
  })

  it('手工填报被明确拒绝', () => {
    expect(() => OrderTrackingService.assertNotManual()).toThrow(/不允许手工填报/)
  })

  it('手工填报的错误码是 ORD_2040 / 403', () => {
    try {
      OrderTrackingService.assertNotManual()
    } catch (error) {
      expect(error).toMatchObject({ code: 'ORD_2040', status: 403 })
    }
    expect.assertions(1)
  })
})

describe('聚合与视图', () => {
  it('产品行进度给出完成数与总节点数', async () => {
    const { service } = build()
    await service.buildRoute(LINE, ['10'])
    await service.applyEvent(event({ status: 'DONE', qtyIn: '100', qtyOk: '100' }))

    const progress = await service.lineProgress(LINE, '100')
    expect(progress.doneNodes).toBe(1)
    expect(progress.totalNodes).toBeGreaterThan(1)
  })

  it('一单多产品时按行分别返回', async () => {
    const { service } = build()
    await service.buildRoute('SOL-A', ['10'])
    await service.buildRoute('SOL-B', ['10'])

    const map = await service.orderProgress('SO1', new Map([['SOL-A', '100'], ['SOL-B', '50']]))
    expect(map.size).toBe(2)
    expect(map.get('SOL-A')?.totalNodes).toBeGreaterThan(0)
  })

  it('没给数量的行按 0 兜底，不会崩', async () => {
    const { service } = build()
    await service.buildRoute('SOL-A', ['10'])

    const map = await service.orderProgress('SO1', new Map())
    expect(map.get('SOL-A')?.nodes[0]?.total).toBe('0')
  })

  it('视图里没有百分比字段，只有完成数与工单数', async () => {
    const { service } = build()
    await service.buildRoute(LINE, ['10'])
    await service.applyEvent(event({ qtyIn: '100', qtyOk: '58' }))

    const line = { id: LINE, productName: '面板', drawingNo: 'BCM-2607', quantity: '100' } as SalesOrderLineRecord
    const view = toLineTrackingView(line, await service.lineProgress(LINE, '100'))

    expect(view.nodes[0]?.done).toBe('58')
    expect(view.nodes[0]?.total).toBe('100')
    expect(JSON.stringify(view)).not.toContain('percent')
    expect(JSON.stringify(view)).not.toContain('"progress"')
  })
})

describe('查看权限：业务部、总经办、PMC 三方', () => {
  it('持有追踪查看权限的人可以看', () => {
    expect(() =>
      OrderTrackingService.assertCanView({
        userCode: 'X',
        permissions: [PERMISSION_CODES.ORDER_TRACKING_VIEW],
      }),
    ).not.toThrow()
  })

  it('业务岗位即便没有追踪权限也能看自己的单', () => {
    expect(() =>
      OrderTrackingService.assertCanView({
        userCode: 'X',
        permissions: [PERMISSION_CODES.SALES_OPERATE],
      }),
    ).not.toThrow()
  })

  it('两者都没有就看不了', () => {
    expect(() =>
      OrderTrackingService.assertCanView({ userCode: 'X', permissions: [] }),
    ).toThrow(/业务岗位/)
  })
})
