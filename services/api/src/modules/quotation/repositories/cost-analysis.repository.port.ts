import type { CostRates } from '../constants/cost-rates'
import type { ProcessColumn } from '../constants/process-columns'
import type { CostAnalysisStatus } from '@prisma/client'


export interface CostAnalysisLineRecord {
  id: string
  sequence: number
  blankType: string
  drawingNo: string
  drawingVersionId: string | null
  spec: string
  revision: string | null
  quantity: string
  material: string
  estimatedWeightKg: string
  netWeightKg: string
  scrapWeightKg: string
  scrapUnitPriceMinor: bigint
  materialUnitPriceMinor: bigint
  materialPriceOverridden: boolean
  materialPriceSourceId: string | null
  machiningMethod: string
  machiningMinutes: string
  machiningCostMinor: bigint
  processCosts: Record<string, bigint>
  remark: string | null
}

export interface CostAnalysisRecord {
  id: string
  docNo: string
  version: number
  rootId: string | null
  customerId: string
  productModel: string
  lossBps: number
  overheadBps: number
  vatBps: number
  currency: string
  processColumns: ProcessColumn[]
  status: CostAnalysisStatus
  preparedBy: string
  completedAt: Date | null
  lines: CostAnalysisLineRecord[]
  versionLock: number
}

export type CostAnalysisLineDraft = Omit<CostAnalysisLineRecord, 'id'>

export interface CreateCostAnalysisData {
  docNo: string
  version: number
  rootId: string | null
  customerId: string
  productModel: string
  lossBps: number
  overheadBps: number
  vatBps: number
  currency: string
  processColumns: ProcessColumn[]
  preparedBy: string
  createdBy: string
  lines: CostAnalysisLineDraft[]
}

/** 可调费率。默认 5%/5%/13% 只是初值，报价工程师随时可改。形状定义在 constants/。 */
export type CostRateData = CostRates

export interface CostAnalysisRepositoryPort {
  findById(id: string): Promise<CostAnalysisRecord | null>
  listByCustomer(customerId: string, limit: number): Promise<CostAnalysisRecord[]>
  create(data: CreateCostAnalysisData): Promise<CostAnalysisRecord>
  /** 带乐观锁的费率调整；版本冲突或已锁版返回 null */
  updateRates(
    id: string,
    versionLock: number,
    rates: CostRateData,
    updatedBy: string,
  ): Promise<CostAnalysisRecord | null>
  /** 带乐观锁的整表替换；版本冲突返回 null */
  replaceLines(
    id: string,
    versionLock: number,
    lines: CostAnalysisLineDraft[],
    updatedBy: string,
  ): Promise<CostAnalysisRecord | null>
  markCompleted(id: string, versionLock: number, at: Date): Promise<boolean>
  markLocked(id: string): Promise<void>
}

export const COST_ANALYSIS_REPOSITORY = Symbol('COST_ANALYSIS_REPOSITORY')
