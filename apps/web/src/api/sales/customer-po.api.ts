import { upload } from '../http'

import type { UploadOptions } from '../http'

export interface CustomerPoUploadView {
  objectKey: string
  fileName: string
  fileSize: number
  /** 已挂到订单上时为订单 id；建单表单里先传文件时为 null */
  boundOrderId: string | null
}

export interface UploadCustomerPoInput {
  file: File
  /** 已有订单时传，建单表单里不传（暂存，建单时把 objectKey 带上） */
  orderId?: string
  onProgress?: UploadOptions['onProgress']
}

/** POST /sales-orders/customer-po —— 上传客户订单原件。 */
export function uploadCustomerPo(input: UploadCustomerPoInput): Promise<CustomerPoUploadView> {
  return upload<CustomerPoUploadView>({
    url: '/sales-orders/customer-po',
    file: input.file,
    fields: { orderId: input.orderId },
    onProgress: input.onProgress,
  })
}
