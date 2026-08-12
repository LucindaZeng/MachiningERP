import type { Money, TimelineNode } from './common.types'

/* ------------------------------ 报关资料 EXP（本轮补充） ------------------------------ */

export type CustomsStatus = 'draft' | 'checking' | 'generated' | 'declared' | 'released'

/**
 * 报关文件的一个版本。
 *
 * **形式发票与商业发票是两份不同的单据**：形式发票在出货前按订单数据开，
 * 用途是开信用证与收预付款；商业发票在出货后按实发数量开，海关据以清关。
 * 因此这里恒定有五格（EXP-PIN / EXP-INV / EXP-PKL / EXP-CON / EXP-DEC），
 * 没生成的显示 '—'。
 */
export interface CustomsDocument {
  templateCode: string
  name: string
  /** 展示值：'V2' 或未生成时的 '—' */
  version: string
  generatedAt?: string
  /** 数值版本号；未生成时不下发 */
  versionNo?: number
  /** 该版本的 id，预览按 `(customs-document, documentId)` 取文件 */
  documentId?: string
  /** 本版出具那一刻的汇率快照 */
  exchangeRate?: string
  /** 已登记版本但尚未真正出文件（docgen 接入前）——禁用下载与预览 */
  pending?: boolean
}

/** 一次申报的清单快照：这一版到底送出去了哪几份文件的哪几版。 */
export interface CustomsDeclarationSnapshot {
  version: number
  declaredAt: string
  declaredBy: string
  manifest: Array<{ templateCode: string; name: string; version: number }>
  receiptNo?: string
  receiptAt?: string
}

/** 申报之后的更正记录。理由必填——已申报资料是对海关的正式陈述。 */
export interface CustomsCorrection {
  seq: number
  reason: string
  affectedDocuments: Array<{
    templateCode: string
    name: string
    fromVersion: number
    toVersion: number
  }>
  resultingDeclarationVersion: number
  createdBy: string
  createdAt: string
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
  /**
   * 还缺哪些要素（中文标签）。**由服务端算出**，不落库也不接受前端传入——
   * 它背后是一道硬闸门（要素不齐禁止生成资料包），前端能算的东西前端就能绕过。
   */
  missingFields: string[]
  /** 本轮新增：清关必需要素，齐套校验会点名要它们 */
  shippingMarks?: string
  destinationPortCode?: string
  /** 本轮新增：申报快照与更正记录 */
  declarationVersion?: number
  declarations?: CustomsDeclarationSnapshot[]
  corrections?: CustomsCorrection[]
  timeline?: TimelineNode[]
  versionLock?: number
}
