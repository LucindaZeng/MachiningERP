import { statementLineTypeOf, type ReturnStatementLineType } from '../constants/return-dispositions'

import type { ReturnDisposition } from '@prisma/client'

/**
 * RMA → 客户对账单的扣减口径（纯函数）。
 *
 * 三条决定了这里长什么样的规则：
 *
 * 1. **只有动钱的处置进对账单。** 返工把货修好还回去、补货「补发不另收费」
 *    ——这两条不改变任何应收，进对账单只会让客户以为自己又被减了一次。
 * 2. **让步是折让，不是退货。** 客户把货留下了，只是少付钱；
 *    在对账单上写「退货」，客户看到的是一笔他手里明明还有货的退货行。
 * 3. **金额分两种取法。** 退款 / 报废扣该行整笔货值；
 *    让步只扣谈定的减价额——那是个谈出来的数字，系统推算不出来，必须录入。
 */

export interface ReturnDeductionFacts {
  disposition: ReturnDisposition
  /** 该行涉及货值（正数） */
  amountMinor: bigint
  /** 让步谈定的减价额；只有 CONCESSION 用 */
  allowanceMinor: bigint | null
}

/**
 * 该行在对账单上算哪一类；`null` = 不进对账单。
 * 判定表在 constants/return-dispositions.ts，这里只是转发，
 * 好让「口径」这件事只有一处定义。
 */
export function deductionTypeOf(disposition: ReturnDisposition): ReturnStatementLineType | null {
  return statementLineTypeOf(disposition)
}

/**
 * 该行的扣减金额（正数；符号由对账汇总按类型统一加）。
 *
 * 让步而没录折让额时返回 0 而不是抛错：结案闸门已经把这种行拦在结案之前了，
 * 而对账取数读的是**已结案**的单——真读到 0，说明有更早的一道闸门漏了，
 * 那该由测试抓出来，不该让对账单在半夜炸掉。
 */
export function deductionMinorOf(line: ReturnDeductionFacts): bigint {
  const type = deductionTypeOf(line.disposition)
  if (type === null) return 0n
  if (line.disposition === 'CONCESSION') return absOf(line.allowanceMinor ?? 0n)
  return absOf(line.amountMinor)
}

function absOf(value: bigint): bigint {
  return value < 0n ? -value : value
}

/** 整张单对某一类的扣减合计，用于结案播报与自检。 */
export function totalDeductionOf(
  lines: readonly ReturnDeductionFacts[],
  type: ReturnStatementLineType,
): bigint {
  return lines
    .filter((line) => deductionTypeOf(line.disposition) === type)
    .reduce((sum, line) => sum + deductionMinorOf(line), 0n)
}
