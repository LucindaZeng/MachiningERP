import type { PrismaClient, SalesOrderLine } from '@prisma/client'

/**
 * 出货与对账演示数据，覆盖三种典型局面：
 *
 * 1. 已包装待出运，且**有尾数未处置** —— 结案时会被数量平衡校验拦下的那一种；
 * 2. 已开票，全部发齐、无尾数 —— 正常走完全程的那一种；
 * 3. 一张 DRAFT 对账单 —— 差异非零且已写说明，覆盖「差异必须说明」这条规则。
 *
 * 客户与订单沿用既有 seed，不另造：出货的每一行都必须挂在真实订单行上，
 * 造一份假的订单行等于把「行必须关联订单行」这条硬校验从演示数据里绕过去。
 */
const OWNER = 'WFX-2018-0042'

interface LineSeed {
  sequence: number
  orderLineId: string
  productName: string
  drawingNo: string
  itemCode: string | null
  batchNo: string
  orderedQty: string
  qualifiedQty: string
  packedQty: string
  shippedQty: string
  unitPriceMinor: bigint
}

function linesFor(orderLines: SalesOrderLine[], shortfall: string): LineSeed[] {
  return orderLines.slice(0, 2).map((line, index) => {
    const ordered = line.quantity.toString()
    // 第一行故意少发，留出尾数；其余行发齐
    const shipped = index === 0 ? subtract(ordered, shortfall) : ordered
    return {
      sequence: index + 1,
      orderLineId: line.id,
      productName: line.productName,
      drawingNo: line.drawingNo,
      itemCode: line.itemCode,
      batchNo: `B2607${String(index + 1).padStart(4, '0')}`,
      orderedQty: ordered,
      qualifiedQty: shipped,
      packedQty: shipped,
      shippedQty: shipped,
      unitPriceMinor: line.unitPriceMinor,
    }
  })
}

function subtract(left: string, right: string): string {
  return (Number(left) - Number(right)).toFixed(6)
}

export async function seedShipments(prisma: PrismaClient): Promise<void> {
  const order = await prisma.salesOrder.findFirst({
    where: { lines: { some: {} } },
    include: { lines: { orderBy: { sequence: 'asc' } } },
    orderBy: { docNo: 'asc' },
  })
  if (!order || order.lines.length === 0) return

  await seedShipment(prisma, order.id, order.customerId, order.currency, {
    docNo: 'SHP202608100001',
    status: 'PACKED',
    lines: linesFor(order.lines, '14'),
    packedAt: new Date('2026-08-10T07:20:00Z'),
  })

  await seedShipment(prisma, order.id, order.customerId, order.currency, {
    docNo: 'SHP202608100002',
    status: 'INVOICED',
    lines: linesFor(order.lines, '0'),
    packedAt: new Date('2026-08-02T02:10:00Z'),
    shippedAt: new Date('2026-08-03T01:30:00Z'),
    signedAt: new Date('2026-08-06T06:00:00Z'),
    invoicedAt: new Date('2026-08-07T02:00:00Z'),
    invoiceNo: 'INV-26-0771',
    carrier: 'DHL Global Forwarding',
    trackingNo: 'DHL-8871209934',
  })

  await seedStatement(prisma, order.customerId, order.currency)
}

interface ShipmentSeed {
  docNo: string
  status: 'PACKED' | 'INVOICED'
  lines: LineSeed[]
  packedAt?: Date
  shippedAt?: Date
  signedAt?: Date
  invoicedAt?: Date
  invoiceNo?: string
  carrier?: string
  trackingNo?: string
}

async function seedShipment(
  prisma: PrismaClient,
  orderId: string,
  customerId: string,
  currency: string,
  seed: ShipmentSeed,
): Promise<void> {
  const existing = await prisma.shipment.findUnique({ where: { docNo: seed.docNo } })
  if (existing) return

  const { lines, ...header } = seed
  await prisma.shipment.create({
    data: {
      ...header,
      orderId,
      customerId,
      currency,
      ownerUserCode: OWNER,
      createdBy: 'SEED',
      lines: {
        create: lines.map((line) => ({ ...line })),
      },
    },
  })
}

async function seedStatement(
  prisma: PrismaClient,
  customerId: string,
  currency: string,
): Promise<void> {
  const docNo = 'STM2026080001'
  const existing = await prisma.statement.findUnique({ where: { docNo } })
  if (existing) return

  await prisma.statement.create({
    data: {
      docNo,
      customerId,
      periodFrom: new Date('2026-07-01'),
      periodTo: new Date('2026-07-31'),
      currency,
      version: 1,
      openingBalanceMinor: 48_620_000n,
      shippedAmountMinor: 12_840_000n,
      invoicedAmountMinor: 12_840_000n,
      receivedAmountMinor: 3_000_000n,
      returnAmountMinor: 477_600n,
      closingBalanceMinor: 57_982_400n,
      // 差异非零，因此说明必填——发出这一步会校验
      differenceAmountMinor: 477_600n,
      differenceNote: '客户主张退货应先冲减，公司口径待返工结案后开红字',
      overdueAmountMinor: 12_680_000n,
      ownerUserCode: OWNER,
      createdBy: 'SEED',
      lines: {
        create: [
          {
            sequence: 1,
            occurredAt: new Date('2026-07-06'),
            type: 'SHIPMENT',
            docNo: 'SHP202607060046',
            productName: '导轨压板',
            quantity: '800',
            amountMinor: 3_184_000n,
            matched: true,
          },
          {
            sequence: 2,
            occurredAt: new Date('2026-07-06'),
            type: 'INVOICE',
            docNo: 'INV-26-0731',
            amountMinor: 3_184_000n,
            matched: true,
          },
          {
            sequence: 3,
            occurredAt: new Date('2026-07-20'),
            type: 'RECEIPT',
            docNo: 'RCP-26-0311',
            amountMinor: -3_000_000n,
            matched: true,
            remark: '部分回款，剩余按月结 90 天',
          },
          {
            sequence: 4,
            occurredAt: new Date('2026-07-26'),
            type: 'RETURN',
            docNo: 'RMA202607260009',
            productName: '导轨压板',
            quantity: '120',
            amountMinor: -477_600n,
            matched: false,
            remark: '差异来源：红字发票待返工结案后开具',
          },
        ],
      },
    },
  })
}
