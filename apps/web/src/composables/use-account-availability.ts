import { ref } from 'vue'

import { checkAccountAvailability } from '@/api/auth.api'

import { normalizeAccount } from './account-request-rules'

import type { AccountAvailability, AccountRequestInput } from '@/types/auth.types'

/**
 * 用户名可用性查询。
 * 「可用」只能由服务端判定：用户名在职期间唯一、离职后释放（released=true 时仍可登记），
 * 且待审批的申请同样占用用户名，因此前端不缓存判定结果，每次都重新问一遍。
 */
export function useAccountAvailability(form: AccountRequestInput) {
  const availability = ref<AccountAvailability | null>(null)
  const checking = ref(false)

  /** 失焦或点「检查可用性」时触发 */
  async function checkAccount(): Promise<void> {
    // 回写规范化后的用户名，保证界面、校验与提交用的是同一个值
    const account = normalizeAccount(form.account)
    form.account = account
    if (!account) {
      availability.value = null
      return
    }

    checking.value = true
    try {
      availability.value = await checkAccountAvailability(account)
    } finally {
      checking.value = false
    }
  }

  /** 采纳服务端给出的可用建议后立即复查，避免建议本身在此期间被别人抢占 */
  function useSuggestion(value: string): void {
    form.account = value
    void checkAccount()
  }

  return { availability, checking, checkAccount, useSuggestion }
}
