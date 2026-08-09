import { BizError } from '../biz-error'

import type { PasswordResetRequestInput, PasswordResetRequestResult } from '@/types/auth.types'

let sequence = 0

/** 生成密码重置申请单号：PRR + yyyyMMdd + 4 位流水（统一单据编号规则的简化版） */
export function mockSubmitPasswordResetRequest(
  payload: PasswordResetRequestInput,
): PasswordResetRequestResult {
  if (!payload.account?.trim() || !payload.applicantName?.trim() || !payload.contact?.trim()) {
    throw new BizError({
      code: 'AUTH_1010',
      message: '账号、姓名与联系方式为必填项',
      status: 422,
    })
  }

  sequence += 1
  const now = new Date()

  return {
    requestNo: `PRR${formatDate(now)}${sequence.toString().padStart(4, '0')}`,
    submittedAt: now.toISOString(),
    handlerHint:
      payload.audience === 'portal'
        ? '已派单至对应的采购/业务对接人，核实身份后由 IT 管理员重置并回复初始密码。'
        : '已派单至信息部 IT 系统管理员，核实工号与部门后重置并通过企业微信通知本人。',
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}${month}${day}`
}
