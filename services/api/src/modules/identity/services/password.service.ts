import { AUTH_ERRORS } from '@machining-erp/shared'
import { Injectable } from '@nestjs/common'
import bcrypt from 'bcryptjs'

import { BizError } from '../../../common/errors/biz-error'
import { MIN_PASSWORD_LENGTH } from '../constants/account-rules'

const SALT_ROUNDS = 12

/** 口令散列与校验的唯一出口；禁止在别处直接调用 bcrypt。 */
@Injectable()
export class PasswordService {
  assertStrength(password: string, confirmPassword?: string): void {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new BizError(AUTH_ERRORS.PASSWORD_TOO_SHORT)
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      throw new BizError(AUTH_ERRORS.PASSWORD_MISMATCH)
    }
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS)
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }
}
