import { DOC_NUMBER_RULES } from './doc-number-rules.seed'

import type { PrismaClient } from '@prisma/client'


interface CustomerSeed {
  code: string
  name: string
  shortName: string
  region: 'DOMESTIC' | 'OVERSEAS'
  country: string
  englishName?: string
  englishAddress?: string
  ownerName: string
  ownerPhone: string
  ownerEmail?: string
  salesUserCode: string
  taxNo?: string
  invoiceAddress: string
  bankAccount: string
  bankName: string
  paymentTerm: 'DEPOSIT_THEN_BALANCE' | 'CASH_BEFORE_SHIPMENT' | 'NET_30' | 'NET_60' | 'NET_90'
  depositBps?: number
  invoiceType: 'GENERAL' | 'SPECIAL'
  settlement: 'CASH' | 'NOTE'
  currency: string
  tradeTerm?: string
  level: string
  hkPricingEnabled?: boolean
  hkFactorBps?: number
  hkEffectiveFrom?: string
  hkChangeReason?: string
  creditLimitMinor: bigint
  creditUsedMinor: bigint
  arDays: number
  addresses: Array<{ label: string; receiver: string; phone: string; address: string; isDefault: boolean }>
}

/**
 * 演示客户，覆盖三种典型口径：
 *  - 香港代生产客户（勾选 70% 价格，只有授权业务人员看得到）；
 *  - 国外客户（不强制税号，走报关资料英文字段）；
 *  - 国内客户（必填税号，专票 + 票到 60 天）。
 */
export const CUSTOMERS: CustomerSeed[] = [
  {
    code: 'C0001',
    name: '香港宏晟精密有限公司',
    shortName: '香港宏晟',
    region: 'OVERSEAS',
    country: '中国香港',
    englishName: 'Hong Shing Precision Ltd.',
    englishAddress: '12/F, Kwai Chung Industrial Building, N.T., Hong Kong',
    ownerName: '李启明',
    ownerPhone: '+852 2345 6789',
    ownerEmail: 'km.lee@example.com',
    salesUserCode: 'WFX-2018-0042',
    invoiceAddress: '香港新界葵涌工业大厦 12 楼',
    bankAccount: '6222020000004417',
    bankName: '中国银行东莞分行',
    paymentTerm: 'NET_60',
    invoiceType: 'GENERAL',
    settlement: 'NOTE',
    currency: 'CNY',
    tradeTerm: 'FOB 深圳',
    level: 'A 类战略客户',
    hkPricingEnabled: true,
    hkFactorBps: 7000,
    hkEffectiveFrom: '2026-01-01',
    hkChangeReason: '香港代生产协议 2026 年续签',
    creditLimitMinor: 120_000_000n,
    creditUsedMinor: 74_250_000n,
    arDays: 60,
    addresses: [
      { label: '葵涌总仓', receiver: '陈仓管', phone: '+852 9000 0000', address: '香港新界葵涌工业大厦 3 楼', isDefault: true },
      { label: '深圳转运仓', receiver: '刘转运', phone: '13500000000', address: '深圳市宝安区 XX 路 3 号', isDefault: false },
    ],
  },
  {
    code: 'C0002',
    name: 'Brenner Maschinenbau GmbH',
    shortName: 'Brenner',
    region: 'OVERSEAS',
    country: '德国',
    englishName: 'Brenner Maschinenbau GmbH',
    englishAddress: 'Industriestr. 44, 70565 Stuttgart, Germany',
    ownerName: 'Markus Brenner',
    ownerPhone: '+49 711 998 2210',
    ownerEmail: 'm.brenner@example.com',
    salesUserCode: 'WFX-2020-0088',
    invoiceAddress: 'Industriestr. 44, 70565 Stuttgart',
    bankAccount: 'DE89370400440532013000',
    bankName: 'Deutsche Bank',
    paymentTerm: 'DEPOSIT_THEN_BALANCE',
    depositBps: 3000,
    invoiceType: 'GENERAL',
    settlement: 'CASH',
    currency: 'EUR',
    tradeTerm: 'CIF 汉堡',
    level: 'A 类战略客户',
    creditLimitMinor: 200_000_000n,
    creditUsedMinor: 31_800_000n,
    arDays: 45,
    addresses: [
      { label: 'Stuttgart 工厂', receiver: 'Anna Vogel', phone: '+49 711 998 2211', address: 'Industriestr. 44, 70565 Stuttgart', isDefault: true },
    ],
  },
  {
    code: 'C0003',
    name: '苏州明泰自动化科技有限公司',
    shortName: '苏州明泰',
    region: 'DOMESTIC',
    country: '中国',
    ownerName: '张建国',
    ownerPhone: '13912345678',
    ownerEmail: 'zhang@example.com',
    salesUserCode: 'WFX-2020-0088',
    taxNo: '91320500MA1XXXXXXX',
    invoiceAddress: '苏州市工业园区 XX 路 8 号',
    bankAccount: '6222021001099998888',
    bankName: '工商银行苏州分行',
    paymentTerm: 'NET_30',
    invoiceType: 'SPECIAL',
    settlement: 'NOTE',
    currency: 'CNY',
    level: 'B 类客户',
    creditLimitMinor: 50_000_000n,
    creditUsedMinor: 12_400_000n,
    arDays: 30,
    addresses: [
      { label: '园区总仓', receiver: '王收货', phone: '13800000000', address: '苏州市工业园区 XX 路 8 号', isDefault: true },
    ],
  },
]

export async function seedCustomers(prisma: PrismaClient): Promise<void> {
  for (const customer of CUSTOMERS) {
    const { addresses, hkEffectiveFrom, ...rest } = customer

    await prisma.customer.upsert({
      where: { code: customer.code },
      create: {
        ...rest,
        hkEffectiveFrom: hkEffectiveFrom ? new Date(`${hkEffectiveFrom}T00:00:00Z`) : null,
        hkAppliedBy: customer.hkPricingEnabled ? customer.salesUserCode : null,
        hkApprovedBy: customer.hkPricingEnabled ? 'WFX-2016-0007' : null,
        status: 'ACTIVE',
        createdBy: 'SEED',
        addresses: {
          create: addresses.map((address, index) => ({ ...address, sortOrder: index })),
        },
      },
      update: { name: customer.name, shortName: customer.shortName },
    })
  }

  // 客户编号是 NONE 重置策略，把序列推到已用最大值，避免 seed 后再建档撞号
  const rule = DOC_NUMBER_RULES.find((item) => item.docType === 'CUS')
  if (!rule) return

  await prisma.docNumberSequence.upsert({
    where: { docType_periodKey: { docType: 'CUS', periodKey: '-' } },
    create: { docType: 'CUS', periodKey: '-', lastValue: CUSTOMERS.length },
    update: { lastValue: CUSTOMERS.length },
  })
}
