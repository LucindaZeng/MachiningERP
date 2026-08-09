/**
 * 历史报价「工序级成本回溯」计算：
 * 把 OperationCostLine 展开成带「转入累计 / 本工序新增 / 转出累计」的回溯行，
 * 并按 材料 / 加工时间 / 工艺 三个分项汇总，用于报价 vs 实际的偏差定位。
 */
import type { HistoricalQuote, OperationCostLine } from '@/types/sales.types'

export type CostElement = '材料' | '加工时间' | '工艺'

export const COST_ELEMENTS: CostElement[] = ['材料', '加工时间', '工艺']

export interface TraceRow {
  line: OperationCostLine
  quoted: number
  actual: number | null
  /** 报价口径转入 / 转出累计 */
  quotedIn: number
  quotedOut: number
  /** 实际口径转入 / 转出累计 */
  actualIn: number | null
  actualOut: number | null
  diff: number | null
  diffRate: number | null
  minuteDiff: number | null
  share: number
}

export interface ElementSummary {
  element: CostElement
  quoted: number
  actual: number | null
  diff: number | null
  diffRate: number | null
  share: number
}

export interface TraceTotals {
  quoted: number
  actual: number | null
  diff: number | null
  diffRate: number | null
  hasActual: boolean
}

/** '—' / 空值统一转为 null，避免把未成交报价算成 0 成本 */
function toNumber(value: string | undefined): number | null {
  if (value === undefined || value === '' || value === '—') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function buildTraceRows(lines: OperationCostLine[]): TraceRow[] {
  const ordered = [...lines].sort((a, b) => a.seq - b.seq)
  const totalQuoted = ordered.reduce((sum, line) => sum + (toNumber(line.quotedCost) ?? 0), 0)

  let quotedCarry = 0
  let actualCarry: number | null = 0

  return ordered.map((line) => {
    const quoted = toNumber(line.quotedCost) ?? 0
    const actual = toNumber(line.actualCost)
    const quotedIn = quotedCarry
    const actualIn = actualCarry
    quotedCarry = quotedIn + quoted
    actualCarry = actual === null || actualIn === null ? null : actualIn + actual

    const stdMinutes = toNumber(line.stdMinutes)
    const actMinutes = toNumber(line.actMinutes)

    return {
      line,
      quoted,
      actual,
      quotedIn,
      quotedOut: quotedCarry,
      actualIn,
      actualOut: actualCarry,
      diff: actual === null ? null : actual - quoted,
      diffRate: actual === null || quoted === 0 ? null : (actual - quoted) / quoted,
      minuteDiff: stdMinutes === null || actMinutes === null ? null : actMinutes - stdMinutes,
      share: totalQuoted === 0 ? 0 : quoted / totalQuoted,
    }
  })
}

export function buildElementSummary(rows: TraceRow[]): ElementSummary[] {
  const totalQuoted = rows.reduce((sum, row) => sum + row.quoted, 0)

  return COST_ELEMENTS.map((element) => {
    const group = rows.filter((row) => row.line.element === element)
    const quoted = group.reduce((sum, row) => sum + row.quoted, 0)
    const hasActual = group.length > 0 && group.every((row) => row.actual !== null)
    const actual = hasActual ? group.reduce((sum, row) => sum + (row.actual ?? 0), 0) : null

    return {
      element,
      quoted,
      actual,
      diff: actual === null ? null : actual - quoted,
      diffRate: actual === null || quoted === 0 ? null : (actual - quoted) / quoted,
      share: totalQuoted === 0 ? 0 : quoted / totalQuoted,
    }
  })
}

export function buildTotals(rows: TraceRow[]): TraceTotals {
  const quoted = rows.reduce((sum, row) => sum + row.quoted, 0)
  const hasActual = rows.length > 0 && rows.every((row) => row.actual !== null)
  const actual = hasActual ? rows.reduce((sum, row) => sum + (row.actual ?? 0), 0) : null

  return {
    quoted,
    actual,
    diff: actual === null ? null : actual - quoted,
    diffRate: actual === null || quoted === 0 ? null : (actual - quoted) / quoted,
    hasActual,
  }
}

/** 报价单毛利额（单件）= 单价 − 成本 */
export function unitGross(quote: HistoricalQuote, cost: string | undefined): string {
  const price = toNumber(quote.unitPrice)
  const value = toNumber(cost)
  if (price === null || value === null) {
    return '—'
  }
  return (price - value).toFixed(2)
}

export function money(value: number | null, digits = 2): string {
  return value === null ? '—' : value.toFixed(digits)
}

export function signed(value: number | null, digits = 2): string {
  if (value === null) {
    return '—'
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
}

export function percent(value: number | null, digits = 1): string {
  if (value === null) {
    return '—'
  }
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`
}
