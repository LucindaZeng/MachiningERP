import { BizError } from '../../../common/errors/biz-error'
import { DocNumberService } from '../services/doc-number.service'

import type {
  DocNumberRepositoryPort,
  DocNumberRuleRecord,
} from '../repositories/doc-number.repository.port'

class FakeDocNumberRepository implements DocNumberRepositoryPort {
  readonly sequences = new Map<string, number>()

  constructor(private readonly rules: Record<string, DocNumberRuleRecord>) {}

  async findRule(docType: string): Promise<DocNumberRuleRecord | null> {
    return this.rules[docType] ?? null
  }

  async nextSequence(docType: string, periodKey: string): Promise<number> {
    const key = `${docType}#${periodKey}`
    const next = (this.sequences.get(key) ?? 0) + 1
    this.sequences.set(key, next)
    return next
  }
}

const ACR_RULE: DocNumberRuleRecord = {
  docType: 'ACR',
  prefix: 'ACR',
  datePattern: 'yyyyMMdd',
  padding: 4,
  separator: '',
  resetPolicy: 'DAILY',
}

describe('DocNumberService', () => {
  it('同一周期内序号连续', async () => {
    const service = new DocNumberService(new FakeDocNumberRepository({ ACR: ACR_RULE }))
    const at = new Date(2026, 7, 8)

    expect(await service.next('ACR', at)).toBe('ACR202608080001')
    expect(await service.next('ACR', at)).toBe('ACR202608080002')
  })

  it('跨周期重新从 1 开始', async () => {
    const service = new DocNumberService(new FakeDocNumberRepository({ ACR: ACR_RULE }))

    expect(await service.next('ACR', new Date(2026, 7, 8))).toBe('ACR202608080001')
    expect(await service.next('ACR', new Date(2026, 7, 9))).toBe('ACR202608090001')
  })

  it('未配置编号规则时抛 BizError，而不是发出错号', async () => {
    const service = new DocNumberService(new FakeDocNumberRepository({}))

    await expect(service.next('QTN')).rejects.toBeInstanceOf(BizError)
    await expect(service.next('QTN')).rejects.toThrow(/未配置单据编号规则：QTN/)
  })

  it('不传时间时默认取当前时间', async () => {
    const service = new DocNumberService(new FakeDocNumberRepository({ ACR: ACR_RULE }))
    await expect(service.next('ACR')).resolves.toMatch(/^ACR\d{8}0001$/)
  })
})
