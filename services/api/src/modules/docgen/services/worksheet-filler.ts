import { DOCGEN_ERRORS } from '@machining-erp/shared'


import { BizError } from '../../../common/errors/biz-error'

import { renderCell, rootContext, type CellValue, type RenderContext } from './cell-renderer'
import { valueAt } from './marker-parser'
import { blockHeight, blocksBottomUp, planRepeatBlocks, type RepeatBlock } from './repeat-plan'

import type { Worksheet } from 'exceljs'

/**
 * 把数据填进一张工作表。这是唯一认识 ExcelJS 的填充逻辑。
 *
 * ⚠️ **合并单元格必须手工重建**（`instantiate` 里那段）。
 * ExcelJS 的 `duplicateRow` 会复制字体、边框与行高，但复制出来的合并区
 * 只存在于内存模型里，**写盘时会丢**。实测：复制 3 行后另存再打开，
 * 只有原行的合并还在。因此每个副本都要走一遍「先拆再合」——
 * 拆是因为内存里那份还在，不拆会撞上 “Cannot merge already merged cells”。
 * 丢了合并的后果不是不好看：产品名称本来跨 B:G，散开后会被右边的列盖住。
 */

/** 展开一个重复区域时，落到具体某一行的模板文本。 */
interface CapturedRow {
  /** 相对区域起始的行偏移 */
  offset: number
  cells: Array<{ column: number; text: string }>
}

/** 区域内的合并区，按相对行偏移与绝对列记录。 */
interface CapturedMerge {
  offset: number
  fromColumn: number
  toColumn: number
}

export function fillWorksheet(sheet: Worksheet, payload: unknown): void {
  const blocks = planRepeatBlocks(readRowTexts(sheet), sheet.name)

  // 自下而上展开：先动上面的区域会把下面区域的行号全部推走
  for (const block of blocksBottomUp(blocks)) {
    expandBlock(sheet, block, payload)
  }

  fillScalars(sheet, payload)
}

/** 抄下每一行的文本，交给纯函数去规划区域。 */
function readRowTexts(sheet: Worksheet): Array<{ rowNumber: number; texts: string[] }> {
  const rows: Array<{ rowNumber: number; texts: string[] }> = []
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const texts: string[] = []
    sheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell) => {
      const text = textOf(cell.value)
      if (text !== null) texts.push(text)
    })
    rows.push({ rowNumber, texts })
  }
  return rows
}

/** 展开一个重复区域：先抄模板、再造行、再逐份填。 */
function expandBlock(sheet: Worksheet, block: RepeatBlock, payload: unknown): void {
  const items = valueAt(payload, block.arrayName)
  if (!Array.isArray(items)) {
    throw new BizError(DOCGEN_ERRORS.REPEAT_SOURCE_MISSING, {
      message: `模板「${sheet.name}」引用的数据集合 ${block.arrayName} 不存在`,
    })
  }

  const height = blockHeight(block)
  const template = captureRows(sheet, block)
  const merges = captureMerges(sheet, block)
  // 明细区下方的合并区必须自己搬——理由见 shiftMergesBelow
  const below = capture(sheet, (range) => range.fromRow > block.endRow)

  if (items.length === 0) {
    // 一行数据都没有：删掉模板行，留一张只有表头表尾的空单，而不是留一行标记
    const own = capture(
      sheet,
      (range) => range.fromRow >= block.startRow && range.toRow <= block.endRow,
    )
    sheet.spliceRows(block.startRow, height)
    // 被删掉那几行自己的合并区不会随之消失，会**原地留下**；不清掉它，
    // 下方搬上来的合并区就会与它撞上而被静默丢弃（实测：条款区第一行合并没了）
    for (const merge of own) {
      try {
        sheet.unMergeCells(absoluteRange(merge, 0))
      } catch {
        // 已经不在了，忽略
      }
    }
    shiftMergesBelow(sheet, below, -height)
    return
  }

  if (items.length > 1) {
    duplicateBlock(sheet, block, items.length - 1)
    shiftMergesBelow(sheet, below, (items.length - 1) * height)
  }

  items.forEach((item, index) => {
    instantiate(sheet, block.startRow + index * height, template, merges, {
      payload,
      item,
      index,
    })
  })
}

