import { Injectable, Logger } from '@nestjs/common'

import type {
  CostingAnalyticsPort,
  FinanceAnalyticsPort,
  MesAnalyticsPort,
  WmsAnalyticsPort,
} from './upstream-source.ports'

/**
 * ⚠️ STUB —— 四个上游模块（costing / finance / wms / mes）落地前的临时实现。
 *
 * 语义选择：**一律返回空行集，绝不返回零值行**。
 *
 * 这是本模块最容易做错、后果也最大的一处。填一行 `{ scrapRate: 0 }` 看起来
 * 「更完整」，但管理层看到的是「报废率 0%」——一份优异的经营数据，
 * 而实际情况是这块根本没接上。空行集配上 `pending` 说明，界面才会诚实地写
 * 「成本模块未上线」。
 *
 * 每个 stub 只在**首次**被调用时打一条 warn：分析接口会被反复轮询，
 * 每次都打会把日志淹掉，而这条信息本身是静态的。
 */
abstract class WarnOnceStub {
  protected readonly logger = new Logger(this.constructor.name)
  private warned = false

  protected warnOnce(domain: string): void {
    if (this.warned) return
    this.warned = true
    this.logger.warn(
      `${domain}分析使用 STUB 实现：返回空行集，对应面板将标记为「数据源未上线」。` +
        `${domain}模块落地后替换对应的 ANALYTICS_PORT provider，聚合逻辑不动。`,
    )
  }
}

@Injectable()
export class StubCostingAnalyticsAdapter extends WarnOnceStub implements CostingAnalyticsPort {
  async elementVariance() {
    this.warnOnce('成本')
    return []
  }

  async costDrill() {
    this.warnOnce('成本')
    return []
  }

  async operationVariance() {
    this.warnOnce('成本')
    return []
  }

  async costReference() {
    this.warnOnce('成本')
    return []
  }
}

@Injectable()
export class StubFinanceAnalyticsAdapter extends WarnOnceStub implements FinanceAnalyticsPort {
  async arAging() {
    this.warnOnce('财务')
    return []
  }
}

@Injectable()
export class StubWmsAnalyticsAdapter extends WarnOnceStub implements WmsAnalyticsPort {
  async stockProgress() {
    this.warnOnce('仓储')
    return []
  }

  async stockAging() {
    this.warnOnce('仓储')
    return []
  }

  async stockConsume() {
    this.warnOnce('仓储')
    return []
  }

  async stockIdle() {
    this.warnOnce('仓储')
    return []
  }
}

@Injectable()
export class StubMesAnalyticsAdapter extends WarnOnceStub implements MesAnalyticsPort {
  async productProcess() {
    this.warnOnce('制造执行')
    return []
  }

  async materialProcess() {
    this.warnOnce('制造执行')
    return []
  }
}
