import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { APP_CONFIG_KEY, type AppConfig } from '../../../config/app-config'
import {
  CAPTCHA_REPOSITORY,
  type CaptchaRepositoryPort,
} from '../repositories/captcha.repository.port'

import { createCaptchaArtifact } from './captcha-image'

import type { CaptchaChallengeContract } from '@machining-erp/shared'

/** 图形验证码：服务端持有答案，一次性消费，过期自动失效。 */
@Injectable()
export class CaptchaService {
  constructor(
    private readonly config: ConfigService,
    @Inject(CAPTCHA_REPOSITORY) private readonly repository: CaptchaRepositoryPort,
  ) {}

  async issue(ip: string | null, now: Date = new Date()): Promise<CaptchaChallengeContract> {
    const ttlSeconds = this.authConfig().captchaTtlSeconds
    const artifact = createCaptchaArtifact()

    const record = await this.repository.create({
      code: artifact.code.toUpperCase(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      ip,
    })

    return { captchaId: record.id, imageUrl: artifact.imageUrl, expiresIn: ttlSeconds }
  }

  /** 校验并消费；任何一步不满足都返回 false，由调用方转成 AUTH_1003。 */
  async verify(
    captchaId: string | undefined,
    captchaCode: string | undefined,
    now: Date = new Date(),
  ): Promise<boolean> {
    if (!captchaId || !captchaCode) return false

    const record = await this.repository.findById(captchaId)
    if (!record || record.consumedAt !== null || record.expiresAt.getTime() <= now.getTime()) {
      return false
    }

    if (record.code !== captchaCode.trim().toUpperCase()) {
      // 答错也消费掉，防止对同一张图暴力试错
      await this.repository.consume(captchaId, now)
      return false
    }

    return this.repository.consume(captchaId, now)
  }

  private authConfig(): AppConfig['auth'] {
    return this.config.getOrThrow<AppConfig>(APP_CONFIG_KEY).auth
  }
}