/** 一个绝对坐标的合并区。 */
interface AbsoluteMerge {
  fromRow: number
  toRow: number
  fromColumn: number
  toColumn: number
}

function capture(sheet: Worksheet, keep: (range: AbsoluteMerge) => boolean): AbsoluteMerge[] {
  const captured: AbsoluteMerge[] = []
  for (const range of sheet.model.merges) {
    const parsed = parseRange(range)
    if (parsed && keep(parsed)) captured.push(parsed)
  }
  return captured
}

/**
 * 把明细区下方的合并区整体搬 `delta` 行。
 *
 * ⚠️ 这段不能省。ExcelJS 的 `duplicateRow(insert)` 与 `spliceRows` 会把**单元格的值**
 * 往下（或往上）搬，却**不动合并区的坐标**。于是两条明细就足以让下方整个条款区错位：
 * 「币别」的标签合并区还停在原来那一行，而值已经走了，
 * 打印出来是「币别 币别」「○现金 ⊙现 ○现」这种一格一个字的糊状表格。
 *
 * 单元测试抓不到这个——它只看得见值对不对。这是拿真模板出样张目检出来的。
 *
 * 顺序是有意的：**先全部拆，再全部合**。拆到一半就合，会撞上尚未拆掉的旧区间
 * （旧区间与新区间常常重叠，例如 A14:A22 要搬成 A16:A24）。
 */
function shiftMergesBelow(sheet: Worksheet, merges: readonly AbsoluteMerge[], delta: number): void {
  if (delta === 0 || merges.length === 0) return

  for (const merge of merges) {
    try {
      sheet.unMergeCells(absoluteRange(merge, 0))
    } catch {
      // 已经不在了，忽略
    }
  }

  for (const merge of merges) {
    if (merge.fromRow + delta < 1) continue
    try {
      sheet.mergeCells(absoluteRange(merge, delta))
    } catch {
      // 与相邻区间重叠说明模板本身有问题，跳过这一个而不是让整份文件出不来
    }
  }
}

function absoluteRange(merge: AbsoluteMerge, delta: number): string {
  const from = `${columnLetters(merge.fromColumn)}${merge.fromRow + delta}`
  const to = `${columnLetters(merge.toColumn)}${merge.toRow + delta}`
  return `${from}:${to}`
}

/** 抄下区域内每一格的模板文本。必须在造行之前抄，造完行原文就被覆盖了。 */
function captureRows(sheet: Worksheet, block: RepeatBlock): CapturedRow[] {
  const captured: CapturedRow[] = []
  for (let rowNumber = block.startRow; rowNumber <= block.endRow; rowNumber += 1) {
    const cells: CapturedRow['cells'] = []
    sheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, column) => {
      const text = textOf(cell.value)
      if (text !== null) cells.push({ column, text })
    })
    captured.push({ offset: rowNumber - block.startRow, cells })
  }
  return captured
}

/** 抄下区域内的合并区（只认单行内的横向合并——跨行合并的行不可能是重复行）。 */
function captureMerges(sheet: Worksheet, block: RepeatBlock): CapturedMerge[] {
  const captured: CapturedMerge[] = []
  for (const range of sheet.model.merges) {
    const parsed = parseRange(range)
    if (!parsed) continue
    const { fromRow, toRow, fromColumn, toColumn } = parsed
    if (fromRow !== toRow) continue
    if (fromRow < block.startRow || fromRow > block.endRow) continue
    captured.push({ offset: fromRow - block.startRow, fromColumn, toColumn })
  }
  return captured
}

