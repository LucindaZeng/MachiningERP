import type { Money } from './common.types'

/* ------------------------------ 报关资料 EXP（本轮补充） ------------------------------ */

export type CustomsStatus = 'draft' | 'checking' | 'generated' | 'declared' | 'released'

export interface CustomsDocument {
  templateCode: string
  name: string
  version: string
  generatedAt?: string
}

export interface CustomsDossier {
  id: string
  docNo: string
  shipmentNo: string
  orderNo: string
  customerName: string
  tradeMode: string
  incoterm: string
  portOfLoading: string
  destination: string
  hsCode: string
  goodsNameCn: string
  goodsNameEn: string
  quantity: string
  unit: string
  netWeight: string
  grossWeight: string
  packages: string
  unitPrice: string
  totalAmount: Money
  exchangeRate: string
  status: CustomsStatus
  owner: string
  checkedBy?: string
  documents: CustomsDocument[]
  missingFields: string[]
}
