import { useAuthStore } from '@/stores/auth.store'

import type { Router } from 'vue-router'


const APP_TITLE = '万富鑫智能装备 ERP'

/** 未登录一律回登录页；已登录访问登录页直接进工作台。 */
export function registerAuthGuard(router: Router): void {
  router.beforeEach((to) => {
    const authStore = useAuthStore()

    document.title = to.meta.title ? `${to.meta.title} · ${APP_TITLE}` : APP_TITLE

    if (to.meta.public) {
      return authStore.isAuthenticated && to.name === 'login' ? { name: 'home' } : true
    }

    return authStore.isAuthenticated ? true : { name: 'login', query: { redirect: to.fullPath } }
  })
}
