
import { BizError } from '../../../common/errors/biz-error'
import { DomainEventPublisher } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { PasswordResetRequestService } from '../services/password-reset-request.service'

import { FakeUserRepository } from './fakes'

import type {
  CreatePasswordResetInput,
  PasswordResetRecord,
  PasswordResetRepositoryPort,
} from '../repositories/password-reset.repository.port'
import type { PasswordResetRequestContract } from '@machining-erp/shared'
import type { LoginAudience } from '@prisma/client'

class FakePasswordResetRepository implements PasswordResetRepositoryPort {
  readonly rows: PasswordResetRecord[] = []

  async hasPending(audience: LoginAudience, account: string): Promise<boolean> {
    return this.rows.some(
      (row) => row.audience === audience && row.account === account && row.status === 'SUBMITTED',
    )
  }

  async create(input: CreatePasswordResetInput): Promise<PasswordResetRecord> {
    const record: PasswordResetRecord = {
      id: `pwr-${this.rows.length + 1}`,
      ...input,
      status: 'SUBMITTED',
      submittedAt: new Date('2026-08-08T10:00:00Z'),
    }
    this.rows.push(record)
    return record
  }

  async listPending(): Promise<PasswordResetRecord[]> {
    return this.rows
  }
}

const VALID: PasswordResetRequestContract = {
  audience: 'internal',
  account: 'zhangsan',
  applicantName: '张三',
  department: '业务部',
  contact: '13800000000',
  reason: '忘记密码',
}

function build(): {
  service: PasswordResetRequestService
  repository: FakePasswordResetRepository
  notifyMany: jest.Mock
} {
  const repository = new FakePasswordResetRepository()
  const notifyMany = jest.fn().mockResolvedValue(1)
  let sequence = 0
  const docNumber = {
    next: async () => {
      sequence += 1
      return `PWR20260808${sequence.toString().padStart(4, '0')}`
    },
  } as unknown as DocNumberService

  const service = new PasswordResetRequestService(
    docNumber,
    { notifyMany } as unknown as NotificationService,
    { publish: jest.fn().mockResolvedValue(undefined) } as unknown as DomainEventPublisher,
    new FakeUserRepository(),
    repository,
  )
  return { service, repository, notifyMany }
}

describe('密码重置申请', () => {
  it('提交成功并明确告知不发邮件/短信', async () => {
    const { service } = build()
    const result = await service.submit(VALID)

    expect(result.requestNo).toBe('PWR202608080001')
    expect(result.handlerHint).toContain('IT 系统管理员')
    expect(result.handlerHint).toContain('不发送邮件或短信')
  })

  it.each([
    ['account', { ...VALID, account: '  ' }],
    ['applicantName', { ...VALID, applicantName: '' }],
    ['department', { ...VALID, department: ' ' }],
    ['contact', { ...VALID, contact: '' }],
  ])('%s 缺失时抛 AUTH_1040', async (_field, payload) => {
    const { service } = build()
    await expect(service.submit(payload)).rejects.toMatchObject({ code: 'AUTH_1040' })
  })

  it('同一账号不能重复提交待处理申请', async () => {
    const { service } = build()
    await service.submit(VALID)

    await expect(service.submit(VALID)).rejects.toBeInstanceOf(BizError)
    await expect(service.submit(VALID)).rejects.toMatchObject({ code: 'AUTH_1041' })
  })

  it('门户账号与内部账号互不冲突', async () => {
    const { service, repository } = build()
    await service.submit(VALID)
    await service.submit({ ...VALID, audience: 'portal' })

    expect(repository.rows.map((row) => row.audience)).toEqual(['INTERNAL', 'PORTAL'])
  })

  it('派单给 IT 管理员', async () => {
    const { service, notifyMany } = build()
    await service.submit(VALID)

    expect(notifyMany).toHaveBeenCalledWith(
      ['WFX-2019-0001'],
      expect.objectContaining({ category: 'PASSWORD_RESET' }),
    )
  })

  it('理由选填，缺省落 null', async () => {
    const { service, repository } = build()
    await service.submit({ ...VALID, reason: undefined })
    expect(repository.rows[0]?.reason).toBeNull()
  })
})
