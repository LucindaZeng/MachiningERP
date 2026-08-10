import type { StatementLineType } from '@prisma/client'

/**
 * 对账单汇总（业务规格第 7 章末段）。
 *
 * > 按客户和期间自动汇总出货明细、发票、收款、退货折让和未收余额……
 * > 数据与财务应收一致，业务不得手工修改金额，对账差异回到源单处理并留痕。
 *
 * 因此这里是一个**纯函数**：输入只有源单条目，没有任何可人工覆写的入口。
 * 期末余额口径可配（发货制 / 开票制），但无论哪种口径，
 * 期末都必须等于「期初 + 本期计入 − 回款 − 退货折让」，不留手改余地。
 */

/** 期末余额的计价口径：按发货金额入账，还是按已开票金额入账。 */
export type StatementBasis = 'SHIPMENT' | 'INVOICE'

export interface AggregationEntry {
  occurredAt: Date
  type: StatementLineType
  docNo: string
  productName: string | null
  quantity: string | null
  /** 一律传正数；正负号由本模块按类型决定 */
  amountMinor: bigint
  remark: string | null
  /**
   * 仅 RETURN / ALLOWANCE 用：这笔扣减是否已由红字发票承接。
   *
   * 同一笔退款可以有两条账面痕迹——RMA 上的扣减，和为它开的红字发票。
   * 两者都是真的，但**只能减一次**，否则客户少付两遍。哪一条算数取决于口径：
   * 见 `countsTowardReturns`。
   */
  settledByCreditNote?: boolean
}

export interface AggregationInput {
  openingBalanceMinor: bigint
  basis: StatementBasis
  entries: readonly AggregationEntry[]
  overdueAmountMinor: bigint
  /** 客户自己账面的期末余额；缺省视为与我方一致（差异 0） */
  customerClosingMinor?: bigint | null
}

export interface AggregationTotals {
  openingBalanceMinor: bigint
  shippedAmountMinor: bigint
  invoicedAmountMinor: bigint
  receivedAmountMinor: bigint
  returnAmountMinor: bigint
  closingBalanceMinor: bigint
  differenceAmountMinor: bigint
  overdueAmountMinor: bigint
}

/**
 * 明细行上的带符号金额：回款、退货、折让都是减项，直接存负数。
 *
 * **开票是唯一保留来源符号的类型**：红字发票本身就是一张负数发票，
 * 强行取正会把红冲累加成开票额。其余类型的源单一律按类型规范化符号。
 */
export function signedAmountOf(type: StatementLineType, amountMinor: bigint): bigint {
  const magnitude = amountMinor < 0n ? -amountMinor : amountMinor
  switch (type) {
    case 'RECEIPT':
    case 'RETURN':
    case 'ALLOWANCE':
      return -magnitude
    case 'INVOICE':
      return amountMinor
    default:
      return magnitude
  }
}

function sumOf(entries: readonly AggregationEntry[], types: readonly StatementLineType[]): bigint {
  return entries
    .filter((entry) => types.includes(entry.type))
    .reduce((sum, entry) => sum + (entry.amountMinor < 0n ? -entry.amountMinor : entry.amountMinor), 0n)
}

/** 开票额按**带符号**汇总：红字发票是负数，必须冲减而不是累加。 */
function signedSumOf(entries: readonly AggregationEntry[], type: StatementLineType): bigint {
  return entries
    .filter((entry) => entry.type === type)
    .reduce((sum, entry) => sum + entry.amountMinor, 0n)
}

/**
 * 一笔退货 / 折让算不算进「退货折让」列——**每种口径只认一个规范来源**。
 *
 * 一笔退款在账上有两条痕迹：RMA 结案时那笔扣减，和财务为它开的红字发票。
 * 两条都是真的，但客户只该被减一次。谁是规范来源，取决于期末余额怎么算：
 *
 * - **发货制**：期末 = 期初 + 发货 − 回款 − 退货折让。红字只影响「开票」这个
 *   展示列，压根不参与期末计算，所以 RMA 那笔扣减永远算数。
 * - **开票制**：期末 = 期初 + 开票 − 回款 − 退货折让。红字发票是一张负数发票，
 *   已经把开票列减下去了；此时 RMA 那笔扣减必须让位，否则减两遍。
 *
 * 明细行两条都照常列出（客户有权看见完整的来龙去脉），只是开票制下
 * 被红字承接的那条不计入合计——这一点由 remark 向客户说明。
 */
export function countsTowardReturns(entry: AggregationEntry, basis: StatementBasis): boolean {
  if (entry.type !== 'RETURN' && entry.type !== 'ALLOWANCE') return false
  return basis === 'INVOICE' ? entry.settledByCreditNote !== true : true
}

export function aggregateStatement(input: AggregationInput): AggregationTotals {
  const shipped = sumOf(input.entries, ['SHIPMENT'])
  const invoiced = signedSumOf(input.entries, 'INVOICE')
  const received = sumOf(input.entries, ['RECEIPT'])
  const returned = input.entries
    .filter((entry) => countsTowardReturns(entry, input.basis))
    .reduce((sum, entry) => sum + (entry.amountMinor < 0n ? -entry.amountMinor : entry.amountMinor), 0n)

  // 发货制把「已发未开票」也算进应收；开票制只认已开票金额。两种口径都不允许手改。
  const charged = input.basis === 'INVOICE' ? invoiced : shipped
  const closing = input.openingBalanceMinor + charged - received - returned

  const customerClosing = input.customerClosingMinor
  const difference = customerClosing === null || customerClosing === undefined
    ? 0n
    : closing - customerClosing

  return {
    openingBalanceMinor: input.openingBalanceMinor,
    shippedAmountMinor: shipped,
    invoicedAmountMinor: invoiced,
    receivedAmountMinor: received,
    returnAmountMinor: returned,
    closingBalanceMinor: closing,
    differenceAmountMinor: difference,
    overdueAmountMinor: input.overdueAmountMinor,
  }
}

/** 明细按发生日期排序后重编序号，保证同一份数据每次重算的行号稳定。 */
export function orderEntries(entries: readonly AggregationEntry[]): AggregationEntry[] {
  return [...entries].sort((left, right) => {
    const byDate = left.occurredAt.getTime() - right.occurredAt.getTime()
    return byDate !== 0 ? byDate : left.docNo.localeCompare(right.docNo)
  })
}
