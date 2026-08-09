import { Logger } from '@nestjs/common'

import { AuditService } from '../services/audit.service'

import type { AuditLogEntry, AuditLogRepositoryPort } from '../repositories/audit-log.repository.port'

const ENTRY: AuditLogEntry = {
  actorUserCode: 'WFX-2018-0042',
  action: 'quotation.approve',
  entityType: 'Quotation',
  entityId: 'QTN202608080001',
  before: { status: 'IN_REVIEW' },
  after: { status: 'EFFECTIVE' },
  ip: '10.0.0.1',
  traceId: 'trace-1',
}

describe('审计写入', () => {
  it('正常写入仓储', async () => {
    const append = jest.fn().mockResolvedValue(undefined)
    const service = new AuditService({ append } as AuditLogRepositoryPort)

    await service.record(ENTRY)
    expect(append).toHaveBeenCalledWith(ENTRY)
  })

  it('审计失败不影响主业务，但必须留下错误日志（禁止静默吞异常）', async () => {
    const append = jest.fn().mockRejectedValue(new Error('db down'))
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const service = new AuditService({ append } as AuditLogRepositoryPort)

    await expect(service.record(ENTRY)).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('审计写入失败'),
      expect.any(String),
    )
    errorSpy.mockRestore()
  })

  it('非 Error 抛出物也能被记录', async () => {
    const append = jest.fn().mockRejectedValue('boom')
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const service = new AuditService({ append } as AuditLogRepositoryPort)

    await service.record({ ...ENTRY, entityId: null })
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('#-'), 'boom')
    errorSpy.mockRestore()
  })
})