/** `B11:G11` → 行列号。解析不了就跳过，不让一个奇怪的区间拖垮整份文件。 */
function parseRange(
  range: string,
): { fromRow: number; toRow: number; fromColumn: number; toColumn: number } | null {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range)
  if (!match) return null
  return {
    fromColumn: columnNumber(match[1]!),
    fromRow: Number(match[2]),
    toColumn: columnNumber(match[3]!),
    toRow: Number(match[4]),
  }
}

function columnNumber(letters: string): number {
  let value = 0
  for (const letter of letters) {
    value = value * 26 + (letter.charCodeAt(0) - 64)
  }
  return value
}

/**
 * 造出 `copies` 份副本。
 *
 * ⚠️ 行序在多行区域上很容易做错：逐个模板行各自 `duplicateRow(n)` 得到的是
 * 「AAABBB」，而我们要的是「ABABAB」。所以这里改成两步——
 * 先在区域末尾一次性追加 `copies × 区域高度` 行（`duplicateRow` 会把下方内容
 * 整体推下去，这一点必须借它的手），再逐行把样式从对应的模板行搬过来。
 * 单行区域走不到第二步，样式由 `duplicateRow` 自己带准。
 */
function duplicateBlock(sheet: Worksheet, block: RepeatBlock, copies: number): void {
  const height = blockHeight(block)
  sheet.duplicateRow(block.endRow, copies * height, true)
  if (height === 1) return

  for (let copy = 1; copy <= copies; copy += 1) {
    for (let offset = 0; offset < height; offset += 1) {
      copyRowStyle(sheet, block.startRow + offset, block.startRow + copy * height + offset)
    }
  }
}

/** 把一行的行高与逐格样式搬到另一行。值不搬——值由 `instantiate` 按模板文本重新渲染。 */
function copyRowStyle(sheet: Worksheet, sourceRow: number, targetRow: number): void {
  const source = sheet.getRow(sourceRow)
  const target = sheet.getRow(targetRow)
  target.height = source.height

  for (let column = 1; column <= sheet.columnCount; column += 1) {
    target.getCell(column).style = source.getCell(column).style
  }
}

/** 把一份数据填进某一份副本，并重建它的合并区。 */
function instantiate(
  sheet: Worksheet,
  startRow: number,
  template: readonly CapturedRow[],
  merges: readonly CapturedMerge[],
  context: RenderContext,
): void {
  // 先拆再合：内存里已有的那份不拆掉，mergeCells 会直接抛错
  for (const merge of merges) {
    const range = rangeOf(startRow + merge.offset, merge.fromColumn, merge.toColumn)
    try {
      sheet.unMergeCells(range)
    } catch {
      // 本来就没合并，忽略
    }
    sheet.mergeCells(range)
  }

  for (const row of template) {
    for (const cell of row.cells) {
      const rendered = renderCell(cell.text, context)
      if (rendered === undefined) continue
      sheet.getRow(startRow + row.offset).getCell(cell.column).value = rendered
    }
  }
}

function rangeOf(row: number, fromColumn: number, toColumn: number): string {
  return `${columnLetters(fromColumn)}${row}:${columnLetters(toColumn)}${row}`
}

function columnLetters(column: number): string {
  let letters = ''
  let remaining = column
  while (remaining > 0) {
    const remainder = (remaining - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    remaining = Math.floor((remaining - 1) / 26)
  }
  return letters
}

/** 填所有非重复格。重复区展开完再做，避免把展开后的行又当标量填一遍。 */
function fillScalars(sheet: Worksheet, payload: unknown): void {
  const context = rootContext(payload)
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = textOf(cell.value)
      if (text === null) return
      const rendered = renderCell(text, context)
      if (rendered !== undefined) cell.value = rendered as CellValue
    })
  })
}

/**
 * 取一格的可填充文本。
 *
 * 只认字符串与富文本：数字、日期、公式格里不会有标记，
 * 而**公式格必须原样留着**——模板里的合计公式是模板的一部分，不是数据。
 */
function textOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value !== null && typeof value === 'object' && 'richText' in value) {
    const parts = (value as { richText: Array<{ text: string }> }).richText
    return parts.map((part) => part.text).join('')
  }
  return null
}
