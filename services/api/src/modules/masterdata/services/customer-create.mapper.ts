import type { CreateCustomerInput } from './customer-create-input'
import type { CreateCustomerData } from '../repositories/customer.repository.port'

/**
 * 建档入参 → 落库数据的映射。
 * 抽成纯函数是为了把一长串「可选字段兜默认值」从 service 的用例编排里挪走：
 * service 只负责流程顺序，字段口径在这里一眼看全。
 */
export function toCreateCustomerData(
  input: CreateCustomerInput,
  code: string,
  actorUserCode: string,
): CreateCustomerData {
  return {
    code,
    name: input.name.trim(),
    shortName: input.shortName.trim(),
    region: input.region,
    country: input.country.trim(),
    englishName: input.englishName ?? null,
    englishAddress: input.englishAddress ?? null,
    ownerName: input.ownerName.trim(),
    ownerPhone: input.ownerPhone.trim(),
    ownerEmail: input.ownerEmail ?? null,
    // 未指定负责业务员时默认落到建档人，保证数据权限过滤有依据
    salesUserCode: input.salesUserCode ?? actorUserCode,
    taxNo: input.taxNo ?? null,
    invoiceAddress: input.invoiceAddress.trim(),
    bankAccount: input.bankAccount ?? null,
    bankName: input.bankName ?? null,
    paymentTerm: input.paymentTerm,
    depositBps: input.depositBps ?? null,
    invoiceType: input.invoiceType,
    settlement: input.settlement,
    currency: input.currency ?? 'CNY',
    tradeTerm: input.tradeTerm ?? null,
    level: input.level ?? null,
    hkPricingEnabled: input.hkPricingEnabled ?? false,
    // 10000 万分比 = 100%，即不打折
    hkFactorBps: input.hkFactorBps ?? 10_000,
    hkEffectiveFrom: input.hkEffectiveFrom ? new Date(input.hkEffectiveFrom) : null,
    // 谁勾的香港价格必须留痕，供审计追责
    hkAppliedBy: input.hkPricingEnabled ? actorUserCode : null,
    hkChangeReason: input.hkChangeReason ?? null,
    // 报价阶段的新客户先建草稿，成交下单前再补全
    status: input.draft ? 'DRAFT' : 'ACTIVE',
    createdBy: actorUserCode,
    addresses: input.addresses.map((address, index) => ({ ...address, sortOrder: index })),
  }
}
