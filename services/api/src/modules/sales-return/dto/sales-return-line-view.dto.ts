import type { DispositionWire, ResponsibilityWire } from '../constants/return-dispositions'

/**
 * 退货明细行的对外形状，对齐前端 `ReturnLine`。
 *
 * `responsibility` / `disposition` 是**本轮新增的可选字段**：
 * 责任归属与处置方式的真相在行上（一张 RMA 可以同时有本厂与委外责任），
 * 单头那两个同名字段是派生视图。既有页面不读这两个字段也照样工作。
 */
export interface SalesReturnLineView {
  seq: number
  productName: string
  drawingNo: string
  batchNo: string
  returnQty: string
  reason: string
  amount: string
  responsibility?: ResponsibilityWire
  disposition?: DispositionWire
  dispositionNote?: string
  /** 让步接收谈定的减价额 */
  allowance?: string
  /** 不良品实物入库时间；返工行没有它就不能开工 */
  receivedAt?: string
  receivedQty?: string
  settledByCreditNote?: boolean
  creditNoteDocNo?: string
}
