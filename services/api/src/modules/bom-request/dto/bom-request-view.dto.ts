/**
 * BOM 申请对外表示。
 *
 * `bomReady` 与 `programReady` **分别透出**，契约里没有「全部工程完成」这种合并字段——
 * 前端要分开显示（ENG-05 硬性 UI 要求），契约层就不给合并的可能。
 */
export interface BomRequestView {
  id: string
  docNo: string
  customerId: string
  quotationId: string | null
  quotationItemId: string | null
  customerPoNo: string | null
  productName: string
  drawingNo: string
  drawingVersionId: string | null
  drawingVersion: string
  material: string
  surfaceTreatment: string
  inspection: string
  packing: string
  quantity: string
  targetDeliveryDate: string | null
  productionType: string
  fromSampleNo: string | null
  specialRequirement: string | null
  status: string
  ownerUserCode: string
  submittedAt: string | null
  claimedAt: string | null
  claimedBy: string | null
  /** 工程退回累计等待小时数 */
  returnedHours: number
  returnReason: string | null
  bomReady: boolean
  programReady: boolean
  bomReadyAt: string | null
  programReadyAt: string | null
  /** 量产是品号，模具是模具编号 */
  productCode: string | null
  /** BOM 好了就能下单，不必等程序 */
  canPlaceOrder: boolean
  versionLock: number
}
