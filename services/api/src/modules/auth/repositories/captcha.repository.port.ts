export interface CaptchaRecord {
  id: string
  code: string
  expiresAt: Date
  consumedAt: Date | null
}

export interface CreateCaptchaInput {
  code: string
  expiresAt: Date
  ip: string | null
}

export interface CaptchaRepositoryPort {
  create(input: CreateCaptchaInput): Promise<CaptchaRecord>
  findById(id: string): Promise<CaptchaRecord | null>
  /** 一次性消费：并发下只有一个请求能消费成功 */
  consume(id: string, at: Date): Promise<boolean>
  deleteExpired(before: Date): Promise<number>
}

export const CAPTCHA_REPOSITORY = Symbol('CAPTCHA_REPOSITORY')
