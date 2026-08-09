import { BizError } from '../../../common/errors/biz-error'
import { PasswordService } from '../services/password.service'

describe('口令强度校验', () => {
  const service = new PasswordService()

  it('至少 8 位', () => {
    expect(() => service.assertStrength('Wfx@2026')).not.toThrow()
    expect(() => service.assertStrength('short')).toThrow(BizError)
    expect(() => service.assertStrength('')).toThrow(BizError)
  })

  it('两次输入必须一致', () => {
    expect(() => service.assertStrength('Wfx@2026', 'Wfx@2026')).not.toThrow()
    expect(() => service.assertStrength('Wfx@2026', 'Different1')).toThrow(/两次输入的密码不一致/)
  })

  it('不传确认密码时跳过一致性校验', () => {
    expect(() => service.assertStrength('Wfx@2026', undefined)).not.toThrow()
  })
})

describe('口令散列', () => {
  const service = new PasswordService()

  it('散列后不等于明文，且可以校验回来', async () => {
    const hash = await service.hash('Wfx@2026')

    expect(hash).not.toBe('Wfx@2026')
    expect(hash.startsWith('$2')).toBe(true)
    await expect(service.verify('Wfx@2026', hash)).resolves.toBe(true)
    await expect(service.verify('wrong', hash)).resolves.toBe(false)
  })

  it('同一明文两次散列结果不同（加盐）', async () => {
    const [first, second] = await Promise.all([service.hash('Wfx@2026'), service.hash('Wfx@2026')])
    expect(first).not.toBe(second)
  })
})
