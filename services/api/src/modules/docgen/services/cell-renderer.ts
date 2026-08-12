import { SELECTED_MARK, UNSELECTED_MARK } from '../constants/marker-syntax'

import { isMarkerOnly, parseMarkers, repeatValueAt, valueAt } from './marker-parser'

/**
 * 把一个单元格的模板文本渲染成最终值。**纯函数，不认识 ExcelJS。**
 *
 * 关键取舍：整格只有一个标记时返回**原生值**（number / Date / string），
 * 混排时返回拼好的字符串。原因写在 marker-syntax.ts 的 MARKER_ONLY_PATTERN 上——
 * 模板单元格自带数字与日期格式，把金额写成字符串会让格式失效，
 * 客户就没法在自己的 Excel 里对这一列求和。
 */

/** 渲染上下文：重复行需要知道当前元素与序号，普通行两者为 null。 */
export interface RenderContext {
  /** 整份文件的数据 */
  payload: unknown
  /** 当前重复元素；非重复行为 null */
  item: unknown
  /** 当前重复元素的 0 基下标；非重复行为 -1 */
  index: number
}

export type CellValue = string | number | boolean | Date | null

/** 非重复行的上下文。 */
export function rootContext(payload: unknown): RenderContext {
  return { payload, item: null, index: -1 }
}

/**
 * 渲染一格。
 *
 * 返回 `undefined` 表示「这格没有标记」——调用方据此**保持原值不动**，
 * 与「标记解析出来是空值」（返回 null，要清空）是两回事。
 */
export function renderCell(text: string, context: RenderContext): CellValue | undefined {
  const markers = parseMarkers(text)
  if (markers.length === 0) return undefined

  if (markers.length === 1 && isMarkerOnly(text)) {
    return single(markers[0]!, context)
  }

  let output = text
  for (const marker of markers) {
    output = output.split(marker.raw).join(toText(single(marker, context)))
  }
  return output
}

/** 单条标记求值。 */
function single(
  marker: ReturnType<typeof parseMarkers>[number],
  context: RenderContext,
): CellValue {
  if (marker.kind === 'select') {
    const actual = valueAt(context.payload, marker.path)
    return toText(normalize(actual)) === marker.expected ? SELECTED_MARK : UNSELECTED_MARK
  }

  if (marker.kind === 'repeat') {
    // 重复标记出现在非重复行上是模板写错了；给空值而不是抛异常——
    // 一份少了一格的报价单，比一份出不来的报价单更容易被发现和修
    if (context.index < 0) return null
    return normalize(repeatValueAt(context.item, marker.field, context.index))
  }

  return normalize(valueAt(context.payload, marker.path))
}

/** 未知类型一律落到字符串；null/undefined 落到 null（清空该格）。 */
function normalize(value: unknown): CellValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value
  }
  if (value instanceof Date) return value
  return String(value)
}

/** 拼字符串时的表现形式：null 出空串，日期出 YYYY-MM-DD。 */
function toText(value: CellValue): string {
  if (value === null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}
