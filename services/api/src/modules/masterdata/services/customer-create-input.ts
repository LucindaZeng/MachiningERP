import type { CustomerProfileInput } from './customer-validation.rules'

/** 建客户档案的入参。校验规则见 customer-validation.rules.ts。 */
export interface CreateCustomerInput extends CustomerProfileInput {
  englishName?: string | null
  englishAddress?: string | null
  ownerEmail?: string | null
  bankName?: string | null
  salesUserCode?: string | null
  currency?: string
  tradeTerm?: string | null
  level?: string | null
  /** 报价阶段的新客户先建草稿，成交下单前再补全 */
  draft?: boolean
}
