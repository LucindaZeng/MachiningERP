import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CaptchaRecord,
  CaptchaRepositoryPort,
  CreateCaptchaInput,
} from './captcha.repository.port'


@Injectable()
export class PrismaCaptchaRepository implements CaptchaRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateCaptchaInput): Promise<CaptchaRecord> {
    return this.prisma.captchaChallenge.create({ data: { ...input } })
  }

  findById(id: string): Promise<CaptchaRecord | null> {
    return this.prisma.captchaChallenge.findUnique({ where: { id } })
  }

  async consume(id: string, at: Date): Promise<boolean> {
    const result = await this.prisma.captchaChallenge.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: at } },
      data: { consumedAt: at },
    })
    return result.count === 1
  }

  async deleteExpired(before: Date): Promise<number> {
    const result = await this.prisma.captchaChallenge.deleteMany({
      where: { expiresAt: { lt: before } },
    })
    return result.count
  }
}
