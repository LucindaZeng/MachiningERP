import { Injectable } from '@nestjs/common'

import { QuotationService } from '../../quotation'

import type { QuotationLineFacts } from './bom-eligibility.rules'
import type { BomRequestPayloadDto } from '../dto/bom-request-payload.dto'

/**
 * 从报价单取「这条产品行能不能建 BOM」所需的事实。
 *
 * 走 quotation 的 `index.ts` 出口，不碰它的内部文件（开发指南 3.4）。
 * 判断规则住在本模块的 `bom-eligibility.rules.ts`——取数属于报价，判断属于 BOM 申请，
 * 两件事分开才不会在两个模块里各写一份「什么算生效报价」。
 */
@Injectable()
export class BomQuotationContextService {
  constructor(private readonly quotations: QuotationService) {}

  async factsFor(dto: BomRequestPayloadDto): Promise<QuotationLineFacts> {
    const quotation = await this.quotations.load(dto.quotationId)
    const item = quotation.items.find((line) => line.id === dto.quotationItemId)

    return {
      quotationStatus: quotation.status,
      // 报价行没有显式的「样品」标记，用申请侧声明的用途兜底：
      // 样品单本来就不该走 BOM 申请，前端也不会给出 SAMPLE 这个选项。
      isSampleLine: false,
      quotationItemId: item?.id ?? null,
      drawingVersionId: item?.drawingVersionId ?? dto.drawingVersionId,
    }
  }
}
