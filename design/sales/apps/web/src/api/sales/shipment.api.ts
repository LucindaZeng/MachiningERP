import { request } from '../http'
import type { Shipment } from '@/types/sales.types'

/** GET /shipments —— 销货出运单（SHP-01~06，本轮补充设计） */
export function fetchShipments(): Promise<Shipment[]> {
  return request<Shipment[]>({ method: 'GET', url: '/shipments' })
}

/** POST /shipments/tail-plan —— 尾数四路径处理：返工补交 / 入库 / 直接入库 / 报废 */
export function submitTailPlan(docNo: string, plan: string): Promise<{ docNo: string; plan: string }> {
  return request<{ docNo: string; plan: string }>({
    method: 'POST',
    url: '/shipments/tail-plan',
    body: { docNo, plan },
  })
}
