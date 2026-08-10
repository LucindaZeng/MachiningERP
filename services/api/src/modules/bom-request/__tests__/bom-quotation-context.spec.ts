import { BomQuotationContextService } from '../services/bom-quotation-context.service'

import type { QuotationService } from '../../quotation'
import type { BomRequestPayloadDto } from '../dto/bom-request-payload.dto'

const DTO = {
  quotationId: 'Q1',
  quotationItemId: 'QI1',
  drawingVersionId: 'DV-FROM-FORM',
} as BomRequestPayloadDto

function build(quotation: unknown): BomQuotationContextService {
  return new BomQuotationContextService({
    load: jest.fn().mockResolvedValue(quotation),
  } as unknown as QuotationService)
}

describe('报价事实取自 quotation 模块的公开出口', () => {
  it('报价状态原样带出，供资格校验判定', async () => {
    const service = build({ status: 'EFFECTIVE', items: [{ id: 'QI1', drawingVersionId: 'DV1' }] })
    const facts = await service.factsFor(DTO)

    expect(facts.quotationStatus).toBe('EFFECTIVE')
    expect(facts.quotationItemId).toBe('QI1')
  })

  it('图纸版本以报价行为准，而不是表单里传来的那个', async () => {
    const service = build({ status: 'EFFECTIVE', items: [{ id: 'QI1', drawingVersionId: 'DV1' }] })
    const facts = await service.factsFor(DTO)

    // 表单传的是 DV-FROM-FORM，但真相在报价行上——否则等于允许换图
    expect(facts.drawingVersionId).toBe('DV1')
  })

  it('报价行找不到时 quotationItemId 为 null，交给资格校验去拒', async () => {
    const service = build({ status: 'EFFECTIVE', items: [{ id: 'OTHER', drawingVersionId: 'DV1' }] })
    const facts = await service.factsFor(DTO)

    expect(facts.quotationItemId).toBeNull()
  })

  it('报价行没有图纸版本时回落到表单值，最终仍由资格校验判定', async () => {
    const service = build({
      status: 'EFFECTIVE',
      items: [{ id: 'QI1', drawingVersionId: null }],
    })
    const facts = await service.factsFor(DTO)

    expect(facts.drawingVersionId).toBe('DV-FROM-FORM')
  })

  it('未生效的报价状态照实带出，不在这里拦', async () => {
    const service = build({ status: 'DRAFT', items: [{ id: 'QI1', drawingVersionId: 'DV1' }] })
    const facts = await service.factsFor(DTO)

    expect(facts.quotationStatus).toBe('DRAFT')
  })

  it('报价没有任何行时不炸', async () => {
    const service = build({ status: 'EFFECTIVE', items: [] })
    const facts = await service.factsFor(DTO)

    expect(facts.quotationItemId).toBeNull()
    expect(facts.isSampleLine).toBe(false)
  })
})
