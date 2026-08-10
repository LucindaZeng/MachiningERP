import type { PrismaClient } from '@prisma/client'

/**
 * BOM 申请演示数据，覆盖三种典型局面：
 * 已提交待接收、工程建立中、BOM 好了但程序还没好（可下单但工程未齐）。
 *
 * 第三条是最容易被实现错的那一种——`bomReady=true` 而 `programReady=false`
 * 时状态必须停在 BOM_DONE，界面要分两栏显示，不得合并成「全部工程完成」。
 */
export const BOM_REQUESTS = [
  {
    docNo: 'BOMR202608090001',
    productName: '直线导轨安装座',
    drawingNo: 'MT-7719',
    drawingVersion: 'Rev.B',
    material: '45# 钢',
    surfaceTreatment: '发黑',
    inspection: '首件 + 抽检 AQL 1.0',
    packing: '气泡袋 + 纸箱 50 件/箱',
    quantity: '500',
    productionType: 'BATCH' as const,
    status: 'SUBMITTED' as const,
    bomReady: false,
    programReady: false,
    productCode: null,
  },
  {
    docNo: 'BOMR202608090002',
    productName: '12K Live Front Panel',
    drawingNo: 'BCM-2607',
    drawingVersion: 'REV A',
    material: 'AL6061-T6',
    surfaceTreatment: '阳极氧化',
    inspection: '全检',
    packing: 'EPE + 纸箱 100 件/箱',
    quantity: '1000',
    productionType: 'BATCH' as const,
    status: 'CLAIMED' as const,
    bomReady: false,
    programReady: false,
    productCode: null,
  },
  {
    docNo: 'BOMR202608090003',
    productName: '压铸模具 A 型腔',
    drawingNo: 'MLD-3301',
    drawingVersion: 'Rev.A',
    material: 'SKD11',
    surfaceTreatment: '氮化',
    inspection: '试模首件',
    packing: '木箱',
    quantity: '1',
    productionType: 'MOLD' as const,
    // BOM 已建立、程序未完成：可下单，但工程未齐——两个开关必须分别显示
    status: 'BOM_DONE' as const,
    bomReady: true,
    programReady: false,
    productCode: '1901010001',
  },
] as const

export async function seedBomRequests(prisma: PrismaClient): Promise<void> {
  const customer = await prisma.customer.findFirst({ orderBy: { code: 'asc' } })
  if (!customer) return

  for (const item of BOM_REQUESTS) {
    const existing = await prisma.bomRequest.findUnique({ where: { docNo: item.docNo } })
    if (existing) continue

    await prisma.bomRequest.create({
      data: {
        ...item,
        customerId: customer.id,
        ownerUserCode: 'WFX-2018-0042',
        submittedAt: new Date('2026-08-09T01:00:00Z'),
        createdBy: 'SEED',
      },
    })
  }
}
