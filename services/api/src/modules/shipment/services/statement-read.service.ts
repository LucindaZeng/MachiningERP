import { Injectable } from '@nestjs/common'

import { ShipmentContextService } from './shipment-context.service'
import { toStatementView } from './statement-view.mapper'
import { StatementService } from './statement.service'

import type { StatementView } from '../dto/statement-view.dto'
import type {
  StatementQuery,
  StatementRecord,
} from '../repositories/statement.repository.port'

/** 读侧组装：对账记录 + 客户抬头 + 业务员姓名 → 前端形状。 */
@Injectable()
export class StatementReadService {
  constructor(
    private readonly statements: StatementService,
    private readonly context: ShipmentContextService,
  ) {}

  async render(record: StatementRecord): Promise<StatementView> {
    const [customer, ownerName] = await Promise.all([
      this.context.customerContext(record.customerId),
      this.context.displayName(record.ownerUserCode),
    ])

    return toStatementView(record, {
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      ownerName,
    })
  }

  async list(query: StatementQuery): Promise<StatementView[]> {
    const records = await this.statements.list(query)
    return Promise.all(records.map((record) => this.render(record)))
  }

  async detail(id: string): Promise<StatementView> {
    return this.render(await this.statements.load(id))
  }
}
