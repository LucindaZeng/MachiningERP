import { PrismaClient } from '@prisma/client'

import { seedBaseData } from './seeds/base-data.seed'
import { seedBomRequests } from './seeds/bom-requests.seed'
import { seedCustomers } from './seeds/customers.seed'
import { seedDepartments } from './seeds/departments.seed'
import { seedDocNumberRules } from './seeds/doc-number-rules.seed'
import { seedMaterialPrices } from './seeds/material-prices.seed'
import { seedPermissions } from './seeds/permissions.seed'
import { seedPreviewSamples } from './seeds/preview-samples.seed'
import { seedRoles } from './seeds/roles.seed'
import { seedShipments } from './seeds/shipments.seed'
import { seedUsers } from './seeds/users.seed'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  console.log('· 部门（十三部门）')
  await seedDepartments(prisma)

  console.log('· 权限点')
  await seedPermissions(prisma)

  console.log('· 角色与角色-权限矩阵')
  await seedRoles(prisma)

  console.log('· 公司基础资料（工艺 / 仓库 / 车间，取自 example xls）')
  await seedBaseData(prisma)

  console.log('· 单据编号规则')
  await seedDocNumberRules(prisma)

  console.log('· 演示账号（与前端 mock 账号一致）')
  await seedUsers(prisma)

  console.log('· 演示客户（港澳台 / 国外 / 国内三种口径）')
  await seedCustomers(prisma)

  console.log('· 原材料价格表与当日汇率')
  await seedMaterialPrices(prisma)

  console.log('· BOM 申请演示数据（含 BOM 好了但程序未好的那一档）')
  await seedBomRequests(prisma)

  console.log('· 出货与客户对账单演示数据（含尾数未处置与差异需说明两种局面）')
  await seedShipments(prisma)

  console.log('· 在线预览样例文件（图纸版本 + 客户订单原件）')
  await seedPreviewSamples(prisma)

  console.log('种子数据写入完成。')
}

main()
  .catch((error: unknown) => {
    console.error('种子数据写入失败：', error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
