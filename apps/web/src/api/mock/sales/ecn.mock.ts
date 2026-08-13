import { BizError } from '../../biz-error'

import { ENGINEERING_CHANGES } from './ecn.fixture'

import type { EngineeringChange } from '@/types/sales.types'

/**
 * ECN 的 mock 路由。规则与后端保持镜像，尤其是那四道闸门：
 * 受理范围、样品阶段重定向、四项影响评全、改图必须同步工艺路线——
 * **mock 通过不代表真实环境通过**，但至少不让明显不该放行的操作在原型上过去。
 */

const SIGNOFF_DEPARTMENTS = ['PMC', '采购', '生产', '品质', '财务']

/** 服务端受理的四种；其余在这里就要按正确去处拒掉。 */
const REDIRECTED_INTENTS: Record<string, string> = {
  quantity: '改数量请走「订单管理 → 订单修改申请（ORC）」（业务规格 4.6）',
  delivery: '改交期请走「订单管理 → 订单修改申请（ORC）」（业务规格 4.6）',
  packing: '改包装要求请走「订单管理 → 订单修改申请（ORC）」',
  price: '改价格请走「报价管理 → 报价单修改申请（QRC）」（业务规格 2.5）',
  requirement: '客户其它要求变更请按落点选择：涉及订单信息走订单修改申请，涉及价格走报价单修改申请',
}

const SERVER_TO_LOCAL: Record<string, EngineeringChange['changeType']> = {
  DRAWING: 'drawing',
  MATERIAL: 'material',
  SURFACE: 'surface',
  PROCESS: 'process',
}

function findChange(id: string | undefined): EngineeringChange {
  const record = ENGINEERING_CHANGES.find((item) => item.id === id || item.docNo === id)
  if (!record) {
    throw new BizError({ code: 'ORD_3000', message: '工程变更申请不存在', status: 404 })
  }
  return record
}

function patchChange(
  id: string | undefined,
  patch: Partial<EngineeringChange>,
): EngineeringChange {
  const record = findChange(id)
  Object.assign(record, patch)
  record.versionLock = (record.versionLock ?? 0) + 1
  return record
}

/** 受理范围闸门：越界时必须点名正确去处，否则用户换个字眼再提一次。 */
function assertInScope(changeType: string): EngineeringChange['changeType'] {
  const local = SERVER_TO_LOCAL[changeType] ?? (changeType as EngineeringChange['changeType'])
  if (SERVER_TO_LOCAL[changeType] || ['drawing', 'material', 'surface', 'process'].includes(local)) {
    return local
  }

  const hint = REDIRECTED_INTENTS[local]
  throw new BizError({
    code: 'ORD_3004',
    status: 422,
    message: hint
      ? `「${local}」不属于工程变更申请的受理范围：${hint}`
      : `「${local}」不属于工程变更申请的受理范围；ECN 只受理改图、改材料、改表面处理与随之同步的工艺变更`,
  })
}

/** 四项影响必须评全才能送会签，与后端 assertImpactsAssessed 同一条规则。 */
function assertImpactsAssessed(record: EngineeringChange): void {
  const required = ['在制工单', '已采购物料', '已完工库存', '已发货批次']
  const assessed = record.impacts.map((impact) => impact.scope)
  const missing = required.filter((scope) => !assessed.includes(scope))
  if (missing.length) {
    throw new BizError({
      code: 'ORD_3009',
      status: 422,
      message: `影响评估尚缺：${missing.join('、')}`,
    })
  }
}

/** 批准前置：改图必须已同步工艺路线；改工序必须指定生效批次。 */
function assertReleasable(record: EngineeringChange): void {
  if (record.changeType === 'drawing' && !record.routingUpdated) {
    throw new BizError({
      code: 'ORD_3007',
      status: 422,
      message: '图纸变更尚未同步更新工艺路线，不允许批准发布',
    })
  }
  if (record.changeType === 'process' && !record.effectiveBatch) {
    throw new BizError({
      code: 'ORD_3008',
      status: 422,
      message: '工艺工序变更必须指定生效批次版本后才能批准',
    })
  }
  if (!record.signoffs?.length) {
    throw new BizError({
      code: 'ORD_3012',
      status: 422,
      message: `尚未会签的部门：${SIGNOFF_DEPARTMENTS.join('、')}`,
    })
  }
}

