import type { FormInstance, FormRules } from 'element-plus'
import { computed, reactive, ref } from 'vue'

import { isBizError } from '@/api/biz-error'
import { checkAccountAvailability, submitAccountRequest } from '@/api/auth.api'
import type { AccountAvailability, AccountRequestInput, AccountRequestResult } from '@/types/auth.types'

/** 用户名规则与后端一致：4–20 位，字母开头，只允许小写字母、数字、点与下划线 */
const ACCOUNT_PATTERN = /^[a-z][a-z0-9._]{3,19}$/

/**
 * 账户申请：员工姓名、所属部门、用户名、密码。
 * 用户名是全公司唯一编码，输入时即时校验，提交时服务端再校验一次，
 * 已提交待审批的申请同样占用该用户名，避免两个人拿到同一个编码。
 */
export function useAccountRequest() {
  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const checking = ref(false)
  const errorMessage = ref('')
  const availability = ref<AccountAvailability | null>(null)
  const result = ref<AccountRequestResult | null>(null)

  const form = reactive<AccountRequestInput>({
    employeeName: '',
    department: '',
    account: '',
    password: '',
    confirmPassword: '',
    contact: '',
    reason: '',
  })

  /** 密码强度：长度、大小写、数字、符号各占一档 */
  const passwordScore = computed(() => {
    const value = form.password
    if (!value) {
      return 0
    }
    let score = 0
    if (value.length >= 8) score += 1
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
    if (/\d/.test(value)) score += 1
    if (/[^A-Za-z0-9]/.test(value)) score += 1
    return score
  })

  const accountReady = computed(() => availability.value?.available === true)

  const canSubmit = computed(
    () =>
      Boolean(form.employeeName.trim()) &&
      Boolean(form.department) &&
      accountReady.value &&
      form.password.length >= 8 &&
      form.password === form.confirmPassword,
  )

  const rules: FormRules<AccountRequestInput> = {
    employeeName: [{ required: true, message: '请输入员工姓名', trigger: 'blur' }],
    department: [{ required: true, message: '请选择所属部门', trigger: 'change' }],
    account: [
      { required: true, message: '请输入用户名', trigger: 'blur' },
      {
        trigger: 'blur',
        validator: (_r, value: string, cb) =>
          ACCOUNT_PATTERN.test((value ?? '').trim().toLowerCase())
            ? cb()
            : cb(new Error('用户名需 4–20 位，以字母开头，只能包含小写字母、数字、点或下划线')),
      },
    ],
    password: [
      { required: true, message: '请输入密码', trigger: 'blur' },
      { min: 8, message: '密码至少 8 位', trigger: 'blur' },
    ],
    confirmPassword: [
      {
        trigger: 'blur',
        validator: (_r, value: string, cb) =>
          value === form.password ? cb() : cb(new Error('两次输入的密码不一致')),
      },
    ],
  }

  /** 用户名唯一性校验：失焦或点「检查可用性」时触发 */
  async function checkAccount(): Promise<void> {
    const account = form.account.trim().toLowerCase()
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

  function useSuggestion(value: string): void {
    form.account = value
    void checkAccount()
  }

  async function submit(): Promise<void> {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid || !canSubmit.value) {
      errorMessage.value = '请先补齐必填项，并确认用户名可用、两次密码一致'
      return
    }

    submitting.value = true
    errorMessage.value = ''
    try {
      result.value = await submitAccountRequest({ ...form })
    } catch (error) {
      errorMessage.value = isBizError(error) ? error.message : '提交失败，请稍后重试'
      // 用户名被抢占时刷新可用性提示
      void checkAccount()
    } finally {
      submitting.value = false
    }
  }

  function reset(): void {
    Object.assign(form, {
      employeeName: '',
      department: '',
      account: '',
      password: '',
      confirmPassword: '',
      contact: '',
      reason: '',
    })
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
