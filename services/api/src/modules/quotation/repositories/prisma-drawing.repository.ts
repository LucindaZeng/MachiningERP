import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateDrawingVersionData,
  DrawingRepositoryPort,
  DrawingVersionRecord,
} from './drawing.repository.port'
import type { Drawing, DrawingVersion } from '@prisma/client'

type VersionRow = DrawingVersion & { drawing: Pick<Drawing, 'drawingNo'> }

function toRecord(row: VersionRow): DrawingVersionRecord {
  return {
    id: row.id,
    drawingId: row.drawingId,
    drawingNo: row.drawing.drawingNo,
    revision: row.revision,
    sequence: row.sequence,
    source: row.source,
    fileKey: row.fileKey,
    fileName: row.fileName,
    fileSize: row.fileSize,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
  }
}

@Injectable()
export class PrismaDrawingRepository implements DrawingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 图号 + 客户唯一。通用件没有客户，`customerId` 为 null——
   * Postgres 的唯一索引不把两个 NULL 当相等，所以这一支要单独查再建。
   */
  async ensureDrawing(input: {
    drawingNo: string
    customerId: string | null
    title: string | null
    createdBy: string
  }): Promise<{ id: string; drawingNo: string }> {
    const existing = await this.prisma.drawing.findFirst({
      where: { drawingNo: input.drawingNo, customerId: input.customerId },
      select: { id: true, drawingNo: true },
    })
    if (existing) return existing

    return this.prisma.drawing.create({
      data: {
        drawingNo: input.drawingNo,
        customerId: input.customerId,
        title: input.title,
        createdBy: input.createdBy,
      },
      select: { id: true, drawingNo: true },
    })
  }

  async latestSequence(drawingId: string): Promise<number> {
    const row = await this.prisma.drawingVersion.findFirst({
      where: { drawingId },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    })
    return row?.sequence ?? 0
  }

  async createVersion(data: CreateDrawingVersionData): Promise<DrawingVersionRecord> {
    const row = await this.prisma.drawingVersion.create({
      data,
      include: { drawing: { select: { drawingNo: true } } },
    })
    return toRecord(row)
  }

  async findVersion(id: string): Promise<DrawingVersionRecord | null> {
    const row = await this.prisma.drawingVersion.findUnique({
      where: { id },
      include: { drawing: { select: { drawingNo: true } } },
    })
    return row ? toRecord(row) : null
  }

  async listVersions(drawingId: string): Promise<DrawingVersionRecord[]> {
    const rows = await this.prisma.drawingVersion.findMany({
      where: { drawingId },
      orderBy: { sequence: 'asc' },
      include: { drawing: { select: { drawingNo: true } } },
    })
    return rows.map(toRecord)
  }
}
