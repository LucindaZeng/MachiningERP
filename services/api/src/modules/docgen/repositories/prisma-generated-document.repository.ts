import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infrastructure/prisma/prisma.service'

import type {
  CreateGeneratedDocumentData,
  GeneratedDocumentQuery,
  GeneratedDocumentRecord,
  GeneratedDocumentRepositoryPort,
} from './generated-document.repository.port'
import type { GeneratedDocument } from '@prisma/client'

const DEFAULT_LIMIT = 50

/** 薄适配器：只做数据访问，不含任何业务规则。 */
@Injectable()
export class PrismaGeneratedDocumentRepository implements GeneratedDocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateGeneratedDocumentData): Promise<GeneratedDocumentRecord> {
    return toRecord(await this.prisma.generatedDocument.create({ data }))
  }

  async findById(id: string): Promise<GeneratedDocumentRecord | null> {
    const row = await this.prisma.generatedDocument.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  }

  async list(query: GeneratedDocumentQuery): Promise<GeneratedDocumentRecord[]> {
    const rows = await this.prisma.generatedDocument.findMany({
      where: {
        ...(query.sourceType ? { sourceType: query.sourceType } : {}),
        ...(query.sourceId ? { sourceId: query.sourceId } : {}),
        ...(query.generatedBy ? { generatedBy: query.generatedBy } : {}),
      },
      orderBy: { generatedAt: 'desc' },
      take: query.limit ?? DEFAULT_LIMIT,
    })
    return rows.map(toRecord)
  }
}

function toRecord(row: GeneratedDocument): GeneratedDocumentRecord {
  return {
    id: row.id,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceDocNo: row.sourceDocNo,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    objectKey: row.objectKey,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    documentCount: row.documentCount,
    generatedAt: row.generatedAt,
    generatedBy: row.generatedBy,
  }
}
