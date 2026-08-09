import { SYSTEM_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import {
  DOC_NUMBER_REPOSITORY,
  type DocNumberRepositoryPort,
} from '../repositories/doc-number.repository.port'

import { formatDocNumber, periodKeyFor } from './doc-number-format'

/**
 * 统一单据编号（development-guide「统一单据编号、状态机基类」）。
 * 所有模块通过 docType 取号，规则改动只影响 doc_number_rules 表。
 */
@Injectable()
export class DocNumberService {
  constructor(
    @Inject(DOC_NUMBER_REPOSITORY)
    private readonly repository: DocNumberRepositoryPort,
  ) {}

  async next(docType: string, at: Date = new Date()): Promise<string> {
    const rule = await this.repository.findRule(docType)
    if (!rule) {
      throw new BizError(SYSTEM_ERRORS.UNKNOWN, {
        message: `未配置单据编号规则：${docType}，请先在 doc_number_rules 中维护`,
      })
    }

    const periodKey = periodKeyFor(rule.resetPolicy, at)
    const sequence = await this.repository.nextSequence(docType, periodKey)

    return formatDocNumber(
      {
        prefix: rule.prefix,
        datePattern: rule.datePattern,
        padding: rule.padding,
        separator: rule.separator,
        resetPolicy: rule.resetPolicy,
      },
      sequence,
      at,
    )
  }
}
