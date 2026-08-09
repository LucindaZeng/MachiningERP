import { type FormInstance, type FormRules } from 'element-plus'
import { reactive, ref } from 'vue'

import { isBizError } from '@/api/biz-error'
import { submitPasswordResetRequest } from '@/api/password-reset.api'
import type { LoginAudience, PasswordResetRequestResult } from '@/types/auth.types'

export interface PasswordResetFormModel {
  audience: LoginAudience
  account: string
  applicantName: string
  department: string
  contact: string
  reason: string
}

const CONTACT_PATTERN = /^(1[3-9]\d{9}|[^\s@]+@[^\s@]+\.[^\s@]+)$/

/** 忘记密码：提交重置申请给 IT/系统管理员，管理员核实后在后台重置。 */
export function usePasswordResetRequest() {
  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const errorMessage = ref('')
  const result = ref<PasswordResetRequestResult | null>(null)

  const form = reactive<PasswordResetFormModel>({
    audience: 'internal',
    account: '',
    applicantName: '',
    department: '',
    contact: '',
    reason: '',
  })

  const rules: FormRules<PasswordResetFormModel> = {
    account: [{ required: true, message: '请输入需要重置的工号或账号', trigger: 'blur' }],
    applicantName: [{ required: true, message: '请输入本人姓名，便于管理员核实身份', trigger: 'blur' }],
    department: [{ required: true, message: '请选择所属部门', trigger: 'change' }],
    contact: [
      { required: true, message: '请输入手机号或企业邮箱', trigger: 'blur' },
      { pattern: CONTACT_PATTERN, message: '请输入正确的手机号或企业邮箱', trigger: 'blur' },
    ],
  }

  function reset(audience: LoginAudience, account: string): void {
    form.audience = audience
    form.account = account
    form.applicantName = ''
    form.department = ''
    form.contact = ''
    form.reason = ''
    errorMessage.value = ''
    result.value = null
    formRef.value?.clearValidate()
  }

  async function submit(): Promise<void> {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) {
      return
    }

    submitting.value = true
    errorMessage.value = ''

    try {
      result.value = await submitPasswordResetRequest({
        audience: form.audience,
        account: form.account.trim(),
        applicantName: form.applicantName.trim(),
        department: form.department,
        contact: form.contact.trim(),
        reason: form.reason.trim() || undefined,
      })
    } catch (error) {
      errorMessage.value = isBizError(error) ? error.message : '提交失败，请稍后重试或电话联系信息部'
    } finally {
      submitting.value = false
    }
  }

  return { form, formRef, rules, submitting, errorMessage, result, reset, submit }
}
