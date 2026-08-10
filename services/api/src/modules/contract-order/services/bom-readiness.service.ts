import { Injectable, type OnModuleInit } from '@nestjs/common'

import { DOMAIN_EVENTS, DomainEventPublisher } from '../../../platform/events'

/**
 * 「这条产品行的 BOM 建好了没」——下单前置校验链要用的那一条事实。
 *
 * 数据来自 bom-request 模块发出的 `engineering.bom-request.bom-ready` 事件，
 * **不 import 对方任何内部文件**（开发指南 3.4：跨模块只走 index.ts 或领域事件）。
 *
 * 认的是 `bom-ready` 而不是 `completed`：加工程序编制（ENG-04）与订单审批、
 * 采购并行跑，程序卡的是开工，不是下单。等 `completed` 会白白压住整条下单链。
 *
 * 在此之前这条事实是个占位实现——「订单行上填了 BOM 申请号就算数」，
 * 意味着业务员随手敲个单号就能绕过工程闸门。现在改成只认事件。
 *
 * 内存索引只是读模型：进程重启后由出箱表重放补齐；
 * 查不到时回落到「订单行是否已关联工程回填的品号」，避免重启窗口内全部误判为未完成。
 */
@Injectable()
export class BomReadinessService implements OnModuleInit {
  /** key: 报价行 id —— 订单行正是按报价行建起来的 */
  private readonly readyQuotationItems = new Set<string>()
  private readonly readyDrawings = new Set<string>()

  constructor(private readonly events: DomainEventPublisher) {}

  onModuleInit(): void {
    this.events.subscribe(DOMAIN_EVENTS.BOM_REQUEST_BOM_READY, (event) => {
      const payload = event.payload as {
        quotationItemId?: string | null
        drawingNo?: string | null
      }
      if (payload.quotationItemId) this.readyQuotationItems.add(payload.quotationItemId)
      if (payload.drawingNo) this.readyDrawings.add(payload.drawingNo)
    })
  }

  /**
   * 按报价行判定；报价行为空时退回按图号判定
   * （样品转量产这类场景下订单行可能没挂报价行）。
   */
  isReady(quotationItemId: string | null, drawingNo: string): boolean {
    if (quotationItemId && this.readyQuotationItems.has(quotationItemId)) return true
    return this.readyDrawings.has(drawingNo)
  }

  /** 供出箱表重放时补齐读模型。 */
  markReady(quotationItemId: string | null, drawingNo: string | null): void {
    if (quotationItemId) this.readyQuotationItems.add(quotationItemId)
    if (drawingNo) this.readyDrawings.add(drawingNo)
  }
}
