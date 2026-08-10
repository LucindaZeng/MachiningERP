import {
  NEEDS_FINANCE_APPROVAL,
  REQUIRES_REASON,
  requiresGoodsReceipt,
} from '../constants/return-dispositions'

import type { ReturnDisposition, ReturnResponsibility } from '@prisma/client'

/**
 * 逐行处置的纯规则：结案闸门、单头派生值、财务升级判定。
 *
 * **为什么逐行**：一张 RMA 里「本厂加工不良」与「委外表处不良」可以同时存在
 * （fixture RT1 就是这样：平面度超差 + 镀锌层附着力不良）。单头一个字段说不清，
 * 而分析报表本来就是按批统计的，一批 = 一行。单头因此只是派生视图。
 *
 * 本文件不碰数据库、不发事件、不抛异常——它只回答「哪些地方还不满足」，
 * 由服务层决定抛哪个错误码。这样每一条规则都能单独测。
 */

export interface ReturnLineFacts {
  sequence: number
  productName: string
  responsibility: ReturnResponsibility
  disposition: ReturnDisposition
  dispositionNote: string | null
  /** 该行涉及货值（最小货币单位，正数） */
  amountMinor: bigint
  /** 让步接收谈定的减价额；只有 CONCESSION 用 */
  allowanceMinor: bigint | null
  /** 物理退货入库时间；返工必须先有它 */
  receivedAt: Date | null
}

export type ClosureIssueKind =
  | 'RESPONSIBILITY_UNDECIDED'
  | 'DISPOSITION_UNDECIDED'
  | 'REASON_MISSING'
  | 'ALLOWANCE_MISSING'
  | 'ALLOWANCE_TOO_LARGE'
  | 'GOODS_NOT_RECEIVED'

export interface ClosureIssue {
  kind: ClosureIssueKind
  sequence: number
  productName: string
  detail: string
}

function hasText(value: string | null): boolean {
  return value !== null && value.trim().length > 0
}

/**
 * 结案闸门：**每一行**都要有责任归属与处置方式，动钱的行还要有理由与金额。
 *
 * 一次收集全部问题再一起返回，而不是遇到第一条就抛：业务员改一轮就该能过，
 * 不该被逼着一条一条试。
 */
export function collectClosureIssues(lines: readonly ReturnLineFacts[]): ClosureIssue[] {
  return lines.flatMap((line) => lineIssues(line))
}

function lineIssues(line: ReturnLineFacts): ClosureIssue[] {
  const at = { sequence: line.sequence, productName: line.productName }
  const issues: ClosureIssue[] = []

  if (line.responsibility === 'UNDECIDED') {
    issues.push({ ...at, kind: 'RESPONSIBILITY_UNDECIDED', detail: '责任归属未判定' })
  }
  if (line.disposition === 'UNDECIDED') {
    // 处置未定时后面几条都无从谈起，直接返回，避免刷出一串派生噪音
    issues.push({ ...at, kind: 'DISPOSITION_UNDECIDED', detail: '处置方式未确定' })
    return issues
  }

  if (REQUIRES_REASON[line.disposition] && !hasText(line.dispositionNote)) {
    issues.push({ ...at, kind: 'REASON_MISSING', detail: '退款 / 让步 / 报废必须写明理由' })
  }
  issues.push(...allowanceIssues(line, at))
  if (requiresGoodsReceipt(line.disposition) && line.receivedAt === null) {
    issues.push({ ...at, kind: 'GOODS_NOT_RECEIVED', detail: '返工前必须先登记退货入库' })
  }

  return issues
}

function allowanceIssues(
  line: ReturnLineFacts,
  at: { sequence: number; productName: string },
): ClosureIssue[] {
  if (line.disposition !== 'CONCESSION') return []

  if (line.allowanceMinor === null) {
    return [{ ...at, kind: 'ALLOWANCE_MISSING', detail: '让步接收必须录入谈定的折让金额' }]
  }
  if (line.allowanceMinor > line.amountMinor) {
    return [
      {
        ...at,
        kind: 'ALLOWANCE_TOO_LARGE',
        detail: `折让 ${line.allowanceMinor} 超过该行货值 ${line.amountMinor}`,
      },
    ]
  }
  return []
}

/**
 * 单头展示的责任归属：全行一致就取该值，否则回落到「待判定」。
 *
 * 与出货单尾数路径同一条道理——多数派标签会歪曲其余的行，
 * 与其给一个看似确定的错答案，不如明说这单要按行看。
 */
export function rollupResponsibility(
  lines: readonly ReturnLineFacts[],
): ReturnResponsibility {
  return rollup(lines.map((line) => line.responsibility), 'UNDECIDED')
}

export function rollupDisposition(lines: readonly ReturnLineFacts[]): ReturnDisposition {
  return rollup(lines.map((line) => line.disposition), 'UNDECIDED')
}

function rollup<T extends string>(values: readonly T[], fallback: T): T {
  const first = values[0]
  if (first === undefined) return fallback
  return values.every((value) => value === first) ? first : fallback
}

/** 单头是不是「按行不一」——前端要据此提示用户展开明细看。 */
export function isMixedDisposition(lines: readonly ReturnLineFacts[]): boolean {
  return isMixed(lines.map((line) => line.disposition))
}

export function isMixedResponsibility(lines: readonly ReturnLineFacts[]): boolean {
  return isMixed(lines.map((line) => line.responsibility))
}

function isMixed<T extends string>(values: readonly T[]): boolean {
  const first = values[0]
  if (first === undefined) return false
  return values.some((value) => value !== first)
}

/**
 * 只要有一行涉及退款 / 补货 / 让步，整张单就要升级到财务与总经办。
 * 升级是单头层面的事：审批的是「这张单能不能这么处理」，不是逐行盖章。
 */
export function needsFinanceApproval(lines: readonly ReturnLineFacts[]): boolean {
  return lines.some((line) => NEEDS_FINANCE_APPROVAL[line.disposition])
}

/** 判为返工的行——只有这些要送去 rework 模块拆工单。 */
export function reworkLines(lines: readonly ReturnLineFacts[]): ReturnLineFacts[] {
  return lines.filter((line) => line.disposition === 'REWORK')
}
