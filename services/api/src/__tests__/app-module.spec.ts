import { Test } from '@nestjs/testing'

import { AppModule } from '../app.module'
import { PrismaService } from '../infrastructure/prisma/prisma.service'
import { AccessTokenService } from '../modules/auth'
import { AccountRequestService, UserDirectoryService } from '../modules/identity'
import { DepartmentService } from '../modules/org'
import { DocNumberService } from '../platform/numbering'

/**
 * 依赖注入接线的回归测试。
 *
 * 背景：NestJS 靠 `emitDecoratorMetadata` 读构造函数参数类型，被注入的类必须是**值导入**；
 * 一旦某次自动修复把它改成 `import type`，编译期完全看不出问题，运行期才在启动时炸。
 * 这里编译整个 AppModule（只替换 PrismaService，不真连数据库）来兜住这类回归。
 */
describe('AppModule 依赖注入', () => {
  it('全量模块可以完成装配', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile()

    // 平台能力
    expect(moduleRef.get(DocNumberService)).toBeInstanceOf(DocNumberService)
    // 业务模块
    expect(moduleRef.get(DepartmentService)).toBeInstanceOf(DepartmentService)
    expect(moduleRef.get(UserDirectoryService)).toBeInstanceOf(UserDirectoryService)
    expect(moduleRef.get(AccountRequestService)).toBeInstanceOf(AccountRequestService)
    expect(moduleRef.get(AccessTokenService)).toBeInstanceOf(AccessTokenService)

    await moduleRef.close()
  })
})
