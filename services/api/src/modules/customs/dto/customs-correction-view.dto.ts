/** 申报后的更正记录，对外形状（本轮新增的可选字段）。 */
export interface CustomsCorrectionView {
  seq: number
  /** 更正理由，必填且为中文 */
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
