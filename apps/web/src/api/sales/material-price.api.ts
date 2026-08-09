import { request } from '../http'

import type { MaterialPrice } from '@/types/sales.types'

/** GET /metal-prices/board —— 原材料价格表（业务视图：无供应商身份与底价） */
export function fetchMaterialPrices(): Promise<MaterialPrice[]> {
  return request<MaterialPrice[]>({ method: 'GET', url: '/metal-prices/board' })
}
