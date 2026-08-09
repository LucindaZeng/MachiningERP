
import { BizError } from '../../../common/errors/biz-error'
import { DomainEventPublisher } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { AccountAvailabilityService } from '../services/account-availability.service'
import { AccountRequestService } from '../services/account-request.service'
import { PasswordService } from '../services/password.service'
import { UserCodeService } from '../services/user-code.service'

import { FakeAccountRequestRepository, FakeUserCodeRepository, FakeUserRepository } from './fakes'


import type { AccountRequestContract } from '@machining-erp/shared'

const VALID: AccountRequestContract = {
  employeeName: '张三',
  department: '业务部',
  account: 'zhangsan',
  password: 'Wfx@2026!',
  confirmPassword: 'Wfx@2026!',
  contact: '13800000000',
  reason: '新入职',
}

interface Harness {
  service: AccountRequestService
  users: FakeUserRepository
  requests: FakeAccountRequestRepository
  notifyMany: jest.Mock
  publish: jest.Mock
}

function build(): Harness {
  const users = new FakeUserRepository()
  const requests = new FakeAccountRequestRepository()
  const availability = new AccountAvailabilityService(users, requests)
  const passwords = new PasswordService()

  let sequence = 208
  const docNumber = {
    next: async (docType: string) => {
      sequence += 1
      return docType === 'USER_CODE'
        ? `WFX-2026-${sequence.toString().padStart(4, '0')}`
        : `ACR20260808${sequence.toString().padStart(4, '0')}`
    },
  } as unknown as DocNumberService

  const userCodes = new UserCodeService(docNumber, new FakeUserCodeRepository())
  const notifyMany = jest.fn().mockResolvedValue(1)
  const publish = jest.fn().mockResolvedValue(undefined)

  const service = new AccountRequestService(
    availability,
    passwords,
    userCodes,
    docNumber,
    { notifyMany } as unknown as NotificationService,
    { publish } as unknown as DomainEventPublisher,
    users,
    requests,
  )

  return { service, users, requests, notifyMany, publish }
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  )
  expect(BizError.is(error)).toBe(true)
  return (error as BizError).code
}

describe('提交账户申请：必填与格式校验', () => {
  it.each([
    ['employeeName', { ...VALID, employeeName: '  ' }],
    ['department', { ...VALID, department: '' }],
    ['account', { ...VALID, account: '   ' }],
  ])('%s 缺失时抛 AUTH_1020', async (_field, payload) => {
    const { service } = build()
    expect(await codeOf(service.submit(payload))).toBe('AUTH_1020')
  })

  it('用户名格式不合法抛 AUTH_1021', async () => {
    const { service } = build()
    expect(await codeOf(service.submit({ ...VALID, account: 'A1' }))).toBe('AUTH_1021')
  })

  it('密码少于 8 位抛 AUTH_1023', async () => {
    const { service } = build()
    expect(
      await codeOf(service.submit({ ...VALID, password: 'short', confirmPassword: 'short' })),
    ).toBe('AUTH_1023')
  })

  it('两次密码不一致抛 AUTH_1024', async () => {
    const { service } = build()
    expect(await codeOf(service.submit({ ...VALID, confirmPassword: 'Different1!' }))).toBe(
      'AUTH_1024',
    )
  })

  it('用户名被占用抛 AUTH_1022', async () => {
    const { service, users } = build()
    users.users.push({
      id: 'u1',
      userCode: 'WFX-2020-0001',
      account: 'zhangsan',
      audience: 'INTERNAL',
      formerAccount: null,
      displayName: '张三',
      departmentName: null,
      passwordHash: 'hash',
      status: 'ACTIVE',
      employmentStatus: 'ACTIVE',
      leftAt: null,
      roleCodes: [],
      permissionCodes: [],
    })

    expect(await codeOf(service.submit(VALID))).toBe('AUTH_1022')
  })

  it('同一用户名不能连续提交两次申请', async () => {
    const { service } = build()
    await service.submit(VALID)
    expect(await codeOf(service.submit(VALID))).toBe('AUTH_1022')
  })
})

describe('提交账户申请：成功路径', () => {
  it('注册即发放唯一编码，密码落库前已散列', async () => {
    const { service, requests } = build()
    const result = await service.submit(VALID)

    expect(result.requestNo).toMatch(/^ACR\d{12}$/)
    expect(result.userCode).toMatch(/^WFX-2026-\d{4}$/)
    expect(result.account).toBe('zhangsan')
    expect(result.reusedFrom).toBeUndefined()

    const saved = requests.rows[0]
    expect(saved?.passwordHash).not.toBe(VALID.password)
    expect(saved?.passwordHash.startsWith('$2')).toBe(true)
    expect(saved?.status).toBe('SUBMITTED')
  })

  it('用户名做 trim + 小写归一化后落库', async () => {
    const { service, requests } = build()
    const result = await service.submit({ ...VALID, account: '  ZhangSan  ' })

    expect(result.account).toBe('zhangsan')
    expect(requests.rows[0]?.account).toBe('zhangsan')
  })

  it('派单给全部 IT 管理员并发出领域事件', async () => {
    const { service, notifyMany, publish } = build()
    await service.submit(VALID)

    expect(notifyMany).toHaveBeenCalledWith(
      ['WFX-2019-0001'],
      expect.objectContaining({ category: 'ACCOUNT_REQUEST' }),
    )
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'identity.account-request.submitted' }),
    )
  })

  it('复用离职释放的用户名时，编码全新且提示原使用人', async () => {
    const { service, users } = build()
    users.released.push({
      formerAccount: 'liwentao',
      formerHolder: '李文涛',
      leftAt: new Date('2026-05-31T00:00:00Z'),
    })

    const result = await service.submit({ ...VALID, account: 'liwentao' })

    expect(result.reusedFrom).toBe('李文涛（2026-05-31 离职，用户名已释放）')
    expect(result.handlerHint).toContain('与原使用人的编码无关')
    // 关键：编码是本次注册新发的，不是原使用人的 WFX-2022-0208
    expect(result.userCode).toMatch(/^WFX-2026-\d{4}$/)
  })

  it('两个人先后申请拿到不同的申请单号与唯一编码', async () => {
    const { service } = build()
    const first = await service.submit(VALID)
    const second = await service.submit({ ...VALID, account: 'lisi', employeeName: '李四' })

    expect(first.requestNo).not.toBe(second.requestNo)
    expect(first.userCode).not.toBe(second.userCode)
  })

  it('选填项缺省时落 null 而不是空字符串', async () => {
    const { service, requests } = build()
    await service.submit({ ...VALID, contact: undefined, reason: undefined })

    expect(requests.rows[0]?.contact).toBeNull()
    expect(requests.rows[0]?.reason).toBeNull()
  })
})
