
import { ConfigService } from '@nestjs/config'

import { BizError } from '../../../common/errors/biz-error'
import { loadAppConfig } from '../../../config/app-config'
import { DomainEventPublisher } from '../../../platform/events'
import { PasswordService, UserDirectoryService } from '../../identity'
import { AccessTokenService } from '../services/access-token.service'
import { CaptchaService } from '../services/captcha.service'
import { LoginService } from '../services/login.service'

import type { UserRecord } from '../../identity'
import type { LoginAttemptRepositoryPort } from '../repositories/login-attempt.repository.port'
import type { ThrottleState } from '../services/login-throttle.policy'
import type { LoginAudience } from '@prisma/client'

const NOW = new Date('2026-08-08T10:00:00Z')

const ACTIVE_USER: UserRecord = {
  id: 'user-1',
  userCode: 'WFX-2018-0042',
  account: 'luoxiaolin',
  audience: 'INTERNAL',
  formerAccount: null,
  displayName: '罗晓琳',
  departmentName: '业务部',
  passwordHash: 'hash',
  status: 'ACTIVE',
  employmentStatus: 'ACTIVE',
  leftAt: null,
  roleCodes: ['SALES_MANAGER'],
  permissionCodes: ['quote.approve', 'sales.operate'],
}

class FakeAttempts implements LoginAttemptRepositoryPort {
  readonly rows = new Map<string, ThrottleState>()

  async find(audience: LoginAudience, account: string): Promise<ThrottleState | null> {
    return this.rows.get(`${audience}:${account}`) ?? null
  }

  async save(audience: LoginAudience, account: string, state: ThrottleState): Promise<void> {
    this.rows.set(`${audience}:${account}`, state)
  }

  async reset(audience: LoginAudience, account: string): Promise<void> {
    this.rows.delete(`${audience}:${account}`)
  }
}

interface Harness {
  service: LoginService
  attempts: FakeAttempts
  captchaVerify: jest.Mock
  passwordVerify: jest.Mock
  findForLogin: jest.Mock
  publish: jest.Mock
  touchLastLogin: jest.Mock
}

function buildHarness(user: UserRecord | null = ACTIVE_USER): Harness {
  const attempts = new FakeAttempts()
  const captchaVerify = jest.fn().mockResolvedValue(true)
  const passwordVerify = jest.fn().mockResolvedValue(true)
  const findForLogin = jest.fn().mockResolvedValue(user)
  const publish = jest.fn().mockResolvedValue(undefined)
  const touchLastLogin = jest.fn().mockResolvedValue(undefined)

  const config = { getOrThrow: () => loadAppConfig({} as NodeJS.ProcessEnv) } as unknown as ConfigService
  const captcha = { verify: captchaVerify } as unknown as CaptchaService
  const tokens = {
    issue: jest.fn().mockResolvedValue({
      accessToken: 'jwt-token',
      expiresIn: 28800,
      tokenId: 'jti-1',
      expiresAt: new Date(NOW.getTime() + 28_800_000),
    }),
    revoke: jest.fn().mockResolvedValue(undefined),
  } as unknown as AccessTokenService
  const passwords = { verify: passwordVerify } as unknown as PasswordService
  const directory = { findForLogin, touchLastLogin } as unknown as UserDirectoryService
  const events = { publish } as unknown as DomainEventPublisher

  const service = new LoginService(config, captcha, tokens, passwords, directory, events, attempts)
  return { service, attempts, captchaVerify, passwordVerify, findForLogin, publish, touchLastLogin }
}

const CONTEXT = { ip: '10.0.0.1', userAgent: 'jest', traceId: 'trace-1' }

async function expectBizError(promise: Promise<unknown>, code: string): Promise<BizError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  )
  expect(BizError.is(error)).toBe(true)
  const bizError = error as BizError
  expect(bizError.code).toBe(code)
  return bizError
}

