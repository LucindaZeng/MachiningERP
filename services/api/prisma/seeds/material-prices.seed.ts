import type { PrismaClient } from '@prisma/client'

const yuan = (value: number): bigint => BigInt(Math.round(value * 100))
const day = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

/**
 * 原材料价格表。取价规则是「不晚于报价日期的最新一条」，
 * 所以这里特意给 AL6061-T6 板料排了三个生效日期，
 * 便于验证历史成本分析不会被今天的价格改写。
 * 29 元/KG 这一档与 example/成本分析/CNC成本分析.xls 的口径一致。
 */
export const MATERIAL_PRICES = [
  { material: 'AL6061-T6', shape: '板料', unitPriceMinor: yuan(27), effectiveFrom: day('2026-01-01'), source: '供应商报价' },
  { material: 'AL6061-T6', shape: '板料', unitPriceMinor: yuan(29), effectiveFrom: day('2026-04-01'), source: '供应商报价' },
  { material: 'AL6061-T6', shape: '型材', unitPriceMinor: yuan(31), effectiveFrom: day('2026-04-01'), source: '供应商报价' },
  { material: 'AL6061', shape: '型材', unitPriceMinor: yuan(29), effectiveFrom: day('2026-04-01'), source: '供应商报价' },
  { material: 'AL6061', shape: '板料', unitPriceMinor: yuan(29), effectiveFrom: day('2026-04-01'), source: '供应商报价' },
  { material: 'AL6063', shape: '型材', unitPriceMinor: yuan(28), effectiveFrom: day('2026-04-01'), source: '供应商报价' },
  { material: 'SUS304', shape: '板料', unitPriceMinor: yuan(52), effectiveFrom: day('2026-04-01'), source: '供应商报价' },
  { material: 'SUS316L', shape: '棒料', unitPriceMinor: yuan(68), effectiveFrom: day('2026-04-01'), source: '供应商报价' },
  { material: 'SKD11', shape: '棒料', unitPriceMinor: yuan(86), effectiveFrom: day('2026-04-01'), source: '供应商报价' },
  { material: 'C3604', shape: '棒料', unitPriceMinor: yuan(64), effectiveFrom: day('2026-04-01'), source: '供应商报价' },
] as const

/** 当日汇率。国外报价按此换算并在报价版本上落快照。 */
export const EXCHANGE_RATES = [
  { base: 'CNY', quote: 'USD', rateMicros: 138_900n, quotedOn: day('2026-08-01') },
  { base: 'CNY', quote: 'USD', rateMicros: 139_500n, quotedOn: day('2026-08-08') },
  { base: 'CNY', quote: 'EUR', rateMicros: 127_000n, quotedOn: day('2026-08-08') },
  { base: 'CNY', quote: 'HKD', rateMicros: 1_092_000n, quotedOn: day('2026-08-08') },
] as const

export async function seedMaterialPrices(prisma: PrismaClient): Promise<void> {
  for (const price of MATERIAL_PRICES) {
    const existing = await prisma.materialPrice.findFirst({
      where: { material: price.material, shape: price.shape, effectiveFrom: price.effectiveFrom },
    })
    if (existing) continue

    await prisma.materialPrice.create({ data: { ...price, currency: 'CNY', createdBy: 'SEED' } })
  }

  for (const rate of EXCHANGE_RATES) {
    await prisma.exchangeRate.upsert({
      where: { base_quote_quotedOn: { base: rate.base, quote: rate.quote, quotedOn: rate.quotedOn } },
      create: { ...rate, createdBy: 'SEED' },
      update: { rateMicros: rate.rateMicros },
    })
  }
}
