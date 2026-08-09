import 'reflect-metadata'

import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'
import { APP_CONFIG_KEY, type AppConfig } from './config/app-config'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false })
  const config = app.get(ConfigService).getOrThrow<AppConfig>(APP_CONFIG_KEY)

  app.setGlobalPrefix(config.globalPrefix)
  app.enableCors({ origin: true, credentials: true })
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  )

  const openapi = new DocumentBuilder()
    .setTitle('MachiningERP API')
    .setDescription('接口规范见 docs/api/api-conventions.md')
    .setVersion('v1')
    .addBearerAuth()
    .build()
  SwaggerModule.setup(`${config.globalPrefix}/docs`, app, SwaggerModule.createDocument(app, openapi))

  await app.listen(config.port)
  new Logger('Bootstrap').log(
    `API 已启动：http://localhost:${config.port}/${config.globalPrefix}（文档 /docs）`,
  )
}

void bootstrap()