describe('登录成功路径', () => {
  it('返回 token 与用户信息，权限点由后端下发', async () => {
    const harness = buildHarness()
    const result = await harness.service.login(
      { audience: 'internal', account: ' LuoXiaoLin ', password: 'Wfx@2026' },
      CONTEXT,
      NOW,
    )

    expect(result.accessToken).toBe('jwt-token')
    expect(result.expiresIn).toBe(28800)
    expect(result.user).toMatchObject({
      userCode: 'WFX-2018-0042',
      account: 'luoxiaolin',
      department: '业务部',
      roles: ['SALES_MANAGER'],
      permissions: ['quote.approve', 'sales.operate'],
    })
    // 账号做了 trim + 小写归一化后再查库
    expect(harness.findForLogin).toHaveBeenCalledWith('INTERNAL', 'luoxiaolin')
  })

  it('成功后清零失败计数并记录登录事件', async () => {
    const harness = buildHarness()
    await harness.attempts.save('INTERNAL', 'luoxiaolin', { failureCount: 2, lockedUntil: null })

    await harness.service.login(
      { audience: 'internal', account: 'luoxiaolin', password: 'Wfx@2026' },
      CONTEXT,
      NOW,
    )

    expect(await harness.attempts.find('INTERNAL', 'luoxiaolin')).toBeNull()
    expect(harness.touchLastLogin).toHaveBeenCalledWith('user-1', NOW)
    expect(harness.publish).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'auth.session.logged-in' }),
    )
  })

  it('门户账号走 PORTAL 账号域', async () => {
    const harness = buildHarness({ ...ACTIVE_USER, audience: 'PORTAL' })
    await harness.service.login(
      { audience: 'portal', account: 'sup001', password: 'Portal@2026' },
      CONTEXT,
      NOW,
    )
    expect(harness.findForLogin).toHaveBeenCalledWith('PORTAL', 'sup001')
  })

  it('部门为空时返回空字符串而不是 null', async () => {
    const harness = buildHarness({ ...ACTIVE_USER, departmentName: null, account: null })
    const result = await harness.service.login(
      { audience: 'internal', account: 'luoxiaolin', password: 'Wfx@2026' },
      CONTEXT,
      NOW,
    )
    expect(result.user.department).toBe('')
    expect(result.user.account).toBe('luoxiaolin')
  })
})

