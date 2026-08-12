import { Injectable } from '@nestjs/common'

import { SalesOrderService } from '../../contract-order'
import { UserDirectoryService } from '../../identity'
import { CustomerService } from '../../masterdata'
import { DrawingUploadService } from '../../quotation'

import type { EcnOrderFacts } from './ecn-scope.rules'

/** 详情页要展示的变更链路：图纸版本 ↔ BOM ↔ 报价版本。 */
export interface EcnLinkageView {
  drawingNo: string
  /** 变更前版本（REV A / REV B …） */
  fromRevision: string | null
  fromVersionId: string | null
  /** 变更后版本；改图之外的类型为空 */
  toRevision: string | null
  toVersionId: string | null
  bomRequestId: string | null
  quotationId: string | null
}

/**
 * 跨模块取数的唯一入口。
 *
 * 订单走 contract-order、图纸走 quotation 的图纸通道、客户走 masterdata、
 * 人名走 identity——四者都是对方 index.ts 上的公开出口，本模块不 import 任何内部文件。
 *
 * **图纸版本一律经 quotation 的 `DrawingUploadService`**：ECN 不另建上传路径。
 * 另建一条，图纸就会有两个版本序列，而「这张图现在是第几版」将没有答案。
 */
@Injectable()
export class EcnContextService {
  constructor(
    private readonly orders: SalesOrderService,
    private readonly customers: CustomerService,
    private readonly users: UserDirectoryService,
    private readonly drawings: DrawingUploadService,
  ) {}

  /**
   * 取订单事实供样品阶段判定。取不到（未关联订单、或订单已删）返回 null，
   * 由闸门按「无从判定则放行」处理——理由见 ecn-scope.rules。
   */
  async orderFacts(orderId: string | null): Promise<EcnOrderFacts | null> {
    if (!orderId) return null
    try {
      const order = await this.orders.load(orderId)
      return { orderType: order.orderType, docNo: order.docNo }
    } catch {
      return null
    }
  }

  async orderDocNo(orderId: string | null): Promise<string | null> {
    return (await this.orderFacts(orderId))?.docNo ?? null
  }

  /** 查不到姓名时退回工号——宁可显示工号，也不要显示空白。 */
  async displayName(userCode: string): Promise<string> {
    const user = await this.users.findByUserCode(userCode)
    return user?.displayName ?? userCode
  }

  async customerName(customerId: string): Promise<string> {
    try {
      return (await this.customers.profileFor(customerId)).name
    } catch {
      // 客户停用或删档不该让历史变更单打不开
      return customerId
    }
  }

  /** 组装变更链路。取不到某一版就留空，不编版本号。 */
  async linkage(input: {
    drawingNo: string
    drawingVersionId: string | null
    newDrawingVersionId: string | null
    bomRequestId: string | null
    quotationId: string | null
  }): Promise<EcnLinkageView> {
    const [from, to] = await Promise.all([
      this.revisionOf(input.drawingVersionId),
      this.revisionOf(input.newDrawingVersionId),
    ])

    return {
      drawingNo: input.drawingNo,
      fromRevision: from,
      fromVersionId: input.drawingVersionId,
      toRevision: to,
      toVersionId: input.newDrawingVersionId,
      bomRequestId: input.bomRequestId,
      quotationId: input.quotationId,
    }
  }

  private async revisionOf(versionId: string | null): Promise<string | null> {
    if (!versionId) return null
    try {
      return (await this.drawings.loadVersion(versionId)).revision
    } catch {
      return null
    }
  }
}
