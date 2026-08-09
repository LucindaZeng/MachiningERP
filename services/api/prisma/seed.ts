import { PrismaClient } from '@prisma/client'

import { seedCustomers } from './seeds/customers.seed'
import { seedDepartments } from './seeds/departments.seed'
import { seedDocNumberRules } from './seeds/doc-number-rules.seed'
import { seedMaterialPrices } from './seeds/material-prices.seed'
import { seedPermissions } from './seeds/permissions.seed'
import { seedRoles } from './seeds/roles.seed'
import { seedUsers } from './seeds/users.seed'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  console.log('· 部门（十三部门）')
  await seedDepartments(prisma)

  console.log('· 权限点')
  await seedPermissions(prisma)

  console.log('· 角色与角色-权限矩阵')
  await seedRoles(prisma)

  console.log('· 单据编号规则')
  await seedDocNumberRules(prisma)

  console.log('· 演示账号（与前端 mock 账号一致）')
  await seedUsers(prisma)

  console.log('· 演示客户（香港代生产 / 国外 / 国内三种口径）')
  await seedCustomers(prisma)

  console.log('· 原材料价格表与当日汇率')
  await seedMaterialPrices(prisma)

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
