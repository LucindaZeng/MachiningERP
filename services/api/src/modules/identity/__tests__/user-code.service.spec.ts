import { BizError } from '../../../common/errors/biz-error'
import { DocNumberService } from '../../../platform/numbering'
import { UserCodeService } from '../services/user-code.service'

import { FakeUserCodeRepository } from './fakes'


function docNumberStub(codes: string[]): DocNumberService {
  let index = 0
  return {
    next: async () => {
      const code = codes[Math.min(index, codes.length - 1)] ?? 'WFX-2026-9999'
      index += 1
      return code
    },
  } as unknown as DocNumberService
}

describe('唯一编码发放', () => {
  it('正常发号并登记进台账', async () => {
    const repository = new FakeUserCodeRepository()
    const service = new UserCodeService(docNumberStub(['WFX-2026-0209']), repository)

    await expect(service.issue()).resolves.toBe('WFX-2026-0209')
    expect(repository.issued.has('WFX-2026-0209')).toBe(true)
  })

  it('编码永不复用：撞上已发放过的号就取下一个', async () => {
    const repository = new FakeUserCodeRepository()
    repository.issued.add('WFX-2026-0209')
    const service = new UserCodeService(
      docNumberStub(['WFX-2026-0209', 'WFX-2026-0210']),
      repository,
    )

    await expect(service.issue()).resolves.toBe('WFX-2026-0210')
  })

  it('连续 10 次都撞号则抛错，避免死循环', async () => {
    const repository = new FakeUserCodeRepository()
    repository.issued.add('WFX-2026-0209')
    const service = new UserCodeService(docNumberStub(['WFX-2026-0209']), repository)

    await expect(service.issue()).rejects.toBeInstanceOf(BizError)
    await expect(service.issue()).rejects.toThrow(/连续 10 次/)
  })

  it('两个人先后注册拿到互不相同的编码', async () => {
    const repository = new FakeUserCodeRepository()
    const service = new UserCodeService(
      docNumberStub(['WFX-2026-0209', 'WFX-2026-0210']),
      repository,
    )

    const first = await service.issue('ACCOUNT_REQUEST', '张三')
    const second = await service.issue('ACCOUNT_REQUEST', '李四')
    expect(first).not.toBe(second)
    expect(repository.issued.size).toBe(2)
  })
})
