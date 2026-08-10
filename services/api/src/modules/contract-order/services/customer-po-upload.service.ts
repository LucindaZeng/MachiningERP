import { randomUUID } from 'node:crypto'

import { ORDER_ERRORS, PERMISSION_CODES, UPLOAD_ERRORS } from '@machining-erp/shared'
import { Inject, Injectable } from '@nestjs/common'

import { BizError } from '../../../common/errors/biz-error'
import { AuditService } from '../../../platform/audit'
import { ObjectStorageService, assertUploadAllowed } from '../../../platform/object-storage'
import { isOrderEditable } from '../constants/order-states'
import {
  SALES_ORDER_REPOSITORY,
  type SalesOrderRepositoryPort,
} from '../repositories/sales-order.repository.port'

import type { OrderActor } from './sales-order.service'

export interface CustomerPoUploadInput {
  /** 已存在的订单 id；建单表单里还没有订单时留空，走 staging */
  orderId: string | null
  fileName: string
  contentType: string
  content: Buffer
}

export interface CustomerPoUploadResult {
  objectKey: string
  fileName: string
  fileSize: number
  /** 已绑定到订单时为订单 id；staging 时为 null */
  boundOrderId: string | null
}

/**
 * 客户订单原件上传（业务规格 4.1）。
 *
 * 沿用「订单上一列字符串」的既有模型，不另建附件表。由此带来一个真实的时序问题：
 * 建单表单里**订单还不存在**，没有 id 可挂。因此支持两条路径——
 * - 传了 `orderId`（在已有订单上补传）：当场写进 `customerPoFile`，
 *   预览随即可用（file-preview 的 `order-customer-po` 按订单 id 解析）；
 * - 没传（新建表单里先传文件后建单）：落到 staging 键并把键回给前端，
 *   建单请求带上这个键，订单落库时列就有值了。
 *
 * 必传闸门本身不在这里——它已经住在 `order-prerequisites` 的 `customerPoIssues`
 * 里（模具与正常订单必传、收费样品必传、免费样品与备料豁免），
 * 建单与送审都会跑到。这里只负责把文件放好、把键给出去。
 */
@Injectable()
export class CustomerPoUploadService {
  constructor(
    private readonly storage: ObjectStorageService,
    private readonly audit: AuditService,
    @Inject(SALES_ORDER_REPOSITORY) private readonly orders: SalesOrderRepositoryPort,
  ) {}

  static assertCanUpload(actor: OrderActor): void {
    if (!actor.permissions.includes(PERMISSION_CODES.SALES_OPERATE)) {
      throw new BizError(ORDER_ERRORS.SALES_ROLE_REQUIRED)
    }
  }

  async upload(input: CustomerPoUploadInput, actor: OrderActor): Promise<CustomerPoUploadResult> {
    CustomerPoUploadService.assertCanUpload(actor)
    assertUploadAllowed(
      { fileName: input.fileName, sizeBytes: input.content.length, content: input.content },
      { maxBytes: this.storage.config.maxUploadBytes },
    )

    const order = input.orderId ? await this.loadEditableOrder(input.orderId) : null
    // staging 用随机段而不是文件名：同名文件反复上传不会互相覆盖，
    // 也就守住了「已上传对象不可变」这条
    const reference = order ? order.docNo : `staging/${randomUUID()}`
    const objectKey = composeCustomerPoObjectKey(reference, input.fileName)

    await this.storage.putImmutable(objectKey, input.content, input.contentType)

    if (order) {
      await this.orders.setCustomerPoFile(order.id, objectKey, actor.userCode)
    }

    await this.audit.record({
      actorUserCode: actor.userCode,
      action: 'order.customer-po.upload',
      entityType: 'SalesOrder',
      entityId: order?.docNo ?? null,
      after: {
        objectKey,
        fileName: input.fileName,
        fileSize: input.content.length,
        staged: order === null,
      },
    })

    return {
      objectKey,
      fileName: input.fileName,
      fileSize: input.content.length,
      boundOrderId: order?.id ?? null,
    }
  }

  /** 已送审的订单不接受换原件——那份文件已经是审核依据的一部分。 */
  private async loadEditableOrder(orderId: string): Promise<{ id: string; docNo: string }> {
    const order = await this.orders.findById(orderId)
    if (!order) throw new BizError(ORDER_ERRORS.ORDER_NOT_FOUND)

    if (!isOrderEditable(order.status)) {
      throw new BizError(UPLOAD_ERRORS.IMMUTABLE_OBJECT, {
        message: `订单 ${order.docNo} 已进入审核流程，不能更换客户订单原件`,
        details: { orderId, status: order.status },
      })
    }

    return { id: order.id, docNo: order.docNo }
  }
}

/** 客户订单原件的对象键。与图纸不同，这里没有版本概念，靠单据号/随机段隔离。 */
export function composeCustomerPoObjectKey(reference: string, fileName: string): string {
  const safeReference = reference
    .split('/')
    .map((segment) => segment.replace(/[^\w.\-一-龥]+/gu, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('/')
  const safeName = fileName.replace(/[^\w.\-一-龥]+/gu, '-').replace(/^-|-$/g, '')

  return `orders/customer-po/${safeReference || 'unknown'}/${safeName || 'file'}`
}
