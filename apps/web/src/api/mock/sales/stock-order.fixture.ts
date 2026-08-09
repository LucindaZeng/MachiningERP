import type { StockOrder } from '@/types/sales.types'

/**
 * 备料订单库存：备料订单完工全部入库即视为完成，库存可被后续正式订单领用，
 * 领用部分按备料订单的单件生产成本计价，与新投产部分做加权平均。
 */
export const STOCK_ORDERS: StockOrder[] = [
  {
    id: 'ST1',
    docNo: 'SO-20260612-0061',
    productName: '连接器外壳 CNC 件',
    drawingNo: 'HS-4471-A',
    totalQty: '2000',
    usedQty: '1980',
    remainingQty: '20',
    unitCost: '10.00',
    currency: 'CNY',
    status: 'stocked',
    completedAt: '2026-06-28',
    owner: '罗晓琳',
  },
  {
    id: 'ST2',
    docNo: 'SO-20260520-0048',
    productName: '探头支架',
    drawingNo: 'RX-3390',
    totalQty: '1000',
    usedQty: '400',
    remainingQty: '600',
    unitCost: '17.20',
    currency: 'CNY',
    status: 'stocked',
    completedAt: '2026-06-05',
    owner: '陈志强',
  },
  {
    id: 'ST3',
    docNo: 'SO-20260722-0109',
    productName: '液压阀体',
    drawingNo: 'BR-2208',
    totalQty: '500',
    usedQty: '0',
    remainingQty: '0',
    unitCost: '86.40',
    currency: 'CNY',
    status: 'producing',
    owner: '陈志强',
  },
]
