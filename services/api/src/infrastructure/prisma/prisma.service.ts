import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

/**
 * Prisma 客户端的唯一持有者。
 * 铁律：只有各模块的 `repositories/` 允许注入本服务，service 与 controller 一律不得直接使用
 * （由 eslint `no-restricted-imports` 与 tools/check-module-boundaries.mjs 双重强制）。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit(): Promise<void> {
    await this.$connect()
    this.logger.log('Prisma 已连接数据库')
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
