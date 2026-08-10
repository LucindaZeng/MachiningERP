import type { DrawingVersionView } from '../dto/drawing-version-view.dto'
import type { DrawingVersionRecord } from '../repositories/drawing.repository.port'

/** 对象键不出这个门：前端要看文件走预览端点，不该拿到存储内部路径。 */
export function toDrawingVersionView(record: DrawingVersionRecord): DrawingVersionView {
  return {
    drawingVersionId: record.id,
    drawingNo: record.drawingNo,
    revision: record.revision,
    sequence: record.sequence,
    fileName: record.fileName,
    fileSize: record.fileSize,
    uploadedBy: record.uploadedBy,
    uploadedAt: record.uploadedAt.toISOString(),
  }
}
