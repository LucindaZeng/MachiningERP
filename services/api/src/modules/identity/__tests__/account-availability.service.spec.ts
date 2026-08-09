import { AccountAvailabilityService } from '../services/account-availability.service'

import { FakeAccountRequestRepository, FakeUserRepository } from './fakes'

const NOW = new Date('2026-08-08T10:00:00Z')

function build(): {
  service: AccountAvailabilityService
  users: FakeUserRepository
  requests: FakeAccountRequestRepository
} {
  const users = new FakeUserRepository()
  const requests = new FakeAccountRequestRepository()
  return { service: new AccountAvailabilityService(users, requests), users, requests }
}

function addActiveUser(users: FakeUserRepository, account: string): void {
  users.users.push({
    id: account,
    userCode: `WFX-2020-${account}`,
    account,
    audience: 'INTERNAL',
    formerAccount: null,
    displayName: account,
    departmentName: null,
    passwordHash: 'hash',
    status: 'ACTIVE',
    employmentStatus: 'ACTIVE',
    leftAt: null,
    roleCodes: [],
    permissionCodes: [],
  })
}

describe('用户名格式校验', () => {
  it.each(['ab', 'ab#cd', '1abcd', 'ab-cd', '_abcd', 'a'.repeat(21)])('%s 不合法', async (account) => {
    const { service } = build()
    const result = await service.check(account, NOW)
    expect(result.available).toBe(false)
    expect(result.reason).toContain('4–20 位')
    expect(result.suggestions).toEqual([])
  })

  it('大小写与空格会被归一化', async () => {
    const { service } = build()
    expect((await service.check('  LiWenTao  ', NOW)).account).toBe('liwentao')
  })
})

describe('用户名占用判定', () => {
  it('在职账号占用：不可用并给出候选建议', async () => {
    const { service, users } = build()
    addActiveUser(users, 'zhangsan')

    const result = await service.check('zhangsan', NOW)
    expect(result.available).toBe(false)
    expect(result.reason).toBe('该用户名已被现有账号占用，请更换')
    expect(result.suggestions).toEqual(['zhangsan01', 'zhangsan.wfx', 'zhangsan26'])
  })

  it('待审批的申请同样占用用户名，避免两人同时申请到同一个', async () => {
    const { service, requests } = build()
    await requests.create({
      requestNo: 'ACR202608080001',
      employeeName: '张三',
      department: '业务部',
      departmentId: null,
      account: 'zhangsan',
      passwordHash: 'hash',
      contact: null,
      reason: null,
      userCode: 'WFX-2026-0209',
      reusedFrom: null,
    })

    const result = await service.check('zhangsan', NOW)
    expect(result.available).toBe(false)
    expect(result.reason).toBe('该用户名已有待审批的申请占用，请更换')
  })

  it('候选建议本身被占用时会被过滤掉', async () => {
    const { service, users } = build()
    addActiveUser(users, 'zhangsan')
    addActiveUser(users, 'zhangsan01')

    const result = await service.check('zhangsan', NOW)
    expect(result.suggestions).toEqual(['zhangsan.wfx', 'zhangsan26'])
  })
})

describe('离职释放的用户名', () => {
  it('可以重新登记，但要提示原使用人与新编码互不相干', async () => {
    const { service, users } = build()
    users.released.push({
      formerAccount: 'liwentao',
      formerHolder: '李文涛',
      leftAt: new Date('2026-05-31T00:00:00Z'),
    })

    const result = await service.check('liwentao', NOW)
    expect(result.available).toBe(true)
    expect(result.released).toBe(true)
    expect(result.reason).toContain('李文涛')
    expect(result.reason).toContain('2026-05-31')
    expect(result.reason).toContain('新的唯一编码')
  })

  it('离职日期缺失时也能给出可读提示', async () => {
    const { service, users } = build()
    users.released.push({ formerAccount: 'liwentao', formerHolder: '李文涛', leftAt: null })

    expect((await service.check('liwentao', NOW)).reason).toContain('离职日期缺失')
  })

  it('原使用人仍在职时按占用处理，不进入释放分支', async () => {
    const { service, users } = build()
    addActiveUser(users, 'liwentao')
    users.released.push({ formerAccount: 'liwentao', formerHolder: '李文涛', leftAt: null })

    expect((await service.check('liwentao', NOW)).available).toBe(false)
  })
})

describe('全新用户名', () => {
  it('直接可用且不带提示', async () => {
    const { service } = build()
    expect(await service.check('wangwu', NOW)).toEqual({
      account: 'wangwu',
      available: true,
      suggestions: [],
    })
  })
})
