import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { DEMO_ROLES, type DemoRole } from '@/composables/use-permission'

const ROLE_KEY = 'erp.demo.role'

/**
 * 演示用角色切换：真实环境角色来自登录态与角色-权限矩阵，不可由前端切换。
 * 这里保留切换器是为了在原型上直观演示「香港 70% 只有业务部可见」「成本核算只有报价工程师可做」。
 */
export const useRoleStore = defineStore('role', () => {
  const code = ref<string>(localStorage.getItem(ROLE_KEY) ?? DEMO_ROLES[0].code)

  const current = computed<DemoRole>(
    () => DEMO_ROLES.find((item) => item.code === code.value) ?? DEMO_ROLES[0],
  )

  function switchTo(next: string): void {
    code.value = next
    localStorage.setItem(ROLE_KEY, next)
  }

  return { code, current, switchTo }
})
