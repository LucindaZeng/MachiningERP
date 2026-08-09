import bcrypt from 'bcryptjs'

import type { PrismaClient } from '@prisma/client'

interface UserSeed {
  userCode: string
  account: string | null
  displayName: string
  departmentCode: string
  roleCodes: string[]
  employmentStatus: 'ACTIVE' | 'LEFT'
  /** 离职后用户名释放：account 置空，formerAccount 保留原用户名用于提示 */
  formerAccount?: string
  leftAt?: string
}

const DEFAULT_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Wfx@2026'

/**
 * 演示账号，与 apps/web `src/api/mock/mock-accounts.ts` 一一对应，
 * 便于把前端 VITE_USE_MOCK 从 true 切到 false 后行为一致。
 *
 * `liwentao` 是关键用例：**离职后用户名已释放**（account = NULL，formerAccount 保留），
 * 因此新员工可以重新登记这个用户名，而其唯一编码 WFX-2022-0208 永不回收。
 */
export const USERS: UserSeed[] = [
  { userCode: 'WFX-2019-0001', account: 'admin', displayName: '系统管理员', departmentCode: 'IT', roleCodes: ['SYS_ADMIN'], employmentStatus: 'ACTIVE' },
  { userCode: 'WFX-2016-0007', account: 'lucinda', displayName: '罗经理', departmentCode: 'GM', roleCodes: ['EXECUTIVE'], employmentStatus: 'ACTIVE' },
  { userCode: 'WFX-2018-0042', account: 'luoxiaolin', displayName: '罗晓琳', departmentCode: 'SALES', roleCodes: ['SALES_MANAGER'], employmentStatus: 'ACTIVE' },
  { userCode: 'WFX-2020-0088', account: 'chenzhiqiang', displayName: '陈志强', departmentCode: 'SALES', roleCodes: ['SALES_REP'], employmentStatus: 'ACTIVE' },
  { userCode: 'WFX-2019-0113', account: 'wugong', displayName: '吴工', departmentCode: 'ENG', roleCodes: ['QUOTE_ENGINEER'], employmentStatus: 'ACTIVE' },
  { userCode: 'WFX-2021-0134', account: 'pmc01', displayName: '陈计划', departmentCode: 'PMC', roleCodes: ['PMC_PLANNER'], employmentStatus: 'ACTIVE' },
  { userCode: 'WFX-2022-0208', account: null, formerAccount: 'liwentao', leftAt: '2026-05-31', displayName: '李文涛', departmentCode: 'QC', roleCodes: [], employmentStatus: 'LEFT' },
]

export async function seedUsers(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12)
  const departments = await prisma.department.findMany({ select: { id: true, code: true } })
  const departmentByCode = new Map(departments.map((item) => [item.code, item.id]))

  for (const user of USERS) {
    await prisma.issuedUserCode.upsert({
      where: { code: user.userCode },
      create: { code: user.userCode, source: 'SEED', note: user.displayName },
      update: {},
    })

    const leftAt = user.leftAt ? new Date(`${user.leftAt}T00:00:00Z`) : null
    const saved = await prisma.user.upsert({
      where: { userCode: user.userCode },
      create: {
        userCode: user.userCode,
        account: user.account,
        formerAccount: user.formerAccount ?? null,
        accountReleasedAt: user.employmentStatus === 'LEFT' ? leftAt : null,
        audience: 'INTERNAL',
        displayName: user.displayName,
        departmentId: departmentByCode.get(user.departmentCode) ?? null,
        passwordHash,
        status: user.employmentStatus === 'LEFT' ? 'DISABLED' : 'ACTIVE',
        employmentStatus: user.employmentStatus,
        leftAt,
        createdBy: 'SEED',
      },
      update: { displayName: user.displayName, passwordHash },
    })

    if (user.roleCodes.length === 0) continue

    const roles = await prisma.role.findMany({
      where: { code: { in: user.roleCodes } },
      select: { id: true },
    })
    await prisma.userRole.createMany({
      data: roles.map((role) => ({ userId: saved.id, roleId: role.id, grantedBy: 'SEED' })),
      skipDuplicates: true,
    })
  }
}