function createChange(body: unknown): EngineeringChange {
  const input = (body ?? {}) as Record<string, string | boolean | undefined>
  const changeType = assertInScope(String(input.changeType ?? ''))

  if (changeType === 'drawing' && !input.newDrawingVersionId) {
    throw new BizError({
      code: 'ORD_3006',
      status: 422,
      message: '图纸变更必须上传新版图纸后才能提交评估',
    })
  }

  const sequence = ENGINEERING_CHANGES.length + 1
  const record: EngineeringChange = {
    id: `EC-LOCAL-${sequence}`,
    docNo: `ECN-LOCAL-${String(sequence).padStart(4, '0')}`,
    customerName: String(input.customerId ?? '（本地占位）'),
    orderNo: input.orderId ? String(input.orderId) : undefined,
    productName: String(input.productName ?? ''),
    drawingNo: String(input.drawingNo ?? ''),
    changeType,
    origin: input.origin === 'INTERNAL' ? 'internal' : 'customer',
    urgent: Boolean(input.urgent),
    beforeValue: String(input.beforeValue ?? ''),
    afterValue: String(input.afterValue ?? ''),
    reason: String(input.reason ?? ''),
    impacts: [],
    routingUpdated: false,
    needRequote: false,
    needOrderReapproval: false,
    status: 'submitted',
    owner: '业务 · 本地',
    submittedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    signoffs: [],
    timeline: [{ node: 'ECN-01 业务提交变更申请', owner: '业务 · 本地', state: 'done' }],
    versionLock: 0,
  }
  ENGINEERING_CHANGES.push(record)
  return record
}

/**
 * 生产影响分类闸门（规格第 6 章新增规则）。未判定不许送会签——
 * 分类决定了后面要不要清点、要不要返工，不填等于把两步一起跳过。
 */
function assertProductionImpactClassified(record: EngineeringChange): void {
  if (record.productionImpact) return
  throw new BizError({
    code: 'ORD_3013',
    status: 422,
    message: '请先判定本次变更对生产有无影响（无影响 / 有影响）再送会签',
  })
}

/** 结案闸门：「有影响」必须清点完并已发起返工；「无影响」两步都跳过。 */
function assertClosable(record: EngineeringChange): void {
  if (record.productionImpact !== 'impacted') return

  if (!record.affectedLines?.length) {
    throw new BizError({
      code: 'ORD_3016',
      status: 422,
      message: '对生产有影响的变更必须先由 PMC 录入受影响数量',
    })
  }
  if (!record.reworkInitiatedAt) {
    throw new BizError({
      code: 'ORD_3017',
      status: 422,
      message: '对生产有影响的变更必须先发起返工才能结案',
    })
  }
}

/** 本地清点录入。返工一经发起即锁死，与后端 assertQuantityEntryEditable 同一条规则。 */
function enterQuantities(id: string | undefined, body: unknown): EngineeringChange {
  const record = findChange(id)
  if (record.reworkInitiatedAt) {
    throw new BizError({
      code: 'ORD_3015',
      status: 409,
      message: '返工已发起，受影响数量不可再修改；如需调整请另开变更单',
    })
  }

  const input = (body ?? {}) as {
    lines?: Array<{ productName: string; drawingNo: string; affectedQty: string; note?: string | null }>
  }
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')

  return patchChange(id, {
    affectedLines: (input.lines ?? []).map((line) => ({
      productName: line.productName,
      drawingNo: line.drawingNo,
      affectedQty: line.affectedQty,
      note: line.note ?? null,
      enteredBy: 'PMC · 本地',
      enteredAt: now,
    })),
  })
}

/** 本地发起返工。真实环境这里会发出带新旧图纸版本的返工事件，mock 只锁数量。 */
function initiateRework(id: string | undefined): EngineeringChange {
  const record = findChange(id)
  if (record.productionImpact !== 'impacted') {
    throw new BizError({
      code: 'ORD_3013',
      status: 422,
      message: '仅「对生产有影响」的变更需要发起返工',
    })
  }
  if (record.reworkInitiatedAt) {
    throw new BizError({ code: 'ORD_3018', status: 409, message: '返工已发起，不可重复发起' })
  }
  if (!record.affectedLines?.length) {
    throw new BizError({
      code: 'ORD_3016',
      status: 422,
      message: '对生产有影响的变更必须先由 PMC 录入受影响数量',
    })
  }

  return patchChange(id, {
    reworkInitiatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  })
}

