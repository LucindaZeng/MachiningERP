import { Injectable } from '@nestjs/common'

import { CustomsContextService } from './customs-context.service'
import { CustomsDocumentService } from './customs-document.service'
import { CustomsReadService } from './customs-read.service'
import { CustomsService, type CustomsActor } from './customs.service'

import type { CreateDossierDto } from '../dto/create-dossier.dto'
import type { CustomsDossierView } from '../dto/customs-dossier-view.dto'
import type { GenerateDocumentDto } from '../dto/generate-document.dto'
import type { CustomsDocKind } from '@prisma/client'

/**
 * 建档与出具的读写组装。
 *
 * 单拎一支 facade 是因为这两个用例都要「先取出货上下文、再动领域服务、再渲染视图」，
 * 三步都塞进 controller 就成了业务层，塞进领域服务又会让服务反过来依赖视图。
 */
@Injectable()
export class CustomsDocumentFacade {
  constructor(
    private readonly customs: CustomsService,
    private readonly documents: CustomsDocumentService,
    private readonly context: CustomsContextService,
    private readonly reads: CustomsReadService,
  ) {}

  /** 客户、订单、币种一律从原出货单带出；前端能传的东西，前端就能传错。 */
  async createAndView(dto: CreateDossierDto, actor: CustomsActor): Promise<CustomsDossierView> {
    const shipment = await this.context.shipmentContext(dto.shipmentId)

    const record = await this.customs.create(
      {
        shipmentId: shipment.shipmentId,
        orderId: shipment.orderId,
        customerId: shipment.customerId,
        tradeMode: dto.tradeMode,
        incoterm: dto.incoterm,
        portOfLoading: dto.portOfLoading,
        destination: dto.destination,
        destinationPortCode: dto.destinationPortCode ?? null,
        shippingMarks: dto.shippingMarks ?? null,
        hsCode: dto.hsCode,
        goodsNameCn: dto.goodsNameCn,
        goodsNameEn: dto.goodsNameEn ?? null,
        quantity: dto.quantity,
        unit: dto.unit,
        netWeight: dto.netWeight,
        grossWeight: dto.grossWeight,
        packages: dto.packages,
        currency: shipment.currency,
        unitPriceMinor: BigInt(dto.unitPriceMinor),
        totalAmountMinor: BigInt(dto.totalAmountMinor),
        exchangeRate: dto.exchangeRate,
        ownerUserCode: actor.userCode,
      },
      actor,
    )

    return this.reads.render(record)
  }

  async generateAndView(
    id: string,
    dto: GenerateDocumentDto,
    actor: CustomsActor,
  ): Promise<CustomsDossierView> {
    const dossier = await this.customs.load(id)
    const shipment = await this.context.shipmentContext(dossier.shipmentId)

    const record = await this.documents.generate(
      id,
      dto.versionLock,
      dto.kind as CustomsDocKind,
      {
        posted: shipment.posted,
        // 不传就用建档时的当日汇率；这一版的快照照样冻结在文件行上
        exchangeRate: dto.exchangeRate ?? dossier.exchangeRate,
      },
      actor,
    )

    return this.reads.render(record)
  }
}

/**
 * 【曾经写过一条币种判据，已删除】原本用「人民币结算 = 内销」来挡住误建的报关资料，
 * 直到 fixture CD3 打脸：香港代生产模具出境是**人民币结算的出口**，
 * 那条判据会把一份完全正当的报关资料拒之门外。
 *
 * 目前 schema 里没有任何可靠的「这票是不是外贸」的事实（目的地是自由文本，
 * 币种如上所述不成立）。与其发明一条会误伤的判据，不如不判：
 * 建报关资料本来就是业务员的明确动作，不是系统猜出来的。
 * 将来出货单上有了贸易性质字段，这道闸门再补。
 */
