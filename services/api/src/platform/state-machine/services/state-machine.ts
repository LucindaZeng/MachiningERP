import { SYSTEM_ERRORS } from '@machining-erp/shared'

import { BizError } from '../../../common/errors/biz-error'

export type TransitionMap<TState extends string> = Readonly<Record<TState, readonly TState[]>>

/**
 * 单据状态机基类（development-guide「状态机基类」）。
 * 业务模块只声明合法迁移表，非法迁移一律由这里拦截成 SYS_9012，
 * 禁止在 service 里手写 if/else 判状态。
 */
export class StateMachine<TState extends string> {
  constructor(
    private readonly docType: string,
    private readonly transitions: TransitionMap<TState>,
  ) {}

  can(from: TState, to: TState): boolean {
    return (this.transitions[from] ?? []).includes(to)
  }

  /** 非法迁移直接抛错，附带可读的允许列表，便于前端提示与排障。 */
  assert(from: TState, to: TState): void {
    if (this.can(from, to)) return

    const allowed = this.transitions[from] ?? []
    throw new BizError(SYSTEM_ERRORS.ILLEGAL_STATE_TRANSITION, {
      message: `${this.docType} 不允许从「${from}」迁移到「${to}」；当前允许：${
        allowed.length > 0 ? allowed.join('、') : '无（终态）'
      }`,
      details: { docType: this.docType, from, to, allowed },
    })
  }

  isTerminal(state: TState): boolean {
    return (this.transitions[state] ?? []).length === 0
  }

  nextStates(state: TState): readonly TState[] {
    return this.transitions[state] ?? []
  }
}
