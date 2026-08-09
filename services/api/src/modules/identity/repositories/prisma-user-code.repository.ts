import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type { UserCodeRepositoryPort } from './user-code.repository.port'


const UNIQUE_VIOLATION = 'P2002'

@Injectable()
export class PrismaUserCodeRepository implements UserCodeRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async isIssued(code: string): Promise<boolean> {
    const found = await this.prisma.issuedUserCode.findUnique({ where: { code } })
    return found !== null
  }

  async tryIssue(code: string, source: string, note?: string | null): Promise<boolean> {
    try {
      await this.prisma.issuedUserCode.create({ data: { code, source, note: note ?? null } })
      return true
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        return false
      }
      throw error
    }
  }
}
