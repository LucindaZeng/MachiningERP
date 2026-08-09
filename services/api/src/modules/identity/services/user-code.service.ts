import { SYSTEM_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { DOC_TYPES, DocNumberService  } from '../../../platform/numbering'
import {
  USER_CODE_REPOSITORY,
  type UserCodeRepositoryPort,
} from '../repositories/user-code.repository.port'


const MAX_ATTEMPTS = 10

/**
 * 唯一编码发放（业务规格「唯一编码规则」「用户名释放规则」）。
 *
 * 铁律：编码在**注册那一刻**生成，终身不变、**永不复用**。
 * 用户名离职后释放可被他人再次登记，但历史单据、审批与审计记录一律指向唯一编码，
 * 因此换人不会让历史数据错乱。
 */
@Injectable()
export class UserCodeService {
  constructor(
    private readonly docNumber: DocNumberService,
    @Inject(USER_CODE_REPOSITORY)
    private readonly repository: UserCodeRepositoryPort,
  ) {}

  async issue(source = 'ACCOUNT_REQUEST', note?: string | null): Promise<string> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const candidate = await this.docNumber.next(DOC_TYPES.USER_CODE)
      const issued = await this.repository.tryIssue(candidate, source, note)
      if (issued) {
        return candidate
      }
    }

    throw new BizError(SYSTEM_ERRORS.UNKNOWN, {
      message: `连续 ${MAX_ATTEMPTS} 次取到已发放过的唯一编码，请检查 issued_user_codes 与编号规则`,
    })
  }
}
