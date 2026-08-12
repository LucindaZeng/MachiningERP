import { DOCGEN_ERRORS } from '@machining-erp/shared'

import { BizError } from '../../../common/errors/biz-error'

import { repeatArraysOf } from './marker-parser'

/**
 * 重复区域的规划：**纯函数，不认识 ExcelJS**。
 *
 * 规则只有一条：**连续的、引用同一个数组的行构成一个区域**。
 * 不引入 `{{#each}}…{{/each}}` 这类成对定界符，因为在 Excel 里成对定界符
 * 要额外占两行或两格，业务改模板时最容易漏删一半，留下一个永远填不出来的表。
 * 「谁引用了哪个数组」这件事标记自己就说清楚了，不必再声明一遍。
 *
 * 区域可以跨多行（合并导出的每份单据一块，就是多行区域），
 * 一行同时引用两个数组则判为模板错误——那种表述没有确定的展开语义。
 */

export interface RepeatBlock {
  /** 数组名 */
  arrayName: string
  /** 1 基起始行号 */
  startRow: number
  /** 1 基结束行号（含） */
  endRow: number
}

/** 一行的模板文本。空行也要占位，否则行号会错位。 */
export interface RowTexts {
  rowNumber: number
  texts: readonly string[]
}

/**
 * 规划所有重复区域，按行号升序。
 *
 * @param sheetName 出错时报给使用者，让「模板哪里写错了」一眼可见
 */
export function planRepeatBlocks(rows: readonly RowTexts[], sheetName: string): RepeatBlock[] {
  const blocks: RepeatBlock[] = []
  let open: RepeatBlock | null = null

  for (const row of rows) {
    const names = repeatArraysOf(row.texts)
    if (names.length > 1) {
      throw new BizError(DOCGEN_ERRORS.AMBIGUOUS_REPEAT_ROW, {
        message: `模板「${sheetName}」第 ${row.rowNumber} 行同时引用了 ${names.join('、')}，无法确定展开方式`,
      })
    }

    const name = names[0] ?? null
    if (name === null) {
      open = null
      continue
    }

    // 与上一行同数组且行号相邻 → 并入同一区域；否则另起一块
    if (open !== null && open.arrayName === name && open.endRow === row.rowNumber - 1) {
      open.endRow = row.rowNumber
      continue
    }

    open = { arrayName: name, startRow: row.rowNumber, endRow: row.rowNumber }
    blocks.push(open)
  }

  return blocks
}

/**
 * 展开后的行号偏移。
 *
 * 从下往上展开是**必须的**：先动上面的区域会把下面区域的行号全部推走，
 * 于是第二个区域就填到了别的地方。倒序处理让每个区域展开时，
 * 它自己的行号还是模板里那个行号。
 */
export function blocksBottomUp(blocks: readonly RepeatBlock[]): RepeatBlock[] {
  return [...blocks].sort((left, right) => right.startRow - left.startRow)
}

/** 区域高度（行数）。 */
export function blockHeight(block: RepeatBlock): number {
  return block.endRow - block.startRow + 1
}
