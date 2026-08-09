
import { ConfigService } from '@nestjs/config'

import { loadAppConfig } from '../../../config/app-config'
import { CaptchaService } from '../services/captcha.service'

import type {
  CaptchaRecord,
  CaptchaRepositoryPort,
  CreateCaptchaInput,
} from '../repositories/captcha.repository.port'

class FakeCaptchaRepository implements CaptchaRepositoryPort {
  readonly rows = new Map<string, CaptchaRecord>()
  private sequence = 0

  async create(input: CreateCaptchaInput): Promise<CaptchaRecord> {
    this.sequence += 1
    const record: CaptchaRecord = {
      id: `cap-${this.sequence}`,
      code: input.code,
      expiresAt: input.expiresAt,
      consumedAt: null,
    }
    this.rows.set(record.id, record)
    return record
  }

  async findById(id: string): Promise<CaptchaRecord | null> {
    return this.rows.get(id) ?? null
  }

  async consume(id: string, at: Date): Promise<boolean> {
    const row = this.rows.get(id)
    if (!row || row.consumedAt !== null || row.expiresAt.getTime() <= at.getTime()) return false
    row.consumedAt = at
    return true
  }

  async deleteExpired(): Promise<number> {
    return 0
  }
}

function buildService(): { service: CaptchaService; repository: FakeCaptchaRepository } {
  const repository = new FakeCaptchaRepository()
  const config = {
    getOrThrow: () => loadAppConfig({ CAPTCHA_TTL_SECONDS: '120' } as NodeJS.ProcessEnv),
  } as unknown as ConfigService
  return { service: new CaptchaService(config, repository), repository }
}

const NOW = new Date('2026-08-08T10:00:00Z')

describe('图形验证码', () => {
  it('签发返回可直接用于 <img src> 的 data URL', async () => {
    const { service } = buildService()
    const challenge = await service.issue('127.0.0.1', NOW)

    expect(challenge.captchaId).toBe('cap-1')
    expect(challenge.expiresIn).toBe(120)
    expect(challenge.imageUrl).toMatch(/^data:image\/svg\+xml;base64,/)
  })

  it('答案存为大写，校验大小写不敏感', async () => {
    const { service, repository } = buildService()
    const challenge = await service.issue(null, NOW)
    const answer = repository.rows.get(challenge.captchaId)?.code ?? ''

    expect(answer).toBe(answer.toUpperCase())
    await expect(service.verify(challenge.captchaId, answer.toLowerCase(), NOW)).resolves.toBe(true)
  })

  it('缺少 id 或 code 一律不通过', async () => {
    const { service } = buildService()
    await expect(service.verify(undefined, 'ABCD', NOW)).resolves.toBe(false)
    await expect(service.verify('cap-1', undefined, NOW)).resolves.toBe(false)
  })

  it('不存在的挑战不通过', async () => {
    const { service } = buildService()
    await expect(service.verify('missing', 'ABCD', NOW)).resolves.toBe(false)
  })

  it('过期后不通过', async () => {
    const { service } = buildService()
    const challenge = await service.issue(null, NOW)
    const later = new Date(NOW.getTime() + 121_000)
    await expect(service.verify(challenge.captchaId, 'ABCD', later)).resolves.toBe(false)
  })

  it('答错也会消费掉，防止对同一张图暴力试错', async () => {
    const { service, repository } = buildService()
    const challenge = await service.issue(null, NOW)
    const answer = repository.rows.get(challenge.captchaId)?.code ?? ''

    await expect(service.verify(challenge.captchaId, 'WRONG-ANSWER', NOW)).resolves.toBe(false)
    expect(repository.rows.get(challenge.captchaId)?.consumedAt).not.toBeNull()
    await expect(service.verify(challenge.captchaId, answer, NOW)).resolves.toBe(false)
  })

  it('一次性消费：同一答案不能用第二次', async () => {
    const { service, repository } = buildService()
    const challenge = await service.issue(null, NOW)
    const answer = repository.rows.get(challenge.captchaId)?.code ?? ''

    await expect(service.verify(challenge.captchaId, answer, NOW)).resolves.toBe(true)
    await expect(service.verify(challenge.captchaId, answer, NOW)).resolves.toBe(false)
  })
})

describe('默认取当前时间', () => {
  it('issue / verify 不传 now 时使用系统时钟', async () => {
    const { service, repository } = buildService()
    const challenge = await service.issue('127.0.0.1')
    const answer = repository.rows.get(challenge.captchaId)?.code ?? ''

    await expect(service.verify(challenge.captchaId, answer)).resolves.toBe(true)
  })
})
