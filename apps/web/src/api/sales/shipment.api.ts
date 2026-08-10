import { request } from '../http'

import type { Shipment } from '@/types/sales.types'

/** 出货单列表过滤条件，与后端 `GET /shipments` 的 query 对齐。 */
export interface ShipmentQuery {
  customerId?: string
  orderId?: string
  status?: string
  ownerUserCode?: string
  shippedFrom?: string
  shippedTo?: string
}

function toQueryString(query: ShipmentQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value)
    }
  }
  const search = params.toString()
  return search ? `?${search}` : ''
}

/** GET /shipments —— 销货出运单（SHP-01~06） */
export function fetchShipments(query?: ShipmentQuery): Promise<Shipment[]> {
  return request<Shipment[]>({ method: 'GET', url: `/shipments${toQueryString(query)}` })
}

/** GET /shipments/:id —— 出货单详情（含明细与节点计时） */
export function fetchShipment(id: string): Promise<Shipment> {
  return request<Shipment>({ method: 'GET', url: `/shipments/${id}` })
}

/** POST /shipments/tail-plan —— 尾数四路径处理：返工补交 / 入库 / 直接入库 / 报废 */
export function submitTailPlan(
  docNo: string,
  plan: string,
  remark?: string,
): Promise<{ docNo: string; plan: string }> {
  return request<{ docNo: string; plan: string }>({
    method: 'POST',
    url: '/shipments/tail-plan',
    body: { docNo, plan, remark },
  })
}

/**
 * SHP-02~06 与结案的动作端点。
 * 状态迁移一律走动作端点而不是 PATCH status，好让每一步的执行人与耗时都留痕。
 */
export function startPicking(id: string, versionLock: number): Promise<Shipment> {
  return action(id, 'pick', { versionLock })
}

export function packShipment(id: string, versionLock: number): Promise<Shipment> {
  return action(id, 'pack', { versionLock })
}

/** 出运发货：后端在这一步做品质放行 + 财务信用双闸门校验。 */
export function shipShipment(
  id: string,
  versionLock: number,
  carrier?: string,
  trackingNo?: string,
): Promise<Shipment> {
  return action(id, 'ship', { versionLock, carrier, trackingNo })
}

export function signShipment(id: string, versionLock: number): Promise<Shipment> {
  return action(id, 'sign', { versionLock })
}

export function invoiceShipment(
  id: string,
  versionLock: number,
  invoiceNo: string,
): Promise<Shipment> {
  return action(id, 'invoice', { versionLock, invoiceNo })
}

/** 结案：后端在这一步做尾数数量平衡校验（订单数 = 已发数 + 已处置尾数）。 */
export function closeShipment(id: string, versionLock: number): Promise<Shipment> {
  return action(id, 'close', { versionLock })
}

function action(id: string, verb: string, body: Record<string, unknown>): Promise<Shipment> {
  return request<Shipment>({ method: 'POST', url: `/shipments/${id}/${verb}`, body })
}
