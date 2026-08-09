import { ref } from 'vue'

import { fetchCaptcha } from '@/api/auth.api'
import type { CaptchaChallenge } from '@/types/auth.types'

/** 图形验证码取数逻辑，页面组件只负责展示与触发。 */
export function useCaptcha() {
  const challenge = ref<CaptchaChallenge | null>(null)
  const loading = ref(false)

  async function refresh(): Promise<void> {
    loading.value = true
    try {
      challenge.value = await fetchCaptcha()
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    challenge.value = null
  }

  return { challenge, loading, refresh, reset }
}
