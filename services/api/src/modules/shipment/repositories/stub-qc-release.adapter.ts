import { Injectable, Logger } from '@nestjs/common'

import type { QcReleasePort, QcReleaseQuery, QcReleaseVerdict } from './qc-release.port'

/**
 * ⚠️ STUB —— QMS 模块落地前的临时 provider，**不是**最终实现。
 *
 * 语义选择：默认「已放行」。理由是没有 QMS 的时候检验结论根本不存在，
 * 若默认拦截，出货链在 QMS 上线前完全走不通，等于把未完成的模块变成阻断器。
 * 但这是一个会放行不合格品的选择，所以每次调用都打一条 warn，
 * 让它在日志里显眼到不可能被忘记。QMS 上线后把本类从 shipment.module.ts
 * 的 provider 里换掉即可，判定逻辑（ship-gate.rules.ts）无需改动。
 */
@Injectable()
export class StubQcReleaseAdapter implements QcReleasePort {
  private readonly logger = new Logger(StubQcReleaseAdapter.name)

  async verdictFor(query: QcReleaseQuery): Promise<QcReleaseVerdict> {
    this.logger.warn(
      `品质放行使用 STUB 实现，默认放行：图号 ${query.drawingNo} 批次 ${query.batchNo}。` +
        'QMS 模块落地后必须替换 QC_RELEASE_PORT 的 provider。',
    )
    return { released: true, reason: null, inspectionNo: null }
  }
}
