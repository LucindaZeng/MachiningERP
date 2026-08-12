/**
 * 模板标记语法。
 *
 * 设计前提（见本模块 README）：**版式的唯一真相是模板文件本身**，代码只负责填数。
 * 因此标记必须写在单元格里、能被业务人员在 Excel 里直接看懂和挪位置——
 * 一旦改用「代码里写死单元格地址」，业务动一下模板就要改一次代码，
 * 而模板是会被动的（客户抬头换了、加一列备注），代码不该跟着抖。
 *
 * 四种标记，全部写在单元格文本里，与普通文字混排：
 *
 * | 写法 | 含义 |
 * | --- | --- |
 * | `{{customer.name}}` | 标量：按点分路径取值 |
 * | `{{*items.productName}}` | 重复行：`items` 是数组名，`productName` 是元素字段 |
 * | `{{*items.#}}` | 重复行内的 1 基序号 |
 * | `{{?currency=CNY}}` | 勾选标记：相等出 ⊙，否则出 ○ |
 *
 * 勾选标记刻意只出字符不出控件：原始模板（example/报价单模板/国内报价单.xls）
 * 的「⊙RMB ○USD ○HKD」本来就是打印出来给人看的字符，不是表单控件。
 */

/** 标记的起止定界符。选 `{{}}` 是因为它在 Excel 里不会被当成公式或数字。 */
export const MARKER_OPEN = '{{'
export const MARKER_CLOSE = '}}'

/** 重复行标记前缀：`{{*lines.qty}}` 中的 `*`。 */
export const REPEAT_PREFIX = '*'

/** 勾选标记前缀：`{{?currency=CNY}}` 中的 `?`。 */
export const SELECT_PREFIX = '?'

/** 重复行里取 1 基序号的字段名：`{{*lines.#}}`。 */
export const INDEX_FIELD = '#'

/** 勾选标记的两个字形。选中 ⊙，未选 ○——与原始模板逐字一致。 */
export const SELECTED_MARK = '⊙'
export const UNSELECTED_MARK = '○'

/**
 * 整个单元格恰好是一个标记时，写入**原生类型**（数字/日期）而不是字符串。
 * 理由：模板单元格自带数字格式（千分位、两位小数、日期格式），
 * 写成字符串会让格式失效，客户拿到的报价单里金额就不是右对齐的数字了，
 * 而且他们无法在 Excel 里对这一列求和。
 */
export const MARKER_ONLY_PATTERN = /^\s*\{\{([^{}]+)\}\}\s*$/
