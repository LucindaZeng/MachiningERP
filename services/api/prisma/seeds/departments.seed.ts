import type { PrismaClient } from '@prisma/client'

/**
 * 十三部门（docs/product/department-operating-model.md 第 8 行口径）。
 * 公司实际命名：企划课 = PMC、外协课 = 委外。
 */
export const DEPARTMENTS = [
  { code: 'GM', name: '总经办', shortName: '总经办', sortOrder: 10 },
  { code: 'FIN', name: '财务部', shortName: '财务', sortOrder: 20 },
  { code: 'SALES', name: '业务部', shortName: '业务', sortOrder: 30 },
  { code: 'ENG', name: '工程部', shortName: '工程', sortOrder: 40 },
  { code: 'PMC', name: 'PMC', shortName: '企划课', sortOrder: 50 },
  { code: 'PUR', name: '采购', shortName: '采购', sortOrder: 60 },
  { code: 'OUT', name: '委外', shortName: '外协课', sortOrder: 70 },
  { code: 'WH', name: '仓库', shortName: '仓库', sortOrder: 80 },
  { code: 'PROD', name: '生产部', shortName: '生产', sortOrder: 90 },
  { code: 'QC', name: '品质部', shortName: '品质', sortOrder: 100 },
  { code: 'POST', name: '后工序部', shortName: '后工序', sortOrder: 110 },
  { code: 'ADM', name: '行政', shortName: '行政', sortOrder: 120 },
  { code: 'IT', name: 'IT', shortName: '信息部', sortOrder: 130 },
] as const

export async function seedDepartments(prisma: PrismaClient): Promise<void> {
  for (const department of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: department.code },
      create: { ...department, createdBy: 'SEED' },
      update: { name: department.name, shortName: department.shortName, sortOrder: department.sortOrder },
    })
  }
}
