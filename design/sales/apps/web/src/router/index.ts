import { createRouter, createWebHistory } from 'vue-router'

import { registerAuthGuard } from './auth-guard'
import { salesRoutes } from './sales.routes'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/login/LoginPage.vue'),
      meta: { public: true, title: '用户登录' },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/layouts/MainLayout.vue'),
      redirect: '/sales',
      children: salesRoutes,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/sales',
    },
  ],
})

registerAuthGuard(router)

export default router
