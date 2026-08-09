import type { AccountRequestInput } from '@/types/auth.types'

/**
 * 账户申请表单的空状态。
 * 初始化与「重置」两处都要用同一份字段清单，抽成工厂函数避免两边漂移；
 * 每次返回新对象而不是共享常量，防止 reactive 包装后被上一轮填写过的数据污染。
 */
export function createAccountRequestForm(): AccountRequestInput {
  return {
    employeeName: '',
    department: '',
    account: '',
    password: '',
    confirmPassword: '',
    contact: '',
    reason: '',
  }
}
