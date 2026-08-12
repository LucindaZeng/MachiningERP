import type { GeneratedDocumentView } from '../dto/generated-document-view.dto'
import type { GeneratedDocumentRecord } from '../repositories/generated-document.repository.port'

/** 记录 → 视图。刻意丢掉 `objectKey`，理由见视图 DTO 的文件头。 */
export function toGeneratedDocumentView(record: GeneratedDocumentRecord): GeneratedDocumentView {
  return {
    id: record.id,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    sourceDocNo: record.sourceDocNo,
    templateId: record.templateId,
    templateVersion: record.templateVersion,
    fileName: record.fileName,
    sizeBytes: record.sizeBytes,
    documentCount: record.documentCount,
    generatedAt: record.generatedAt.toISOString(),
    generatedBy: record.generatedBy,
  }
}
