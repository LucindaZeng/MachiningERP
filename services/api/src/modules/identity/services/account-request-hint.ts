import type { ReleasedAccountRecord } from '../repositories/user.repository.port'

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : '（离职日期缺失）'
}

export function buildReusedFrom(released: ReleasedAccountRecord | null): string | null {
  if (!released) return null
  return `${released.formerHolder}（${formatDate(released.leftAt)} 离职，用户名已释放）`
}

/**
 * 受理提示文案。纯函数，方便单测覆盖「用户名复用」与「全新登记」两条分支。
 * 措辞要点：唯一编码是本次注册新生成的，不继承原使用人的角色、数据范围与待办。
 */
export function buildHandlerHint(
  userCode: string,
  released: ReleasedAccountRecord | null,
): string {
  if (released) {
    return (
      `已派单至信息部 IT 系统管理员。本次登记的用户名此前由 ${released.formerHolder} 使用，` +
      `其离职后用户名已释放；系统已为本次注册单独生成唯一编码 ${userCode}，与原使用人的编码无关，` +
      '不继承其角色、数据范围与待办。历史单据关联的是唯一编码而非用户名，因此不受本次换人影响。'
    )
  }

  return (
    '已派单至信息部 IT 系统管理员：核实员工在职状态与所属部门后开通账号，并由部门负责人确认角色与数据范围。' +
    `系统已为本次注册生成唯一编码 ${userCode}，终身不变、永不复用；用户名仅作登录用途，审批前已被本次登记锁定。`
  )
}
