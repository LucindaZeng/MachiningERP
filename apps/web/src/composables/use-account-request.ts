import { computed, reactive, ref } from 'vue'

import { submitAccountRequest } from '@/api/auth.api'

import { createAccountRequestForm } from './account-request-form-state'
import { createAccountRequestRules, isAccountRequestComplete } from './account-request-rules'
import { AUTH_MESSAGES, resolveAuthErrorMessage } from './auth-error-message'
import { scorePassword } from './password-strength'
import { useAccountAvailability } from './use-account-availability'

import type { AccountRequestInput, AccountRequestResult } from '@/types/auth.types'
import type { FormInstance } from 'element-plus'

/**
 * 账户申请：员工姓名、所属部门、用户名、密码。
 * 用户名是全公司唯一编码，输入时即时校验，提交时服务端再校验一次，
 * 已提交待审批的申请同样占用该用户名，避免两个人拿到同一个编码。
 *
 * 本文件只做响应式编排：字段清单、校验规则、密码强度、可用性查询分别下沉到
 * account-request-form-state / account-request-rules / password-strength / use-account-availability。
 */
export function useAccountRequest() {
  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const errorMessage = ref('')
  const result = ref<AccountRequestResult | null>(null)

  const form = reactive<AccountRequestInput>(createAccountRequestForm())
  const { availability, checking, checkAccount, useSuggestion } = useAccountAvailability(form)

  const passwordScore = computed(() => scorePassword(form.password))
  const accountReady = computed(() => availability.value?.available === true)
  const canSubmit = computed(() => isAccountRequestComplete(form, accountReady.value))

  const rules = createAccountRequestRules(form)

  async function submit(): Promise<void> {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid || !canSubmit.value) {
      errorMessage.value = AUTH_MESSAGES.accountRequestIncomplete
      return
    }

    submitting.value = true
    errorMessage.value = ''
    try {
      result.value = await submitAccountRequest({ ...form })
    } catch (error) {
      errorMessage.value = resolveAuthErrorMessage(error, AUTH_MESSAGES.accountRequestFailed)
      // 用户名被抢占时刷新可用性提示
      void checkAccount()
    } finally {
      submitting.value = false
    }
  }

  function reset(): void {
    Object.assign(form, createAccountRequestForm())
    availability.value = null
    result.value = null
    errorMessage.value = ''
    formRef.value?.clearValidate()
  }

  return {
    form,
    formRef,
    rules,
    submitting,
    checking,
    errorMessage,
    availability,
    accountReady,
    passwordScore,
    canSubmit,
    result,
    checkAccount,
    useSuggestion,
    submit,
    reset,
  }
}
