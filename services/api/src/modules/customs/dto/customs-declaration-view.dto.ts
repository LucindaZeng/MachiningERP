/** 一次申报的清单快照，对外形状（本轮新增的可选字段）。 */
export interface CustomsDeclarationView {
  version: number
  declaredAt: string
  declaredBy: string
  /** 这一版申报送出去的是哪几份文件的哪几版 */
  manifest: Array<{ templateCode: string; name: string; version: number }>
  receiptNo?: string
  receiptAt?: string
}
