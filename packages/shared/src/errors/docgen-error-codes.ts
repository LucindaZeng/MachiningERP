import type { BizErrorDefinition } from './error-segment'

/**
 * SYS_905x —— 单据出具（docgen）。
 *
 * 归在 SYS 段而不是 ORD 段，是有意的：这些错误**几乎全是模板或配置的问题**，
 * 不是业务员填错了单。让它们出现在 ORD 段，会把「你的单据有问题」
 * 和「系统的模板有问题」混成一类，前端也就没法把后者引到管理员那里去。
 *
 * 唯一的例外是 `NOTHING_SELECTED`（合并导出没选文档），那是纯输入校验。
 */
export const DOCGEN_ERRORS = {
  TEMPLATE_NOT_FOUND: {
    code: 'SYS_9050',
    status: 500,
    message: '单据模板不存在，请联系管理员检查模板配置',
  },
  /** 模板文件损坏、被换成了非 xlsx、或 sheet 名与登记不符 */
  TEMPLATE_UNREADABLE: {
    code: 'SYS_9051',
    status: 500,
    message: '单据模板无法读取，请联系管理员核对模板文件',
  },
  /**
   * 一行同时引用两个数组，没有确定的展开语义。
   * 这是模板编辑者最容易犯的错，因此单独给码并在消息里点名行号。
   */
  AMBIGUOUS_REPEAT_ROW: {
    code: 'SYS_9052',
    status: 500,
    message: '单据模板的重复行定义有歧义，请联系管理员',
  },
  /** 模板声明的重复数组在数据里不存在或不是数组 */
  REPEAT_SOURCE_MISSING: {
    code: 'SYS_9053',
    status: 500,
    message: '单据模板引用了不存在的数据集合，请联系管理员',
  },
  RENDER_FAILED: {
    code: 'SYS_9054',
    status: 500,
    message: '单据出具失败，请重试或联系管理员并提供 traceId',
  },
  NOTHING_SELECTED: {
    code: 'SYS_9055',
    status: 400,
    message: '请至少选择一份单据再导出',
  },
  /** 合并导出一次最多多少份，防止一次点选把整年报价拖进内存 */
  TOO_MANY_SELECTED: {
    code: 'SYS_9056',
    status: 400,
    message: '一次合并导出的单据数量超出上限',
  },
  GENERATED_NOT_FOUND: {
    code: 'SYS_9057',
    status: 404,
    message: '生成的文件不存在或无权访问',
  },
} as const satisfies Record<string, BizErrorDefinition>

export type DocgenErrorKey = keyof typeof DOCGEN_ERRORS
