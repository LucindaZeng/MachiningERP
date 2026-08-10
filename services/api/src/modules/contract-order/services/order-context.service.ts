import { Injectable } from '@nestjs/common'

import { CustomerService } from '../../masterdata'

import { BomReadinessService } from './bom-readiness.service'

import type { OrderContext, OrderActor } from './sales-order.service'
import type { CreateSalesOrderDto } from '../dto/create-sales-order.dto'

/**
 * 组装下单强制校验需要的**外部事实**。
 *
 * 客户档案是否补全由 masterdata 判定，走它 `index.ts` 出口暴露的 `completeness()`——
 * 跨模块只能经公开出口或领域事件，禁止 import 别人的内部文件（开发指南 3.4）。
 * 这里刻意不复制一份「什么算补全」的判断：那条规则属于客户档案，不属于订单。
 *
 * BOM 是否建立完成来自 bom-request 发出的领域事件（`BomReadinessService`），
 * 不再靠「行上填了 BOM 申请号就算数」那个占位实现——那等于业务员随手敲个单号
 * 就能绕过工程闸门。
 */
@Injectable()
export class OrderContextService {
  constructor(
    private readonly customers: CustomerService,
    private readonly bomReadiness: BomReadinessService,
  ) {}

  async build(dto: CreateSalesOrderDto, actor: OrderActor): Promise<OrderContext> {
    const completeness = await this.customers.completeness(dto.customerId, {
      userCode: actor.userCode,
      permissions: [...actor.permissions],
    })

    return {
      customerReadyForOrder: completeness.ready,
      bomConfirmed: this.resolveBomStatus(dto),
    }
  }

  /** 只认 bom-request 发出的完成事件，不认订单行上手填的申请号。 */
  private resolveBomStatus(dto: CreateSalesOrderDto): Record<number, boolean> {
    return Object.fromEntries(
      dto.lines.map((line) => [
        line.sequence,
        this.bomReadiness.isReady(line.quotationItemId ?? null, line.drawingNo),
      ]),
    )
  }
}
