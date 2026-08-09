import { DocTimelineService } from '../services/doc-timeline.service'

import type {
  CloseNodeInput,
  DocTimelineRepositoryPort,
  OpenNodeInput,
  TimelineNodeRecord,
} from '../repositories/doc-timeline.repository.port'

class FakeTimelineRepository implements DocTimelineRepositoryPort {
  readonly rows: TimelineNodeRecord[] = []

  async findOpenNode(docType: string, docId: string): Promise<TimelineNodeRecord | null> {
    const open = this.rows
      .filter((row) => row.docType === docType && row.docId === docId && row.leftAt === null)
      .sort((left, right) => right.sequence - left.sequence)
    return open[0] ?? null
  }

  async listByDoc(docType: string, docId: string): Promise<TimelineNodeRecord[]> {
    return this.rows.filter((row) => row.docType === docType && row.docId === docId)
  }

  async openNode(input: OpenNodeInput): Promise<TimelineNodeRecord> {
    const record: TimelineNodeRecord = {
      id: `node-${this.rows.length + 1}`,
      docType: input.docType,
      docId: input.docId,
      node: input.node,
      sequence: input.sequence,
      status: 'IN_PROGRESS',
      enteredAt: this.now,
      leftAt: null,
      durationMs: null,
      ownerUserCode: input.ownerUserCode ?? null,
      ownerDept: input.ownerDept ?? null,
      remark: input.remark ?? null,
    }
    this.rows.push(record)
    return record
  }

  async closeNode(input: CloseNodeInput): Promise<void> {
    const row = this.rows.find((item) => item.id === input.id)
    if (!row) return
    row.leftAt = input.leftAt
    row.durationMs = input.durationMs
    row.status = input.status
  }

  now = new Date('2026-08-08T10:00:00Z')
}

const T0 = new Date('2026-08-08T10:00:00Z')

describe('节点计时', () => {
  it('首个节点直接开启，序号从 1 起', async () => {
    const repository = new FakeTimelineRepository()
    const service = new DocTimelineService(repository)

    const node = await service.enter({ docType: 'SO', docId: 'SO001', node: '订单评审', at: T0 })
    expect(node.sequence).toBe(1)
    expect(node.leftAt).toBeNull()
  })

  it('进入下一节点时自动结算上一节点耗时', async () => {
    const repository = new FakeTimelineRepository()
    const service = new DocTimelineService(repository)

    await service.enter({ docType: 'SO', docId: 'SO001', node: '订单评审', at: T0 })
    repository.now = new Date(T0.getTime() + 3_600_000)
    await service.enter({
      docType: 'SO',
      docId: 'SO001',
      node: 'PMC计划',
      at: new Date(T0.getTime() + 3_600_000),
    })

    const [first, second] = repository.rows
    expect(first?.durationMs).toBe(3_600_000n)
    expect(first?.status).toBe('DONE')
    expect(second?.sequence).toBe(2)
  })

  it('异常节点可标记为 ABNORMAL 并联动预警', async () => {
    const repository = new FakeTimelineRepository()
    const service = new DocTimelineService(repository)

    await service.enter({ docType: 'SO', docId: 'SO001', node: '品质检', at: T0 })
    await service.enter({
      docType: 'SO',
      docId: 'SO001',
      node: '返工',
      previousStatus: 'ABNORMAL',
      at: new Date(T0.getTime() + 1000),
    })

    expect(repository.rows[0]?.status).toBe('ABNORMAL')
  })

  it('时钟回拨时耗时按 0 处理，不出现负值', async () => {
    const repository = new FakeTimelineRepository()
    const service = new DocTimelineService(repository)

    await service.enter({ docType: 'SO', docId: 'SO001', node: 'A', at: T0 })
    await service.enter({
      docType: 'SO',
      docId: 'SO001',
      node: 'B',
      at: new Date(T0.getTime() - 5000),
    })

    expect(repository.rows[0]?.durationMs).toBe(0n)
  })

  it('单据终结时关闭最后一个开放节点', async () => {
    const repository = new FakeTimelineRepository()
    const service = new DocTimelineService(repository)

    await service.enter({ docType: 'SO', docId: 'SO001', node: '入库', at: T0 })
    await service.close('SO', 'SO001', 'DONE', new Date(T0.getTime() + 60_000))

    expect(repository.rows[0]?.leftAt).not.toBeNull()
    expect(repository.rows[0]?.durationMs).toBe(60_000n)
  })

  it('没有开放节点时 close 是幂等的空操作', async () => {
    const repository = new FakeTimelineRepository()
    const service = new DocTimelineService(repository)

    await expect(service.close('SO', 'SO404')).resolves.toBeUndefined()
    expect(repository.rows).toHaveLength(0)
  })

  it('按单据列出全部节点', async () => {
    const repository = new FakeTimelineRepository()
    const service = new DocTimelineService(repository)

    await service.enter({ docType: 'SO', docId: 'SO001', node: 'A', at: T0 })
    await service.enter({ docType: 'SO', docId: 'SO001', node: 'B', at: T0 })

    expect(await service.list('SO', 'SO001')).toHaveLength(2)
  })
})

describe('默认取当前时间', () => {
  it('enter / close 不传 at 时使用系统时钟', async () => {
    const repository = new FakeTimelineRepository()
    const service = new DocTimelineService(repository)

    await service.enter({ docType: 'SO', docId: 'SO002', node: '订单评审' })
    await service.enter({ docType: 'SO', docId: 'SO002', node: 'PMC计划' })
    await service.close('SO', 'SO002')

    expect(repository.rows.every((row) => row.leftAt !== null)).toBe(true)
  })
})
