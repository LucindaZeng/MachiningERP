import { ElMessage, type FormInstance } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'

import { AUTH_MESSAGES, resolveAuthErrorMessage } from './auth-error-message'
import { createLoginFormRules } from './login-form-rules'
import { createLoginFormState, switchFormAudience, toLoginRequest } from './login-form-state'
import { persistRememberedFrom, restoreRememberedInto } from './login-remember-sync'
import { useLoginCaptcha } from './use-login-captcha'
import { useRememberedAccount } from './use-remembered-account'

import type { LoginAudience } from '@/types/auth.types'

export type { LoginFormModel } from './login-form-state'

/**
 * 登录页取数与提交逻辑；页面组件只做编排与展示。
 * 本文件只做响应式编排：字段清单与请求体映射在 login-form-state，校验规则在 login-form-rules，
 * 「记住我」的读写在 login-remember-sync，验证码风控状态在 use-login-captcha。
 */
export function useLoginForm() {
  const router = useRouter()
  const authStore = useAuthStore()
  const remembered = useRememberedAccount()

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const errorMessage = ref('')

  const form = reactive(createLoginFormState())
  const captcha = useLoginCaptcha(form)
  const rules = createLoginFormRules(() => captcha.required.value)

  function restoreRememberedAccount(): void {
    restoreRememberedInto(form, remembered)
  }

  function switchAudience(audience: LoginAudience): void {
    switchFormAudience(form, audience)
    errorMessage.value = ''
  }

  async function submit(): Promise<void> {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) {
      return
    }

    submitting.value = true
    errorMessage.value = ''

    try {
      const user = await authStore.login(toLoginRequest(form, captcha.credentials()))
      await handleSuccess(user.displayName)
    } catch (error) {
      await handleFailure(error)
    } finally {
      submitting.value = false
    }
  }

  async function handleSuccess(displayName: string): Promise<void> {
    persistRememberedFrom(form, remembered)
    captcha.reset()
    ElMessage.success(`欢迎回来，${displayName}`)
    await router.push({ name: 'home' })
  }

  /** 失败提示与验证码风控要分开：文案走错误码映射，是否强制验证码由服务端标记决定 */
  async function handleFailure(error: unknown): Promise<void> {
    errorMessage.value = resolveAuthErrorMessage(error, AUTH_MESSAGES.loginUnavailable)
    await captcha.applyLoginFailure(error)
  }

  return {
    form,
    formRef,
    rules,
    submitting,
    errorMessage,
    ...captcha.exposed,
    restoreRememberedAccount,
    switchAudience,
    submit,
  }
}
