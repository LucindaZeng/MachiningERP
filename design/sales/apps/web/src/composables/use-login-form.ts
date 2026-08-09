import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { isBizError } from '@/api/biz-error'
import { useCaptcha } from './use-captcha'
import { useRememberedAccount } from './use-remembered-account'
import { useAuthStore } from '@/stores/auth.store'
import type { LoginAudience } from '@/types/auth.types'

export interface LoginFormModel {
  audience: LoginAudience
  account: string
  password: string
  captchaCode: string
  remember: boolean
}

/** 登录页取数与提交逻辑；页面组件只做编排与展示。 */
export function useLoginForm() {
  const router = useRouter()
  const authStore = useAuthStore()
  const remembered = useRememberedAccount()
  const captcha = useCaptcha()

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const captchaRequired = ref(false)
  const errorMessage = ref('')

  const form = reactive<LoginFormModel>({
    audience: 'internal',
    account: '',
    password: '',
    captchaCode: '',
    remember: false,
  })

  const rules: FormRules<LoginFormModel> = {
    account: [{ required: true, message: '请输入工号或登录账号', trigger: 'blur' }],
    password: [
      { required: true, message: '请输入登录密码', trigger: 'blur' },
      { min: 6, message: '密码至少 6 位', trigger: 'blur' },
    ],
    captchaCode: [
      {
        trigger: 'blur',
        validator: (_rule, value: string, callback) => {
          if (!captchaRequired.value) {
            return callback()
          }
          return value?.trim().length === 4 ? callback() : callback(new Error('请输入 4 位图形验证码'))
        },
      },
    ],
  }

  function restoreRememberedAccount(): void {
    const record = remembered.read()
    if (!record) {
      return
    }
    form.audience = record.audience
    form.account = record.account
    form.remember = true
  }

  function switchAudience(audience: LoginAudience): void {
    form.audience = audience
    form.password = ''
    form.captchaCode = ''
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
      const user = await authStore.login({
        audience: form.audience,
        account: form.account.trim(),
        password: form.password,
        captchaId: captcha.challenge.value?.captchaId,
        captchaCode: captchaRequired.value ? form.captchaCode.trim() : undefined,
      })
      await handleSuccess(user.displayName)
    } catch (error) {
      await handleFailure(error)
    } finally {
      submitting.value = false
    }
  }

  async function handleSuccess(displayName: string): Promise<void> {
    if (form.remember) {
      remembered.save(form.audience, form.account)
    } else {
      remembered.clear()
    }

    captchaRequired.value = false
    ElMessage.success(`欢迎回来，${displayName}`)
    await router.push({ name: 'home' })
  }

  async function handleFailure(error: unknown): Promise<void> {
    errorMessage.value = isBizError(error) ? error.message : '登录服务暂不可用，请稍后重试'

    if (isBizError(error) && error.captchaRequired) {
      captchaRequired.value = true
    }

    form.captchaCode = ''
    if (captchaRequired.value) {
      await captcha.refresh()
    }
  }

  return {
    form,
    formRef,
    rules,
    submitting,
    captchaRequired,
    captchaChallenge: captcha.challenge,
    captchaLoading: captcha.loading,
    errorMessage,
    refreshCaptcha: captcha.refresh,
    restoreRememberedAccount,
    switchAudience,
    submit,
  }
}
