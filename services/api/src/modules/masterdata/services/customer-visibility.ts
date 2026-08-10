import { PERMISSION_CODES, fromMinor, type CurrencyCode, type Money } from '@machining-erp/shared'

import { BPS_SCALE } from './customer-validation.rules'

import type { CustomerView } from '../dto/customer-view.dto'
import type { CustomerRecord } from '../repositories/customer.repository.port'

export interface Viewer {
  userCode: string
  permissions: readonly string[]
}

function has(viewer: Viewer, code: string): boolean {
  return viewer.permissions.includes(code)
}

function money(minor: bigint, currency: string): Money {
  return fromMinor({ minor, currency: currency as CurrencyCode })
}

/** 只保留后 4 位，其余打码。税号与银行账号在无财务权限时按此展示。 */
function maskTail(value: string | null): string | null {
  if (!value) return null
  const tail = value.slice(-4)
  return tail.length < value.length ? `**** **** ${tail}` : tail
}

function bpsToRatio(bps: number): number {
  return bps / BPS_SCALE
}

/**
 * 把仓储记录转成对外表示，并按权限裁剪字段。
 *
 * 硬规则：财务字段（税号、银行账号、授信、账龄）无 `customer.finance.view` 时打码，
 * 业务角色只读不可见明文。列表、详情、报表与导出复用同一个出口，裁剪只此一处。
 */
export function toCustomerView(record: CustomerRecord, viewer: Viewer): CustomerView {
  const canSeeFinance = has(viewer, PERMISSION_CODES.CUSTOMER_FINANCE_VIEW)

  return {
    id: record.id,
    code: record.code,
    name: record.name,
    shortName: record.shortName,
    region: record.region,
    country: record.country,
    englishName: record.englishName,
    englishAddress: record.englishAddress,
    ownerName: record.ownerName,
    ownerPhone: record.ownerPhone,
    ownerEmail: record.ownerEmail,
    salesUserCode: record.salesUserCode,
    invoiceAddress: record.invoiceAddress,
    paymentTerm: record.paymentTerm,
    depositRatio: record.depositBps == null ? null : bpsToRatio(record.depositBps),
    invoiceType: record.invoiceType,
    settlement: record.settlement,
    currency: record.currency,
    tradeTerm: record.tradeTerm,
    level: record.level,
    status: record.status,
    approvedBy: record.approvedBy,
    addresses: record.addresses.map((address) => ({
      id: address.id,
      label: address.label,
      receiver: address.receiver,
      phone: address.phone,
      address: address.address,
      isDefault: address.isDefault,
    })),
    finance: {
      taxNo: canSeeFinance ? record.taxNo : maskTail(record.taxNo),
      bankAccount: canSeeFinance ? record.bankAccount : maskTail(record.bankAccount),
      bankName: record.bankName,
      creditLimit: money(record.creditLimitMinor, record.currency),
      creditUsed: money(record.creditUsedMinor, record.currency),
      overdueAmount: money(record.overdueAmountMinor, record.currency),
      arDays: record.arDays,
    },
    createdBy: record.createdBy,
    updatedAt: record.updatedAt.toISOString(),
    version: record.version,
  }
}

export function toCustomerViews(records: readonly CustomerRecord[], viewer: Viewer): CustomerView[] {
  return records.map((record) => toCustomerView(record, viewer))
}
