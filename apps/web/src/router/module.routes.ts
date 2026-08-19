import { MODULE_SPECS } from '@/pages/modules/module-catalog'
import type { RouteRecordRaw } from 'vue-router'

/**
 * 其余九个部门的模块总览路由，由 module-catalog.ts 自动派生，
 * 路径与 layouts/menu.config.ts 的 DEPARTMENT_MENU 保持一致。
 */
export const moduleRoutes: RouteRecordRaw[] = MODULE_SPECS.map((spec) => ({
  path: spec.path,
  name: `module-${spec.key}`,
  component: () => import('@/pages/modules/ModuleOverviewPage.vue'),
  meta: { title: spec.title, moduleKey: spec.key },
}))
