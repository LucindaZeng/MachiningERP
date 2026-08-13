/**
 * 影响评估的提交形状。
 *
 * 单独一个文件而不是写在 dialog 的 `<script setup>` 里：
 * `<script setup>` 不能 export 类型，而页面那一侧要用同一个形状把它转发给接口。
 */
import type { EcnProductionImpact } from '@/types/sales.types'

export interface AssessPayload {
  impacts: Array<{ scope: string; quantity: string; amountMinor: string | null; note: string }>
  /**
   * 对生产有无影响（规格第 6 章新增规则）。必填——它决定后面要不要
   * 由 PMC 清点已投产数量、要不要走返工，不填等于把这两步一起跳过。
   */
  productionImpact: EcnProductionImpact
  routingUpdated: boolean
  /** 中途改工序的生效批次版本 */
  effectiveBatch: string | null
  needRequote: boolean
  needOrderReapproval: boolean
}
