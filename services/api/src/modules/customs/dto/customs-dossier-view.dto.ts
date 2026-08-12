import type { CustomsCorrectionView } from './customs-correction-view.dto'
import type { CustomsDeclarationView } from './customs-declaration-view.dto'
import type { CustomsDocumentView } from './customs-document-view.dto'
import type { DocTimelineNodeView } from '../../shipment'

/**
 * 报关资料的对外形状，对齐前端 `CustomsDossier`。
 *
 * `missingFields` 是**服务端算出来的**，不落库也不接受前端传入：
 * 它背后是一道硬闸门（要素不齐禁止生成资料包），而前端能算的东西前端就能绕过。
 */
export interface CustomsDossierView {
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
  totalAmount: { amount: string; currency: string }
  exchangeRate: string
  status: 'draft' | 'checking' | 'generated' | 'declared' | 'released'
  owner: string
  checkedBy?: string
  documents: CustomsDocumentView[]
  missingFields: string[]
  /** 本轮新增：清关必需要素，齐套校验会点名要它们 */
  shippingMarks?: string
  destinationPortCode?: string
  /** 本轮新增：申报快照与更正记录 */
  declarationVersion?: number
  declarations?: CustomsDeclarationView[]
  corrections?: CustomsCorrectionView[]
  timeline?: DocTimelineNodeView[]
  versionLock: number
}