describe('登录失败与风控', () => {
  it('密码错误累加失败计数并抛 AUTH_1001', async () => {
    const harness = buildHarness()
    harness.passwordVerify.mockResolvedValue(false)

    const error = await expectBizError(
      harness.service.login(
        { audience: 'internal', account: 'luoxiaolin', password: 'wrong' },
        CONTEXT,
        NOW,
      ),
      'AUTH_1001',
    )

    expect(error.captchaRequired).toBe(false)
    expect(await harness.attempts.find('INTERNAL', 'luoxiaolin')).toEqual({
      failureCount: 1,
      lockedUntil: null,
    })
  })

  it('账号不存在时同样报「账号或密码不正确」，避免账号枚举', async () => {
    const harness = buildHarness(null)
    await expectBizError(
      harness.service.login(
        { audience: 'internal', account: 'nobody', password: 'x' },
        CONTEXT,
        NOW,
      ),
      'AUTH_1001',
    )
  })

  it('第 3 次失败起，错误响应带 captchaRequired', async () => {
    const harness = buildHarness()
    harness.passwordVerify.mockResolvedValue(false)
    await harness.attempts.save('INTERNAL', 'luoxiaolin', { failureCount: 2, lockedUntil: null })

    const error = await expectBizError(
      harness.service.login(
        { audience: 'internal', account: 'luoxiaolin', password: 'wrong', captchaId: 'c', captchaCode: 'X' },
        CONTEXT,
        NOW,
      ),
      'AUTH_1001',
    )
    expect(error.captchaRequired).toBe(true)
    expect(error.message).toContain('还可尝试 5 次')
  })

  it('失败满 3 次后未通过验证码直接 AUTH_1003', async () => {
    const harness = buildHarness()
    harness.captchaVerify.mockResolvedValue(false)
    await harness.attempts.save('INTERNAL', 'luoxiaolin', { failureCount: 3, lockedUntil: null })

    const error = await expectBizError(
      harness.service.login(
        { audience: 'internal', account: 'luoxiaolin', password: 'Wfx@2026' },
        CONTEXT,
        NOW,
      ),
      'AUTH_1003',
    )
    expect(error.captchaRequired).toBe(true)
    // 验证码没过就不该去比对口令
    expect(harness.passwordVerify).not.toHaveBeenCalled()
  })

  it('失败次数未达阈值时不要求验证码', async () => {
    const harness = buildHarness()
    await harness.attempts.save('INTERNAL', 'luoxiaolin', { failureCount: 2, lockedUntil: null })

    await harness.service.login(
      { audience: 'internal', account: 'luoxiaolin', password: 'Wfx@2026' },
      CONTEXT,
      NOW,
    )
    expect(harness.captchaVerify).not.toHaveBeenCalled()
  })

  it('失败满 8 次锁定，并发出锁定事件', async () => {
    const harness = buildHarness()
    harness.passwordVerify.mockResolvedValue(false)
    await harness.attempts.save('INTERNAL', 'luoxiaolin', { failureCount: 7, lockedUntil: null })

    await expectBizError(
      harness.service.login(
        { audience: 'internal', account: 'luoxiaolin', password: 'wrong', captchaId: 'c', captchaCode: 'X' },
        CONTEXT,
        NOW,
      ),
      'AUTH_1001',
    )

    expect(harness.publish).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'auth.session.locked' }),
    )
    expect((await harness.attempts.find('INTERNAL', 'luoxiaolin'))?.lockedUntil).not.toBeNull()
  })

  it('锁定窗口内直接 AUTH_1005', async () => {
    const harness = buildHarness()
    await harness.attempts.save('INTERNAL', 'luoxiaolin', {
      failureCount: 8,
      lockedUntil: new Date(NOW.getTime() + 600_000),
    })

    const error = await expectBizError(
      harness.service.login(
        { audience: 'internal', account: 'luoxiaolin', password: 'Wfx@2026' },
        CONTEXT,
        NOW,
      ),
      'AUTH_1005',
    )
    expect(error.captchaRequired).toBe(true)
  })

  it('锁定窗口过期后自动放行', async () => {
    const harness = buildHarness()
    await harness.attempts.save('INTERNAL', 'luoxiaolin', {
      failureCount: 8,
      lockedUntil: new Date(NOW.getTime() - 1000),
    })

    await expect(
      harness.service.login(
        { audience: 'internal', account: 'luoxiaolin', password: 'Wfx@2026' },
        CONTEXT,
        NOW,
      ),
    ).resolves.toMatchObject({ accessToken: 'jwt-token' })
  })
})

describe('离职账号', () => {
  it('离职后账号停用，提示用户名已释放可由新员工重新申请', async () => {
    const harness = buildHarness({
      ...ACTIVE_USER,
      employmentStatus: 'LEFT',
      status: 'DISABLED',
      account: null,
      formerAccount: 'liwentao',
    })

    const error = await expectBizError(
      harness.service.login(
        { audience: 'internal', account: 'liwentao', password: 'Wfx@2026' },
        CONTEXT,
        NOW,
      ),
      'AUTH_1030',
    )
    expect(error.message).toContain('用户名已释放')
  })

  it('被停用（非离职）的账号同样拒绝登录', async () => {
    const harness = buildHarness({ ...ACTIVE_USER, status: 'DISABLED' })
    await expectBizError(
      harness.service.login(
        { audience: 'internal', account: 'luoxiaolin', password: 'Wfx@2026' },
        CONTEXT,
        NOW,
      ),
      'AUTH_1030',
    )
  })
})

describe('注销', () => {
  it('撤销当前会话的 token', async () => {
    const harness = buildHarness()
    await expect(harness.service.logout('jti-1', NOW)).resolves.toBeUndefined()
  })
})
