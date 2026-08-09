import { ref } from 'vue'

import { isBizError } from '@/api/biz-error'

import { useCaptcha } from './use-captcha'

import type { LoginFormModel } from './login-form-state'
import type { LoginRequest } from '@/types/auth.types'

/**
 * 登录风控中的图形验证码状态。
 * 「是否需要验证码」由服务端说了算：连续 3 次密码错误后返回 AUTH_1003（captchaRequired），
 * 前端据此置位并保持到本次登录成功为止——本地不自己数错误次数，否则刷新页面即可绕过。
 */
export function useLoginCaptcha(form: LoginFormModel) {
  const { challenge, loading, refresh } = useCaptcha()
  const required = ref(false)

  /** 登录失败后的验证码处理：置位风控标记、清掉旧输入、必要时换一张图 */
  async function applyLoginFailure(error: unknown): Promise<void> {
    if (isBizError(error) && error.captchaRequired) {
      required.value = true
    }

    form.captchaCode = ''
    if (required.value) {
      await refresh()
    }
  }

  /** 登录成功即解除风控：计数在服务端已清零 */
  function reset(): void {
    required.value = false
  }

  /** 未触发风控时不带验证码字段，避免服务端为空值做多余校验 */
  function credentials(): Pick<LoginRequest, 'captchaId' | 'captchaCode'> {
    return {
      captchaId: challenge.value?.captchaId,
      captchaCode: required.value ? form.captchaCode.trim() : undefined,
    }
  }

  /** 按登录页组件依赖的字段名对外暴露，供 useLoginForm 原样透出 */
  const exposed = {
    captchaRequired: required,
    captchaChallenge: challenge,
    captchaLoading: loading,
    refreshCaptcha: refresh,
  }

  return { required, exposed, applyLoginFailure, reset, credentials }
}
