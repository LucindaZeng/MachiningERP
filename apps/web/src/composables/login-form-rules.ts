import type { LoginFormModel } from './login-form-state'
import type { FormRules } from 'element-plus'

/**
 * 登录表单校验规则。
 * 验证码是否必填由风控状态决定（连续 3 次密码错误后服务端才要求），
 * 因此用 getter 读取而不是接收一次性的布尔值——规则对象只创建一次，之后状态还会变。
 */
export function createLoginFormRules(isCaptchaRequired: () => boolean): FormRules<LoginFormModel> {
  return {
    account: [{ required: true, message: '请输入工号或登录账号', trigger: 'blur' }],
    password: [
      { required: true, message: '请输入登录密码', trigger: 'blur' },
      { min: 6, message: '密码至少 6 位', trigger: 'blur' },
    ],
    captchaCode: [
      {
        trigger: 'blur',
        validator: (_rule, value: string, callback) => {
          if (!isCaptchaRequired()) {
            return callback()
          }
          return value?.trim().length === 4
            ? callback()
            : callback(new Error('请输入 4 位图形验证码'))
        },
      },
    ],
  }
}
