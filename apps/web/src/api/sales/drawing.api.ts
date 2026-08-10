import { upload } from '../http'

import type { UploadOptions } from '../http'

/** 图纸上传回执；`drawingVersionId` 是下游唯一要记住的东西。 */
export interface DrawingVersionView {
  drawingVersionId: string
  drawingNo: string
  revision: string
  sequence: number
  fileName: string
  fileSize: number
  uploadedBy: string
  uploadedAt: string
}

export interface UploadDrawingInput {
  file: File
  drawingNo: string
  customerId?: string
  title?: string
  /** 不填则由后端按序号自动生成 REV A / REV B */
  revision?: string
  onProgress?: UploadOptions['onProgress']
}

/**
 * POST /quotations/drawings —— 上传图纸并产生新版本。
 * 一次上传，核价与建 BOM 共用同一个版本，下游不再重传。
 */
export function uploadDrawing(input: UploadDrawingInput): Promise<DrawingVersionView> {
  return upload<DrawingVersionView>({
    url: '/quotations/drawings',
    file: input.file,
    fields: {
      drawingNo: input.drawingNo,
      customerId: input.customerId,
      title: input.title,
      revision: input.revision,
    },
    onProgress: input.onProgress,
  })
}
