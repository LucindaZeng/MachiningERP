import type { DrawingSource } from '@prisma/client'

export interface DrawingVersionRecord {
  id: string
  drawingId: string
  drawingNo: string
  revision: string
  sequence: number
  source: DrawingSource
  fileKey: string
  fileName: string
  fileSize: number
  uploadedBy: string
  uploadedAt: Date
}

export interface CreateDrawingVersionData {
  drawingId: string
  revision: string
  sequence: number
  source: DrawingSource
  fileKey: string
  fileName: string
  fileSize: number
  uploadedBy: string
}

export interface DrawingRepositoryPort {
  /** 图号 + 客户唯一定位一张图纸；没有就建一张。 */
  ensureDrawing(input: {
    drawingNo: string
    customerId: string | null
    title: string | null
    createdBy: string
  }): Promise<{ id: string; drawingNo: string }>
  /** 现有最大版本序号；没有版本时返回 0。 */
  latestSequence(drawingId: string): Promise<number>
  createVersion(data: CreateDrawingVersionData): Promise<DrawingVersionRecord>
  findVersion(id: string): Promise<DrawingVersionRecord | null>
  listVersions(drawingId: string): Promise<DrawingVersionRecord[]>
}

export const DRAWING_REPOSITORY = Symbol('DRAWING_REPOSITORY')
