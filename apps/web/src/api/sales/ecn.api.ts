import { request } from '../http'

import type { EcnProductionImpact, EngineeringChange } from '@/types/sales.types'

/**
 * 工程变更申请（ECN-01~05）。
 *
 * **受理范围由服务端硬拦**：改数量/交期/包装走订单修改申请，改价格走报价单修改申请，
 * 样品阶段的产品变更走报价变更。越界时后端会返回带「正确去处」的中文消息，
 * 前端一律原样显示——那句话才是用户真正需要的。
 */
export interface EcnQuery {
  customerId?: string
  orderId?: string
  status?: string
  changeType?: string
  ownerUserCode?: string
}

function toQueryString(query: EcnQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

export function fetchEngineeringChanges(query?: EcnQuery): Promise<EngineeringChange[]> {
  return request<EngineeringChange[]>({
    method: 'GET',
    url: `/engineering-changes${toQueryString(query)}`,
  })
}

export function fetchEngineeringChange(id: string): Promise<EngineeringChange> {
  return request<EngineeringChange>({ method: 'GET', url: `/engineering-changes/${id}` })
}

/** 服务端接受的四种类型；其余会被拒绝并指路。 */
export type EcnServerChangeType = 'DRAWING' | 'MATERIAL' | 'SURFACE' | 'PROCESS'

/** 前端那套小写枚举 → 服务端枚举。未登记的值原样传出去，由服务端点名拒绝。 */
export const SERVER_CHANGE_TYPE: Record<string, string> = {
  drawing: 'DRAWING',
  material: 'MATERIAL',
  surface: 'SURFACE',
  process: 'PROCESS',
}

/**
 * ECN-01 提交变更申请。
 *
 * `newDrawingVersionId` 在改图时必填——新版图纸经**报价模块既有的上传通道**产生，
 * ECN 不另建上传路径：另建一条，同一张图就会有两个版本序列。
 */
export function createEngineeringChange(payload: {
  customerId: string
  orderId?: string | null
  productName: string
  drawingNo: string
  drawingVersionId?: string | null
  newDrawingVersionId?: string | null
  bomRequestId?: string | null
  quotationId?: string | null
  changeType: string
  origin: 'CUSTOMER' | 'INTERNAL'
  urgent: boolean
  beforeValue: string
  afterValue: string
  reason: string
}): Promise<EngineeringChange> {
  return request<EngineeringChange>({ method: 'POST', url: '/engineering-changes', body: payload })
}

/** ECN-02 工程认领并开始评估。 */
export function startEcnAssessment(id: string, versionLock: number): Promise<EngineeringChange> {
  return action(id, 'start-assessment', { versionLock })
}

/** 退回业务补充说明——看不懂的变更不该硬着头皮评。 */
export function returnEcnForDetail(id: string, versionLock: number): Promise<EngineeringChange> {
  return action(id, 'return-for-detail', { versionLock })
}

/** ECN-02 保存影响评估。四项（在制/已采购/已完工/已发货）整表提交。 */
export function assessEcnImpact(
  id: string,
  versionLock: number,
  payload: {
    impacts: Array<{ scope: string; quantity: string; amountMinor?: string | null; note: string }>
    /** 对生产有无影响（规格第 6 章新增规则）。未判定的单据服务端不放行送会签。 */
    productionImpact: EcnProductionImpact
    routingUpdated: boolean
    effectiveBatch?: string | null
    needRequote: boolean
    needOrderReapproval: boolean
  },
): Promise<EngineeringChange> {
  return action(id, 'assess', { versionLock, ...payload })
}

/**
 * PMC 录入已投产（车床/CNC 已动）数量。**整表提交**，与影响评估同一套理由：
 * 逐条追加会让「清点完了没有」变成一个要靠人记的状态。
 *
 * 返工一经发起即锁死，此时服务端返回 ORD_3015，界面把入口收起来。
 */
export function enterEcnAffectedQuantities(
  id: string,
  versionLock: number,
  lines: Array<{ productName: string; drawingNo: string; affectedQty: string; note?: string | null }>,
): Promise<EngineeringChange> {
  return action(id, 'affected-quantities', { versionLock, lines })
}

/** 发起返工：服务端发出带新旧图纸版本与逐行数量的返工事件，并锁死数量。 */
export function initiateEcnRework(id: string, versionLock: number): Promise<EngineeringChange> {
  return action(id, 'initiate-rework', { versionLock })
}

/** ECN-03 送跨部门会签；四项影响未评全会被服务端拒绝。 */
export function submitEcnForSignoff(id: string, versionLock: number): Promise<EngineeringChange> {
  return action(id, 'submit-signoff', { versionLock })
}

/** ECN-03 记录会签。各部门模块上线前由工程代签，服务端逐条标记代签。 */
export function signoffEcn(
  id: string,
  versionLock: number,
  opinion?: string | null,
): Promise<EngineeringChange> {
  return action(id, 'signoff', { versionLock, opinion })
}

/** ECN-04 批准发布；改图未同步工艺路线、改工序未指定批次都会被拒绝。 */
export function approveEcn(id: string, versionLock: number): Promise<EngineeringChange> {
  return action(id, 'approve', { versionLock })
}

/** ECN-04 驳回。中文理由必填，服务端会随通知送到发起的业务员手上。 */
export function rejectEcn(
  id: string,
  versionLock: number,
  reason: string,
): Promise<EngineeringChange> {
  return action(id, 'reject', { versionLock, reason })
}

export function executeEcn(id: string, versionLock: number): Promise<EngineeringChange> {
  return action(id, 'execute', { versionLock })
}

export function closeEcn(id: string, versionLock: number): Promise<EngineeringChange> {
  return action(id, 'close', { versionLock })
}

function action(id: string, verb: string, body: Record<string, unknown>): Promise<EngineeringChange> {
  return request<EngineeringChange>({
    method: 'POST',
    url: `/engineering-changes/${id}/${verb}`,
    body,
  })
}
