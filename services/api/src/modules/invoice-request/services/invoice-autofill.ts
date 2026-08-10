import { parseDecimal } from '@machining-erp/shared'

import type { InvoiceKind, PaymentTerm } from '@prisma/client'

/**
 * 发票申请的自动带出（业务规格第 9 章）：
 *
 * > 系统自动带出金额、税率、发票种类（普票/专票，来自客户档案）
 * > 与开票信息（抬头、税号、发票地址）。
 *
 * 纯函数：客户档案与出货明细由调用方查好传进来。带出来的开票信息会**冻结**在
 * 申请上——客户档案三个月后改了地址，不该动到已经开出去的那张票。
 */
const BPS_SCALE = 10_000

/** 客户档案里与开票相关的那几项。 */
export interface InvoiceCustomerFacts {
  region: 'DOMESTIC' | 'HK_MO_TW' | 'OVERSEAS'
  /** 客户档案上的发票种类；国内客户才有专票/普票之分 */
  invoiceType: 'SPECIAL' | 'GENERAL' | null
  title: string
  taxNo: string | null
  bankAccount: string | null
  invoiceAddress: string
  ownerEmail: string | null
  paymentTerm: PaymentTerm
  currency: string
}

export interface InvoiceLineFacts {
  shipmentId: string | null
  shipmentNo: string
  productName: string
  drawingNo: string
  quantity: string
  unitPriceMinor: bigint
  amountMinor: bigint
}

export interface AutofilledLine extends InvoiceLineFacts {
  sequence: number
  taxRateBps: number
  taxAmountMinor: bigint
}

export interface AutofilledInvoice {
  invoiceKind: InvoiceKind
  lines: AutofilledLine[]
  amountExTaxMinor: bigint
  taxAmountMinor: bigint
  amountIncTaxMinor: bigint
  title: string
  taxNo: string
  bankAccount: string | null
  address: string
  deliveryMethod: string
  deliveryTarget: string
  expectedPaymentDate: Date | null
}

/** 增值税率 13%；出口零税率。 */
export const VAT_RATE_BPS = 1_300
export const ZERO_RATE_BPS = 0

/**
 * 发票种类：出口一律零税率出口发票，国内看客户档案的专票/普票设置。
 * 档案没设时按普票——普票开错的补救成本远低于专票。
 */
export function resolveInvoiceKind(customer: InvoiceCustomerFacts): InvoiceKind {
  if (customer.region !== 'DOMESTIC') return 'EXPORT'
  return customer.invoiceType === 'SPECIAL' ? 'SPECIAL' : 'GENERAL'
}

export function taxRateBpsFor(invoiceKind: InvoiceKind): number {
  return invoiceKind === 'EXPORT' || invoiceKind === 'PROFORMA' ? ZERO_RATE_BPS : VAT_RATE_BPS
}

/** 账期天数：票到 N 天。预付/现金没有账期，按开票当日。 */
export function paymentTermDays(term: PaymentTerm): number {
  switch (term) {
    case 'NET_30':
      return 30
    case 'NET_60':
      return 60
    case 'NET_90':
      return 90
    default:
      return 0
  }
}

/** 行税额 = 行金额 × 税率，decimal 全程算完再取整到分。 */
export function lineTaxMinor(amountMinor: bigint, taxRateBps: number): bigint {
  const tax = parseDecimal(amountMinor.toString(), '金额').mul(taxRateBps).div(BPS_SCALE)
  return BigInt(tax.toDecimalPlaces(0).toFixed(0))
}

export function autofillInvoice(
  customer: InvoiceCustomerFacts,
  lineFacts: readonly InvoiceLineFacts[],
  issuedOn: Date,
): AutofilledInvoice {
  const invoiceKind = resolveInvoiceKind(customer)
  const taxRateBps = taxRateBpsFor(invoiceKind)

  const lines = lineFacts.map((line, index) => ({
    ...line,
    sequence: index + 1,
    taxRateBps,
    taxAmountMinor: lineTaxMinor(line.amountMinor, taxRateBps),
  }))

  const amountExTaxMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0n)
  const taxAmountMinor = lines.reduce((sum, line) => sum + line.taxAmountMinor, 0n)

  return {
    invoiceKind,
    lines,
    amountExTaxMinor,
    taxAmountMinor,
    amountIncTaxMinor: amountExTaxMinor + taxAmountMinor,
    title: customer.title,
    taxNo: customer.taxNo ?? '',
    bankAccount: customer.bankAccount,
    address: customer.invoiceAddress,
    // 有邮箱就发电子发票；没有就只能寄纸质件
    deliveryMethod: customer.ownerEmail ? '电子发票（邮箱）' : '纸质发票（快递）',
    deliveryTarget: customer.ownerEmail ?? customer.invoiceAddress,
    expectedPaymentDate: addDays(issuedOn, paymentTermDays(customer.paymentTerm)),
  }
}

function addDays(from: Date, days: number): Date {
  const result = new Date(from.getTime())
  result.setDate(result.getDate() + days)
  return result
}