/** 本地评估：把四项写进去，并按入参更新两个下游标志。 */
function assess(id: string | undefined, body: unknown): EngineeringChange {
  const input = (body ?? {}) as {
    impacts?: Array<{ scope: string; quantity: string; amountMinor?: string | null; note: string }>
    productionImpact?: string
    routingUpdated?: boolean
    effectiveBatch?: string | null
    needRequote?: boolean
    needOrderReapproval?: boolean
  }
  const label: Record<string, string> = {
    WIP: '在制工单',
    PURCHASED: '已采购物料',
    FINISHED_STOCK: '已完工库存',
    SHIPPED: '已发货批次',
  }

  return patchChange(id, {
    impacts: (input.impacts ?? []).map((impact) => ({
      scope: label[impact.scope] ?? impact.scope,
      quantity: impact.quantity,
      // 空表示「算不出钱」，与 0.00 是两回事
      amount:
        impact.amountMinor === null || impact.amountMinor === undefined
          ? '—'
          : (Number(impact.amountMinor) / 100).toFixed(2),
      note: impact.note,
    })),
    productionImpact: input.productionImpact === 'impacted' ? 'impacted' : 'none',
    routingUpdated: Boolean(input.routingUpdated),
    effectiveBatch: input.effectiveBatch ?? undefined,
    needRequote: Boolean(input.needRequote),
    needOrderReapproval: Boolean(input.needOrderReapproval),
  })
}

export const ECN_ROUTES: Array<{
  path: string
  handle: (params: string[], body: unknown) => unknown
}> = [
  { path: 'GET /engineering-changes/:id', handle: ([id]) => findChange(id) },
  { path: 'POST /engineering-changes', handle: (_params, body) => createChange(body) },
  {
    path: 'POST /engineering-changes/:id/start-assessment',
    handle: ([id]) => patchChange(id, { status: 'assessing' }),
  },
  {
    path: 'POST /engineering-changes/:id/return-for-detail',
    handle: ([id]) => patchChange(id, { status: 'submitted' }),
  },
  { path: 'POST /engineering-changes/:id/assess', handle: ([id], body) => assess(id, body) },
  {
    path: 'POST /engineering-changes/:id/submit-signoff',
    handle: ([id]) => {
      const record = findChange(id)
      assertImpactsAssessed(record)
      assertProductionImpactClassified(record)
      return patchChange(id, { status: 'reviewing' })
    },
  },
  {
    path: 'POST /engineering-changes/:id/signoff',
    handle: ([id], body) => {
      const opinion = (body as { opinion?: string })?.opinion
      return patchChange(id, {
        signoffs: SIGNOFF_DEPARTMENTS.map((department) => ({
          department,
          signedBy: '工程 · 本地',
          signedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
          opinion: opinion || '该部门模块尚未上线，由工程岗代签',
          proxied: true,
        })),
      })
    },
  },
  {
    path: 'POST /engineering-changes/:id/approve',
    handle: ([id]) => {
      assertReleasable(findChange(id))
      return patchChange(id, { status: 'approved' })
    },
  },
  {
    path: 'POST /engineering-changes/:id/reject',
    handle: ([id], body) => {
      const reason = (body as { reason?: string })?.reason?.trim()
      if (!reason) {
        throw new BizError({ code: 'ORD_3010', status: 400, message: '驳回工程变更必须填写理由' })
      }
      return patchChange(id, { status: 'rejected', rejectReason: reason })
    },
  },
  {
    path: 'POST /engineering-changes/:id/execute',
    handle: ([id]) => patchChange(id, { status: 'executing' }),
  },
  {
    path: 'POST /engineering-changes/:id/close',
    handle: ([id]) => {
      assertClosable(findChange(id))
      return patchChange(id, { status: 'closed' })
    },
  },
  {
    path: 'POST /engineering-changes/:id/affected-quantities',
    handle: ([id], body) => enterQuantities(id, body),
  },
  {
    path: 'POST /engineering-changes/:id/initiate-rework',
    handle: ([id]) => initiateRework(id),
  },
]
