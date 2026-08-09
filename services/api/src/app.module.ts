import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'

import { BizExceptionFilter } from './common/errors/biz-exception.filter'
import { ResponseEnvelopeInterceptor } from './common/http/response-envelope.interceptor'
import { traceContextMiddleware } from './common/http/trace-context'
import { APP_CONFIG_KEY, loadAppConfig } from './config/app-config'
import { PrismaModule } from './infrastructure/prisma/prisma.module'
import { AuthModule, JwtAuthGuard, PermissionsGuard } from './modules/auth'
import { IdentityModule } from './modules/identity'
import { MasterdataModule } from './modules/masterdata'
import { OrgModule } from './modules/org'
import { QuotationModule } from './modules/quotation'
import { AuditModule } from './platform/audit'
import { EventsModule } from './platform/events'
import { NotificationModule } from './platform/notification'
import { NumberingModule } from './platform/numbering'
import { TimelineModule } from './platform/timeline'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => ({ [APP_CONFIG_KEY]: loadAppConfig() })],
    }),
    PrismaModule,

    /* 平台共享能力：编号、审计、节点计时、领域事件、通知 —— 业务模块一律复用 */
    NumberingModule,
    AuditModule,
    TimelineModule,
    EventsModule,
    NotificationModule,

    /* 业务模块 */
    OrgModule,
    IdentityModule,
    AuthModule,
    MasterdataModule,
    QuotationModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: BizExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(traceContextMiddleware).forRoutes('*')
  }
}
