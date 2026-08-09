/**
 * 唯一编码台账：**只增不删**。
 * 用户名可以被离职释放后再登记，唯一编码永远不回收，因此发号必须先查台账再登记。
 */
export interface UserCodeRepositoryPort {
  isIssued(code: string): Promise<boolean>
  /** 登记成功返回 true；若并发下已被别人登记则返回 false，由调用方取下一个号 */
  tryIssue(code: string, source: string, note?: string | null): Promise<boolean>
}

export const USER_CODE_REPOSITORY = Symbol('USER_CODE_REPOSITORY')
