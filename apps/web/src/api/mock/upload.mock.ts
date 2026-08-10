import { UPLOAD_ACCEPT_ATTRIBUTE, extensionOf, isUploadable } from '@machining-erp/shared'

import { BizError } from '../biz-error'

import type { UploadOptions } from '../http'

/**
 * 上传的 mock：不起 MinIO 也能把「选文件 → 进度 → 成功/失败」整条交互走通。
 *
 * 校验规则**与后端同源**（都用 shared 的 `isUploadable`），
 * 所以 mock 下拒掉的类型在真实环境同样会被拒——这正是 mock 该有的价值，
 * 否则接上真后端才发现规则不一样，等于白演示一遍。
 */
let sequence = 0

export async function dispatchUploadMock<T>(options: UploadOptions): Promise<T> {
  const fileName = options.file.name

  if (!isUploadable(fileName)) {
    throw new BizError({
      code: 'SYS_9041',
      message: `不支持上传 .${extensionOf(fileName) || '(无扩展名)'} 文件，允许：${UPLOAD_ACCEPT_ATTRIBUTE}`,
      status: 415,
    })
  }

  await simulateProgress(options.onProgress)

  if (options.url === '/quotations/drawings') {
    sequence += 1
    const revision = options.fields?.revision || `REV ${String.fromCharCode(64 + sequence)}`
    return {
      drawingVersionId: `DV-MOCK-${sequence}`,
      drawingNo: options.fields?.drawingNo ?? 'MT-0000',
      revision,
      sequence,
      fileName,
      fileSize: options.file.size,
      uploadedBy: 'WFX-2018-0042',
      uploadedAt: new Date().toISOString(),
    } as T
  }

  return {
    objectKey: `orders/customer-po/staging/mock-${(sequence += 1)}/${fileName}`,
    fileName,
    fileSize: options.file.size,
    boundOrderId: options.fields?.orderId ?? null,
  } as T
}

/** 分几步推进度，好让进度条真的动起来而不是从 0 直接跳 100。 */
async function simulateProgress(onProgress?: (percent: number) => void): Promise<void> {
  for (const percent of [15, 45, 80, 100]) {
    await new Promise((resolve) => setTimeout(resolve, 90))
    onProgress?.(percent)
  }
}
