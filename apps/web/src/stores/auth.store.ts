import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { login as loginApi, logout as logoutApi } from '@/api/auth.api'

import type { LoginRequest, LoginUser } from '@/types/auth.types'

const TOKEN_KEY = 'erp.auth.token'
const USER_KEY = 'erp.auth.user'

/** 会话状态：token 只放 sessionStorage，关闭浏览器即失效。 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(sessionStorage.getItem(TOKEN_KEY) ?? '')
  const user = ref<LoginUser | null>(readStoredUser())

  const isAuthenticated = computed(() => Boolean(token.value))

  async function login(payload: LoginRequest): Promise<LoginUser> {
    const result = await loginApi(payload)
    setSession(result.accessToken, result.user)
    return result.user
  }

  async function logout(): Promise<void> {
    if (token.value) {
      await logoutApi(token.value).catch(() => undefined)
    }
    clearSession()
  }

  function setSession(accessToken: string, loginUser: LoginUser): void {
    token.value = accessToken
    user.value = loginUser
    sessionStorage.setItem(TOKEN_KEY, accessToken)
    sessionStorage.setItem(USER_KEY, JSON.stringify(loginUser))
  }

  function clearSession(): void {
    token.value = ''
    user.value = null
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  }

  return { token, user, isAuthenticated, login, logout, clearSession }
})

function readStoredUser(): LoginUser | null {
  const raw = sessionStorage.getItem(USER_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as LoginUser
  } catch {
    return null
  }
}
