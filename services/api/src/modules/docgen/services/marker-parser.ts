import {
  INDEX_FIELD,
  MARKER_CLOSE,
  MARKER_ONLY_PATTERN,
  MARKER_OPEN,
  REPEAT_PREFIX,
  SELECT_PREFIX,
} from '../constants/marker-syntax'

/**
 * 标记解析：**纯函数，不认识 ExcelJS**。
 *
 * 单独成文件的理由：填充引擎那一层要跟工作簿对象打交道，很难写细粒度测试；
 * 而「这段文字里有哪些标记、各是什么语义」是这个模块最容易出错也最值得
 * 逐条钉死的部分（分支覆盖 ≥ 90% 的要求主要落在这里）。
 */

/** 标量标记：`{{customer.name}}` */
export interface ScalarMarker {
  kind: 'scalar'
  /** 原始文本，替换时按它做字符串替换 */
  raw: string
  /** 点分路径 */
  path: string
}

/** 重复行标记：`{{*lines.qty}}` */
export interface RepeatMarker {
  kind: 'repeat'
  raw: string
  /** 数组名（路径的第一段） */
  arrayName: string
  /** 元素内字段路径；`#` 表示 1 基序号 */
  field: string
}

/** 勾选标记：`{{?currency=CNY}}` */
export interface SelectMarker {
  kind: 'select'
  raw: string
  path: string
  /** 期望值，字符串比较 */
  expected: string
}

export type Marker = ScalarMarker | RepeatMarker | SelectMarker

/**
 * 扫出一段文本里的全部标记。
 *
 * 不用正则一把梭：`{{` 与 `}}` 之间允许出现中文、空格、等号与点，
 * 手写扫描比一条越写越长的正则更容易在出错时看明白。
 */
export function parseMarkers(text: string): Marker[] {
  const markers: Marker[] = []
  let cursor = 0

  for (;;) {
    const start = text.indexOf(MARKER_OPEN, cursor)
    if (start < 0) break
    const end = text.indexOf(MARKER_CLOSE, start + MARKER_OPEN.length)
    if (end < 0) break

    const body = text.slice(start + MARKER_OPEN.length, end)
    const raw = text.slice(start, end + MARKER_CLOSE.length)
    const marker = toMarker(raw, body.trim())
    if (marker) markers.push(marker)
    cursor = end + MARKER_CLOSE.length
  }

  return markers
}

/** 单条标记体 → 结构。无法识别（空体、缺字段名）时返回 null，按普通文字处理。 */
function toMarker(raw: string, body: string): Marker | null {
  if (body.length === 0) return null

  if (body.startsWith(SELECT_PREFIX)) {
    const separator = body.indexOf('=')
    if (separator < 0) return null
    const path = body.slice(SELECT_PREFIX.length, separator).trim()
    if (path.length === 0) return null
    return { kind: 'select', raw, path, expected: body.slice(separator + 1).trim() }
  }

  if (body.startsWith(REPEAT_PREFIX)) {
    const path = body.slice(REPEAT_PREFIX.length).trim()
    const dot = path.indexOf('.')
    // 数组名与字段名都不能缺：`{{*lines}}` 没有指出要取元素的哪个字段
    if (dot <= 0 || dot === path.length - 1) return null
    return {
      kind: 'repeat',
      raw,
      arrayName: path.slice(0, dot),
      field: path.slice(dot + 1),
    }
  }

  return { kind: 'scalar', raw, path: body }
}

/** 这段文本是否恰好只有一个标记（决定写原生类型还是拼字符串）。 */
export function isMarkerOnly(text: string): boolean {
  return MARKER_ONLY_PATTERN.test(text)
}

/** 这一行涉及的重复数组名（去重、保序）。空数组表示这不是重复行。 */
export function repeatArraysOf(texts: readonly string[]): string[] {
  const names: string[] = []
  for (const text of texts) {
    for (const marker of parseMarkers(text)) {
      if (marker.kind === 'repeat' && !names.includes(marker.arrayName)) {
        names.push(marker.arrayName)
      }
    }
  }
  return names
}

/** 点分路径取值。任一段缺失即返回 undefined——模板写错字段名不该让整份文件出不来。 */
export function valueAt(source: unknown, path: string): unknown {
  let current = source
  for (const segment of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/** 重复行取值：`#` 给序号，其余走路径。 */
export function repeatValueAt(item: unknown, field: string, index: number): unknown {
  return field === INDEX_FIELD ? index + 1 : valueAt(item, field)
}
