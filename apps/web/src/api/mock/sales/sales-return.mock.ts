import { BizError } from '../../biz-error'

import { SALES_RETURNS } from './fulfilment.fixture'

import type { ReturnDisposition, ReturnResponsibility, SalesReturn } from '@/types/sales.types'

/* ------------------------------ 销退 / RMA ------------------------------ */

/**
 * 逐行补丁的入参形状。责任归属与处置方式的真相在**行**上——
 * 同一张 RMA 里本厂与委外责任可以并存，单头那两个字段是派生的。
 */
interface ReturnLinePatch {
  lineId?: string
  seq?: number
  responsibility?: string
  disposition?: string
  dispositionNote?: string
  allowanceMinor?: string
  receivedQty?: string
}

function findSalesReturn(id: string | undefined): SalesReturn {
  const record = SALES_RETURNS.find((item) => item.id === id || item.docNo === id)
  if (!record) {
    throw new BizError({ code: 'ORD_2800', message: '退货单不存在', status: 404 })
  }
  return record
}

function patchSalesReturn(id: string | undefined, patch: Partial<SalesReturn>): SalesReturn {
  const record = findSalesReturn(id)
  Object.assign(record, patch)
  return record
}

/** 首响与转品质判定是同一个动作，与后端 ReturnFlowService.respond 同一口径。 */
function respondToReturn(id: string | undefined): SalesReturn {
  return patchSalesReturn(id, {
    status: 'quality-judging',
    respondedAt: new Date().toISOString(),
  })
}

/**
 * fixture 的行没有 id，mock 下按 `lineId` 或 `seq` 定位；
 * 单头派生值随后按「全行一致取该值，否则 undecided + mixed」现算，
 * 与后端 toSalesReturnView 同一条规则。
 */
function applyReturnLines(
  record: SalesReturn,
  patches: ReturnLinePatch[],
  apply: (line: NonNullable<SalesReturn['lines']>[number], patch: ReturnLinePatch) => void,
): void {
  const lines = record.lines ?? []
  for (const patch of patches) {
    const line = lines.find(
      (item) => item.seq === patch.seq || `${record.docNo}-L${item.seq}` === patch.lineId,
    )
    if (line) apply(line, patch)
  }
  rollupReturnHeader(record)
}

function rollupReturnHeader(record: SalesReturn): void {
  const lines = record.lines ?? []
  if (lines.length === 0) return

  const responsibilities = lines.map((line) => line.responsibility)
  const dispositions = lines.map((line) => line.disposition)
  const uniform = <T,>(values: T[]): T | undefined =>
    values.every((value) => value === values[0]) ? values[0] : undefined

  const responsibility = uniform(responsibilities)
  const disposition = uniform(dispositions)
  record.responsibility = responsibility ?? 'undecided'
  record.disposition = disposition ?? 'undecided'
  record.mixedResponsibility = responsibility === undefined
  record.mixedDisposition = disposition === undefined
  // 涉及退款 / 补货 / 让步就升级财务，与后端 NEEDS_FINANCE_APPROVAL 同一张表
  record.needFinanceApproval = dispositions.some((item) =>
    item === 'refund' || item === 'replacement' || item === 'concession',
  )
}

function judgeReturn(id: string | undefined, body: { lines?: ReturnLinePatch[] }): SalesReturn {
  const record = findSalesReturn(id)
  applyReturnLines(record, body.lines ?? [], (line, patch) => {
    if (patch.responsibility) {
      line.responsibility = patch.responsibility.toLowerCase() as ReturnResponsibility
    }
  })
  record.status = 'disposition'
  return record
}

function disposeReturn(id: string | undefined, body: { lines?: ReturnLinePatch[] }): SalesReturn {
  const record = findSalesReturn(id)
  applyReturnLines(record, body.lines ?? [], (line, patch) => {
    if (patch.disposition) line.disposition = patch.disposition.toLowerCase() as ReturnDisposition
    if (patch.dispositionNote) line.dispositionNote = patch.dispositionNote
    if (patch.allowanceMinor) line.allowance = patch.allowanceMinor
  })
  return record
}

function receiveReturnGoods(id: string | undefined, body: { lines?: ReturnLinePatch[] }): SalesReturn {
  const record = findSalesReturn(id)
  const now = new Date().toISOString()
  applyReturnLines(record, body.lines ?? [], (line, patch) => {
    line.receivedAt = now
    if (patch.receivedQty) line.receivedQty = patch.receivedQty
  })
  return record
}

/**
 * 结案闸门：每一行都要有责任归属与处置，返工行还要已入库。
 * 与后端 collectClosureIssues 同一条规则——mock 通过不代表真实环境通过，
 * 但至少不让明显不该结的案在原型上结掉。
 */
function closeSalesReturn(id: string | undefined): SalesReturn {
  const record = findSalesReturn(id)
  const lines = record.lines ?? []

  const unresolved = lines.filter(
    (line) => line.responsibility === 'undecided' || line.disposition === 'undecided',
  )
  if (unresolved.length > 0) {
    throw new BizError({
      code: 'ORD_2807',
      message: `第 ${unresolved.map((line) => line.seq).join('、')} 行还没有明确的责任归属与处置方式`,
      status: 422,
    })
  }

  const notReceived = lines.filter((line) => line.disposition === 'rework' && !line.receivedAt)
  if (notReceived.length > 0) {
    throw new BizError({
      code: 'ORD_2811',
      message: `第 ${notReceived.map((line) => line.seq).join('、')} 行判为返工但尚未登记退货入库`,
      status: 409,
    })
  }

  return patchSalesReturn(id, { status: 'closed', closedAt: new Date().toISOString() })
}

/**
 * 销退 / RMA 的 mock 路由。单独一支文件是为了让 sales.mock.ts 守住 400 行上限，
 * 也让「RMA 的规则镜像」这件事集中在一处——真实后端改了口径，只改这里。
 */
export const SALES_RETURN_ROUTES: Array<{
  path: string
  handle: (params: string[], body: unknown) => unknown
}> = [
  { path: 'GET /sales-returns/:id', handle: ([id]) => findSalesReturn(id) },
  { path: 'POST /sales-returns/:id/respond', handle: ([id]) => respondToReturn(id) },
  {
    path: 'POST /sales-returns/:id/judge',
    handle: ([id], body) => judgeReturn(id, body as { lines?: ReturnLinePatch[] }),
  },
  {
    path: 'POST /sales-returns/:id/disposition',
    handle: ([id], body) => disposeReturn(id, body as { lines?: ReturnLinePatch[] }),
  },
  {
    path: 'POST /sales-returns/:id/approve',
    handle: ([id]) => patchSalesReturn(id, { status: 'executing' }),
  },
  {
    path: 'POST /sales-returns/:id/reject',
    handle: ([id], body) =>
      patchSalesReturn(id, {
        status: 'rejected',
        rejectReason: (body as { reason?: string })?.reason,
      }),
  },
  {
    path: 'POST /sales-returns/:id/receive',
    handle: ([id], body) => receiveReturnGoods(id, body as { lines?: ReturnLinePatch[] }),
  },
  { path: 'POST /sales-returns/:id/close', handle: ([id]) => closeSalesReturn(id) },
]
