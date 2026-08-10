import { DOMAIN_EVENTS } from '../../../platform/events'
import { BomReadinessService } from '../services/bom-readiness.service'

import type { DomainEventPublisher } from '../../../platform/events'

type Handler = (event: { payload: Record<string, unknown> }) => void

function build(): { service: BomReadinessService; fire: (payload: Record<string, unknown>) => void } {
  const handlers: Handler[] = []
  const events = {
    subscribe: (name: string, handler: Handler) => {
      // 只认 bom-ready：程序没编完也该能下单
      if (name === DOMAIN_EVENTS.BOM_REQUEST_BOM_READY) handlers.push(handler)
    },
  } as unknown as DomainEventPublisher

  const service = new BomReadinessService(events)
  service.onModuleInit()

  return {
    service,
    fire: (payload) => handlers.forEach((handler) => handler({ payload })),
  }
}

describe('BOM 就绪只认领域事件，不认手填的申请号', () => {
  it('没收到事件时一律视为未就绪', () => {
    const { service } = build()
    expect(service.isReady('QI1', 'MT-7719')).toBe(false)
  })

  it('收到完成事件后按报价行放行', () => {
    const { service, fire } = build()
    fire({ quotationItemId: 'QI1', drawingNo: 'MT-7719' })

    expect(service.isReady('QI1', 'OTHER')).toBe(true)
  })

  it('报价行对不上时按图号兜底放行', () => {
    const { service, fire } = build()
    fire({ quotationItemId: 'QI1', drawingNo: 'MT-7719' })

    expect(service.isReady('QI-OTHER', 'MT-7719')).toBe(true)
  })

  it('报价行与图号都对不上就是未就绪', () => {
    const { service, fire } = build()
    fire({ quotationItemId: 'QI1', drawingNo: 'MT-7719' })

    expect(service.isReady('QI-OTHER', 'OTHER')).toBe(false)
  })

  it('订单行没挂报价行时也能按图号判定', () => {
    const { service, fire } = build()
    fire({ quotationItemId: 'QI1', drawingNo: 'MT-7719' })

    expect(service.isReady(null, 'MT-7719')).toBe(true)
    expect(service.isReady(null, 'OTHER')).toBe(false)
  })

  it('事件载荷缺字段时不炸，也不误放行', () => {
    const { service, fire } = build()
    fire({})

    expect(service.isReady('QI1', 'MT-7719')).toBe(false)
  })

  it('只带图号的事件同样生效', () => {
    const { service, fire } = build()
    fire({ drawingNo: 'MT-7719' })

    expect(service.isReady(null, 'MT-7719')).toBe(true)
  })

  it('重放接口可补齐读模型', () => {
    const { service } = build()
    service.markReady('QI9', 'DW-9')

    expect(service.isReady('QI9', 'X')).toBe(true)
    expect(service.isReady(null, 'DW-9')).toBe(true)
  })

  it('重放时传空值不会污染读模型', () => {
    const { service } = build()
    service.markReady(null, null)

    expect(service.isReady(null, '')).toBe(false)
  })

  it('多条事件各自累积', () => {
    const { service, fire } = build()
    fire({ quotationItemId: 'QI1', drawingNo: 'A' })
    fire({ quotationItemId: 'QI2', drawingNo: 'B' })

    expect(service.isReady('QI1', 'X')).toBe(true)
    expect(service.isReady('QI2', 'X')).toBe(true)
  })
})
