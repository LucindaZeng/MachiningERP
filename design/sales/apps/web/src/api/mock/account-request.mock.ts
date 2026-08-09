import { BizError } from '../biz-error'
import { MOCK_ACCOUNTS } from './mock-accounts'
import type {
  AccountAvailability,
  AccountRequestInput,
  AccountRequestResult,
} from '@/types/auth.types'

/** 用户名规则：4–20 位，字母开头，只允许小写字母、数字、点与下划线 */
const ACCOUNT_PATTERN = /^[a-z][a-z0-9._]{3,19}$/

let sequence = 0

/**
 * 唯一编码流水：**每次注册单独生成，只增不减、永不复用**。
 * 与用户名彻底解耦——用户名离职后可以被别人再次登记，唯一编码不会。
 * 真实环境由服务端集中发号（数据库序列 / 号段），此处仅做演示。
 */
let userCodeSequence = 208

/** 已发放过的唯一编码，任何情况下都不回收 */
const issuedUserCodes = new Set<string>(
  MOCK_ACCOUNTS.map((item) => item.user.userCode).filter(Boolean),
)

function nextUserCode(): string {
  const year = new Date().getFullYear()
  let code = ''
  do {
    userCodeSequence += 1
    code = `WFX-${year}-${userCodeSequence.toString().padStart(4, '0')}`
  } while (issuedUserCodes.has(code))
  issuedUserCodes.add(code)
  return code
}

/** 已提交但尚未审批的申请也占用用户名，避免两个人同时申请到同一个编码 */
const pendingAccounts = new Set<string>()

interface Released {
  formerHolder: string
  leftAt: string
}

/**
 * 用户名占用判定（只针对登录用户名，与唯一编码无关）：
 * - existing：在职账号正在使用；
 * - pending：已提交待审批的登记占用；
 * - null：可以登记（含离职后已释放的用户名）。
 * 离职后**用户名**自离职之日起释放，可被他人再次登记；
 * 唯一编码不释放、永不复用，历史单据关联的是唯一编码，因此不受用户名换人影响。
 */
function taken(account: string): 'existing' | 'pending' | null {
  const normalized = account.trim().toLowerCase()
  const matched = MOCK_ACCOUNTS.find((item) => item.user.account.toLowerCase() === normalized)
  if (matched && matched.employment !== 'left') {
    return 'existing'
  }
  return pendingAccounts.has(normalized) ? 'pending' : null
}

/** 该用户名是否为离职释放出来的用户名 */
function releasedInfo(account: string): Released | null {
  const normalized = account.trim().toLowerCase()
  const matched = MOCK_ACCOUNTS.find(
    (item) => item.user.account.toLowerCase() === normalized && item.employment === 'left',
  )
  if (!matched) {
    return null
  }
  return {
    formerHolder: matched.formerHolder ?? matched.user.displayName,
    leftAt: matched.leftAt ?? '',
  }
}

/** 被占用时给三个可用建议：加数字后缀、加部门缩写、加姓名首字母 */
function suggest(account: string): string[] {
  const base = account.trim().toLowerCase().replace(/[^a-z0-9._]/g, '')
  const candidates = [`${base}01`, `${base}.wfx`, `${base}${new Date().getFullYear() % 100}`]
  return candidates.filter((item) => ACCOUNT_PATTERN.test(item) && !taken(item))
}

/** GET /auth/account-availability —— 用户名唯一性即时校验 */
export function mockCheckAccount(account: string): AccountAvailability {
  const value = (account ?? '').trim().toLowerCase()

  if (!ACCOUNT_PATTERN.test(value)) {
    return {
      account: value,
      available: false,
      reason: '用户名需 4–20 位，以字母开头，只能包含小写字母、数字、点或下划线',
      suggestions: [],
    }
  }

  const conflict = taken(value)
  if (conflict) {
    return {
      account: value,
      available: false,
      reason:
        conflict === 'existing'
          ? '该用户名已被现有账号占用，请更换'
          : '该用户名已有待审批的申请占用，请更换',
      suggestions: suggest(value),
    }
  }

  const released = releasedInfo(value)
  if (released) {
    return {
      account: value,
      available: true,
      released: true,
      reason: `该用户名原由 ${released.formerHolder} 使用，其已于 ${released.leftAt} 离职，用户名已释放、可重新登记；本次注册会另行生成新的唯一编码，与原使用人的编码无关`,
      suggestions: [],
    }
  }

  return { account: value, available: true, suggestions: [] }
}

/** POST /auth/account-requests —— 提交账户申请，等待信息部开通 */
export function mockSubmitAccountRequest(payload: AccountRequestInput): AccountRequestResult {
  const account = (payload.account ?? '').trim().toLowerCase()

  if (!payload.employeeName?.trim() || !payload.department?.trim() || !account) {
    throw new BizError({
      code: 'AUTH_1020',
      message: '员工姓名、所属部门与用户名为必填项',
      status: 422,
    })
  }

  if (!ACCOUNT_PATTERN.test(account)) {
    throw new BizError({
      code: 'AUTH_1021',
      message: '用户名需 4–20 位，以字母开头，只能包含小写字母、数字、点或下划线',
      status: 422,
    })
  }

  // 唯一性以提交那一刻的服务端校验为准，前端的即时校验只是提前提示
  if (taken(account)) {
    throw new BizError({
      code: 'AUTH_1022',
      message: `用户名「${account}」已被占用，请更换后重新提交`,
      status: 409,
    })
  }

  if (!payload.password || payload.password.length < 8) {
    throw new BizError({ code: 'AUTH_1023', message: '密码至少 8 位', status: 422 })
  }

  if (payload.password !== payload.confirmPassword) {
    throw new BizError({ code: 'AUTH_1024', message: '两次输入的密码不一致', status: 422 })
  }

  pendingAccounts.add(account)
  sequence += 1
  const now = new Date()

  const released = releasedInfo(account)
  // 唯一编码在注册时即生成，与用户名无关；即使用户名是别人用过的，编码也是全新的
  const userCode = nextUserCode()

  return {
    requestNo: `ACR${formatDate(now)}${sequence.toString().padStart(4, '0')}`,
    account,
    userCode,
    submittedAt: now.toISOString(),
    reusedFrom: released
      ? `${released.formerHolder}（${released.leftAt} 离职，用户名已释放）`
      : undefined,
    handlerHint: released
      ? `已派单至信息部 IT 系统管理员。本次登记的用户名此前由 ${released.formerHolder} 使用，其离职后用户名已释放；系统已为本次注册单独生成唯一编码 ${userCode}，与原使用人的编码无关，不继承其角色、数据范围与待办。历史单据关联的是唯一编码而非用户名，因此不受本次换人影响。`
      : `已派单至信息部 IT 系统管理员：核实员工在职状态与所属部门后开通账号，并由部门负责人确认角色与数据范围。系统已为本次注册生成唯一编码 ${userCode}，终身不变、永不复用；用户名仅作登录用途，审批前已被本次登记锁定。`,
  }
}

function formatDate(date: Date): string {
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}
