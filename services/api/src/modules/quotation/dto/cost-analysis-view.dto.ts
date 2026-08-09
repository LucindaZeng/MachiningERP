import type { CostAnalysisLineView } from './cost-analysis-line-view.dto'
import type { ProcessColumn } from '../constants/process-columns'
import type { Money } from '@machining-erp/shared'



export interface CostAnalysisView {
  id: string
  docNo: string
  version: number
  customerId: string
  productModel: string
  /** 0.05 表示 5% */
  lossRatio: number
  overheadRatio: number
  vatRatio: number
  currency: string
  processColumns: ProcessColumn[]
  status: string
  preparedBy: string
  completedAt: string | null
  versionLock: number
  lines: CostAnalysisLineView[]
  total: Money
  totalWithVat: Money
}
