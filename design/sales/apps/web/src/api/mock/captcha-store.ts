import { renderCaptchaSvg } from './captcha-image'
import type { CaptchaChallenge } from '@/types/auth.types'

/** 去掉易混淆字符（0/O、1/I/l）后的字符集 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const TTL_SECONDS = 120

const issued = new Map<string, { code: string; expiresAt: number }>()

export function issueCaptcha(): CaptchaChallenge {
  const captchaId = `CAP${Date.now().toString(36).toUpperCase()}${randomSuffix()}`
  const code = Array.from({ length: 4 }, pickChar).join('')

  issued.set(captchaId, { code, expiresAt: Date.now() + TTL_SECONDS * 1000 })

  return { captchaId, imageUrl: renderCaptchaSvg(code), expiresIn: TTL_SECONDS }
}

/** 一次性校验：无论成功失败都作废，避免重放。 */
export function verifyCaptcha(captchaId: string | undefined, input: string | undefined): boolean {
  if (!captchaId || !input) {
    return false
  }

  const record = issued.get(captchaId)
  issued.delete(captchaId)

  if (!record || record.expiresAt < Date.now()) {
    return false
  }

  return record.code.toUpperCase() === input.trim().toUpperCase()
}

function pickChar(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
}

function randomSuffix(): string {
  return Math.floor(Math.random() * 1e4)
    .toString()
    .padStart(4, '0')
}
