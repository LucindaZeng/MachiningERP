import type { TimelineNode } from './common.types'

/* ------------------------------ BOM 申请（ENG-02 / ENG-05） ------------------------------ */

export type BomRequestStatus =
  | 'draft'
  | 'submitted'
  | 'claimed'
  | 'returned'
  | 'bom-done'
  | 'all-done'
  | 'ordered'

export interface BomRequest {
  id: string
  docNo: string
  customerName: string
  quotationNo?: string
  customerPoNo?: string
  productName: string
  drawingNo: string
  drawingVersion: string
  material: string
  surfaceTreatment: string
  inspection: string
  packing: string
  quantity: string
  targetDeliveryDate: string
  /**
   * 申请用途：batch = 正式量产产品（建品号 + BOM + 工艺路线）；
   * mold = 模具（建模具编号，不建品号，模具不是可售产品）。
   * 样品订单不提 BOM 申请，因此这里没有 sample。
   */
  productionType: 'batch' | 'mold'
  /** 由样品转量产时回填的样品单号，用于把试做工时与实际成本带入首次量产 */
  fromSampleNo?: string
  specialRequirement?: string
  status: BomRequestStatus
  owner: string
  submittedAt?: string
  claimedAt?: string
  /** 工程退回等待时间（小时），退回重提时累计 */
  returnedHours?: number
  /** ENG-05 双状态：两者必须分别展示，不得合并为「全部工程完成」 */
  bomReady: boolean
  programReady: boolean
  /** 工程建立的编码：productionType=batch 时为品号，=mold 时为模具编号 */
  productCode?: string
  timeline: TimelineNode[]
}
